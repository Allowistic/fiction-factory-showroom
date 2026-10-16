import bpy,sys,json,math
from mathutils import Vector as V
recs=json.load(open('/workspace/loft-xr/assets/cantina_src/pieces.json'))[:4]+json.load(open('/workspace/loft-xr/assets/cantina_src/kaykit_pieces.json'))
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
x=0
for r in recs:
    before=set(sc.objects); bpy.ops.import_scene.gltf(filepath='/workspace/loft-xr/assets/builds-opt/'+r['file'])
    new=[o for o in sc.objects if o not in before]; w=r['dims_mm']['x']/1000
    for o in new:
        if o.parent is None: o.location.x+=x+w/2
    x+=w+0.3
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=2000; sc.render.resolution_y=700
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.15,0.13,0.12,1)
l=bpy.data.lights.new('l','SUN'); l.energy=3; L=bpy.data.objects.new('l',l); sc.collection.objects.link(L); L.rotation_euler=(0.9,0,0.5)
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=x
cam.location=(x/2,-20,8); cam.rotation_euler=(math.radians(68),0,0)
sc.render.filepath='/workspace/loft-xr/assets/builds-opt/cantina_pieces_preview.png'; bpy.ops.render.render(write_still=True)
