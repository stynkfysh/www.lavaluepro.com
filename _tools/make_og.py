#!/usr/bin/env python3
"""Compose public/images/og.jpg (1200x630) from og-photo.jpg with the LA Value Pro brand overlay.
Type matches the site: Source Serif 4 for the name and headline, Atkinson Hyperlegible for supporting lines."""
import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
SRC = os.path.join(SITE, "public/images/og-photo.jpg"); DST = os.path.join(SITE, "public/images/og.jpg")
GF = "https://github.com/google/fonts/raw/main/ofl/"
FONTS = {
    "serif": ("SourceSerif4.ttf", GF + "sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf"),
    "text": ("AtkinsonHyperlegible-Regular.ttf", GF + "atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf"),
    "text-bold": ("AtkinsonHyperlegible-Bold.ttf", GF + "atkinsonhyperlegible/AtkinsonHyperlegible-Bold.ttf"),
}
FALLBACK = {"serif": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
            "text": "/System/Library/Fonts/Supplemental/Arial.ttf",
            "text-bold": "/System/Library/Fonts/Supplemental/Arial Bold.ttf"}
for key, (name, url) in FONTS.items():
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        try:
            urllib.request.urlretrieve(url, path)
        except Exception as e:
            print("font download failed:", name, e)

def font(kind, size, weight=650):
    path = os.path.join(HERE, FONTS[kind][0])
    try:
        f = ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(FALLBACK[kind], size)
    if kind == "serif":
        try:
            vals = []
            for ax in f.get_variation_axes():
                n = str(ax.get("name", "")).lower()
                if "optical" in n:
                    vals.append(max(ax["minimum"], min(ax["maximum"], size)))
                elif "weight" in n:
                    vals.append(weight)
                else:
                    vals.append(ax.get("default", ax["minimum"]))
            f.set_variation_by_axes(vals)
        except Exception as e:
            print("variation not applied:", e)
    return f

im = Image.open(SRC).convert("RGB").resize((1200, 630))
ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
for x in range(1200):
    a = int(235 * max(0.0, min(1.0, 1.15 - x / 820)))
    d.line([(x, 0), (x, 630)], fill=(36, 27, 74, a))
im = Image.alpha_composite(im.convert("RGBA"), ov)
d = ImageDraw.Draw(im)
s = 84; x0, y0 = 72, 70
d.rounded_rectangle([x0, y0, x0 + s, y0 + s], radius=19, fill="#5a45a3")
k = s / 40
pts = [(x0 + 8 * k, y0 + 28 * k), (x0 + 19 * k, y0 + 28 * k), (x0 + 19 * k, y0 + 14 * k), (x0 + 32 * k, y0 + 14 * k)]
d.line(pts, fill="white", width=int(3.6 * k), joint="curve")
r = 3.2 * k; d.ellipse([x0 + 19 * k - r, y0 + 14 * k - r, x0 + 19 * k + r, y0 + 14 * k + r], fill="#22a7bd")
d.text((x0 + s + 24, y0 + 6), "LA Value Pro", font=font("serif", 60, 700), fill="white")
d.text((72, 212), "Los Angeles County", font=font("serif", 60, 650), fill="white")
d.text((72, 280), "desktop appraisals", font=font("serif", 60, 650), fill="white")
d.text((72, 376), "Date of death, step-up in basis, trusts,", font=font("text", 30), fill="#e3def3")
d.text((72, 416), "gift tax, Prop 19, and divorce", font=font("text", 30), fill="#e3def3")
d.text((72, 530), "Brian Ward, Certified Residential Appraiser AR036053", font=font("text", 24), fill="#cfc8ec")
d.text((72, 566), "lavaluepro.com", font=font("text-bold", 26), fill="white")
im.convert("RGB").save(DST, "JPEG", quality=86, optimize=True, progressive=True)
print("og.jpg written", os.path.getsize(DST))
