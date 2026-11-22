"""A small PixelLab caller for the clothing-sets lane (brought in from the clothing-look trial).

One paid account, found through tools/kit-gen/pixellab/pool.json (the first account whose plan is "paid"): the token file's
name is read from the pool config and the token goes to one header, never to a log, an error line or the ledger.
Calls go one at a time; every call appends a ledger line with the server's balance before and after, so a batch can be
reconciled against the cap. Pictures that come back are written under the out directory the caller names.
"""
import base64
import datetime
import io
import json
import os
import time
import urllib.error
import urllib.request

from PIL import Image

HOME = os.path.expanduser('~')
API = 'https://api.pixellab.ai/v2'
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POOL = os.path.join(REPO, 'tools', 'kit-gen', 'pixellab', 'pool.json')
CAP = float(os.environ.get('CLOTHING_CAP', '600'))
LEDGER = os.environ.get('CLOTHING_LEDGER', os.path.join(REPO, '.scratch', 'clothing-sets', 'ledger.jsonl'))


def paid_account(pool_path=POOL):
    """The pool config entry of the paid account, with its index; the config is the one place that names token files."""
    cfg = json.load(open(pool_path))
    for i, a in enumerate(cfg['accounts']):
        if a.get('plan', 'paid') == 'paid':
            d = os.path.expanduser(cfg.get('dir') or os.environ.get('PIXELLAB_SECRETS_DIR') or os.path.join(os.path.expanduser('~'), '.claude', 'secrets'))
            return i, a['label'], os.path.join(d, a['file'])
    raise RuntimeError('pool.json lists no paid account')


_TOKEN = None


def token():
    global _TOKEN
    if _TOKEN is None:
        _TOKEN = open(paid_account()[2]).read().strip()
    return _TOKEN


def _req(method, path, body=None, timeout=120):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json',
                                        'User-Agent': 'game-art/1.0'})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f:
            return f.status, json.loads(f.read() or b'null')
    except urllib.error.HTTPError as e:
        t = e.read().decode(errors='replace')[:600]
        return e.code, {'error': t.replace(token(), '***')}


def balance():
    s, j = _req('GET', '/balance')
    return j['subscription']['generations'] if s == 200 else None


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def img(im):
    return {'type': 'base64', 'base64': b64(im), 'format': 'png'}


def dec(s):
    if s.startswith('data:'):
        s = s.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(s))).convert('RGBA')


def find_images(node, out):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('base64', 'image') and isinstance(v, str) and len(v) > 200:
                out.append(v)
            else:
                find_images(v, out)
    elif isinstance(node, list):
        for v in node:
            if isinstance(v, str) and len(v) > 200:
                out.append(v)
            else:
                find_images(v, out)
    return out


def call(path, body, label, outdir, max_wait=600, ledger=None):
    """POST, poll the background job, save the pictures as outdir/label-N.png, append a ledger line. Returns the file list or None."""
    ledger = ledger or LEDGER
    os.makedirs(outdir, exist_ok=True)
    os.makedirs(os.path.dirname(ledger), exist_ok=True)
    if spent_total(ledger) >= CAP:
        raise RuntimeError(f'cap of {CAP} generations reached: stop and report')

    def log(rec):
        with open(ledger, 'a') as f:
            f.write(json.dumps(rec) + '\n')

    before = balance()
    t0 = time.time()
    st, j = _req('POST', path, body)
    rec = {'at': datetime.datetime.now().isoformat(timespec='seconds'), 'label': label, 'path': path, 'status': st, 'before': before}
    if st not in (200, 202):
        rec['error'] = j
        log(rec)
        print('FAILED', label, st, str(j)[:300])
        return None
    jid = (j or {}).get('background_job_id') or (j or {}).get('id')
    res = j
    if jid:
        rec['job'] = jid
        while time.time() - t0 < max_wait:
            time.sleep(6)
            s2, j2 = _req('GET', f'/background-jobs/{jid}')
            if s2 != 200:
                continue
            if j2.get('status') == 'completed':
                res = j2
                break
            if j2.get('status') in ('failed', 'cancelled'):
                rec['error'] = j2
                log(rec)
                print('FAILED', label, str(j2)[:300])
                return None
        else:
            rec['error'] = 'timeout'
            log(rec)
            print('TIMEOUT', label)
            return None
    after = balance()
    uniq = []
    for x in find_images(res, []):
        if x not in uniq:
            uniq.append(x)
    files = []
    for n, s in enumerate(uniq):
        p = f'{outdir}/{label}-{n}.png'
        dec(s).save(p)
        files.append(p)
    gens = ((res or {}).get('usage') or {}).get('generations')
    rec.update(gens=gens, after=after, spent=None if before is None or after is None else before - after,
               seconds=round(time.time() - t0, 1), usage=(res or {}).get('usage'), files=files)
    log(rec)
    print(label, 'spent', rec['spent'], 'usage', rec['usage'], 'files', len(files), 's', rec['seconds'])
    return files


def spent_total(ledger=None):
    """Generations this lane spent, summed from each job's own usage. Never from the balance's before/after: another lane
    spends from the same balance at the same time, so a balance difference counts its spend too."""
    ledger = ledger or LEDGER
    if not os.path.exists(ledger):
        return 0.0
    n = 0.0
    for l in open(ledger):
        if l.strip():
            r = json.loads(l)
            n += float(r.get('gens') or 0)
    return n
