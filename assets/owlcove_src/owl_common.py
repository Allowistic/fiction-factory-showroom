"""Owl Cove Tiki Nest helpers on top of the cantina pipeline (props2/robots): night bake rig, extra materials, swept tubes, bake with a reserved atlas band."""
import sys, os, json, math, subprocess, datetime
sys.path.insert(0, '/workspace/loft-xr/assets/cantina_src'); sys.path.insert(0, '/workspace/loft-xr/assets/owlcove_src')
from robots import *            # props2 (reset/texmat/flat/glow/tag/box/cyl/lathe/PARTS/M/DST/TX) + robots (part/bone/rig_and_join/lod/nonmanifold...)
import bpy, bmesh
from mathutils import Vector as V, Matrix
OSRC = '/workspace/loft-xr/assets/owlcove_src'
AMBER_NEON = (1.0, 0.52, 0.16)      # tube colour (linear) ~ #FFBE6E display: warm amber, no teal
AMBER_GLOW = (1.0, 0.45, 0.12)
INDIGO_GLOW = (0.16, 0.14, 0.75)
def rig_owl():
    """night bake: indigo sky fill + warm amber practicals from below/front"""
    sc = bpy.context.scene; w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.10, 0.11, 0.30, 1); bg.inputs[1].default_value = 0.35
    for loc, rot, e, col, sz in (((1.2, -2.6, 0.6), (math.radians(80), 0, math.radians(22)), 70, (1, 0.6, 0.3), 2.5),      # warm bar practicals, low
                                 ((-1.5, -1.0, 3.0), (math.radians(35), 0, math.radians(-50)), 40, (0.45, 0.45, 1.0), 3.0),    # indigo cove from above
                                 ((0, 2.5, 1.5), (math.radians(-70), 0, 0), 15, (1, 0.7, 0.45), 2.0)):                        # warm back fill
        l = bpy.data.lights.new('k', 'AREA'); l.energy = e; l.color = col; l.size = sz; o = bpy.data.objects.new('k', l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.max_bounces = 4
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium Low Contrast'; sc.view_settings.exposure = 0.3
    b = sc.render.bake; b.margin = 8; b.margin_type = 'EXTEND'; b.use_pass_direct = b.use_pass_indirect = b.use_pass_diffuse = b.use_pass_emit = True; b.use_pass_glossy = True
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
def owl_mats():
    M['char_wood'] = texmat('char_wood', 'Wood066', (0.10, 0.08, 0.075), 0, 0.85, 1.6)
    M['cord'] = flat('cord', (0.012, 0.011, 0.012), 0.55)
    M['rattan'] = rattan('rattan', (0.95, 0.68, 0.38), glow=0.0)
    M['rattan_dk'] = rattan('rattan_dk', (0.45, 0.28, 0.14), glow=0.0)
    M['rattan_lit'] = rattan_weave('rattan_lit')
def rattan(name, tint, glow=0.0, scale=3.0):
    """Wicker002 (ambientCG CC0) box-projected, honey tint; glow>0 = lantern: light leaks through the weave gaps (baked)"""
    m = texmat(name, 'Wicker002', tint, 0, 0.75, scale)
    if glow:
        nt = m.node_tree; b = nt.nodes['Principled BSDF']; img = [n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image.name.endswith('Color.jpg')][0]
        bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(img.outputs[0], bw.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = 0.30; mr.inputs[2].default_value = 0.62; mr.inputs[3].default_value = 0.10; mr.inputs[4].default_value = 1.0
        nt.links.new(bw.outputs[0], mr.inputs[0])
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 2.2 * glow; nt.links.new(mr.outputs[0], mul.inputs[0])
        b.inputs['Emission Color'].default_value = (*AMBER_GLOW, 1); nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    return m
def rattan_weave(name, scale=2.2):
    """lantern globe (Oct 18 pass; thresholds are on the LINEAR luminance of Wicker002: strands 0.01-0.05, strips 0.15-0.19): high-contrast weave. Wicker002 light strips -> glowing slits (light leaking through),
    dark strands -> deep honey-brown, lit by the bake key; normal detail 1.6x stronger so the over/under relief reads up close"""
    m = texmat(name, 'Wicker002', (1, 1, 1), 0, 0.7, scale)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    img = [n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image.name.endswith('Color.jpg')][0]
    for n in nt.nodes:
        if n.type == 'NORMAL_MAP': n.inputs[0].default_value = 1.6
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(img.outputs[0], bw.inputs[0])
    mk = nt.nodes.new('ShaderNodeMapRange'); mk.inputs[1].default_value = 0.07; mk.inputs[2].default_value = 0.13; mk.inputs[3].default_value = 0.0; mk.inputs[4].default_value = 1.0
    nt.links.new(bw.outputs[0], mk.inputs[0])
    sh = nt.nodes.new('ShaderNodeMapRange'); sh.inputs[1].default_value = 0.006; sh.inputs[2].default_value = 0.05; sh.inputs[3].default_value = 0.45; sh.inputs[4].default_value = 1.0
    nt.links.new(bw.outputs[0], sh.inputs[0])          # strand grain/shading kept inside the dark strands
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; nt.links.new(mk.outputs[0], mx.inputs[0])
    mx.inputs[6].default_value = (0.42, 0.24, 0.10, 1); mx.inputs[7].default_value = (1.0, 0.78, 0.46, 1)
    gr = nt.nodes.new('ShaderNodeMix'); gr.data_type = 'RGBA'; gr.blend_type = 'MULTIPLY'; gr.inputs[0].default_value = 1.0
    nt.links.new(mx.outputs[2], gr.inputs[6]); nt.links.new(sh.outputs[0], gr.inputs[7]); nt.links.new(gr.outputs[2], b.inputs['Base Color'])
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY_ADD'; em.inputs[1].default_value = 0.62; em.inputs[2].default_value = 0.05; nt.links.new(mk.outputs[0], em.inputs[0])   # slits 0.67, strands 0.05 (inner glow scatter)
    b.inputs['Emission Color'].default_value = (*AMBER_GLOW, 1); nt.links.new(em.outputs[0], b.inputs['Emission Strength'])
    return m
def tube_mesh(name, polylines, r, n, closed_flags=None, cap=True):
    """sweep a planar (x,z at y) polyline set into one mesh of n-sided tubes; closed loops wrap, open ends get fan caps (closed shells)"""
    bm = bmesh.new()
    for k, P in enumerate(polylines):
        P = [V(p) for p in P]; closed = closed_flags[k] if closed_flags else (len(P) > 3 and (P[0] - P[-1]).length < 1e-4)
        if closed: P = P[:-1]
        m = len(P)
        if m < 2: continue
        rings = []
        for i, p in enumerate(P):
            if closed: t = (P[(i + 1) % m] - P[(i - 1) % m])
            else: t = P[min(i + 1, m - 1)] - P[max(i - 1, 0)]
            t.normalize(); nrm = V((0, -1, 0)); nrm = (nrm - t * nrm.dot(t)).normalized(); bi = t.cross(nrm)
            # miter: widen across the bend so sharp-ish corners keep their section
            sc_ = 1.0
            if 0 < i < m - 1 or closed:
                a = (P[i] - P[(i - 1) % m]).normalized(); c = (P[(i + 1) % m] - P[i]).normalized(); cs = max(0.35, (1 + a.dot(c)) / 2) ** 0.5; sc_ = 1 / cs
            rings.append([bm.verts.new(p + r * (math.cos(2 * math.pi * q / n + math.pi / n) * nrm + math.sin(2 * math.pi * q / n + math.pi / n) * bi * sc_)) for q in range(n)])
        for i in range(m - 1 + (1 if closed else 0)):
            A, B = rings[i], rings[(i + 1) % m]
            for q in range(n): bm.faces.new((A[q], A[(q + 1) % n], B[(q + 1) % n], B[q]))
        if not closed and cap:
            for R, p, s in ((rings[0], P[0], -1), (rings[-1], P[-1], 1)):
                c = bm.verts.new(p)
                for q in range(n):
                    f = (R[q], R[(q + 1) % n], c) if s < 0 else (R[(q + 1) % n], R[q], c)
                    bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o
def catmull(P, closed, sub):
    P = [V(p) for p in P]
    if closed: P = P[:-1]
    m = len(P); out = []
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0 = P[(i - 1) % m] if closed else P[max(i - 1, 0)]; p1 = P[i]; p2 = P[(i + 1) % m]; p3 = P[(i + 2) % m] if closed else P[min(i + 2, m - 1)]
        for s in range(sub):
            t = s / sub; t2 = t * t; t3 = t2 * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[0].copy() if closed else P[-1].copy()); return out
def rdp(P, tol):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; ab = b - a; L = ab.length
    def d(p): return (p - a).length if L < 1e-9 else (ab.cross(p - a)).length / L
    i, dm = max(((i, d(P[i])) for i in range(1, len(P) - 1)), key=lambda x: x[1])
    if dm > tol: return rdp(P[:i + 1], tol)[:-1] + rdp(P[i:], tol)
    return [a, b]
def split_sharp(P, deg=80):
    out = [[P[0]]]
    for i in range(1, len(P) - 1):
        out[-1].append(P[i]); a = (P[i] - P[i - 1]); c = (P[i + 1] - P[i])
        if a.length > 1e-6 and c.length > 1e-6 and math.degrees(a.angle(c)) > deg: out.append([P[i]])
    out[-1].append(P[-1]); return [s for s in out if len(s) >= 2]
def prep_strokes(pls, y, sub=6, tol=0.0012, maxseg=0.05, ring_step=1):
    """2D sign strokes -> smoothed 3D polylines (x, y, z) at depth y; returns (polylines, closed flags)"""
    res, cl = [], []
    for pl in pls:
        P = [V((x, y, z)) for x, z in pl]
        closed = len(P) > 3 and (P[0] - P[-1]).length < 1e-4
        pieces = [P] if closed else split_sharp(P)
        for Q in pieces:
            c = closed and len(pieces) == 1
            if c:
                S_ = catmull(Q, True, 2)
                if sum((b - a).length for a, b in zip(S_, S_[1:])) < 0.15: S_ = S_[:-1][::ring_step] + [S_[0]]   # tiny rings (period, owl eyes) only
            else: S_ = rdp(catmull(Q, False, sub) if len(Q) > 2 else Q, tol)
            # cap long straight runs so the tube stays round under smooth shading
            T = [S_[0]]
            for p in S_[1:]:
                k = max(1, int((p - T[-1]).length / maxseg + 0.999))
                for j in range(1, k + 1): T.append(T[-1].lerp(p, j / k) if j < k else p)
            res.append(T); cl.append(c)
    return res, cl
def bake_reserved(objs, atlas_name, res, v_max, extra_paste=None):
    """join objs, smart-UV, pack into v in [0, v_max] (the band above is reserved for a pasted texture), bake COMBINED; returns joined obj + atlas path"""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); j = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    while j.data.uv_layers: j.data.uv_layers.remove(j.data.uv_layers[0])
    j.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006)
    bpy.ops.uv.pack_islands(margin=0.004, rotate=True, scale=True, margin_method='FRACTION', shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    for l in j.data.uv_layers[0].data: l.uv = (l.uv[0], l.uv[1] * v_max)
    im = bpy.data.images.new(atlas_name, res, res, float_buffer=True)
    for m in j.data.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.image = im
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n
    j.select_set(True); bpy.context.view_layer.objects.active = j
    bpy.ops.object.bake(type='COMBINED')
    p = f'{DST}/{atlas_name}.jpg'; im.save_render(p, scene=bpy.context.scene)
    return j, p
def unlit_mat(name, path):
    um = bpy.data.materials.new(name); um.use_nodes = True; nt = um.node_tree; nt.nodes.clear()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path, check_existing=False); bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], out.inputs[0]); return um
def glow_mat(name, col, st=3.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = st; return m
def export_glb(path, objs, anim=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_draco_mesh_compression_enable=True, export_image_format='JPEG', export_yup=True, export_apply=True, export_animations=anim)
    return os.path.getsize(path)
def ntris(objs): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs if o.type == 'MESH')
