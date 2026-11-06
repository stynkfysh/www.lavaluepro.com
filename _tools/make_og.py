#!/usr/bin/env python3
"""Compose public/images/og.jpg (1200x630) from og-photo.jpg with the LA Value Pro brand overlay."""
import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
SRC = os.path.join(SITE, "public/images/og-photo.jpg"); DST = os.path.join(SITE, "public/images/og.jpg")
FONT = os.path.join(HERE, "BricolageGrotesque.ttf")
if not os.path.exists(FONT):
    try:
        urllib.request.urlretrieve("https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz,wdth,wght%5D.ttf", FONT)
    except Exception as e:
        print("font download failed:", e)

def font(size, weight=800, width=85):
    try:
        f = ImageFont.truetype(FONT, size)
        try:
            f.set_variation_by_axes([96 if size > 40 else 24, weight, width])  # axis order: opsz, wght, wdth
        except Exception:
            pass
        return f
    except Exception:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)

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
d.text((x0 + s + 24, y0 + 4), "LA Value Pro", font=font(64), fill="white")
d.text((72, 214), "Los Angeles County", font=font(58, 800, 80), fill="white")
d.text((72, 280), "desktop appraisals", font=font(58, 800, 80), fill="white")
d.text((72, 372), "Date of death, step-up in basis, trusts,", font=font(30, 600, 95), fill="#e3def3")
d.text((72, 412), "gift tax, Prop 19, and divorce", font=font(30, 600, 95), fill="#e3def3")
d.text((72, 530), "Brian Ward, Certified Residential Appraiser AR036053", font=font(24, 600, 95), fill="#cfc8ec")
d.text((72, 566), "lavaluepro.com", font=font(26, 800, 90), fill="white")
im.convert("RGB").save(DST, "JPEG", quality=86, optimize=True, progressive=True)
print("og.jpg written", os.path.getsize(DST))
