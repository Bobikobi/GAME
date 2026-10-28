"""The first map's plan, drawn from code (NEXT 19 item 0). Run from the repo root: python3 .scratch/first-map/plan.py

Builds a 192 x 192 raster of the plan for variant A (the proposal), B (a floor of 72 x 72) and C (two passes),
measures it (walking distances, straight runs of paths, danger bands, the first bridge's view) and writes the images.
Every number the plan page prints comes from here.
"""
import json
import math
import random
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
N = 192
SHIFT = (66, 84)  # the old valley's block moves rigidly by this (content/core/map.json: x 0..47, y 0..63)
FLOOR = (48, 48, 143, 143)  # x0, y0, x1, y1 inclusive: 96 x 96
INNER = (60, 60, 131, 131)  # the 72 x 72 core, variant B's floor
SOLID = set('T~^%AF')
BAND_STEPS = 64  # G64: one danger level per 64 steps (the draft's default band, one chunk)

OLD = json.loads((ROOT / 'content/core/map.json').read_text())['map']
OLD_GROUND = OLD['ground']

# the three starting areas (wake tiles, new coordinates): proposals
STARTS = {'N': ('North meadow', (72, 68)), 'W': ('West bank', (67, 95)), 'S': ('Slid bank', (68, 121))}
BRIDGE = (80, 101)  # the old bridge's middle (old (13..15, 17..18) + shift)
TOWN = (96, 92)  # the town square's middle (old (26..29, 7..10) + shift is (92..95, 91..94))
AREA_R = 7  # pocket_grown in content/core/pockets


def noise(x, y, k=0.0):
    return (math.sin(x * 0.21 + k) + math.sin(y * 0.17 - k * 1.3) + math.sin((x + y) * 0.11 + 2 * k) + math.sin((x - y) * 0.07)) / 4


def repair(route, limit=7):
    """No straight run over `limit` tiles (G69 is 8): a long run gets a two-tile sidestep in its middle."""
    route = list(route)
    again = True
    while again:
        again = False
        i = 0
        while i < len(route) - 1:
            d = (route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1])
            j = i
            while j + 1 < len(route) and (route[j + 1][0] - route[j][0], route[j + 1][1] - route[j][1]) == d:
                j += 1
            if j - i + 1 > limit:
                k = (i + j) // 2
                q = (d[1], d[0]) if d[0] == 0 else (0, 1)
                q = (q[0] or 0, q[1] or 0)
                if d[0] == 0:
                    q = (1, 0)
                else:
                    q = (0, 1)
                t = route[k:k + 3]
                if len(t) < 3:
                    i = j
                    continue
                a = (t[0][0] + q[0], t[0][1] + q[1])
                b = (t[1][0] + q[0], t[1][1] + q[1])
                c = (t[2][0] + q[0], t[2][1] + q[1])
                route[k:k + 3] = [t[0], a, b, c, t[2]]
                again = True
                break
            i = j
    return route


def wind(points, seed, jog=2, maxrun=6):
    """A winding route through the waypoints: a staircase of axis legs, none over maxrun steps; a detour pair stands in
    for a missing second axis, so a long line never runs straight."""
    rng = random.Random(seed)
    out = [points[0]]
    x, y = points[0]

    def split(total, lo=3):
        parts = []
        while total > 0:
            n = min(total, rng.randint(lo, maxrun))
            parts.append(n)
            total -= n
        return parts

    for tx, ty in points[1:]:
        dx, dy = tx - x, ty - y
        horiz = abs(dx) >= abs(dy)
        pa, sa = (dx, dy) if horiz else (dy, dx)  # primary (longer) axis, secondary
        P = [n * (1 if pa > 0 else -1) for n in split(abs(pa))]
        S = [n * (1 if sa > 0 else -1) for n in split(abs(sa), 1)] if sa else []
        while len(S) > len(P) + 1:
            S = [n * (1 if sa > 0 else -1) for n in split(abs(sa), maxrun - 1)]
            if len(S) > len(P) + 1:
                P = [n * (1 if pa > 0 else -1) for n in split(abs(pa), 2)]
        side = rng.choice((-1, 1))
        while len(S) < len(P) - 1:
            S += [jog * side, -jog * side]
            side = -side
        pieces = []
        for i in range(max(len(P), len(S))):
            if i < len(P):
                pieces.append((0, P[i]) if horiz else (1, P[i]))
            if i < len(S):
                pieces.append((1, S[i]) if horiz else (0, S[i]))
        for axis, n in pieces:
            for _ in range(abs(n)):
                if axis == 0:
                    x += 1 if n > 0 else -1
                else:
                    y += 1 if n > 0 else -1
                out.append((x, y))
        assert (x, y) == (tx, ty), ((x, y), (tx, ty), pieces)
    return repair(out)


def straight_runs(path):
    """Lengths of the maximal straight runs (tiles in a line, one direction) of a path given as tiles."""
    runs, cur = [], 1
    for i in range(2, len(path)):
        d0 = (path[i - 1][0] - path[i - 2][0], path[i - 1][1] - path[i - 2][1])
        d1 = (path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
        if d0 == d1:
            cur += 1
        else:
            runs.append(cur + 1)
            cur = 1
    runs.append(cur + 1)
    return runs


class Plan:
    def __init__(self):
        self.g = np.full((N, N), '^', dtype='<U1')
        self.lv = np.zeros((N, N), dtype=int)
        self.paths = {}  # id -> list of tiles (authored routes, the G69 check reads these)
        self.stairs = {}  # (x, y) -> label: a crossing tile of the height rule (G68)
        self.marks = {}  # id -> dict(kind, at, label)
        self.passes = {}  # id -> dict(at, label, crossing)
        self.regions = []  # dict(id, rects, ...)

    def rect(self, x0, y0, x1, y1, ch, lv=None):
        self.g[y0:y1 + 1, x0:x1 + 1] = ch
        if lv is not None:
            self.lv[y0:y1 + 1, x0:x1 + 1] = lv

    def disc(self, cx, cy, rx, ry, ch, lv=None, only=None):
        for y in range(max(0, int(cy - ry) - 1), min(N, int(cy + ry) + 2)):
            for x in range(max(0, int(cx - rx) - 1), min(N, int(cx + rx) + 2)):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (only is None or self.g[y, x] in only):
                    self.g[y, x] = ch
                    if lv is not None:
                        self.lv[y, x] = lv

    def crossings(self, route, radius, label):
        """A crossing (G68) stands where a route changes level: the tiles round both sides of the change."""
        for i in range(1, len(route)):
            a, b = route[i - 1], route[i]
            if self.lv[a[1], a[0]] != self.lv[b[1], b[0]]:
                for cx, cy in (a, b):
                    for y in range(cy - radius, cy + radius + 1):
                        for x in range(cx - radius, cx + radius + 1):
                            if 0 <= x < N and 0 <= y < N:
                                self.stairs[(x, y)] = label

    def carve(self, route, radius, ch, lv_of=None):
        """Opens a corridor of the given half-width around a route; lv_of(i) gives the level at route index i."""
        for i, (cx, cy) in enumerate(route):
            for y in range(cy - radius, cy + radius + 1):
                for x in range(cx - radius, cx + radius + 1):
                    if 0 <= x < N and 0 <= y < N:
                        self.g[y, x] = ch
                        if lv_of:
                            self.lv[y, x] = lv_of(i, len(route))

    def lay(self, route, ch=':'):
        for x, y in route:
            if self.g[y, x] not in ('~', 'j'):
                self.g[y, x] = ch


def mountain_level(x, y):
    fx0, fy0, fx1, fy1 = FLOOR
    r = max(fx0 - x, x - fx1, fy0 - y, y - fy1, 0)
    if r == 0:
        return 0
    base = 1 + r / 5.2
    return int(max(1, min(9, round(base + 1.3 * noise(x, y, 1.7)))))


def build(variant='A'):
    p = Plan()
    rng = random.Random(11)
    fx0, fy0, fx1, fy1 = FLOOR
    # 1. mountains all round, the floor meadow
    for y in range(N):
        for x in range(N):
            p.lv[y, x] = mountain_level(x, y)
    p.rect(fx0, fy0, fx1, fy1, '.', 0)

    # 2. the old valley, moved rigidly: ground and heights; its own frame (west woods, north woods, east hills) is new land
    sx, sy = SHIFT
    for oy in range(64):
        row = OLD_GROUND[oy]
        for ox in range(48):
            ch = row[ox]
            if ch in '^A':
                continue
            if ox < 2 and 2 <= oy <= 33:
                ch = '.'
            if oy < 2 and ox not in (13, 14, 15):
                ch = '.'
            if ox >= 44 and ch == 'T' and 3 <= oy <= 21 and (oy % 6) in (0, 1, 2):
                ch = '.'
            x, y = ox + sx, oy + sy
            if 0 <= x < N and 0 <= y < N:
                p.g[y, x] = ch
                p.lv[y, x] = 0 if y <= fy1 else mountain_level(x, y) * 0

    # 3. the river from its spring at the foot of the north range, down into the old river's top (old x 13..15 at y 0)
    river = []
    for y in range(52, 84):
        cx = 80 + int(round(3 * math.sin((y - 84) / 6.5)))
        river.append((cx, y))
        for x in (cx - 1, cx, cx + 1):
            p.g[y, x] = '~'
    p.marks['spring'] = dict(kind='spring', at=(river[0][0], 51), label='Spring')

    # 4. the bay: the old bay (x 66..81, y 118..147), widened west and south into the south-west frame
    p.disc(50, 150, 36, 24, '~', 0)
    p.rect(66, 118, 81, 147, '~', 0)
    p.rect(48, 126, 81, 147, '~', 0)

    # 5. the bay's south coast, a wet shore and the dock; the far bank (the human city across the bay) is scenery at the edge
    p.rect(30, 172, 100, 185, 'S', 0)
    p.disc(70, 178, 26, 6, 'r', 0, only='S')
    p.rect(0, 150, 24, 191, 'F', 0)  # the far bank: not walkable, a skyline
    p.rect(0, 186, 60, 191, 'F', 0)

    # 6. the east terraces and the east pass, the highland and the tarn
    for y in range(60, 131):
        for x in range(114, 144):
            if p.g[y, x] == '.':
                p.lv[y, x] = 0 if x < 124 else (1 if x < 134 else 2)
    east = wind([(114, 100), (124, 100), (134, 102), (143, 100)], 3)
    p.paths['east-road'] = east
    ep = wind([(143, 100), (150, 100), (156, 104), (158, 108)], 4)
    p.paths['east-pass'] = ep
    # the pass climbs to the plateau: level 2 at the floor's edge, 3 on the plateau
    p.carve(ep, 2, 'k', lambda i, n: 2 if i < n // 2 else 3)
    p.rect(152, 62, 186, 128, 'h', 3)
    p.rect(151, 98, 152, 110, 'h', 3)
    p.disc(171, 95, 12, 8, '~', 3)
    p.marks['tarn'] = dict(kind='lake', at=(171, 95), label='Tarn')
    p.marks['boathouse'] = dict(kind='boathouse', at=(158, 98), label='Boathouse')
    p.marks['lift'] = dict(kind='lift', at=(156, 107), label='Boat lift')
    for i in range(14):
        cx, cy = rng.randint(154, 184), rng.randint(64, 126)
        if p.g[cy, cx] == 'h' and math.hypot(cx - 171, cy - 95) > 16 and math.hypot(cx - 158, cy - 100) > 6:
            p.disc(cx, cy, rng.randint(2, 4), rng.randint(2, 3), 'T', 3)  # pines
    # the tarn's outlet runs down the pass and across the terraces into the tangle's wet corner
    stream = wind([(157, 109), (150, 112), (143, 114), (134, 116), (124, 119), (116, 122)], 5, jog=1, maxrun=4)
    for x, y in stream:
        if p.g[y, x] in ('.', 'k', 'h'):
            p.g[y, x] = 'j' if x in (127, 128, 138, 139) else '~'  # two footbridges over the tarn's outlet
    p.disc(114, 124, 5, 3, 'r', 0)
    p.marks['marsh'] = dict(kind='marsh', at=(114, 124), label='Reed marsh')

    # 7. the north pass and the elf wood's threshold
    p.rect(36, 6, 118, 27, 'T', 1)
    # the wood's trails: a hub corridor under the pass, trails of the width of three out to the wayside stalls, dead ends between
    p.rect(60, 24, 100, 27, 'f', 1)
    hub = [(60 + i, 25) for i in range(41)]
    trails = {
        'elf-trail-W': wind([(72, 26), (66, 20), (60, 17), (56, 14)], 31, maxrun=5),
        'elf-trail-C': wind([(84, 26), (86, 20), (84, 12)], 32, maxrun=5),
        'elf-trail-E': wind([(98, 26), (102, 24), (104, 20)], 33, maxrun=5),
        'elf-dead-1': wind([(56, 14), (50, 12), (46, 8)], 34, maxrun=5),
        'elf-dead-2': wind([(84, 12), (90, 10), (94, 8)], 35, maxrun=5),
        'elf-dead-3': wind([(66, 20), (70, 14), (68, 9)], 36, maxrun=5),
    }
    for key, route in trails.items():
        p.paths[key] = route
        p.carve(route, 1, 'f', lambda i, n: 1)
    for gx, gy in [(56, 14), (84, 12), (104, 20)]:
        p.disc(gx, gy, 4, 3, 'f', 1)
    p.marks['stall1'] = dict(kind='stall', at=(56, 14), label='Wayside stall')
    p.marks['stall2'] = dict(kind='stall', at=(84, 12), label='Wayside stall')
    p.marks['stall3'] = dict(kind='stall', at=(104, 20), label='Wayside stall')
    npass = wind([(72, 48), (72, 40), (70, 34), (72, 28)], 6)
    p.paths['north-pass'] = npass
    lvn = lambda i, n: [0, 1, 2, 3, 3, 2, 1][min(6, int(7 * i / n))]
    p.carve(npass, 2, 'k', lvn)
    p.crossings(npass, 2, 'stairs cut in the face')

    # 8. the south-west pass: the shore way runs on past the floor's edge to the bay's south coast and its dock
    swp = wind([(84, 144), (86, 152), (84, 160), (78, 168), (68, 174), (58, 176)], 7)
    p.paths['shore-pass'] = swp
    p.carve(swp, 2, 'k', lambda i, n: 0)
    p.marks['dock'] = dict(kind='dock', at=(52, 177), label='Dock')
    p.disc(46, 168, 5, 3, '~', 0)

    # 9. the descent: the night ruins' gate leads south through the old undead basin to the undead south
    p.rect(70, 158, 130, 186, 'x', 0)
    for i in range(18):
        cx, cy = rng.randint(72, 128), rng.randint(160, 184)
        p.disc(cx, cy, rng.randint(1, 3), rng.randint(1, 2), '%', 0)
    dsc = wind([(99, 146), (103, 152), (100, 158)], 8)
    p.paths['descent-south'] = dsc
    p.carve(dsc, 2, 'k', lambda i, n: [0, 1, 2, 1, 0][min(4, int(5 * i / n))])
    p.crossings(dsc, 2, 'descent stair')
    p.marks['arch'] = dict(kind='arch', at=(75 + 66 - 5, 84 + 19), label='Night arch')  # old arch slot (36, 18..20)
    p.marks['hall'] = dict(kind='ruin', at=(100, 172), label='Sunken hall')

    # 10. new land: forest clumps on the meadow of the north band, the east terraces and the west bank, kept clear of the starts
    keep = [(STARTS[k][1][0], STARTS[k][1][1], 11) for k in STARTS] + [(BRIDGE[0], BRIDGE[1], 8)]
    for i in range(95):
        cx, cy = rng.randint(48, 143), rng.randint(48, 143)
        old = (SHIFT[0] <= cx < SHIFT[0] + 46 and SHIFT[1] <= cy < SHIFT[1] + 60)
        if old:
            continue
        if any(math.hypot(cx - kx, cy - ky) < kr + 4 for kx, ky, kr in keep):
            continue
        if p.g[cy, cx] != '.':
            continue
        p.disc(cx, cy, rng.randint(2, 4), rng.randint(2, 3), 'T', int(p.lv[cy, cx]), only='.')
    # the west foot: a forest edge under the western range
    for y in range(48, 144):
        for x in range(48, 53):
            if p.g[y, x] == '.' and (x + y) % 3:
                p.g[y, x] = 'T'

    # 11. the three starting areas: a cleared disc each
    for key, (name, (x, y)) in STARTS.items():
        p.disc(x, y, AREA_R, AREA_R, '.', 0, only=set('.T,"'))
        p.marks['start-' + key] = dict(kind='start', at=(x, y), label=name, key=key)

    # 12. authored paths on the new land (the old block carries its own, as imported)
    p.paths['bank-road-N'] = wind([(72, 68), (74, 78), (74, 90), (76, 98), (78, 101)], 9)
    p.paths['bank-road-W'] = wind([(67, 95), (72, 98), (78, 101)], 10)
    p.paths['bank-road-S'] = wind([(68, 121), (70, 114), (72, 108), (76, 103), (78, 101)], 12)
    p.paths['north-track'] = wind([(72, 68), (73, 58), (72, 52), (72, 48)], 13)
    p.paths['shore-way-in'] = wind([(82, 118), (84, 126), (84, 135), (84, 144)], 14)
    p.paths['tangle-brook'] = wind([(104, 108), (110, 112), (112, 118)], 15)
    p.paths['town-east-road'] = wind([(104, 92), (108, 98), (112, 100)], 16)
    p.paths['west-foot'] = wind([(67, 95), (63, 104), (63, 112), (68, 121)], 17)
    for key in ('bank-road-N', 'bank-road-W', 'bank-road-S', 'north-track', 'shore-way-in', 'tangle-brook', 'town-east-road', 'west-foot'):
        p.lay(p.paths[key])
    for key in ('east-road',):
        p.lay(p.paths[key])
    p.lay(p.paths['north-pass'])
    p.lay(p.paths['east-pass'])
    p.lay(p.paths['shore-pass'])
    p.lay(p.paths['descent-south'])
    p.g[BRIDGE[1] - 1:BRIDGE[1] + 1, BRIDGE[0] - 1:BRIDGE[0] + 2] = 'j'

    # crossings of the east terraces and the east pass
    p.crossings(east, 1, 'cart ramp')
    p.crossings(ep, 2, 'switchback ramp')
    p.stairs[(157, 109)] = 'boat lift'
    # passes and their gates: a gate opens by the region's own deed (decision 25 of 22.10)
    p.passes['N'] = dict(at=(72, 48), label='N', crossing='stairs cut in the face', to='the elf wood')
    p.passes['E'] = dict(at=(143, 100), label='E', crossing='a cart ramp', to='the highland and the tarn')
    p.passes['SW'] = dict(at=(84, 144), label='SW', crossing='the shore walk', to='the bay and its dock')

    # variants: only the one named thing changes
    if variant == 'B':
        ix0, iy0, ix1, iy1 = INNER
        for y in range(fy0, fy1 + 1):
            for x in range(fx0, fx1 + 1):
                if ix0 <= x <= ix1 and iy0 <= y <= iy1:
                    continue
                near_pass = any(abs(x - px) <= 3 and abs(y - py) <= 3 for path in p.paths.values() for px, py in path)
                keep_old = p.g[y, x] in '~j' or near_pass
                if keep_old:
                    continue
                if SHIFT[1] + 60 > y >= SHIFT[1] and SHIFT[0] <= x < SHIFT[0] + 46 and y <= iy1:
                    continue
                p.g[y, x] = 'T'
                p.lv[y, x] = 1
    if variant == 'C':
        for x in range(76, 94):
            for y in range(fy1 + 1, 180):
                if p.g[y, x] in ('k', ':', '.', 'T', 'S') and y > fy1:
                    p.g[y, x] = '^'
                    p.lv[y, x] = mountain_level(x, y)
        p.paths['shore-pass'] = []
        del p.passes['SW']
    fill_pockets(p)
    p.variant = variant
    return p


def fill_pockets(p, small=60):
    """Walkable pockets nothing leads into and smaller than `small` tiles are forest (a plan has no lost corners)."""
    w = walkable(p)
    seen = np.zeros((N, N), dtype=bool)
    for y0 in range(N):
        for x0 in range(N):
            if not w[y0, x0] or seen[y0, x0]:
                continue
            comp, q = [], deque([(x0, y0)])
            seen[y0, x0] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and 0 <= ny < N and w[ny, nx] and not seen[ny, nx] and p.lv[ny, nx] == p.lv[y, x]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            if len(comp) < small:
                for x, y in comp:
                    if (x, y) not in p.stairs:
                        p.g[y, x] = 'T'


def walkable(p):
    return ~np.isin(p.g, list(SOLID))


def bfs(p, sources, extra_block=None):
    """4-way steps over walkable tiles; between levels only across a stair tile (G68)."""
    w = walkable(p)
    dist = np.full((N, N), -1, dtype=int)
    q = deque()
    for x, y in sources:
        dist[y, x] = 0
        q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < N and 0 <= ny < N) or dist[ny, nx] >= 0 or not w[ny, nx]:
                continue
            if p.lv[ny, nx] != p.lv[y, x] and (nx, ny) not in p.stairs and (x, y) not in p.stairs:
                continue
            dist[ny, nx] = dist[y, x] + 1
            q.append((nx, ny))
    return dist


def nearest_walkable(p, x, y):
    w = walkable(p)
    for r in range(0, 16):
        for yy in range(y - r, y + r + 1):
            for xx in range(x - r, x + r + 1):
                if 0 <= xx < N and 0 <= yy < N and w[yy, xx]:
                    return (xx, yy)
    raise ValueError((x, y))


def measure(p):
    m = {}
    starts = {k: nearest_walkable(p, *v[1]) for k, v in STARTS.items()}
    br = nearest_walkable(p, BRIDGE[0] - 2, BRIDGE[1])  # the west bank end of the bridge
    d_br = bfs(p, [br])
    m['legs'] = {k: int(d_br[y, x]) for k, (x, y) in starts.items()}
    pair = {}
    for a in 'NWS':
        d = bfs(p, [starts[a]])
        for b in 'NWS':
            if a < b:
                pair[a + b] = int(d[starts[b][1], starts[b][0]])
    m['pairs'] = pair
    m['manhattan'] = {a + b: abs(starts[a][0] - starts[b][0]) + abs(starts[a][1] - starts[b][1]) for a in 'NWS' for b in 'NWS' if a < b}
    m['nearest_pair'] = min(pair.values())
    # the first bridge's view: a 6.1 x 13.2 tile window around the bridge (phone at the closer camera), against the other areas' discs
    wx, wy = 3.05, 6.6
    seen = {}
    for k, (cx, cy) in starts.items():
        hit = False
        for y in range(cy - AREA_R, cy + AREA_R + 1):
            for x in range(cx - AREA_R, cx + AREA_R + 1):
                if math.hypot(x - cx, y - cy) <= AREA_R and abs(x - BRIDGE[0]) <= wx and abs(y - BRIDGE[1]) <= wy:
                    hit = True
        seen[k] = hit
    m['bridge_view_shows_start_area'] = seen
    # danger: steps from the town (G64), floor(steps / 64)
    town = nearest_walkable(p, *TOWN)
    d_town = bfs(p, [town])
    m['d_town_max'] = int(d_town.max())
    m['d_levels'] = {str(i): int(((d_town >= 0) & (d_town // BAND_STEPS == i)).sum()) for i in range(0, 4)}
    m['unreachable_walkable'] = int((walkable(p) & (d_town < 0)).sum())
    # places: every authored mark and old slot is a pay for the G62 proxy; the worst walk from a floor tile to one
    pays = [nearest_walkable(p, *mk['at']) for mk in p.marks.values() if mk['kind'] != 'start']
    pays += [nearest_walkable(p, 66 + s['x'], 84 + s['y']) for s in OLD['slots'] if 66 + s['x'] < N and 84 + s['y'] < N]
    d_pay = bfs(p, pays)
    reach = walkable(p) & (d_pay >= 0)
    m['g62_worst_steps'] = int(d_pay[reach].max())
    m['g62_limit'] = 241
    # G69: straight runs of every authored path
    runs = {}
    for k, path in p.paths.items():
        if path:
            r = straight_runs(path)
            runs[k] = max(r)
    m['straight_run_max'] = runs
    # passes: reachability from the town
    m['pass_reach'] = {}
    for k, ps in p.passes.items():
        x, y = nearest_walkable(p, *ps['at'])
        m['pass_reach'][k] = int(d_town[y, x])
    for k in ('boathouse', 'tarn', 'dock', 'hall', 'stall1', 'stall3'):
        if k in p.marks:
            x, y = nearest_walkable(p, *p.marks[k]['at'])
            m['pass_reach'][k] = int(d_town[y, x])
    m['floor_walkable'] = int(walkable(p)[FLOOR[1]:FLOOR[3] + 1, FLOOR[0]:FLOOR[2] + 1].sum())
    return m, d_town


# ---------------------------------------------------------------- drawing

PAL = {
    '.': (118, 172, 92), ',': (126, 178, 96), '"': (86, 142, 84), 'T': (38, 92, 62), '~': (68, 128, 204), '_': (222, 206, 150),
    ':': (205, 170, 108), '=': (196, 190, 176), '#': (150, 140, 162), '%': (104, 98, 108), 'A': (104, 98, 108), 'j': (166, 112, 58),
    'a': (132, 122, 134), 'b': (206, 194, 152), 'S': (226, 208, 150), 'r': (150, 164, 88), 'f': (62, 136, 112), 'h': (156, 154, 100),
    'x': (112, 92, 132), 'k': (170, 160, 150), 'F': (112, 124, 156), '^': (128, 128, 134),
}
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(sz):
    return ImageFont.truetype(FONT, sz)


def mountain_rgb(level, x, y, lv):
    base = np.array([96 + level * 17, 98 + level * 17, 106 + level * 16], dtype=float)
    # a face is lit from the north-west: a drop to the north-west is darker, a rise lighter
    shade = 0
    if y > 0 and lv[y - 1, x] > lv[y, x]:
        shade -= 22
    if x > 0 and lv[y, x - 1] > lv[y, x]:
        shade -= 12
    if y > 0 and lv[y - 1, x] < lv[y, x]:
        shade += 18
    if x > 0 and lv[y, x - 1] < lv[y, x]:
        shade += 10
    if level >= 7:
        base = base * 0.5 + np.array([250, 250, 255]) * 0.5
    return tuple(int(max(0, min(255, c + shade))) for c in base)


def tile_image(p):
    img = np.zeros((N, N, 3), dtype=np.uint8)
    for y in range(N):
        for x in range(N):
            ch = p.g[y, x]
            if ch == '^':
                img[y, x] = mountain_rgb(int(p.lv[y, x]), x, y, p.lv)
            else:
                c = PAL.get(ch, (255, 0, 255))
                if p.lv[y, x] > 0 and ch in 'kh.fT':
                    c = tuple(min(255, int(v + 6 * p.lv[y, x])) for v in c)
                img[y, x] = c
    return img


def edge_mist(im, scale, band=4):
    """The grid's edge: mist, the next ring waits behind it (DECISIONS 2026-10-17)."""
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            d = min(x, y, w - 1 - x, h - 1 - y) / scale
            if d < band:
                a = (1 - d / band) * 0.8
                r, g, b = px[x, y][:3]
                px[x, y] = (int(r + (236 - r) * a), int(g + (238 - g) * a), int(b + (244 - b) * a))


def label(d, xy, text, sz=9, fill=(255, 255, 255), halo=(20, 20, 30), anchor='mm'):
    f = font(sz)
    x, y = xy
    for ox in (-1, 0, 1):
        for oy in (-1, 0, 1):
            if ox or oy:
                d.text((x + ox, y + oy), text, font=f, fill=halo, anchor=anchor)
    d.text((x, y), text, font=f, fill=fill, anchor=anchor)


START_RGB = {'N': (255, 214, 64), 'W': (255, 120, 200), 'S': (80, 230, 230)}


def draw_marks(d, p, s, ox, oy, crop=None, small=False):
    """Marks at scale s (px per tile) from offset (ox, oy) in image px; crop = (x0, y0) of the window's tile origin."""
    cx0, cy0 = crop or (0, 0)

    def P(x, y):
        return (ox + (x - cx0 + 0.5) * s, oy + (y - cy0 + 0.5) * s)

    # chunk lines (64 x 64 world chunks)
    for k in (64, 128):
        for a, b in (((k, 0), (k, N)), ((0, k), (N, k))):
            (x0, y0), (x1, y1) = P(*a), P(*b)
            if crop is None:
                d.line([x0, y0, x1, y1], fill=(255, 255, 255, 70), width=1)
    # starting areas
    for key, (name, (x, y)) in STARTS.items():
        px, py = P(x, y)
        r = AREA_R * s
        d.ellipse([px - r, py - r, px + r, py + r], outline=START_RGB[key] + (255,), width=2 if s >= 3 else 1)
        label(d, (px, py), {'N': '1', 'W': '2', 'S': '3'}[key], 11 if s >= 3 else 9, START_RGB[key])
    for key, mk in p.marks.items():
        x, y = mk['at']
        px, py = P(x, y)
        k = mk['kind']
        if k == 'boathouse':
            d.rectangle([px - 3 * s / 2, py - s, px + 3 * s / 2, py + s], fill=(150, 70, 50), outline=(255, 230, 200))
            for i in range(4):
                d.ellipse([px + 1 + i * 1.2 * s / 2, py - 2 * s - i * 2 * s, px + 3 + i * 1.2 * s / 2 + s, py - 2 * s - i * 2 * s + s], fill=(230, 230, 235, 200))
        elif k == 'lift':
            d.rectangle([px - s, py - s, px + s, py + s], outline=(255, 240, 120), width=1)
        elif k == 'stall':
            d.polygon([(px, py - s), (px + s, py + s), (px - s, py + s)], fill=(200, 120, 255))
        elif k == 'dock':
            d.rectangle([px - 2 * s, py - s / 2, px + 2 * s, py + s / 2], fill=(150, 100, 60), outline=(255, 255, 255))
        elif k == 'arch':
            d.rectangle([px - s, py - s, px + s, py + s], outline=(150, 255, 180), width=1)
        elif k == 'ruin':
            d.rectangle([px - 2 * s, py - s, px + 2 * s, py + s], outline=(190, 150, 220), width=1)
        elif k == 'spring':
            d.ellipse([px - s, py - s, px + s, py + s], outline=(200, 230, 255), width=1)
    # the town, the bridge
    tx, ty = P(*TOWN)
    d.rectangle([tx - 8 * s, ty - 6 * s, tx + 8 * s, ty + 5 * s], outline=(255, 90, 70), width=2 if s >= 3 else 1)
    bx, by = P(*BRIDGE)
    d.rectangle([bx - 2 * s, by - 1.2 * s, bx + 2 * s, by + 1.2 * s], outline=(255, 255, 255), width=1)
    # passes: a bright mark and a letter
    for k, ps in p.passes.items():
        x, y = ps['at']
        px, py = P(x, y)
        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 255, 255), outline=(10, 10, 20), width=2)
        label(d, (px, py + 0.5), ps['label'], 7 if len(ps['label']) > 1 else 8, (10, 10, 20), (255, 255, 255, 0))


def render_map(p, d_town, scale=2, with_contours=True, edge=True):
    img = tile_image(p)
    im = Image.fromarray(img).resize((N * scale, N * scale), Image.NEAREST).convert('RGBA')
    if edge:
        edge_mist(im, scale)
    px = im.load()
    if with_contours:
        band = np.where(d_town >= 0, d_town // BAND_STEPS, -1)
        for y in range(N):
            for x in range(N):
                if band[y, x] < 0:
                    continue
                for dx, dy in ((1, 0), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < N and ny < N and band[ny, nx] >= 0 and band[ny, nx] != band[y, x]:
                        for sx in range(scale):
                            for sy in range(scale):
                                xx = (x + (1 if dx else 0)) * scale - (1 if dx else 0) + (sx if dy else 0)
                                yy = (y + (1 if dy else 0)) * scale - (1 if dy else 0) + (sy if dx else 0)
                                if 0 <= xx < im.size[0] and 0 <= yy < im.size[1]:
                                    px[xx, yy] = (255, 80, 200, 255)
    return im


def compose(p, d_town, caption1, caption2, m, full=False):
    """The 390 x 844 phone image: caption, the whole map at 2 px a tile, the valley at 4 px a tile, a one-line key."""
    W, H = 390, 844
    canvas = Image.new('RGBA', (W, H), (24, 26, 36, 255))
    d = ImageDraw.Draw(canvas, 'RGBA')
    d.text((8, 5), caption1, font=font(11), fill=(255, 255, 255))
    d.text((8, 21), caption2, font=font(9), fill=(190, 200, 220))
    whole = render_map(p, d_town, 2)
    top = 40
    ox = (W - N * 2) // 2
    canvas.alpha_composite(whole, (ox, top))
    draw_marks(d, p, 2, ox, top)
    # the valley at 4 px a tile: the floor window (x 48..143, y 48..143)
    vx0, vy0 = FLOOR[0], FLOOR[1]
    vtop = top + N * 2 + 8
    img = tile_image(p)[vy0:vy0 + 96, vx0:vx0 + 96]
    vm = Image.fromarray(img).resize((96 * 4, 96 * 4), Image.NEAREST).convert('RGBA')
    canvas.alpha_composite(vm, ((W - 384) // 2, vtop))
    vox = (W - 384) // 2
    draw_marks(d, p, 4, vox, vtop, crop=(vx0, vy0))
    # labels on the valley panel
    for text, (x, y) in VALLEY_LABELS.items():
        label(d, (vox + (x - vx0) * 4, vtop + (y - vy0) * 4), text, 8)
    # labels on the whole map
    for text, (x, y) in MAP_LABELS.items():
        label(d, (ox + x * 2, top + y * 2), text, 8)
    # the key
    ky = vtop + 384 + 6
    items = [((255, 90, 70), 'town'), (START_RGB['N'], '1 north'), (START_RGB['W'], '2 west'), (START_RGB['S'], '3 slid'), ((255, 255, 255), 'pass'), ((255, 80, 200), 'danger step 64')]
    xx = 8
    for col, text in items:
        d.rectangle([xx, ky + 2, xx + 8, ky + 10], outline=col + (255,), fill=col + (120,))
        d.text((xx + 12, ky), text, font=font(8), fill=(220, 225, 235))
        xx += 12 + int(font(8).getlength(text)) + 10
    return canvas.convert('RGB')


MAP_LABELS = {
    'ELF WOOD': (77, 17), 'HIGHLAND': (171, 76), 'TARN': (171, 95), 'THE BAY': (40, 148), 'FAR BANK': (11, 170), 'COAST': (66, 181),
    'UNDEAD SOUTH': (100, 172), 'VALLEY': (96, 56), 'N': (72, 50),
}
VALLEY_LABELS = {
    'TOWN': (96, 92), 'bridge': (80, 106), 'tangle': (96, 126), 'night ruins': (104, 110), 'camp': (92, 104), 'east terraces': (128, 86),
    'north meadows': (92, 62), 'west bank': (56, 104), 'bay': (62, 138),
}


def main():
    results = {}
    plans = {v: build(v) for v in 'ABC'}
    today = json.loads((OUT / 'today.json').read_text()) if (OUT / 'today.json').exists() else {}
    for v, p in plans.items():
        m, d_town = measure(p)
        results[v] = m
        cap = {
            'A': ('A: the proposal as written', 'floor 96 x 96, 3 passes (E, N, SW), starts 1-3 well apart'),
            'B': ('B tests: the size of the valley floor', 'floor 72 x 72 (A\'s outer 12 tiles are foothill forest); all else as A'),
            'C': ('C tests: how many passes', '2 passes (E, N): the south-west pass is closed; all else as A'),
        }[v]
        img = compose(p, d_town, cap[0], cap[1], m)
        img.save(OUT / f'still-{v}.png')
        if v == 'A':
            full = compose(p, d_town, 'The first map: plan, 192 x 192 tiles', 'valley floor in the middle, mountains round it, three passes', m, full=True)
            full.save(OUT / 'plan-map.png')
        if v == 'A':
            np.save(OUT / 'A-ground.npy', p.g)
            np.save(OUT / 'A-levels.npy', p.lv)
            Image.fromarray(tile_image(p)).save(OUT / 'A-raw.png')
    # pixel difference of B and C from A inside the map panels
    a = np.array(Image.open(OUT / 'still-A.png').convert('RGB')).astype(int)
    for v in 'BC':
        b = np.array(Image.open(OUT / f'still-{v}.png').convert('RGB')).astype(int)
        diff = (np.abs(a - b).sum(axis=2) > 0)
        diff[:40, :] = False  # the caption band
        ys, xs = np.nonzero(diff)
        results[v]['pixels_differing_from_A'] = int(diff.sum())
        results[v]['diff_bbox'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None
    (OUT / 'measure.json').write_text(json.dumps(results, indent=1))
    print(json.dumps(results, indent=1))


if __name__ == '__main__':
    main()
