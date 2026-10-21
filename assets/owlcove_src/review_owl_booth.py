"""Owl Cove booth review: imports the exported GLBs (as the runtime sees them), Dex on the riser in his clips; renders + Dex/booth overlap + reach."""
import bpy, math, os, json, collections
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree
RB = os.environ.get('RB', '/tmp/oc/booth'); OUT = os.environ.get('OUTDIR', RB); DEX = '/workspace/loft-xr/assets/builds-opt/cantina_robot_dex.glb'
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.view_settings.view_transform = 'Standard'; sc.eevee.taa_render_samples = 32
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.012, 0.03, 1)
G = lambda p: (p[0], -p[2], p[1])
def imp(path, pos, rot=0):
    b = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); n = [o for o in bpy.data.objects if o not in b]
    for o in n:
        if o.parent is None: o.rotation_mode = 'XYZ'; o.location = G(pos); o.rotation_euler = (0, 0, math.radians(rot))
    return n
booth = imp(f'{RB}/owlcove_dj_booth.glb', (0, 0, 0)); dex = imp(DEX, (0, 0.25, -0.45))
arm = [o for o in dex if o.type == 'ARMATURE'][0]; arm.animation_data_create()
def clip(n, t=0):
    arm.animation_data.action = [a for a in bpy.data.actions if a.name.startswith(n)][0]; sc.frame_set(1 + round(t * 30))
def cam(loc, look, lens=35, res=(1400, 1000)):
    c = bpy.data.cameras.new('c'); c.lens = lens; o = bpy.data.objects.new('c', c); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (V(look) - V(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = o; sc.render.resolution_x, sc.render.resolution_y = res; return o
def shot(p): sc.render.filepath = p; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True)
dg = bpy.context.evaluated_depsgraph_get()
def T(o):
    e = o.evaluated_get(dg); me = e.to_mesh(); vs = [o.matrix_world @ v.co for v in me.vertices]; fs = [list(p.vertices) for p in me.polygons]
    gv = [max(v.groups, key=lambda g: g.weight).group if v.groups else -1 for v in me.vertices]; e.to_mesh_clear(); return BVHTree.FromPolygons(vs, fs), fs, gv, vs
dm = [o for o in dex if o.type == 'MESH'][0]; bms = [o for o in booth if o.type == 'MESH' and o.name != 'dj-screen' and o.data.vertices and o.parent is not None and not o.name.startswith('Icosphere')]
rep = {}
for cn in ('hands_on_decks', 'scratch_R', 'idle_nod', 'wave'):
    worst = collections.Counter()
    for t in (0, 0.125, 0.25, 0.5, 1.0, 1.5):
        clip(cn, t); dg.update(); d, fs, gv, vs = T(dm)
        for bmo in bms:
            b, bfs, bg, bvs = T(bmo)
            for i, j in d.overlap(b):
                gname = dm.vertex_groups[gv[fs[i][0]]].name; bz = max(bvs[k].z for k in bfs[j]); bzmin = min(bvs[k].z for k in bfs[j])
                tagz = '@riser_top_contact' if (gname == 'root' and bz < 0.2505) else ('@deck_top_y%.3f' % bz if gname.startswith('fore') else '@y%.2f-%.2f' % (bzmin, bz))
                worst[gname + tagz] += 1
    rep[cn] = dict(worst)
# fingertip vs platter rim (booth-local == world here)
clip('hands_on_decks', 0); dg.update(); _, fs, gv, vs = T(dm)
def grp(n): gi = dm.vertex_groups[n].index; return [vs[i] for i in range(len(vs)) if gv[i] == gi]
for n, cx in (('foreR', -0.48), ('foreL', 0.48)):
    P = [(p.x, p.z, -p.y) for p in grp(n)]
    rep['rim_gap_' + n] = round(min(abs(math.hypot(p[0] - cx, p[2] - 0.02) - 0.152) + max(0, p[1] - 1.075) for p in P), 4)
print('OWLREV', json.dumps(rep))
clip('hands_on_decks', 0)
cam(G((0.0, 1.6, 4.0)), G((0, 1.35, -0.3)), lens=32); shot(f'{OUT}/owlcove_dj_booth_preview_front.png')
cam(G((2.6, 2.0, 2.6)), G((0, 1.2, -0.3)), lens=30); shot(f'{OUT}/owlcove_dj_booth_preview_3q.png')
cam(G((0.0, 4.6, 0.25)), G((0, 0, -0.1)), lens=24); shot(f'{OUT}/owlcove_dj_booth_preview_top.png')
cam(G((-1.0, 2.0, 1.25)), G((0.1, 1.05, -0.1)), lens=30); shot(f'{OUT}/owlcove_dj_booth_preview_dex_decks.png')
