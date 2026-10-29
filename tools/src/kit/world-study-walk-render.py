"""Read-only adapter for the retained race renderer; adds projected diagonal views.

The job pins the upstream renderer's bytes. Nothing in its checkout is modified.
Run with Blender -b --factory-startup --offline-mode -P this-file -- job.json.
"""
import hashlib
import json
from pathlib import Path
import sys

job = json.loads(Path(sys.argv[sys.argv.index("--") + 1]).read_text())
renderer = Path(job["renderer"])
source = renderer.read_bytes()
if hashlib.sha256(source).hexdigest() != job["renderer_sha256"]:
    raise RuntimeError("The retained race renderer changed; inspect it before rebuilding")
old = 'DIRS = {k: v for k, v in {"down": 0.0, "up": math.pi, "left": math.pi / 2}.items() if k in cfg.get("dirs", ["down", "up", "left"])}'
text = source.decode()
if text.count(old) != 1:
    raise RuntimeError("The retained renderer's view hook is not the expected one")
text = text.replace(old, 'DIRS = cfg["view_angles"]')
exec(compile(text, str(renderer), "exec"), {"__file__": str(renderer), "__name__": "__main__"})
