"""Owl Cove Tiki Nest: neon sign (owlcove_neon_sign) + rattan pufferfish lantern (owlcove_lantern), one shared baked atlas
(material 'owlcove_props_atlas' in both GLBs -> one texture cell in the cantina runtime atlas, 0 extra draws), unlit.
Sign: Hershey single-stroke script tubes (one mesh, emissive amber), opaque glow card (charred wood + baked halo), brass standoffs,
2 brass drop rods to the vault, one wire run. Lantern: origin = ceiling attach point (hangs down -Y glTF)."""
import sys; sys.path.insert(0, '/workspace/loft-xr/assets/owlcove_src')
from owl_common import *
import owl_text
OUTD = os.environ.get('OUTDIR', DST); ATL = 'owlcove_props_atlas'
reset(); mats(); mats2(); owl_mats(); rig_owl(); PARTS.clear()
L = owl_text.layout(); json.dump(L, open(f'{OSRC}/owlcove_neon_strokes.json', 'w'))
BW, BH, BD = 1.62, 0.50, 0.035; CW, CH = 1.60, 0.48
TY, TR = -0.032, 0.006          # tube centre depth (in front of the card face at y=0), tube radius (12 mm glass)
CEIL = 0.7375                   # vault above the sign plane (sign bottom at cantina y 2.05, vault 2.79 at x 3.25); rises 0.25 m per m toward the room (-Y)
def mark(o, piece): o['piece'] = piece; return o
# ---------------- sign: tubes ----------------
allp = L['line1'] + L['line2'] + L['eyes']
T0, C0 = prep_strokes(allp, TY, sub=6, tol=0.0012, maxseg=0.05, ring_step=2)
tubes = tube_mesh('owlcove_neon_tubes', T0, TR, 6, C0); tubes.data.materials.append(glow_mat('owlcove_neon_amber', AMBER_NEON, 4.0))
# ---------------- sign: standoffs along every stroke (brass post + clip) ----------------
nst = 0
for P, c in zip(T0, C0):
    Ls = [0.0]
    for a, b in zip(P, P[1:]): Ls.append(Ls[-1] + (b - a).length)
    tot = Ls[-1]
    if tot < 0.03: continue
    k = max(1, int(tot / 0.17)); ds = [tot * (i + 0.5) / k for i in range(k)]
    for dd in ds:
        i = max(j for j in range(len(Ls)) if Ls[j] <= dd); i = min(i, len(P) - 2); f = (dd - Ls[i]) / max(1e-9, Ls[i + 1] - Ls[i]); p = P[i].lerp(P[i + 1], f)
        mark(cyl((p.x, (-0.002 + TY + TR * 0.6) / 2, p.z), 0.0035, abs(TY + TR * 0.6 + 0.002), 'brass_old', n=4, rot=(math.pi / 2, 0, 0)), 'sign')
        cl_ = mark(cyl((p.x, -0.003, p.z), 0.008, 0.003, 'brass_old', n=6, rot=(math.pi / 2, 0, 0)), 'sign'); cl_['clip'] = 1; nst += 1
# ---------------- sign: hanging hardware + one wire run ----------------
for sx in (-1, 1):
    X = sx * 0.62; ytop = CEIL - 0.25 * BD / 2
    mark(cyl((X, BD / 2, BH + 0.012), 0.011, 0.024, 'brass_old', n=8), 'sign')                                 # eye bolt in the backer top
    mark(cyl((X, BD / 2, (BH + 0.02 + ytop) / 2), 0.0055, ytop - BH - 0.02, 'brass_old', n=8), 'sign')        # drop rod
    mark(cyl((X, BD / 2, ytop - 0.006), 0.032, 0.012, 'brass_old', n=16, rot=(-math.atan(0.25), 0, 0)), 'sign')  # ceiling canopy (on the vault slope)
mark(box((0.50, BD + 0.032, 0.40), (0.15, 0.06, 0.09), 'steel_dk'), 'sign')                                       # neon transformer on the backer back
mark(box((0.50, BD + 0.001, 0.40), (0.17, 0.004, 0.11), 'brass_old'), 'sign')                                    # its mounting plate
wire = [V((0.53, BD + 0.045, 0.445)), V((0.56, BD + 0.05, 0.53)), V((0.60, BD + 0.045, 0.60)), V((0.66, BD + 0.035, 0.67)), V((0.70, BD + 0.03, CEIL - 0.25 * (BD + 0.03) - 0.002))]
wo = tube_mesh('wire', [catmull(wire, False, 4)], 0.004, 6, [False]); tag(wo, 'cord'); mark(wo, 'sign')
mark(cyl((0.70, BD + 0.03, CEIL - 0.25 * (BD + 0.03) - 0.008), 0.014, 0.012, 'brass_old', n=10, rot=(-math.atan(0.25), 0, 0)), 'sign')   # cable entry cup
# ---------------- lantern (built off to the side so the bake has no cross-shadowing; moved to origin before export) ----------------
X0 = V((4.0, 0, 0)); LP = []
def lp(o): LP.append(o); return mark(o, 'lantern')
lp(cyl(X0 + V((0, 0, -0.0075)), 0.04, 0.015, 'brass_old', n=16))                    # ceiling canopy (rib underside)
lp(cyl(X0 + V((0, 0, -0.2075)), 0.0042, 0.385, 'cord', n=6))                         # cord
lp(lathe(tuple(X0), [(0.006, -0.40), (0.014, -0.405), (0.018, -0.42), (0.040, -0.445), (0.040, -0.452), (0.0, -0.452)], 'brass_old', n=16))   # brass cap
GC, GR, GZ = -0.612, 0.17, 0.165       # globe centre z, radius, vertical semi-axis
prof = []
for i in range(0, 15):
    a = math.radians(14 + i * (160 - 14) / 14); prof.append((GR * math.sin(a), GC + GZ * math.cos(a)))
lp(lathe(tuple(X0), prof, 'rattan_lit', n=24))                                         # woven globe, light leaking through the gaps (baked)
lp(cyl(X0 + V((0, 0, GC)), GR + 0.004, 0.016, 'rattan_dk', n=24))                    # equator binding
lp(cyl(X0 + V((0, 0, GC + GZ * math.cos(math.radians(14)) - 0.004)), GR * math.sin(math.radians(14)) + 0.006, 0.012, 'rattan_dk', n=16))   # top binding
lp(cyl(X0 + V((0, 0, GC + GZ * math.cos(math.radians(160)) + 0.003)), GR * math.sin(math.radians(160)) + 0.006, 0.012, 'rattan_dk', n=16))  # bottom rim binding
# pufferfish spikes: short rattan cones on a fibonacci sphere (skip the poles)
ga = math.pi * (3 - math.sqrt(5)); ns = 0
for i in range(60):
    zz = 1 - 2 * (i + 0.5) / 60; rr = math.sqrt(1 - zz * zz); th = ga * i
    if abs(zz) > 0.78 or abs(zz) < 0.12: continue
    nrm = V((rr * math.cos(th), rr * math.sin(th), zz)); pnt = X0 + V((GR * nrm.x, GR * nrm.y, GC + GZ * nrm.z))
    o = cyl(pnt + nrm * 0.016, 0.009, 0.042, 'rattan_dk', n=4, r2=0.0015)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = nrm.to_track_quat('Z', 'Y'); bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.transform_apply(rotation=True)
    lp(o); ns += 1
bot_z = GC + GZ * math.cos(math.radians(160)); bot_r = GR * math.sin(math.radians(160))
gd = lathe(tuple(X0), [(0.0, bot_z - 0.004), (bot_r - 0.004, bot_z - 0.004), (bot_r - 0.004, bot_z + 0.002), (0.0, bot_z + 0.002)], 'brass_old', n=16)
PARTS.remove(gd); gd.data.materials.clear(); gd.data.materials.append(glow_mat('owlcove_glow_amber', AMBER_GLOW, 3.0)); gd.name = 'owlcove_lantern_glow'
# ---------------- bake (sign hardware + lantern) into v in [0, 0.69]; card band on top ----------------
for o in PARTS:
    vg = o.vertex_groups.new(name='piece_' + o.get('piece', 'sign')); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    if o.get('clip'): vc = o.vertex_groups.new(name='clip'); vc.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
# neon light on the sign hardware during the bake (the card's halo is painted separately)
l = bpy.data.lights.new('neon', 'AREA'); l.shape = 'RECTANGLE'; l.size = 1.4; l.size_y = 0.3; l.energy = 18; l.color = (1, 0.55, 0.2); lo = bpy.data.objects.new('neon', l); bpy.context.scene.collection.objects.link(lo); lo.location = (0, -0.05, 0.27); lo.rotation_euler = (math.radians(90), 0, 0)
pl_ = bpy.data.lights.new('lan', 'POINT'); pl_.energy = 6; pl_.color = (1, 0.5, 0.15); pl_.shadow_soft_size = 0.05; plo = bpy.data.objects.new('lan', pl_); bpy.context.scene.collection.objects.link(plo); plo.location = X0 + V((0, 0, bot_z - 0.12))
j, apath = bake_reserved(list(PARTS), ATL, 1024, 0.69)
subprocess.run(['python3', f'{OSRC}/make_card.py', f'{OSRC}/owlcove_neon_strokes.json', '/tmp/oc/card.png', '1024', '307', str(CW), str(CH)], check=True)
subprocess.run(['python3', '-c', f"from PIL import Image; a=Image.open('{apath}').convert('RGB'); c=Image.open('/tmp/oc/card.png').convert('RGB'); a.paste(c,(0,0)); a.save('{apath}',quality=90)"], check=True)
um = unlit_mat(ATL, apath); j.data.materials.clear(); j.data.materials.append(um)
# backer + card (UV straight into the card band: front = full card, every other face = a plain charred-wood corner patch)
def boxuv(name, c, s, front_uv=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=s, verts=bm.verts); bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        fr = f.normal.y < -0.9
        for lp_ in f.loops:
            x, z = lp_.vert.co.x, lp_.vert.co.z
            if fr and front_uv: lp_[uvl].uv = front_uv(x, z)
            else: lp_[uvl].uv = (0.006 + 0.02 * ((x + 0.81) / 1.62), 0.975 + 0.018 * (z / 0.5))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(um); return o
V0 = 1 - 307 / 1024
backer = boxuv('backer', (0, BD / 2, BH / 2), (BW, BD, BH))
card = boxuv('card', (0, -0.001, BH / 2), (CW, 0.002, CH), lambda x, z: ((x + CW / 2) / CW, V0 + (z - (BH - CH) / 2) / CH * (1 - V0) * 0.999))
for o, g in ((backer, 'piece_sign'), (card, 'piece_sign')):
    vg = o.vertex_groups.new(name=g); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT'); j.select_set(True); backer.select_set(True); card.select_set(True); bpy.context.view_layer.objects.active = j; bpy.ops.object.join()
# split sign / lantern
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
j.vertex_groups.active_index = j.vertex_groups['piece_lantern'].index; bpy.ops.object.vertex_group_select(); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
lan = [o for o in bpy.context.selected_objects if o != j][0]; sign = j; sign.name = 'owlcove_neon_sign'; lan.name = 'owlcove_lantern'
for o in (sign, lan):
    for vg in list(o.vertex_groups):
        if vg.name != 'clip': o.vertex_groups.remove(vg)
for o in (lan, gd): o.data.transform(Matrix.Translation(-X0)); o.matrix_world = Matrix()
# ---------------- export + lod1 ----------------
rec = {}
def piece_rec(name, objs, lodfn):
    for o in objs:
        for vg in list(o.vertex_groups):
            if vg.name != 'clip': o.vertex_groups.remove(vg)
    t0 = ntris(objs); nm0 = sum(nonmanifold(o) for o in objs); b0 = export_glb(f'{OUTD}/{name}.glb', objs)
    lodfn(); t1 = ntris(objs); nm1 = sum(nonmanifold(o) for o in objs); b1 = export_glb(f'{OUTD}/{name}_lod1.glb', objs)
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    bb = {'x': [round(min(p.x for p in pts), 3), round(max(p.x for p in pts), 3)], 'y_up': [round(min(p.z for p in pts), 3), round(max(p.z for p in pts), 3)], 'z_fwd': [round(min(-p.y for p in pts), 3), round(max(-p.y for p in pts), 3)]}
    return {'tris': t0, 'tris_lod1': t1, 'bytes': b0, 'bytes_lod1': b1, 'draws_glb': len({m.name for o in objs for m in o.data.materials}), 'materials': sorted({m.name for o in objs for m in o.data.materials}), 'nonmanifold_edges': {'lod0': nm0, 'lod1': nm1}, 'bbox_gltf_m': bb}
def sign_lod():
    T1, C1 = prep_strokes(allp, TY, sub=4, tol=0.006, maxseg=0.2, ring_step=3)
    new = tube_mesh('owlcove_neon_tubes_lod1', T1, TR, 4, C1); tubes.data = new.data; bpy.data.objects.remove(new); tubes.data.materials.clear(); tubes.data.materials.append(bpy.data.materials['owlcove_neon_amber'])
    # lod1: drop the little standoff clip discs (posts stay), then decimate the big islands only
    bpy.ops.object.select_all(action='DESELECT'); sign.select_set(True); bpy.context.view_layer.objects.active = sign
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); sign.vertex_groups.active_index = sign.vertex_groups['clip'].index
    bpy.ops.object.vertex_group_select(); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
    lod([sign], 0.45, min_faces=60); print('TUBETRIS_LOD1', ntris([tubes]))
print('TUBETRIS', ntris([tubes]))
rec['sign'] = piece_rec('owlcove_neon_sign', [sign, tubes], sign_lod); rec['sign']['standoffs'] = nst
rec['lantern'] = piece_rec('owlcove_lantern', [lan, gd], lambda: lod([lan], 0.4, min_faces=60)); rec['lantern']['spikes'] = ns
print('OWLPROPS', json.dumps(rec)); json.dump(rec, open(f'{OSRC}/owlcove_props_build.json', 'w'), indent=1)
