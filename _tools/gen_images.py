#!/usr/bin/env python3
"""Generate lavaluepro.com images with Google Gemini (gemini-2.5-flash-image).
Run on the Mac from the site folder:  python3 _tools/gen_images.py [workers]
Resumable: skips images that already exist. Logs to _tools/gen_images.log."""
import base64, io, json, os, sys, time, threading, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
KEY = open(os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Reports/_Claude/gemini-api-key.txt")).read().strip()
URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
TASKS = json.load(open(os.path.join(HERE, "image_tasks.json")))
LOG = open(os.path.join(HERE, "gen_images.log"), "a", buffering=1)
lock = threading.Lock()

def log(*a):
    with lock:
        print(time.strftime("%H:%M:%S"), *a, file=LOG)

def gen(prompt, tries=6):
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"responseModalities": ["IMAGE"]}}).encode()
    for t in range(tries):
        try:
            req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
            d = json.loads(urllib.request.urlopen(req, timeout=180).read())
            for p in d["candidates"][0]["content"]["parts"]:
                k = "inlineData" if "inlineData" in p else ("inline_data" if "inline_data" in p else None)
                if k:
                    return base64.b64decode(p[k]["data"])
            log("  no image part; retry", t)
        except urllib.error.HTTPError as e:
            log("  http", e.code, "retry", t)
            time.sleep(5 + 6 * t)
        except Exception as e:
            log("  err", str(e)[:140], "retry", t)
            time.sleep(5 + 6 * t)
    return None

def save(raw, rel, w, h):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    tr, ir = w / h, im.width / im.height
    if ir > tr:
        nw = int(im.height * tr); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = int(im.width / tr); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
    im = im.resize((w, h), Image.LANCZOS)
    fp = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    tmp = fp + ".part"
    im.save(tmp, "JPEG", quality=80, optimize=True, progressive=True)
    os.replace(tmp, fp)

def work(t):
    fp = os.path.join(SITE, t["path"])
    if os.path.exists(fp):
        return "skip"
    raw = gen(t["prompt"])
    if not raw:
        log("FAILED", t["path"]); return "fail"
    save(raw, t["path"], t["w"], t["h"])
    log("ok", t["path"])
    return "ok"

if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    log(f"=== start {len(TASKS)} tasks, {workers} workers ===")
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(work, TASKS))
    missing = [t["path"] for t in TASKS if not os.path.exists(os.path.join(SITE, t["path"]))]
    log(f"=== done ok={res.count('ok')} skip={res.count('skip')} fail={res.count('fail')} missing={len(missing)} ===")
    open(os.path.join(HERE, "gen_images.done"), "w").write(json.dumps({"missing": missing}))
