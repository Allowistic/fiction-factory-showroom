"""Owl Cove neon copy -> single-stroke polylines in sign-local metres (x right, y up, origin = bottom-centre of the backer).
Line 1 "Owl Cove." : Hershey 'scripts' (single-stroke script). Line 2 "NIGHT OWLS": Hershey 'futural' (monoline sans caps), tracked.
Hershey fonts: public-domain-derived vector data, via the MIT-licensed Hershey-Fonts package (vendor/)."""
import sys, os, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor'))
from HersheyFonts import HersheyFonts
LINE1, LINE2 = 'Owl Cove.', 'NIGHT OWLS'
BW, BH = 1.62, 0.50                       # backer
def strokes(font, text, track=0.0, word=None):
    h = HersheyFonts(); h.load_default_font(font); h.normalize_rendering(100)
    out, x0 = [], 0.0
    for ch in text:
        segs = list(h.lines_for_text(ch))
        # chain segments into polylines
        pls = []
        for a, b in segs:
            if pls and pls[-1][-1] == a: pls[-1].append(b)
            else: pls.append([a, b])
        xs = [p[0] for pl in pls for p in pl]
        adv = (max(xs) - min(xs)) if xs else 0
        # glyph advance from the font metrics (render 'ch' + 'I' trick is unreliable) -> use the package's own advance via lines of 'chX'
        out.append((ch, [[(p[0] + x0, p[1]) for p in pl] for pl in pls]))
        x0 += 0  # positions come from lines_for_text(text) below
    # use the font's own kerning/advance: render the whole text once, then split nothing (letters stay where the font puts them)
    segs = list(h.lines_for_text(text)); pls = []
    for a, b in segs:
        if pls and pls[-1][-1] == a: pls[-1].append(b)
        else: pls.append([a, b])
    return pls
def tracked(font, text, track, space):
    """per-letter placement with extra tracking (for the spaced caps line)"""
    h = HersheyFonts(); h.load_default_font(font); h.normalize_rendering(100)
    x, out = 0.0, []
    for ch in text:
        if ch == ' ': x += space; continue
        segs = list(h.lines_for_text(ch)); pls = []
        for a, b in segs:
            if pls and pls[-1][-1] == a: pls[-1].append(b)
            else: pls.append([a, b])
        xs = [p[0] for pl in pls for p in pl]; mn, mx = min(xs), max(xs)
        out += [[(p[0] - mn + x, p[1]) for p in pl] for pl in pls]; x += (mx - mn) + track
    return out
def fit(pls, x0, x1=None, y0=None, h=None, w=None, cx=0.0):
    xs = [p[0] for pl in pls for p in pl]; ys = [p[1] for pl in pls for p in pl]
    s = (w / (max(xs) - min(xs))) if w else h / (max(ys) - min(ys))
    mx = (max(xs) + min(xs)) / 2
    return [[((p[0] - mx) * s + cx, (p[1] - min(ys)) * s + y0) for p in pl] for pl in pls], s
def layout():
    l1 = strokes('scripts', LINE1)
    # tighten the word gap of the script line: shift every polyline right of the gap left
    xs = sorted({round(p[0], 3) for pl in l1 for p in pl})
    l1, s1 = fit(l1, 0, w=1.40, y0=0.185)
    caps = tracked('futural', LINE2, track=62.0, space=95.0)
    l2, s2 = fit(caps, 0, h=0.058, y0=0.066)
    # period: the Hershey dot is ~1 cm; make it a 22 mm tube ring so 'Cove.' keeps its period at 7 m
    def bb(pl): return min(p[0] for p in pl), max(p[0] for p in pl), min(p[1] for p in pl), max(p[1] for p in pl)
    dot = min(l1, key=lambda pl: (bb(pl)[1]-bb(pl)[0]) + (bb(pl)[3]-bb(pl)[2])); x0_, x1_, y0_, y1_ = bb(dot)
    cx_, cy_ = (x0_+x1_)/2, max((y0_+y1_)/2, 0.185+0.011); l1.remove(dot)
    l1.append([(cx_ + 0.011*math.cos(2*math.pi*i/16), cy_ + 0.011*math.sin(2*math.pi*i/16)) for i in range(17)])
    # owl-eye mark dotting the C: two small rings just above the C's upper terminal (the C is the first stroke starting right of the word gap)
    import statistics
    def bbox(pl): return min(p[0] for p in pl), max(p[0] for p in pl), min(p[1] for p in pl), max(p[1] for p in pl)
    starts = sorted(l1, key=lambda pl: bbox(pl)[0])
    gap_x = None
    # C stroke = the stroke whose bbox starts closest to the right of x=0.0 among tall strokes
    tall = [pl for pl in l1 if bbox(pl)[3] - bbox(pl)[2] > 0.15]
    C = min([pl for pl in tall if bbox(pl)[0] > -0.15], key=lambda pl: bbox(pl)[0])
    end = max((C[0], C[-1]), key=lambda p: p[1])          # upper terminal of the C
    r = 0.0125; eyes = []
    for k, dx in enumerate((-0.017, 0.017)):
        cx, cy = end[0] + dx + 0.012, end[1] + 0.030
        eyes.append([(cx + r * math.cos(2 * math.pi * i / 16), cy + r * math.sin(2 * math.pi * i / 16)) for i in range(17)])
    return {'line1': l1, 'line2': l2, 'eyes': eyes, 'scale': {'line1': s1, 'line2': s2}, 'copy': [LINE1, LINE2], 'backer': [BW, BH]}
if __name__ == '__main__':
    L = layout(); json.dump(L, open(sys.argv[1] if len(sys.argv) > 1 else 'strokes.json', 'w'))
    for k in ('line1', 'line2', 'eyes'):
        xs = [p[0] for pl in L[k] for p in pl]; ys = [p[1] for pl in L[k] for p in pl]
        ln = sum(math.dist(a, b) for pl in L[k] for a, b in zip(pl, pl[1:]))
        print(k, len(L[k]), 'strokes', 'x', round(min(xs), 3), round(max(xs), 3), 'y', round(min(ys), 3), round(max(ys), 3), 'len_m', round(ln, 2))
