"""Glow card for the Owl Cove neon: charred-wood face (Wood066 CC0, burnt down) with the tubes' amber halo baked in.
Opaque on purpose: it rides in the cantina atlas draw (no additive/transparent draw). Usage: make_card.py strokes.json out.png W H card_w card_h"""
import sys, json, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
S, OUT, W, H, CW, CH = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
L = json.load(open(S)); ppm = W / CW
wood = Image.open('/workspace/loft-xr/cantina/tex/Wood066/Wood066_1K-JPG_Color.jpg').convert('L')
# planks: tile the wood across the card, three horizontal boards with dark seams
base = Image.new('L', (W, H)); t = wood.resize((int(W / 2), int(W / 2)))
for x in range(0, W, t.width):
    for y in range(0, H, t.height): base.paste(t, (x, y))
base = ImageOps.autocontrast(base, cutoff=2)
# char: alligator crackle = random cell edges, lighter "ridge" sheen on the raised scales
random.seed(7); cr = Image.new('L', (W, H), 0); d = ImageDraw.Draw(cr)
for _ in range(900):
    x, y = random.uniform(0, W), random.uniform(0, H); w_ = random.uniform(10, 26); h_ = random.uniform(6, 14)
    d.rectangle([x, y, x + w_, y + h_], outline=255, width=1)
cr = cr.filter(ImageFilter.GaussianBlur(0.6))
seams = Image.new('L', (W, H), 0); ds = ImageDraw.Draw(seams)
for k in (1, 2): ds.line([(0, H * k / 3), (W, H * k / 3)], fill=255, width=3)
img = Image.new('RGB', (W, H))
px = base.load(); pc = cr.load(); psm = seams.load(); out = img.load()
for y in range(H):
    for x in range(W):
        b = px[x, y] / 255.0
        v = 0.045 + 0.075 * b - 0.03 * (pc[x, y] / 255.0) - 0.04 * (psm[x, y] / 255.0)
        v = max(0.012, v)
        out[x, y] = (int(255 * v * 0.95), int(255 * v * 0.86), int(255 * v * 1.05))   # burnt brown, faint indigo night cast
# halo from the tubes
mask = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(mask)
tw = max(2, int(0.012 * ppm))
for k in ('line1', 'line2', 'eyes'):
    for pl in L[k]:
        pts = [((x + CW / 2) * ppm, (CH - (y - (0.5 - CH) / 2)) * ppm) for x, y in pl]
        dm.line(pts, fill=255, width=tw, joint='curve')
g1 = mask.filter(ImageFilter.GaussianBlur(ppm * 0.012)); g2 = mask.filter(ImageFilter.GaussianBlur(ppm * 0.045)); g3 = mask.filter(ImageFilter.GaussianBlur(ppm * 0.11))
amb = (1.0, 0.52, 0.18)
p1, p2, p3 = g1.load(), g2.load(), g3.load()
for y in range(H):
    for x in range(W):
        a = min(1.0, 0.55 * p1[x, y] / 255 + 0.85 * p2[x, y] / 255 + 0.75 * p3[x, y] / 255)
        r, g, b = out[x, y]
        out[x, y] = (min(255, int(r + 255 * amb[0] * a * 0.62)), min(255, int(g + 255 * amb[1] * a * 0.62)), min(255, int(b + 255 * amb[2] * a * 0.62)))
img.save(OUT)
