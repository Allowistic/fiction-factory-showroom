"""Owl Cove bandshell DJ booth (owlcove_dj_booth). Booth-local glTF frame as before: x right, y up, +z toward the crowd; deck A at -x (crowd's left).
- Concave screen 'dj-screen' (ONE mesh, own material owlcove_dj_screen): 100 deg of a R 1.4 m arc centred at (0, 0.60), apex z -0.80 behind Dex,
  y 1.30..2.20, UV u 0..1 left->right along the arc as the crowd sees it, v 0..1 bottom->top.
- Counter follows the same R 1.4 curvature (front arc centre (0, 1.70)): walnut frame, brass edge band, rattan-wrapped front panels.
- Decks/mixer reused from the cantina booth; each deck yawed tangent to the counter arc about its platter centre, so platter centres and the
  xfader are exactly where they were: joints booth / platterA / platterB / xfader unchanged (identity rest rotations). Dex stays at (0, 0.25, -0.45).
- Draws in the GLB: atlas + owlcove_glow_amber + owlcove_glow_indigo + screen = 4 (at runtime the first three ride the rigged SkinnedMesh)."""
import sys; sys.path.insert(0, '/workspace/loft-xr/assets/owlcove_src')
from owl_common import *
name = 'owlcove_dj_booth'; OUTD = os.environ.get('OUTDIR', DST)
reset(); mats(); mats2(); owl_mats(); rig_owl(); PARTS.clear(); BONES.clear()
def g(x, yu, zf): return (x, -zf, yu)
CF, RF = 1.70, 1.4            # counter front arc centre z / radius (concave to the crowd)
CB, RB = 1.725, 2.0           # counter back arc (keeps Dex's base 5 mm clear at x=0, holds the yawed decks)
CS, RS = 0.60, 1.4            # screen arc centre z / radius: apex z = -0.80
zf = lambda x: CF - math.sqrt(RF * RF - x * x); zb = lambda x: CB - math.sqrt(RB * RB - x * x)
def zs(r): return lambda x: CS - math.sqrt(r * r - x * x)
def cslab(grp, ffront, fback, x0, x1, y0, y1, k, n=24):
    """closed curved slab between z=ffront(x) (crowd side) and z=fback(x), x0..x1, y0..y1"""
    bm = bmesh.new(); F, Bk = [], []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        F.append([bm.verts.new(g(x, y, ffront(x))) for y in (y0, y1)]); Bk.append([bm.verts.new(g(x, y, fback(x))) for y in (y0, y1)])
    for i in range(n):
        bm.faces.new((F[i][0], F[i + 1][0], F[i + 1][1], F[i][1])); bm.faces.new((Bk[i][1], Bk[i + 1][1], Bk[i + 1][0], Bk[i][0]))
        bm.faces.new((F[i][1], F[i + 1][1], Bk[i + 1][1], Bk[i][1])); bm.faces.new((Bk[i][0], Bk[i + 1][0], F[i + 1][0], F[i][0]))
    for i in (0, n): bm.faces.new((F[i][0], F[i][1], Bk[i][1], Bk[i][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('s'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('s', me); bpy.context.collection.objects.link(o)
    return part(grp, tag, o, k)
def polar(grp, c, ri, ro, a0, a1, y0, y1, k, n=28):
    """closed arc slab about (0, c): radius ri (concave face, crowd side) .. ro, angles a0..a1 (deg, 0 = straight behind on -z)"""
    bm = bmesh.new(); F, Bk = [], []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        F.append([bm.verts.new(g(ri * math.sin(a), y, c - ri * math.cos(a))) for y in (y0, y1)]); Bk.append([bm.verts.new(g(ro * math.sin(a), y, c - ro * math.cos(a))) for y in (y0, y1)])
    for i in range(n):
        bm.faces.new((F[i][0], F[i + 1][0], F[i + 1][1], F[i][1])); bm.faces.new((Bk[i][1], Bk[i + 1][1], Bk[i + 1][0], Bk[i][0]))
        bm.faces.new((F[i][1], F[i + 1][1], Bk[i + 1][1], Bk[i][1])); bm.faces.new((Bk[i][0], Bk[i + 1][0], F[i + 1][0], F[i][0]))
    for i in (0, n): bm.faces.new((F[i][0], F[i][1], Bk[i][1], Bk[i][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('p', me); bpy.context.collection.objects.link(o)
    return part(grp, tag, o, k)
off = lambda f, d: (lambda x: f(x) + d)
AMB = ('owlcove_glow_amber', AMBER_GLOW, 2.5); IND = ('owlcove_glow_indigo', INDIGO_GLOW, 2.5)
HW = 0.95
# ---- counter: plinth, walnut body, rattan front panels in a walnut frame, brass edge bands, leather top ----
cslab('booth', off(zf, -0.03), off(zb, 0.02), -HW + 0.02, HW - 0.02, 0.0, 0.12, 'char')
cslab('booth', zf, zb, -HW, HW, 0.12, 0.96, 'walnut')
cslab('booth', off(zf, 0.004), off(zf, -0.02), -HW - 0.002, HW + 0.002, 0.115, 0.13, 'brass_old')                  # brass band at the plinth
for xa, xb in ((-0.885, -0.335), (-0.265, 0.265), (0.335, 0.885)):
    cslab('booth', off(zf, 0.010), off(zf, -0.01), xa, xb, 0.17, 0.84, 'rattan', n=12)                                 # rattan-wrapped panels
for xc in (-0.915, -0.30, 0.30, 0.915):
    cslab('booth', off(zf, 0.018), off(zf, -0.01), xc - 0.025, xc + 0.025, 0.13, 0.86, 'walnut', n=2)                 # walnut stiles
cslab('booth', off(zf, 0.016), off(zf, -0.01), -HW + 0.01, HW - 0.01, 0.84, 0.90, 'walnut')                          # top rail
cslab('booth', off(zf, 0.016), off(zf, -0.01), -HW + 0.01, HW - 0.01, 0.13, 0.17, 'walnut')                          # bottom rail
cslab('booth', off(zf, 0.025), off(zb, -0.015), -HW - 0.02, HW + 0.02, 0.962, 1.0, 'walnut')                         # top lip
cslab('booth', off(zf, 0.033), off(zf, 0.012), -HW - 0.024, HW + 0.024, 0.955, 1.004, 'brass_old')                   # brass edge band
cslab('booth', off(zf, -0.02), off(zb, 0.02), -HW + 0.02, HW - 0.02, 1.0, 1.008, 'leather')                          # leather top pad
cslab('booth', off(zf, -0.027), off(zf, -0.045), -HW + 0.03, HW - 0.03, 0.10, 0.11, AMB)                               # amber kick light under the overhang
# 'request a song' plaque on the right panel (dj-request pick proxy sits here), turned to the arc normal
xq = 0.55; th = math.asin(-xq / RF); nq = V((math.sin(th), math.cos(th))); P0 = V((xq, zf(xq)))
for d_, s_, k_ in ((0.016, (0.24, 0.012, 0.14), 'brass_old'), (0.024, (0.2, 0.006, 0.1), 'brass_old')):
    p = P0 + nq * d_; part('booth', box, g(p.x, 0.62, p.y), s_, k_, rz=th)
for w_, yy in ((0.15, 0.645), (0.12, 0.62), (0.15, 0.595)):
    p = P0 + nq * 0.0275; part('booth', box, g(p.x, yy, p.y), (w_, 0.002, 0.008), 'char', rz=th)
# ---- engraved brass MUSIC CREDITS plaque (A5 210 x 148 mm) on the left panel, mirror of the request plaque; folded into the atlas (no draw).
# Generic header + faint ruled lines only (the real CC credits live on Jules's guestbook page). Edge-band style: brass_old plate with a raised brass rim.
sys.path.insert(0, OSRC); from owl_text import tracked, fit
M['brass_engr'] = texmat('brass_engr', 'Metal032', (0.20, 0.13, 0.06), 1.0, 0.65, 1.0)     # engraved, tarnish-filled cut
M['brass_rule'] = texmat('brass_rule', 'Metal032', (0.46, 0.32, 0.15), 1.0, 0.6, 1.0)      # faint ruled lines
xc_ = -0.55; thc = math.asin(-xc_ / RF); ncv = V((math.sin(thc), math.cos(thc))); tcv = V((math.cos(thc), -math.sin(thc))); PC = V((xc_, zf(xc_))); YC = 0.62
PW, PH = 0.210, 0.148
part('booth', box, g(*(lambda p: (p.x, YC, p.y))(PC + ncv * 0.016)), (PW, 0.006, PH), 'brass_old', rz=thc)          # plate, faces 0.013..0.019 off the panel arc
for (du, dv, w_, h_) in ((0, PH / 2 - 0.004, PW, 0.008), (0, -PH / 2 + 0.004, PW, 0.008), (-PW / 2 + 0.004, 0, 0.008, PH - 0.016), (PW / 2 - 0.004, 0, 0.008, PH - 0.016)):
    p = PC + ncv * 0.021 + tcv * du; part('booth', box, g(p.x, YC + dv, p.y), (w_, 0.004, h_), 'brass_old', rz=thc)   # raised rim (edge-band profile)
def engr(segs, wd, k, d0=0.0188, d1=0.0198):
    """closed thin boxes lying in the plate face: each segment (u0,v0)-(u1,v1) in plate coords (m, origin = plate centre)"""
    bm = bmesh.new()
    for (u0, v0), (u1, v1) in segs:
        du, dv = u1 - u0, v1 - v0; L = math.hypot(du, dv) or 1e-6; eu, ev = du / L, dv / L; pu, pv = -ev * wd / 2, eu * wd / 2
        a0, a1 = (u0 - eu * wd / 2, v0 - ev * wd / 2), (u1 + eu * wd / 2, v1 + ev * wd / 2)
        q = []
        for d_ in (d0, d1):
            for (uu, vv) in ((a0[0] - pu, a0[1] - pv), (a1[0] - pu, a1[1] - pv), (a1[0] + pu, a1[1] + pv), (a0[0] + pu, a0[1] + pv)):
                p = PC + tcv * uu + ncv * d_; q.append(bm.verts.new(g(p.x, YC + vv, p.y)))
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): bm.faces.new([q[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('engr'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('engr', me); bpy.context.collection.objects.link(o)
    # whole strokes survive decimate; tag them so lod1 can drop the engraving and keep plate + rim
    vg = o.vertex_groups.new(name='lod1_drop'); vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return part('booth', tag, o, k)
hdr, _ = fit(tracked('futural', 'MUSIC CREDITS', track=18.0, space=55.0), 0, h=0.016, y0=PH / 2 - 0.040)
def simp(pl, tol=0.0007):
    out = [pl[0]]
    for p in pl[1:-1]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= tol * 3: out.append(p)
    out.append(pl[-1]); return out
HS = [(a, b) for pl in hdr for a, b in zip(simp(pl), simp(pl)[1:])]
engr(HS, 0.0018, 'brass_engr')
engr([((-0.012 - (0.060 - 0.006 * i), PH / 2 - 0.050), (0.012 + (0.060 - 0.006 * i), PH / 2 - 0.050)) for i in (0,)], 0.0010, 'brass_engr')   # rule under the header
engr([((-0.084, PH / 2 - 0.066 - 0.0135 * i), (0.084, PH / 2 - 0.066 - 0.0135 * i)) for i in range(5)], 0.0008, 'brass_rule', d0=0.0188, d1=0.0193)   # faint ruled lines
print('PLAQUE_HEADER_SEGMENTS', len(HS), 'width_m', round(max(p[0] for pl in hdr for p in pl) - min(p[0] for pl in hdr for p in pl), 3))
# ---- riser (top exactly y 0.25 = Dex root): from the counter back to under the shell ----
cslab('booth', off(zb, -0.005), zs(1.43), -1.0, 1.0, 0.0, 0.242, 'steel_dk')
cslab('booth', off(zb, -0.003), zs(1.432), -1.002, 1.002, 0.242, 0.25, 'brass_old')
cslab('booth', off(zb, -0.002), off(zb, -0.012), -0.98, 0.98, 0.232, 0.244, 'lamp_amber')                            # riser nosing light (baked amber)
# ---- bandshell: walnut shell, rattan band behind Dex, brass screen frame, brass top band + indigo cove strip ----
polar('booth', CS, 1.405, 1.44, -51.5, 51.5, 0.25, 2.36, 'walnut')
polar('booth', CS, 1.395, 1.41, -47.0, 47.0, 0.42, 1.17, 'rattan', n=24)
polar('booth', CS, 1.385, 1.41, -51.2, 51.2, 1.255, 1.30, 'brass_old'); polar('booth', CS, 1.385, 1.41, -51.2, 51.2, 2.20, 2.245, 'brass_old')
for a0, a1 in ((-51.6, -50.0), (50.0, 51.6)): polar('booth', CS, 1.383, 1.41, a0, a1, 1.255, 2.245, 'brass_old', n=2)
polar('booth', CS, 1.398, 1.447, -51.8, 51.8, 2.36, 2.385, 'brass_old')
polar('booth', CS, 1.425, 1.44, -50.0, 50.0, 2.385, 2.395, IND)                                                        # indigo cove light washing the vault
# ---- decks + mixer (cantina booth parts), each deck yawed tangent to the counter arc about its platter centre ----
n0 = len(PARTS); exec(open(f'{OSRC}/owl_deckblock.py').read()); DECK = PARTS[n0:]
YAW = {}
for d_, sx in (('A', -1), ('B', 1)):
    x = sx * 0.48; th = math.atan2(-x, CF - 0.02)   # Blender rz (= glTF yaw about +y): deck back (-z) points away from the front-arc centre
    YAW[d_] = th; Mr = Matrix.Translation(V(g(x, 0, 0.02))) @ Matrix.Rotation(th, 4, 'Z') @ Matrix.Translation(-V(g(x, 0, 0.02)))
    for o in DECK:
        c = sum((o.matrix_world @ v.co for v in o.data.vertices), V()) / len(o.data.vertices)
        if (c.x < -0.2 and sx < 0) or (c.x > 0.2 and sx > 0): o.matrix_world = Mr @ o.matrix_world
bone('booth', (0, 0, 0))
_b = BONES.pop('booth'); _it = list(BONES.items()); BONES.clear(); BONES['booth'] = _b; BONES.update(_it)
# ---- screen: ONE mesh, own material, UV along the arc ----
SA, SY0, SY1, NS = 50.0, 1.30, 2.20, 32
bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); cols = []
for i in range(NS + 1):
    a = math.radians(-SA + 2 * SA * i / NS); cols.append([bm.verts.new(g(RS * math.sin(a), y, CS - RS * math.cos(a))) for y in (SY0, SY1)])
for i in range(NS):
    f = bm.faces.new((cols[i][0], cols[i + 1][0], cols[i + 1][1], cols[i][1]))
    for l_, (u, v) in zip(f.loops, ((i / NS, 0), ((i + 1) / NS, 0), ((i + 1) / NS, 1), (i / NS, 1))): l_[uvl].uv = (u, v)
bm.normal_update()
me = bpy.data.meshes.new('dj-screen'); bm.to_mesh(me); bm.free(); scr = bpy.data.objects.new('dj-screen', me); bpy.context.collection.objects.link(scr)
nz = sum((p.normal for p in me.polygons), V()); print('SCREEN_NORMAL_SUM_blender', tuple(round(c, 2) for c in nz))   # want -y (toward the crowd)
pp = f'{OUTD}/owlcove_dj_screen_placeholder.jpg'; subprocess.run(['python3', f'{OSRC}/owl_screen_placeholder.py', pp], check=True)
sm = unlit_mat('owlcove_dj_screen', pp); me.materials.append(sm); scr.hide_render = True
A, J = rig_and_join(name, {})
scr.parent = A
ALL = [A, J, scr]
NM0 = nonmanifold(J)
t0 = tris([J, scr]); d0 = draws([J, scr]); b0 = ex(name + '.glb', ALL, anim=False)
bpy.ops.wm.save_as_mainfile(filepath=f'{OSRC}/{name}.blend')
# ---- positions for Motion God (written as soon as the layout exists) ----
bn = {b.name: [round(v, 4) for v in (b.head_local.x, b.head_local.z, -b.head_local.y)] for b in A.data.bones}
json.dump({'bones': bn, 'yaw_deg': {k: round(math.degrees(v), 2) for k, v in YAW.items()}}, open('/tmp/oc/booth_layout.json', 'w'))
# lod1: drop MUSIC CREDITS engraving only (plate + raised rim stay). lod0 above is already exported.
_me = J.data; _n0 = sum(len(p.vertices) - 2 for p in _me.polygons)
_bm = bmesh.new(); _bm.from_mesh(_me); _bm.verts.ensure_lookup_table(); _bm.verts.layers.deform.verify()
_vg = J.vertex_groups.get('lod1_drop'); _kill = []
if _vg is not None:
    _dl = _bm.verts.layers.deform.verify(); _gi = _vg.index
    _kill = [v for v in _bm.verts if v[_dl].get(_gi, 0.0) > 0.5]
else:
    # rig_and_join dropped the group: loose islands whose verts all sit in the engraving zone
    _mw = J.matrix_world
    def _inzone(v):
        c = _mw @ v.co; q = V((c.x, -c.y)) - PC
        return 0.0186 <= q.dot(ncv) <= 0.0200 and abs(q.dot(tcv)) <= 0.106 and abs(c.z - YC) <= 0.075
    _seen = set()
    for v0 in _bm.verts:
        if v0.index in _seen: continue
        stack, island = [v0], []; _seen.add(v0.index)
        while stack:
            cur = stack.pop(); island.append(cur)
            for e in cur.link_edges:
                oth = e.other_vert(cur)
                if oth.index not in _seen: _seen.add(oth.index); stack.append(oth)
        if all(_inzone(iv) for iv in island): _kill.extend(island)
if _kill:
    bmesh.ops.delete(_bm, geom=_kill, context='VERTS'); _bm.to_mesh(_me); _me.update()
_bm.free()
print('LOD1_DROPPED_TRIS', _n0 - sum(len(p.vertices) - 2 for p in _me.polygons))
lod([J], 0.34, min_faces=24); t1 = tris([J, scr]); NM1 = nonmanifold(J); b1 = ex(name + '_lod1.glb', ALL, anim=False)
arc_len = RS * math.radians(2 * SA)
rec = {'file': name + '.glb', 'lod1': name + '_lod1.glb', 'tris': t0, 'tris_lod1': t1, 'bytes': b0, 'bytes_lod1': b1, 'draws': d0,
       'materials': sorted({m.name for o in (J, scr) for m in o.data.materials}), 'joints': {k: {'pos_gltf': v} for k, v in bn.items()},
       'nonmanifold_edges': {'lod0': NM0, 'lod1': NM1},
       'screen': {'node': 'dj-screen', 'material': 'owlcove_dj_screen', 'arc_centre_booth_local': [0, CS], 'radius_m': RS, 'arc_deg': 2 * SA, 'arc_length_m': round(arc_len, 3), 'height_m': SY1 - SY0,
                  'y_range': [SY0, SY1], 'apex_z': round(CS - RS, 3), 'aspect_along_surface': round(arc_len / (SY1 - SY0), 3), 'segments': NS, 'faces': 'concave side toward the crowd (+z)',
                  'uv': 'u 0..1 left->right along the arc as the crowd sees it (u=0 at x=-1.072), v 0..1 bottom->top', 'placeholder': 'owlcove_dj_screen_placeholder.jpg'},
       'deck_yaw_deg': {k: round(math.degrees(v), 2) for k, v in YAW.items()}}
print('PIECE', json.dumps(rec)); json.dump(rec, open(f'{OSRC}/{name}.json', 'w'), indent=1)
