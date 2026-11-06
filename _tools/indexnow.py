#!/usr/bin/env python3
"""Submit every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver share submissions). Run after a deploy."""
import glob, json, os, re, urllib.request

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(SITE, "public")
key_files = [f for f in glob.glob(os.path.join(PUB, "*.txt")) if re.fullmatch(r"[0-9a-f]{32}\.txt", os.path.basename(f))]
KEY = os.path.basename(key_files[0])[:-4]
urls = re.findall(r"<loc>([^<]+)</loc>", open(os.path.join(PUB, "sitemap.xml")).read())
body = json.dumps({"host": "lavaluepro.com", "key": KEY, "keyLocation": f"https://lavaluepro.com/{KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
try:
    r = urllib.request.urlopen(req, timeout=60)
    print("IndexNow", r.status, len(urls), "urls")
except urllib.error.HTTPError as e:
    print("IndexNow HTTP", e.code, e.read()[:300])
