import bpy,json,os,math,datetime
from mathutils import Vector as V, Matrix
K='/workspace/loft-xr/cantina/kaykit'; DST='/workspace/loft-xr/assets/builds-opt'
SB=K+'/KayKit-Space-Base-Bits-1.0/addons/kaykit_space_base_bits/Assets/gltf/'
RB=K+'/KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf/'
PICK=[('cargo_A',SB,'Cargo crate'),('cargo_A_stacked',SB,'Stacked cargo crates'),('containers_B',SB,'Fuel containers'),('containers_D',SB,'Container cluster'),('lights',SB,'Floor light post'),
      ('jar_A_large',RB,'Large jar (bar-top)'),('jar_C_medium',RB,'Medium jar (bar-top)'),('menu',RB,'Menu stand'),('food_dinner',RB,'Dinner plate'),('pot_large',RB,'Large pot (back bar)')]
recs=[]
for n,d,desc in PICK:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=d+n+'.gltf')
    ms=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active=ms[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if len(ms)>1: bpy.ops.object.join()
    o=bpy.context.object
    if d==RB: o.data.transform(Matrix.Scale(0.33,4))
    o.name=o.data.name='cantina_kk_'+n
    for im in bpy.data.images:
        if max(im.size)>512: im.scale(512,512)
    pts=[v.co.copy() for v in o.data.vertices]; mn=V([min(p[i] for p in pts) for i in range(3)]); mx=V([max(p[i] for p in pts) for i in range(3)])
    o.data.transform(Matrix.Translation(-V(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))))
    def tris(): return sum(len(p.vertices)-2 for p in o.data.polygons)
    def exp(fn): bpy.ops.export_scene.gltf(filepath=f'{DST}/{fn}',export_format='GLB',export_draco_mesh_compression_enable=True,export_image_format='AUTO',export_yup=True); return os.path.getsize(f'{DST}/{fn}')
    name='cantina_prop_'+n
    t0=tris(); b0=exp(name+'.glb')
    dm=o.modifiers.new('d','DECIMATE'); dm.ratio=0.5; bpy.ops.object.modifier_apply(modifier='d')
    t1=tris(); b1=exp(name+'_lod1.glb'); dims=mx-mn
    recs.append({'file':name+'.glb','name':'Cantina prop: '+desc,'scale':1.0,'lod1':name+'_lod1.glb','dims_mm':{'x':round(dims.x*1000,1),'y':round(dims.z*1000,1),'z':round(dims.y*1000,1)},
      'tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':len(o.data.materials),'materials':[m.name for m in o.data.materials],'room':'cantina',
      'source':'KayKit '+('Space Base Bits' if d==SB else 'Restaurant Bits')+' 1.0 / '+n+'.gltf (CC0, Kay Lousberg)','license':'CC0','date':datetime.datetime.now().astimezone().isoformat(timespec='seconds')})
    print('PIECE',json.dumps(recs[-1]))
json.dump(recs,open('/workspace/loft-xr/assets/cantina_src/kaykit_pieces.json','w'),indent=1)
