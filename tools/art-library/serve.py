#!/usr/bin/env python3
"""Serves the GAME image library page on 127.0.0.1 and keeps the owner's hand sort (issue #658).

Standard library only. Bound to 127.0.0.1, serving one folder (the page's: index.html, thumb/, ids.json) and nothing else.

  GET  /...        the folder's files (never reviews.jsonl, ids.json or a dotfile; no directory listing)
  GET  /reviews    the owner's saved choices, the last line per id: {"<id>": {"review", "note", "at"}}
  POST /review     {"id", "review", "note"?} or {"ids": [...], "review", "note"?}: appended to reviews.jsonl, saved to disk
                   (fsync) before the answer says so. Only a known id and a known state; the body is capped.

Any website open in the owner's browser can send a request to localhost, so every request must carry a Host of
127.0.0.1:<port> or localhost:<port> (a DNS-rebinding page does not), and a POST must also carry an Origin of the same
two and a JSON content type. No CORS header is ever sent, so no other origin can read an answer.

  python3 serve.py [--port 8741] [--dir DIR]
"""
import argparse
import functools
import json
import os
import re
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

STATES = ("keep", "reuse-parts", "rework", "archive", "unreviewed")
REVIEWS_FILE = "reviews.jsonl"
IDS_FILE = "ids.json"
MAX_BODY = 256 * 1024
MAX_IDS = 5000  # the whole library is about 3200 pictures: select all, one request
MAX_NOTE = 300
ID_RE = re.compile(r"^[0-9a-f]{16}$")
HIDDEN = {REVIEWS_FILE, IDS_FILE}


class Refused(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


class Store:
    """reviews.jsonl and the ids the page holds, behind one lock."""

    def __init__(self, root):
        self.root = root
        self.reviews = os.path.join(root, REVIEWS_FILE)
        self.ids_path = os.path.join(root, IDS_FILE)
        self.lock = threading.Lock()
        self._ids = None
        self._ids_stamp = None

    def known_ids(self):
        """The ids of the page, re-read whenever the build writes a new ids.json."""
        try:
            stamp = os.stat(self.ids_path).st_mtime_ns
        except OSError:
            raise Refused(503, "ids.json is missing: build the page first (pnpm art:library)")
        with self.lock:
            if stamp != self._ids_stamp:
                try:
                    with open(self.ids_path, encoding="utf-8") as f:
                        self._ids = frozenset(i for i in json.load(f) if isinstance(i, str))
                except (OSError, ValueError):
                    raise Refused(503, "ids.json cannot be read")
                self._ids_stamp = stamp
            return self._ids

    def latest(self):
        """The last valid line per id. A torn or foreign line is skipped."""
        known = self.known_ids()
        out = {}
        try:
            with open(self.reviews, encoding="utf-8") as f:
                for raw in f:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        v = json.loads(raw)
                    except ValueError:
                        continue
                    if not isinstance(v, dict) or v.get("id") not in known or v.get("review") not in STATES:
                        continue
                    note = v.get("note", "")
                    if not isinstance(note, str):
                        continue
                    out[v["id"]] = {"review": v["review"], "note": note[:MAX_NOTE], "at": v.get("at") if isinstance(v.get("at"), str) else ""}
        except FileNotFoundError:
            pass
        return out

    def append(self, ids, review, note):
        now = datetime.now(timezone.utc)
        at = now.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (now.microsecond // 1000)
        data = "".join(json.dumps({"id": i, "review": review, "note": note, "at": at}, ensure_ascii=False) + "\n" for i in ids).encode("utf-8")
        with self.lock:
            fd = os.open(self.reviews, os.O_RDWR | os.O_APPEND | os.O_CREAT, 0o600)
            try:
                size = os.fstat(fd).st_size
                # a crash can leave a last line without its newline: ours starts on a line of its own
                if size > 0 and os.pread(fd, 1, size - 1) != b"\n":
                    data = b"\n" + data
                view = memoryview(data)
                while view:
                    view = view[os.write(fd, view):]
                os.fsync(fd)
            finally:
                os.close(fd)
        return at


def validate(body, known):
    """The ids, state and note of a POST body, or Refused."""
    if not isinstance(body, dict):
        raise Refused(400, "the body must be a JSON object")
    if ("id" in body) == ("ids" in body):
        raise Refused(400, "send either id or ids")
    ids = [body["id"]] if "id" in body else body["ids"]
    if not isinstance(ids, list) or not ids or len(ids) > MAX_IDS:
        raise Refused(400, "ids must be a list of 1 to %d ids" % MAX_IDS)
    for i in ids:
        if not isinstance(i, str) or not ID_RE.match(i):
            raise Refused(400, "not an id")
        if i not in known:
            raise Refused(422, "unknown id %s" % i)
    review = body.get("review")
    if review not in STATES:
        raise Refused(422, "unknown state")
    note = body.get("note", "")
    if not isinstance(note, str) or len(note) > MAX_NOTE:
        raise Refused(400, "the note must be text of at most %d characters" % MAX_NOTE)
    return list(dict.fromkeys(ids)), review, note.strip()


class Handler(SimpleHTTPRequestHandler):
    server_version = "art-library"
    timeout = 10  # a stalled client frees its thread

    def _allowed_hosts(self):
        port = self.server.server_address[1]
        return {"127.0.0.1:%d" % port, "localhost:%d" % port}

    def _send_json(self, code, value):
        data = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _refuse(self, code, message):
        self.close_connection = True
        self._send_json(code, {"error": message})

    def end_headers(self):
        path = urlsplit(self.path).path
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        # the page and the choices must be fresh at every load; a thumbnail is named by the hash of its picture
        if path.startswith("/thumb/"):
            self.send_header("Cache-Control", "max-age=86400")
        else:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def log_request(self, code="-", size="-"):
        # thumbnails are thousands of lines: log the saves and the refusals
        if self.command == "POST" or str(code)[:1] in "45":
            super().log_request(code, size)

    def _check_host(self):
        if self.headers.get("Host", "") not in self._allowed_hosts():
            raise Refused(403, "wrong Host")

    def list_directory(self, path):
        self.send_error(404, "No such file")
        return None

    def _hidden(self, path):
        parts = [p for p in path.split("/") if p]
        return any(p.startswith(".") or p in HIDDEN for p in parts)

    def do_GET(self):
        try:
            self._check_host()
            path = urlsplit(self.path).path
            if path == "/reviews":
                return self._send_json(200, self.server.store.latest())
            if self._hidden(path):
                return self.send_error(404, "No such file")
            return super().do_GET()
        except Refused as r:
            self._refuse(r.code, r.message)

    def do_HEAD(self):
        try:
            self._check_host()
            if self._hidden(urlsplit(self.path).path):
                return self.send_error(404, "No such file")
            return super().do_HEAD()
        except Refused as r:
            self._refuse(r.code, r.message)

    def do_POST(self):
        try:
            self._check_host()
            if urlsplit(self.path).path != "/review":
                raise Refused(404, "no such endpoint")
            origin = self.headers.get("Origin")
            if origin is None or origin not in {"http://" + h for h in self._allowed_hosts()}:
                raise Refused(403, "wrong Origin")
            if (self.headers.get("Content-Type", "").split(";")[0].strip().lower()) != "application/json":
                raise Refused(415, "send application/json")
            length = self.headers.get("Content-Length")
            if length is None or not length.isdigit():
                raise Refused(411, "send a Content-Length")
            if int(length) > MAX_BODY:
                raise Refused(413, "the body is over %d bytes" % MAX_BODY)
            raw = self.rfile.read(int(length))
            self._drained = True
            if len(raw) != int(length):
                raise Refused(400, "the body was cut short")
            try:
                body = json.loads(raw.decode("utf-8"))
            except ValueError:
                raise Refused(400, "the body is not JSON")
            ids, review, note = validate(body, self.server.store.known_ids())
            try:
                at = self.server.store.append(ids, review, note)
            except OSError as e:
                raise Refused(500, "could not save: %s" % e.strerror)
            self._send_json(200, {"saved": len(ids), "at": at})
        except Refused as r:
            self._drain()
            self._refuse(r.code, r.message)

    def _drain(self):
        """Take an unread body off the socket (up to 1 MiB), so closing on a refusal does not reset the connection under the answer."""
        length = self.headers.get("Content-Length", "")
        left = min(int(length), 1 << 20) if length.isdigit() and not getattr(self, "_drained", False) else 0
        while left > 0:
            chunk = self.rfile.read(min(left, 65536))
            if not chunk:
                break
            left -= len(chunk)

    # no OPTIONS, PUT, DELETE or PATCH: the base class answers 501, and no CORS header exists to be asked for


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, store):
        self.store = store
        super().__init__(address, handler)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8741)
    ap.add_argument("--dir", default=".", help="the page's folder")
    args = ap.parse_args(argv)
    root = os.path.abspath(args.dir)
    if not os.path.isdir(root):
        print("art-library: %s is not a folder" % root, file=sys.stderr)
        return 2
    store = Store(root)
    httpd = Server(("127.0.0.1", args.port), functools.partial(Handler, directory=root), store)
    print("art-library: serving %s on http://127.0.0.1:%d" % (root, httpd.server_address[1]), file=sys.stderr, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
