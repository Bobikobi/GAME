#!/usr/bin/env python3
"""Toy model, part 2: shop price loops, rounding, determinism, prediction, creator reward. Scratch only."""
from fractions import Fraction as F
import hashlib, json, heapq, math
from toy_econ import Act, base_content, cons, fixed_point_lp, income, fl

# ---------- shop price loops: exhaustive search over trade sequences ----------
def shop_search(pay, charge, S, depth, others_dump=False, consume=True):
    """pay(s): gold the shop pays the player at stock s. charge(s): gold the shop charges.
    The player starts with no items; returns the best gold gain over all sequences."""
    best = (0, None)
    for s0 in range(S + 1):
        layer = {(s0, 0): 0}
        for _ in range(depth):
            nxt = dict(layer)
            def put(key, g):
                if key not in nxt or g > nxt[key]:
                    nxt[key] = g
            for (s, inv), g in layer.items():
                if consume and s > 0:
                    put((s - 1, inv), g)                    # the shop's own consumption
                if others_dump and s < S:
                    put((s + 1, inv), g)                    # another player sells one
                if s > 0:
                    put((s - 1, inv + 1), g - charge(s))    # we buy one
                if inv > 0 and s < S:
                    put((s + 1, inv - 1), g + pay(s))       # we sell one
            layer = nxt
        gain = max(layer.values())
        if gain > best[0]:
            best = (gain, s0)
    return best


def shop_experiments():
    print("== K1 shop price function: search for gold from trading alone (base 100, 10 stock steps, 14 moves) ==")
    S, base = 10, 100
    single = lambda s: F(3, 2) - F(s, S)                       # one curve, 1.5 at empty stock to 0.5 at full
    for k in (F(1, 3), F(1, 2), F(95, 100)):
        pay = lambda s, k=k: math.floor(k * base * single(s))
        charge = lambda s: math.ceil(base * single(s))
        a = shop_search(pay, charge, S, 14, consume=False)
        b = shop_search(pay, charge, S, 14, consume=True)
        c = shop_search(pay, charge, S, 14, consume=True, others_dump=True)
        print("one curve 0.5-1.5, k=%-6s instant loop: +%d | with shop consumption: +%d | with other players selling too: +%d" % (k, a[0], b[0], c[0]))
    for k in (F(1, 2), F(95, 100)):
        pay = lambda s, k=k: math.floor(k * base * (1 - F(s, 2 * S)))        # 1.0 down to 0.5 of k*base
        charge = lambda s: math.ceil(base * (F(3, 2) - F(s, 2 * S)))         # 1.5 down to 1.0 of base
        c = shop_search(pay, charge, S, 14, consume=True, others_dump=True)
        print("two curves (pay <= k*base <= base <= charge), k=%-6s any sequence: +%d" % (k, c[0]))

    print("\n== K2 rounding at low values (berry worth 0.1 gold: r=0.1 gold/s, k=1/2, V=2 s) ==")
    p = F(1, 10)
    half_up = lambda n: math.floor(n * p + F(1, 2))
    best = max(range(1, 21), key=lambda n: F(half_up(n), n))
    print("round half up per transaction: best stack size %d pays %d gold = x%s of fair" % (best, half_up(best), fl(F(half_up(best), best) / p, 2)))
    print("minimum price 1 gold per unit: x%s of fair" % fl(1 / p, 1))
    print("floor per transaction: 30 berries pay %d (fair 3.0); 9 berries pay %d (fair 0.9)" % (math.floor(30 * p), math.floor(9 * p)))
    print("milli-gold, floor per transaction: 9 berries pay %d milli (fair 900)" % math.floor(9 * p * 1000))


# ---------- determinism toy ----------
MASK = 0xFFFFFFFF
def xs32(s):
    s ^= (s << 13) & MASK
    s ^= s >> 17
    s ^= (s << 5) & MASK
    return s & MASK

def keyed(seed, key, ctr):
    return int.from_bytes(hashlib.sha256(("%d|%s|%d" % (seed, key, ctr)).encode()).digest()[:4], "big")

def drop(roll):
    u = roll % 10000
    return "gem" if u < 500 else ("ore" if u < 3000 else "stone")

def new_state(seed, order=("tick", "rng", "uses", "inv", "sat", "sat_at")):
    full = {"tick": 0, "rng": seed, "uses": {}, "inv": {}, "sat": 1000, "sat_at": 0}
    return {k: full[k] for k in order}

def satiety(st):                       # lazy: no per-tick mutation
    return max(0, st["sat"] - (st["tick"] - st["sat_at"]) // 7)

def step(st, action, mode, seed):
    kind = action[0]
    if kind == "wait":
        st["tick"] += action[1]
    elif kind == "dig":
        spot = action[1]
        if mode == "single":
            st["rng"] = xs32(st["rng"]); roll = st["rng"]
        else:
            roll = keyed(seed, spot, st["uses"].get(spot, 0))
        st["uses"][spot] = st["uses"].get(spot, 0) + 1
        d = drop(roll)
        st["inv"][d] = st["inv"].get(d, 0) + 1
        st["tick"] += 600
    elif kind == "gather":
        if mode == "single":
            st["rng"] = xs32(st["rng"]); roll = st["rng"]
        else:
            roll = keyed(seed, "bush", st["uses"].get("bush", 0))
        st["uses"]["bush"] = st["uses"].get("bush", 0) + 1
        st["inv"]["berry"] = st["inv"].get("berry", 0) + 3
        st["tick"] += 120
    elif kind == "ambient":            # an unrelated entity that takes one roll
        if mode == "single":
            st["rng"] = xs32(st["rng"])
        else:
            keyed(seed, "butterfly", 0)
    return st

def h(st, canonical=True):
    return hashlib.sha256(json.dumps(st, sort_keys=canonical).encode()).hexdigest()[:12]

def run(actions, mode, seed=12345, pre=()):
    st = new_state(seed)
    log = []
    for a in list(pre) + list(actions):
        before = dict(st["inv"])
        step(st, a, mode, seed)
        if a[0] == "dig":
            log.append(next(k for k in st["inv"] if st["inv"][k] != before.get(k, 0)))
    return st, log

def determinism_experiments(VH):
    print("\n== D1 replay twice ==")
    actions = [("dig", "spot%d" % (i % 20)) if i % 3 else ("gather",) for i in range(300)]
    for mode in ("single", "keyed"):
        print(mode, "stream: hashes equal:", h(run(actions, mode)[0]) == h(run(actions, mode)[0]))
    print("== D2 add one unrelated entity that takes one roll at load ==")
    for mode in ("single", "keyed"):
        a, b = run(actions, mode)[1], run(actions, mode, pre=[("ambient",)])[1]
        print(mode, "stream: dig results that changed: %d of %d" % (sum(x != y for x, y in zip(a, b)), len(a)))
    print("== D3 same state, built in a different key order ==")
    s1 = new_state(1); s2 = new_state(1, order=("inv", "uses", "sat_at", "sat", "rng", "tick"))
    print("plain serialization equal:", h(s1, False) == h(s2, False), "| canonical (sorted keys) equal:", h(s1) == h(s2))
    print("== D5 time skip: 10000 one-tick waits vs one 10000-tick wait ==")
    a = run([("wait", 1)] * 10000 + [("gather",)], "keyed")[0]
    b = run([("wait", 10000), ("gather",)], "keyed")[0]
    print("hash equal:", h(a) == h(b), "| satiety:", satiety(a), satiety(b), "| step calls: 10001 vs 2")

    print("\n== D4 a player who can read the seed ==")
    val = lambda inv: sum(float(VH.get(k, 0)) * n for k, n in inv.items())
    hours = 200
    budget = hours * 3600 * 20
    st = new_state(777)
    while st["tick"] < budget:
        step(st, ("dig", "spot0"), "single", 777)
    honest = st
    st = new_state(777)
    while st["tick"] < budget:
        step(st, ("dig", "spot0") if drop(xs32(st["rng"])) == "gem" else ("gather",), "single", 777)
    bot = st
    print("single stream in the client state, %d h: honest %.1f gems/h, value %.0f s/h | peeking bot %.1f gems/h, value %.0f s/h -> x%.2f" % (
        hours, honest["inv"].get("gem", 0) / hours, val(honest["inv"]) / hours, bot["inv"].get("gem", 0) / hours, val(bot["inv"]) / hours,
        val(bot["inv"]) / val(honest["inv"])))
    for spots in (20, 200, 2000):
        digs_per_day, days, got = 240, 30, 0
        for day in range(days):
            heap = []
            for s in range(spots):
                c = 0
                while drop(keyed(777, "s%d|d%d" % (s, day), c)) != "gem":
                    c += 1
                heapq.heappush(heap, (c + 1, s, c + 1))             # (digs to next gem, spot, next counter)
            left = digs_per_day
            while heap and heap[0][0] <= left:
                cost, s, ctr = heapq.heappop(heap)
                left -= cost; got += 1
                c = ctr
                while drop(keyed(777, "s%d|d%d" % (s, day), c)) != "gem":
                    c += 1
                heapq.heappush(heap, (c - ctr + 1, s, c + 1))
        print("keyed streams, seed readable, %4d dig spots, 240 digs a day: %.1f gems/day against 12.0 honest -> x%.2f" % (
            spots, got / days, got / days / 12.0))


def creator_experiments():
    print("\n== C1 creator reward by raw seconds ==")
    honest_hours = 100.0                                   # 100 players, one active hour a day, in creator B's content
    for alts, hrs in ((20, 24), (20, 2)):
        fake = alts * hrs
        print("creator A runs %d idle accounts, %d h each counted: A takes %.1f%% of the weekly pool with no real player" % (
            alts, hrs, 100 * fake / (fake + honest_hours)))
    print("an 8-hour single action counted as play time: one click earns 8 h of pool share and 8 h of gold at k*r")


if __name__ == "__main__":
    acts = base_content()
    VH = fixed_point_lp(cons(acts, "hard"))
    VD = fixed_point_lp(cons(acts, "naive", count_wait=False))
    print("== E2b drop table valued as 'cheapest way to obtain' when the dig is the only source ==")
    lone = [Act("dig", 30, outs={"shard": F(7, 10), "relic": F(1, 4), "idol": F(1, 20)})]
    Vn = fixed_point_lp(cons(lone, "naive"))
    g, _ = income(lone, Vn, F(1, 2))
    print("values:", {k: float(v) for k, v in Vn.items()}, "-> value per 30 s dig = %s s ; income x%s of k*r" % (
        fl(sum(y * Vn[o] for o, y in lone[0].outs.items()), 1), fl(g / F(1, 2), 2)))
    dig = next(a for a in acts if a.id == "dig_ruin")
    out_d = sum(y * VD[o] for o, y in dig.outs.items()); cost_d = dig.t + sum(q * VD[i] for i, q in dig.ins.items())
    print("toy dig under valuation D: value out %s s for cost %s s (x%s)" % (fl(out_d, 2), fl(cost_d, 2), fl(out_d / cost_d, 2)))
    shop_experiments()
    determinism_experiments(VH)
    creator_experiments()
