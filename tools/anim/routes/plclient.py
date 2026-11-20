#!/usr/bin/env python3
"""One PixelLab job from a JSON spec, for the animation routes trial (#762). Python 3 standard library only.

  python3 plclient.py TOKEN_FILE SPEC.json OUT_DIR
  python3 plclient.py TOKEN_FILE --balance

SPEC.json: {"name": "...", "path": "/animate-pixminimax", "body": {...}}. A string value in the body that starts with "@" is a
PNG file path (relative to the spec) and is sent as a base64 image object. The token is read from its file, goes into one
header to api.pixellab.ai only, and is never printed or written. The balance is read before and after and both go to
OUT_DIR/ledger.jsonl with the job id and the fall, so the real cost of a job is the server's number, not an estimate.
Frames come back as OUT_DIR/p00.png ...; the response with the pictures cut out is OUT_DIR/response.json."""
from __future__ import annotations
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

API = "https://api.pixellab.ai/v2"
# The paid account the order of #762 names. Pass "-" as TOKEN_FILE to read it; any other path is read instead.
DEFAULT_TOKEN = Path.home() / ".claude" / "secrets" / "pixellab-token-trial1.txt"


def token_from(arg: str) -> str:
    return (DEFAULT_TOKEN if arg == "-" else Path(arg)).read_text().strip()


def _req(token: str, method: str, path: str, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(API + path, data=data, method=method, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f:
            return f.status, json.loads(f.read().decode() or "null")
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace").replace(token, "[token]")[:600]
        return e.code, {"error": text}


def balance(token: str) -> float:
    st, j = _req(token, "GET", "/balance")
    if st != 200:
        raise SystemExit(f"balance: HTTP {st}")
    return float(j["subscription"]["generations"])


def load_body(body, base: Path):
    if isinstance(body, dict):
        return {k: load_body(v, base) for k, v in body.items()}
    if isinstance(body, list):
        return [load_body(v, base) for v in body]
    if isinstance(body, str) and body.startswith("@"):
        raw = (base / body[1:]).read_bytes()
        return {"type": "base64", "base64": base64.b64encode(raw).decode(), "format": "png"}
    return body


def find_images(o, out):
    """Every base64 picture in an answer, in order of appearance."""
    if isinstance(o, dict):
        if isinstance(o.get("base64"), str):
            out.append(o["base64"])
        else:
            for v in o.values():
                find_images(v, out)
    elif isinstance(o, list):
        for v in o:
            find_images(v, out)
    return out


def strip_images(o):
    if isinstance(o, dict):
        return {k: ("<png>" if k == "base64" else strip_images(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [strip_images(v) for v in o]
    return o


def run(token: str, spec_path: Path, out: Path):
    spec = json.loads(spec_path.read_text())
    out.mkdir(parents=True, exist_ok=True)
    before = balance(token)
    body = load_body(spec["body"], spec_path.parent)
    st, j = _req(token, "POST", spec["path"], body, timeout=120)
    if st >= 400 or not isinstance(j, dict):
        print("submit failed", st, json.dumps(j)[:500])
        return 1
    jid = j.get("background_job_id") or j.get("id") or (j.get("data") or {}).get("background_job_id")
    if not jid:  # a call answered at once (estimate-skeleton): keep the answer
        after = balance(token)
        (out / "response.json").write_text(json.dumps(strip_images(j), indent=1))
        line = {"name": spec.get("name"), "path": spec["path"], "job": None, "before": before, "after": after, "fall": round(before - after, 3)}
        with (out / "ledger.jsonl").open("a") as f:
            f.write(json.dumps(line) + "\n")
        print(json.dumps(line))
        return 0
    t0 = time.time()
    while True:
        time.sleep(8)
        st, r = _req(token, "GET", f"/background-jobs/{jid}")
        status = (r or {}).get("status")
        if status in ("completed", "failed") or time.time() - t0 > 1500:
            break
    after = balance(token)
    imgs = find_images((r or {}).get("last_response"), [])
    for i, b in enumerate(imgs):
        (out / f"p{i:02d}.png").write_bytes(base64.b64decode(b))
    (out / "response.json").write_text(json.dumps(strip_images(r), indent=1))
    line = {"name": spec.get("name"), "path": spec["path"], "job": jid, "status": status, "images": len(imgs), "before": before, "after": after, "fall": round(before - after, 3), "seconds": round(time.time() - t0)}
    with (out / "ledger.jsonl").open("a") as f:
        f.write(json.dumps(line) + "\n")
    print(json.dumps(line))
    return 0 if status == "completed" else 1


def main():
    if len(sys.argv) >= 3 and sys.argv[2] == "--balance":
        print(balance(token_from(sys.argv[1])))
        return 0
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    token = token_from(sys.argv[1])
    return run(token, Path(sys.argv[2]), Path(sys.argv[3]))


if __name__ == "__main__":
    sys.exit(main())
