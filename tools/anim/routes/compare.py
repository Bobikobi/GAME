#!/usr/bin/env python3
"""The moving comparison page of the animation routes trial (#762): compare.py MANIFEST.json OUT.html

MANIFEST.json: {"clips": [{"id", "name", "dir" (frames f*.png), "ms" (own frame time), "measures" (a measure.py json path),
"cost" (text), "hand" (text), "note" (text)}]}. One self-contained page (frames inlined as data URIs): every clip loops at its own
frame rate at 3x with a 1x copy beside it, a speed slider, play/pause and a step-by-frame button, two clips per row at 844 px.
Pure helper `bar_lines` (the label numbers) is tested in test_compare.py."""
from __future__ import annotations
import base64
import glob
import json
import sys
from pathlib import Path


def bar_lines(m: dict, frames: int, ms: float) -> list[str]:
    """The B1-B4 numbers of one clip as short label lines."""
    return [
        f"{frames} frames, {ms:g} ms each = {1000 / ms:.0f} fps",
        f"B1 height {m['b1_height_min']}-{m['b1_height_max']} px (stance {m['b1_height_stance']}), palette dist {m['b1_palette_dist_mean']:g}",
        f"B2 foot edge drift {m['b2_foot_edge_drift']} px, ground row spread {m['b2_lowest_row_spread']} px",
        f"B3 limb jump mean {m['b3_limb_jump_mean']:g} max {m['b3_limb_jump_max']:g} px, pixel change max {m['b3_mad_max']:g}",
        f"B4 loop close jump {m['b4_close_limb_jump']:g} px ({'ok' if m['b4_loop_ok'] else 'FAILS'})",
    ]


def data_uri(p: str) -> str:
    return "data:image/png;base64," + base64.b64encode(Path(p).read_bytes()).decode()


def build(manifest: dict) -> str:
    clips = []
    for c in manifest["clips"]:
        files = sorted(glob.glob(str(Path(c["dir"]) / "f*.png")))
        m = json.load(open(c["measures"]))
        clips.append({"id": c["id"], "name": c["name"], "ms": c["ms"], "frames": [data_uri(f) for f in files],
                      "lines": bar_lines(m, len(files), c["ms"]) + [c.get("cost", ""), c.get("hand", "")], "note": c.get("note", "")})
    return PAGE.replace("__CLIPS__", json.dumps(clips))


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Animation routes</title><style>
:root{--bg:#10140f;--card:#1a2018;--ink:#e8efe3;--dim:#9fb09a;--stage:#7a8f7a;--accent:#e9a23b}
@media (prefers-color-scheme:light){:root{--bg:#f2f4ee;--card:#fff;--ink:#1d241b;--dim:#566352}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.35 system-ui,sans-serif;padding:12px 16px}
h1{font-size:18px;margin:4px 0}.bar{position:sticky;top:0;background:var(--bg);padding:8px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;z-index:2}
button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--dim);background:var(--card);color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.card{background:var(--card);border-radius:8px;padding:8px;min-width:0}.card h2{font-size:14px;margin:0 0 4px}
.stage{display:flex;gap:8px;align-items:flex-end;background:var(--stage);border-radius:6px;padding:4px;justify-content:space-between}
canvas{image-rendering:pixelated;display:block}.c3{width:100%;max-width:384px;aspect-ratio:1}.c1{width:128px;height:128px}
.l{color:var(--dim);font-size:11.5px;margin-top:4px}.l b{color:var(--ink)}.f{font-variant-numeric:tabular-nums}
@media (max-width:560px){.grid{grid-template-columns:1fr}}
</style></head><body><h1>Fell, human, left view: animation routes (#762)</h1>
<div class="bar"><button id="pp">Pause</button><button id="st">Step frame</button><label>Speed <input id="sp" type="range" min="0.1" max="2" step="0.05" value="1"> <span id="spv">1.00x</span></label></div>
<div class="grid" id="g"></div><script>
const CLIPS=__CLIPS__;let speed=1,playing=true;const S=[];
function mk(c){const d=document.createElement('div');d.className='card';d.innerHTML='<h2>'+c.name+'</h2><div class="stage"><canvas class="c3" width="128" height="128"></canvas><canvas class="c1" width="128" height="128"></canvas></div><div class="l f"></div>';document.getElementById('g').appendChild(d);
const cv=d.querySelectorAll('canvas'),lab=d.querySelector('.l');lab.innerHTML=c.lines.filter(Boolean).map((x,i)=>i==0?'<b>'+x+'</b>':x).join('<br>')+(c.note?'<br><i>'+c.note+'</i>':'')+'<br><span class="fr"></span>';
const imgs=c.frames.map(s=>{const i=new Image();i.src=s;return i});const st={c,cv,fr:d.querySelector('.fr'),imgs,i:0,t:0};S.push(st);show(st)}
function show(s){for(const k of s.cv){const x=k.getContext('2d');x.clearRect(0,0,128,128);const im=s.imgs[s.i];if(im.complete)x.drawImage(im,0,0)}s.fr.textContent='frame '+(s.i+1)+' / '+s.imgs.length}
CLIPS.forEach(mk);let last=performance.now();
function tick(n){const dt=n-last;last=n;if(playing)for(const s of S){s.t+=dt*speed;while(s.t>=s.c.ms){s.t-=s.c.ms;s.i=(s.i+1)%s.imgs.length;show(s)}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
document.getElementById('pp').onclick=e=>{playing=!playing;e.target.textContent=playing?'Pause':'Play'};
document.getElementById('st').onclick=()=>{playing=false;document.getElementById('pp').textContent='Play';for(const s of S){s.i=(s.i+1)%s.imgs.length;show(s)}};
document.getElementById('sp').oninput=e=>{speed=+e.target.value;document.getElementById('spv').textContent=speed.toFixed(2)+'x'};
</script></body></html>"""


def main() -> None:
    man = json.load(open(sys.argv[1]))
    Path(sys.argv[2]).write_text(build(man))
    print("wrote", sys.argv[2])


if __name__ == "__main__":
    main()
