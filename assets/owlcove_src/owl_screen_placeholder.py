# Owl Cove dj-screen placeholder (along-arc aspect ~2.71): indigo field, warm amber/brass bars, no teal. Replaced at runtime by Jules's visualizer canvas.
import sys, math
from PIL import Image, ImageDraw
W, H = 1024, 378
im = Image.new('RGB', (W, H), (10, 9, 30)); dr = ImageDraw.Draw(im)
for x in range(0, W, 32): dr.line([(x, 0), (x, H)], fill=(20, 18, 52))
for y in range(0, H, 32): dr.line([(0, y), (W, y)], fill=(20, 18, 52))
for i in range(52):
    h = int(20 + 120 * abs(math.sin(i * 0.63))); col = (226, 150, 60) if i % 3 else (184, 128, 58)
    dr.rectangle([40 + i * 18.4, 330 - h * 2, 51 + i * 18.4, 330], fill=col)
dr.rectangle([2, 2, W - 3, H - 3], outline=(184, 135, 62), width=3); dr.text((22, 16), 'OWL COVE dj-screen  (along-arc 2.44 x 0.90 m, aspect 2.71)  -  replaced by the live visualizer', fill=(255, 176, 96))
im.save(sys.argv[1], quality=88)
