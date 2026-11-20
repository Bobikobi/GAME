#!/usr/bin/env python3
"""The owner's card: one moving GIF per chosen clip plus the hub spec that lists them.

  card.py SET_DIR MANIFEST TILE OUT_DIR CONFIG.json

Each GIF is the clip at 3x on the tile, looped a whole number of times to about 3.2 s, with the race's halo drawn behind the figure as its own
layer (two layers, reach x0.88 and x1.12, cross-faded once per GIF so the halo breathes by the rule of the page: peak alpha .54, falloff 3.5 px).
Halo colour: skeleton black, elf white, human none. The frames themselves never carry the halo.

CONFIG.json: {"name", "title", "intro", "tabs", "path_prefix" (what the spec's paths start with), "views": ["left","front","back"],
              "views_title": {"left": "Left", ...}, "motions": [[label, motion, variant]...] (the order of the buttons; variant "" = the plain take),
              "pick": {"race/motion-view": variant} (override of a chosen take), "races": [{"id","title","text","rec","yes","no"}...]}
A button exists only where the chosen take's verdict is PASS (eye). The spec has one card per race, kind "likeno", and a `switch` of one
group per view. Nothing here knows a home folder; paths come from the arguments."""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gates

PEAK, TAU, BREATH, PERIOD_MS, Z = 0.54, 3.5, 0.12, 3200, 3
HALO_COL = {"skeleton": (0, 0, 0), "elf": (255, 255, 255), "human": None}
MAX_BYTES = int(1.2 * 1024 * 1024)


def chamfer(mask):
    """Chamfer 3-4 style distance (px) from each pixel to the nearest opaque pixel; the same rule as the moving page."""
    INF = 1e9
    h, w = mask.shape
    d = np.where(mask, 0.0, INF)
    for y in range(h):
        for x in range(w):
            v = d[y, x]
            if v == 0:
                continue
            if x:
                v = min(v, d[y, x - 1] + 1)
            if y:
                v = min(v, d[y - 1, x] + 1)
                if x:
                    v = min(v, d[y - 1, x - 1] + 1.414)
                if x < w - 1:
                    v = min(v, d[y - 1, x + 1] + 1.414)
            d[y, x] = v
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            v = d[y, x]
            if v == 0:
                continue
            if x < w - 1:
                v = min(v, d[y, x + 1] + 1)
            if y < h - 1:
                v = min(v, d[y + 1, x] + 1)
                if x < w - 1:
                    v = min(v, d[y + 1, x + 1] + 1.414)
                if x:
                    v = min(v, d[y + 1, x - 1] + 1.414)
            d[y, x] = v
    return d


def halo_layer(d, mask, k, col):
    a = np.where(mask, 0.0, PEAK * k * np.exp(-np.maximum(d - 0.5, 0) / (TAU * k)))
    rgba = np.zeros(d.shape + (4,), float)
    rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3] = col[0], col[1], col[2], a * 255
    im = Image.fromarray(rgba.astype("uint8"), "RGBA")
    # blur the alpha only; the colour is constant
    al = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(al)
    return im


def scaled(layer, f):
    a = np.asarray(layer.resize((gates.SIZE * Z, gates.SIZE * Z), Image.BILINEAR)).astype(float)
    a[..., 3] *= f
    return Image.fromarray(a.astype("uint8"), "RGBA")


def make_gif(frames_dir, race, ms, tile, out, colours=250):
    files = sorted(Path(frames_dir).glob("f[0-9]*.png"))
    n = len(files)
    loops = max(1, round(PERIOD_MS / (n * ms)))
    N, T = loops * n, loops * n * ms
    col = HALO_COL[race]
    base = []
    for f in files:
        arr = gates.load(f)
        fig = Image.fromarray(gates.scale(arr, Z))
        if col:
            mask = arr[..., 3] > 0
            d = chamfer(mask)
            base.append((fig, halo_layer(d, mask, 1 - BREATH, col), halo_layer(d, mask, 1 + BREATH, col)))
        else:
            base.append((fig, None, None))
    t = np.array(Image.open(tile).convert("RGBA"))
    bg = Image.fromarray(gates.scale(t, gates.SIZE * Z // t.shape[0]))
    frames = []
    for k in range(N):
        fig, ha, hb = base[k % n]
        c = bg.copy()
        if ha is not None:
            mix = 0.5 + 0.5 * math.sin(2 * math.pi * (k * ms) / T)
            c.alpha_composite(scaled(ha, 1 - mix))
            c.alpha_composite(scaled(hb, mix))
        c.alpha_composite(fig)
        frames.append(c.convert("RGB"))
    for cols in (colours, 128, 64):
        sheet = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
        for i, x in enumerate(frames):
            sheet.paste(x, (0, i * frames[0].height))
        pal = sheet.quantize(colors=cols, method=Image.MEDIANCUT, dither=Image.NONE)
        q = [x.quantize(palette=pal, dither=Image.NONE) for x in frames]
        q[0].save(out, save_all=True, append_images=q[1:], loop=0, duration=ms, disposal=1, optimize=False)
        if Path(out).stat().st_size <= MAX_BYTES:
            break
    return {"frames": n, "loops": loops, "ms_total": T, "colours": cols, "kb": Path(out).stat().st_size // 1024}


def chosen(rows, race, motion, view, pick):
    key = f"{race}/{motion}-{view}"
    want = pick.get(key, "")
    for r in rows:
        if r["race"] == race and r["motion"] == motion and r["view"] == view and r.get("clip") and (r.get("variant") or "") == want and r["route"] == "P":
            return r
    return None


def main(argv=None):
    a = argv or sys.argv[1:]
    sets, manifest, tile, outdir, cfgp = a
    cfg = json.loads(Path(cfgp).read_text())
    rows = json.loads(Path(manifest).read_text())["rows"]
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    prefix = cfg["path_prefix"].rstrip("/")
    cards, report = [], []
    for race in cfg["races"]:
        groups = []
        for view in cfg["views"]:
            items = []
            for label, motion, variant in cfg["motions"]:
                pick = dict(cfg.get("pick", {}))
                if variant:
                    pick[f"{race['id']}/{motion}-{view}"] = variant
                r = chosen(rows, race["id"], motion, view, pick)
                if not r or not str(r["verdict"]).startswith("PASS"):
                    continue
                name = f"{race['id']}-{motion}{'-' + variant if variant else ''}-{view}.gif"
                info = make_gif(Path(sets) / r["clip"], race["id"], r["ms_per_frame"], tile, out / name)
                items.append([label, f"{prefix}/{name}"])
                report.append((name, info))
                print(name, info, flush=True)
            groups.append({"group": cfg["views_title"][view], "items": items})
        cards.append({"id": race["id"], "title": race["title"], "kind": "likeno", "text": race["text"], "rec": race["rec"], "yes": race["yes"], "no": race["no"], "switch": groups})
    spec = {"name": cfg["name"], "title": cfg["title"], "intro": cfg["intro"], "tabs": bool(cfg.get("tabs", True)), "cards": cards}
    (out / "spec.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("spec", out / "spec.json", sum(len(g["items"]) for c in cards for g in c["switch"]), "buttons")


if __name__ == "__main__":
    main()
