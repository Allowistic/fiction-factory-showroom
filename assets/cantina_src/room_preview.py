import bpy, math
from mathutils import Vector as V
B='/workspace/loft-xr/assets/builds-opt/'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def G(x,z): return (x,-z)   # glTF x,z -> blender x,y
def place(f,x,z,rot_deg,y=0.0):
    before=set(sc.objects); bpy.ops.import_scene.gltf(filepath=B+f)
    roots=[o for o in sc.objects if o not in before and o.parent is None]
    e=bpy.data.objects.new(f,None); sc.collection.objects.link(e)
    for r in roots: r.parent=e
    bx,by=G(x,z); e.location=(bx,by,y); e.rotation_euler=(0,0,math.radians(rot_deg)); return e
def mat(n,col,rough=0.7,metal=0,em=None,es=0):
    m=bpy.data.materials.new(n); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if em: b.inputs['Emission Color'].default_value=(*em,1); b.inputs['Emission Strength'].default_value=es
    return m
def box(c,s,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c); o=bpy.context.object; o.scale=s; o.data.materials.append(m); return o
W,D,H=8.0,6.5,3.2
wall=mat('wall',(0.09,0.05,0.035),0.8); floor=mat('floor',(0.05,0.04,0.035),0.5,0.0); ceil=mat('ceil',(0.04,0.035,0.03),0.8)
brass=mat('rib',(0.6,0.42,0.18),0.35,1.0); teal=mat('tealrib',(0.05,0.3,0.3),0.4,0,(0.1,0.85,0.8),0.8)
box((0,-D/2,-0.01),(W,D,0.02),floor); box((0,-D/2,H),(W,D,0.02),ceil)
box((0,-D-0.05,H/2),(W,0.1,H),wall); box((-W/2-0.05,-D/2,H/2),(0.1,D,H),wall); box((W/2+0.05,-D/2,H/2),(0.1,D,H),wall)
box((-2.4,0.05,H/2),(3.2,0.1,H),wall); box((2.4,0.05,H/2),(3.2,0.1,H),wall); box((0,0.05,2.6),(1.6,0.1,1.2),wall)
for i in range(1,6):
    y=-i*1.2+0.15
    for x in (-W/2+0.02,W/2-0.02): box((x,y,H/2),(0.05,0.08,H),brass)
    box((0,y,H-0.17),(W-0.3,0.16,0.02),wall); box((0,y-0.08,H-0.13),(W-0.3,0.02,0.1),wall); box((0,y+0.08,H-0.13),(W-0.3,0.02,0.1),wall)  # cove trough
    box((0,y,H-0.15),(W-0.4,0.03,0.01),teal)
    l=bpy.data.lights.new('cove','AREA'); l.shape='RECTANGLE'; l.size=W-0.5; l.size_y=0.05; l.energy=12; l.color=(0.1,0.85,0.8)
    o=bpy.data.objects.new('cove',l); sc.collection.objects.link(o); o.location=(0,y,H-0.14); o.rotation_euler=(math.pi,0,0)
# pieces (glTF room coords from SHOWROOM_SPEC)
place('ent_center_bar.glb',0,6.26,180)
place('cantina_bar.glb',-2.024,3.2,90)
place('cantina_stools.glb',-1.214,3.2,90)
place('cantina_back_bar.glb',-3.73,4.3,90)
place('cantina_booth.glb',2.6,3.6,-44)
place('cantina_prop_containers_D.glb',-3.6,1.0,0); place('cantina_prop_cargo_A_stacked.glb',3.4,5.9,10); place('cantina_prop_cargo_A.glb',2.6,6.0,-15)
place('cantina_prop_containers_B.glb',-3.55,6.05,90); place('cantina_prop_lights.glb',3.6,2.0,0)
for f,(x,z) in {'cantina_prop_jar_A_large.glb':(-1.95,3.7),'cantina_prop_jar_C_medium.glb':(-2.05,2.6),'cantina_prop_menu.glb':(-1.9,3.2),'cantina_prop_food_dinner.glb':(2.6,3.6),'cantina_prop_pot_large.glb':(-3.7,4.0)}.items():
    yy={'cantina_prop_food_dinner.glb':0.761,'cantina_prop_pot_large.glb':0.94}.get(f,1.05)
    place(f,x,z,0,yy)
# lights: ~20% ambient, amber + teal
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.03,0.025,0.02,1)
def pt(loc,e,col,r=0.2):
    l=bpy.data.lights.new('p','POINT'); l.energy=e; l.color=col; l.shadow_soft_size=r; o=bpy.data.objects.new('p',l); sc.collection.objects.link(o); o.location=loc
pt((-1.6,-3.2,0.3),60,(1,0.55,0.2),0.5); pt((-3.3,-4.3,1.8),70,(1,0.6,0.25),0.6); pt((2.6,-3.6,1.6),50,(1,0.6,0.25)); pt((0,-5.5,2.0),60,(1,0.7,0.45),1.0)
pt((2.6,-3.6,1.15),45,(1,0.55,0.25),0.3); pt((3.4,-3.9,0.9),25,(1,0.5,0.25),0.4)
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=1600; sc.render.resolution_y=900
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
try: sc.eevee.use_raytracing=True
except: pass
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.lens=16
t=bpy.data.objects.new('t',None); sc.collection.objects.link(t); cam.constraints.new('TRACK_TO').target=t
for n,loc,tg in (('entry',(0,-0.25,1.6),(0,-6.3,1.1)),('3q',(3.4,-0.7,2.5),(-1.2,-4.3,0.8))):
    cam.location=loc; t.location=tg; sc.render.filepath=B+f'cantina_room_preview_{n}.png'; bpy.ops.render.render(write_still=True)
