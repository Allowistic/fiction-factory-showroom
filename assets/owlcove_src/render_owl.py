# Owl Cove preview renders (Eevee + compositor glare). Usage: VIEW=sign_front|sign_3q|lantern|lantern_close|room OWL_BO=... OUT=... blender -b -P render_owl.py
import bpy, math, os, sys
from mathutils import Vector
BO = os.environ.get('OWL_BO', '/workspace/loft-xr/assets/builds-opt/').rstrip('/\\') + '/'
VIEW = os.environ.get('VIEW', 'sign_front'); OUT = os.environ.get('OUT', '/tmp/oc/r_%s.png' % VIEW)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = (1600, 900)
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.013, 0.04, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
G = lambda x, y, z: Vector((x, -z, y))       # glTF -> Blender
def imp(f, pos=(0, 0, 0), rot=0.0):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=BO + f)
    new = [o for o in bpy.data.objects if o not in before]
    for t in [o for o in new if o.parent is None]:
        t.rotation_mode = 'XYZ'; t.location = G(*pos); t.rotation_euler = (0, 0, math.radians(rot))
    for o in new:
        if o.name.startswith('Icosphere'): o.hide_render = True
    return new
def emis(mat, col, s):
    nt = mat.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*col, 1); e.inputs[1].default_value = s
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0])
def unlit_boost(mat, s):
    # glTF unlit import -> force pure emission of the base texture so the bake shows exactly as in the runtime
    nt = mat.node_tree; tex = [n for n in nt.nodes if n.type == 'TEX_IMAGE']
    if not tex: return
    img = tex[0].image; nt.nodes.clear()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value = s
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(t.outputs[0], e.inputs[0]); nt.links.new(e.outputs[0], o.inputs[0])
def fixmats():
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        n = m.name
        if n.startswith('owlcove_neon_amber'): emis(m, (1.0, 0.52, 0.16), 9.0)
        elif 'glow_amber' in n: emis(m, (1.0, 0.45, 0.12), 5.0)
        elif 'glow_indigo' in n: emis(m, (0.16, 0.14, 0.75), 4.0)
        elif 'glow_teal' in n: emis(m, (0.1, 0.9, 0.85), 3.0)
        elif 'glow' in n or 'lamp' in n: emis(m, (1.0, 0.5, 0.15), 3.0)
        else: unlit_boost(m, 1.0)
def cam(loc, tgt, lens=50, ortho=None):
    c = bpy.data.cameras.new('c'); o = bpy.data.objects.new('cam', c); sc.collection.objects.link(o); sc.camera = o
    o.location = loc; o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); c.lens = lens
    if ortho: c.type = 'ORTHO'; c.ortho_scale = ortho
def plane(name, co, size, rot, col):
    bpy.ops.mesh.primitive_plane_add(size=1, location=co, rotation=rot); p = bpy.context.object; p.name = name; p.scale = size
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.8; p.data.materials.append(m)
if VIEW in ('sign_front', 'sign_3q'):
    imp('owlcove_neon_sign.glb')
    plane('vault', G(0, 0.74, -0.05), (3, 1.5, 1), (math.radians(90), 0, 0), (0.02, 0.022, 0.05))
    plane('vault', G(0, 0.74, -0.15), (4, 3, 1), (math.radians(90), 0, 0), (0.025, 0.025, 0.06))
    if VIEW == 'sign_front': cam(G(0, 0.40, 2.9), G(0, 0.40, 0), lens=50)
    else: cam(G(1.3, 0.1, 1.6), G(0, 0.4, 0), lens=45)
elif VIEW == 'lantern':
    for x in (-0.55, 0.0, 0.55): imp('owlcove_lantern.glb', (x, 0.8, 0), {-0.55: 0, 0.0: 25, 0.55: 50}[x])
    plane('back', G(0, 0.5, -0.6), (4, 2, 1), (math.radians(90), 0, 0), (0.03, 0.03, 0.07))
    cam(G(0, 0.45, 2.1), G(0, 0.42, 0), lens=50)
    sc.render.resolution_x, sc.render.resolution_y = (1200, 900)
elif VIEW == 'lantern_close':
    imp('owlcove_lantern.glb', (0, 0.8, 0), 0)
    plane('back', G(0, 0.5, -0.6), (4, 2, 1), (math.radians(90), 0, 0), (0.03, 0.03, 0.07))
    cam(G(0, 0.42, 0.95), G(0, 0.42, 0), lens=50)
    sc.render.resolution_x, sc.render.resolution_y = (1200, 900)
elif VIEW == 'room':
    # Clay frame (unmirrored): bar wall at -x
    imp('cantina_bar.glb', (-2.024, 0, 3.2), 90); imp('cantina_back_bar.glb', (-3.73, 0, 4.3), 90)
    imp('cantina_stools.glb', (-1.214, 0, 3.2), 90)
    imp('cantina_robot_bartender.glb', (-3.0, 0, 3.7), 90)
    imp('owlcove_neon_sign.glb', (-3.25, 2.05, 4.3), 90)
    for z in (1.8, 3.0, 4.2): imp('owlcove_lantern.glb', (-2.02, 3.01, z), 0)
    plane('floor', G(-1, 0, 3.25), (8, 6.5, 1), (0, 0, 0), (0.035, 0.025, 0.02))
    plane('wall', G(-4.0, 1.4, 3.25), (2.8, 6.5, 1), (0, math.radians(90), 0), (0.03, 0.03, 0.07))
    # vault ceiling over the bar side (slope (4,2.6)->(1.6,3.2))
    bpy.ops.mesh.primitive_plane_add(size=1); v = bpy.context.object; me = v.data
    for i, (x, y) in enumerate(((-4, 2.6), (-1.6, 3.2), (-1.6, 3.2), (-4, 2.6))): pass
    v.location = G(-2.8, 2.9, 3.25); v.scale = (2.47, 6.5, 1); v.rotation_euler = (0, math.atan2(0.6, 2.4), 0)
    m = bpy.data.materials.new('vault'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.03, 0.03, 0.07, 1); me.materials.append(m)
    for z in (0.6, 1.8, 3.0, 4.2, 5.4):
        bpy.ops.mesh.primitive_cube_add(size=1, location=G(-2.8, 2.84, z), rotation=(0, math.atan2(0.6, 2.4), 0)); r = bpy.context.object; r.scale = (2.5, 0.08, 0.1); r.data.materials.append(m)
    cam(G(1.6, 1.55, 1.2), G(-2.9, 1.75, 4.0), lens=26)
    pl = bpy.data.lights.new('fill', 'AREA'); pl.energy = 60; pl.color = (0.45, 0.45, 1.0); pl.size = 4
    po = bpy.data.objects.new('fill', pl); sc.collection.objects.link(po); po.location = G(0, 3.0, 3.0)
    for z in (1.8, 3.0, 4.2):
        l = bpy.data.lights.new('lan', 'POINT'); l.energy = 25; l.color = (1, 0.55, 0.2); l.shadow_soft_size = 0.15
        lo = bpy.data.objects.new('lan', l); sc.collection.objects.link(lo); lo.location = G(-2.02, 2.35, z)
    l = bpy.data.lights.new('neon', 'AREA'); l.energy = 30; l.color = (1, 0.55, 0.2); l.size = 1.5
    lo = bpy.data.objects.new('neon', l); sc.collection.objects.link(lo); lo.location = G(-3.1, 2.4, 4.3); lo.rotation_euler = (0, math.radians(-90), 0)
fixmats()
# compositor glare
sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); co = nt.nodes.new('CompositorNodeComposite')
gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'; gl.threshold = 0.9; gl.size = 8; gl.mix = -0.35
nt.links.new(rl.outputs[0], gl.inputs[0]); nt.links.new(gl.outputs[0], co.inputs[0])
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
print('RENDERED', OUT)
