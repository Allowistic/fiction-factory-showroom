"""Re-render cantina_review_booth_dex_7m.png and check Dex's headphone band vs the screen frame (3D gap + projected gap at 7 m)."""
import bpy,math,os,json
from mathutils import Vector as V
from bpy_extras.object_utils import world_to_camera_view as w2c
RB=os.environ.get('RB','/tmp/rb'); OUT=os.environ.get('OUTDIR','/tmp/rb')
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.view_settings.view_transform='Standard'; sc.eevee.taa_render_samples=64
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.02,0.018,0.016,1)
G=lambda p:(p[0],-p[2],p[1])
def imp(path,pos,rot):
    b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); n=[o for o in bpy.data.objects if o not in b]
    for o in n:
        if o.parent is None: o.rotation_mode='XYZ'; o.location=G(pos); o.rotation_euler=(0,0,math.radians(rot))
    return n
booth=imp(f'{RB}/cantina_dj_booth.glb',(3.1,0,1.15),-90); dex=imp(f'{RB}/cantina_robot_dex.glb',(3.55,0.25,1.15),-90)
arm=[o for o in dex if o.type=='ARMATURE'][0]; arm.animation_data_create()
arm.animation_data.action=[a for a in bpy.data.actions if a.name.startswith('hands_on_decks')][0]; sc.frame_set(1)
c=bpy.data.cameras.new('c'); c.sensor_fit='HORIZONTAL'; c.angle=math.radians(60); co=bpy.data.objects.new('c',c); sc.collection.objects.link(co)
co.location=G((3.1-7,1.6,1.15)); co.rotation_euler=(V(G((3.1,1.35,1.15)))-co.location).to_track_quat('-Z','Y').to_euler(); sc.camera=co
sc.render.resolution_x,sc.render.resolution_y=1150,800
dg=bpy.context.evaluated_depsgraph_get()
def verts(o,grp=None):
    e=o.evaluated_get(dg); me=e.to_mesh(); gi=o.vertex_groups[grp].index if grp else None
    P=[o.matrix_world@v.co for v in me.vertices if gi is None or any(g.group==gi and g.weight>0.5 for g in v.groups)]; e.to_mesh_clear(); return P
dm=[o for o in dex if o.type=='MESH'][0]; head=verts(dm,'head')+verts(dm,'antenna')
bm=[o for o in booth if o.type=='MESH' and 'screen' not in o.name][0]; bv=verts(bm)
frame=[p for p in bv if p.z>1.7]          # screen frame + upper posts/elbows
frame_bottom=min(p.z for p in frame if abs(p.y+1.15)<0.75 and p.x>3.6)   # frame face, behind Dex (x > Dex) and within its width
top=max(p.z for p in head)
def py(p): return w2c(sc,co,p).y*sc.render.resolution_y   # pixel row from bottom
# projected: Dex's highest pixel vs the lowest frame pixel in the same image columns
hp=max(py(p) for p in head); fp=min(py(p) for p in frame if p.x>3.6 and abs(w2c(sc,co,p).x-0.5)<0.15)
rep={'dex_head_top_world_m':round(top,3),'frame_bottom_world_m':round(frame_bottom,3),'gap_3d_m':round(frame_bottom-top,3),
     'at_7m_px_dex_top':round(hp,1),'at_7m_px_frame_bottom':round(fp,1),'projected_gap_px':round(fp-hp,1),'clears':fp>hp}
print('B7',json.dumps(rep))
for o in bpy.data.objects: o.hide_render=False
sc.render.filepath=f'{OUT}/cantina_review_booth_dex_7m.png'; bpy.ops.render.render(write_still=True)
