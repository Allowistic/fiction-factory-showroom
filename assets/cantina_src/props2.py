import bpy, bmesh, math, json, os, datetime
from mathutils import Vector as V, Matrix
DST='/workspace/loft-xr/assets/builds-opt'; TX='/workspace/loft-xr/cantina/tex'; SRC='/workspace/loft-xr/assets/cantina_src'
S=int(os.environ.get('S','96'))
AMBER=(1.0,0.55,0.15); TEAL=(0.1,0.85,0.8)
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
M={}
def texmat(name,tex,tint=(1,1,1),metal=0.0,rough=None,scale=2.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    tc=nt.nodes.new('ShaderNodeTexCoord'); mp=nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(scale,scale,scale)
    nt.links.new(tc.outputs['Object'],mp.inputs[0])
    def img(suf,cs='Non-Color'):
        p=f'{TX}/{tex}/{tex}_1K-JPG_{suf}.jpg'
        if not os.path.exists(p): return None
        n=nt.nodes.new('ShaderNodeTexImage'); n.image=bpy.data.images.load(p,check_existing=True); n.image.colorspace_settings.name=cs; n.projection='BOX'; n.projection_blend=0.3
        nt.links.new(mp.outputs[0],n.inputs[0]); return n
    c=img('Color','sRGB'); mul=nt.nodes.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs[0].default_value=1
    nt.links.new(c.outputs[0],mul.inputs[6]); mul.inputs[7].default_value=(*tint,1); nt.links.new(mul.outputs[2],b.inputs['Base Color'])
    r=img('Roughness')
    if r and rough is None: nt.links.new(r.outputs[0],b.inputs['Roughness'])
    else: b.inputs['Roughness'].default_value=rough or 0.5
    n=img('NormalGL')
    if n:
        nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs[0],nm.inputs[1]); nm.inputs[0].default_value=0.6; nt.links.new(nm.outputs[0],b.inputs['Normal'])
    b.inputs['Metallic'].default_value=metal; return m
def flat(name,col,rough=0.3,metal=0.0,trans=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    b.inputs['Coat Weight'].default_value=0.5 if trans else 0; return m
def mats():
    M.clear()
    M['walnut']=texmat('walnut','Wood066',(0.55,0.42,0.32),0,None,1.2)
    M['brass']=texmat('brass','Metal032',(0.95,0.68,0.32),1.0,0.38,1.0)
    M['leather']=texmat('leather','Leather037',(0.62,0.33,0.30),0,0.55,1.5)
    M['steel']=texmat('steel','Metal046B',(1,1,1),0.8,None,1.5)
    M['glass']=flat('glass',(0.02,0.025,0.022),0.08,0,1)
    M['amberglass']=flat('amberglass',(0.25,0.11,0.02),0.08,0,1)
    M['char']=flat('char',(0.02,0.018,0.016),0.6)
    M['screen']=flat('screen',(0.01,0.01,0.01),0.2)
def glow(n,col,st):
    if n in M: return M[n]
    m=bpy.data.materials.new(n); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Emission Color'].default_value=(*col,1); b.inputs['Emission Strength'].default_value=st; M[n]=m; return m
PARTS=[]
def tag(o,k):
    o.data.materials.clear(); o.data.materials.append(M[k] if isinstance(k,str) else glow(*k)); o['glow']=not isinstance(k,str); PARTS.append(o); return o
def box(c,s,k,rz=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c,rotation=(0,0,rz)); o=bpy.context.object; o.scale=s; bpy.ops.object.transform_apply(scale=True,rotation=True); return tag(o,k)
def cyl(c,r,h,k,n=12,r2=None,rot=(0,0,0)):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=c,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r2,depth=h,location=c,rotation=rot)
    return tag(bpy.context.object,k)
def lathe(c,prof,k,n=10):
    bm=bmesh.new(); rings=[]
    for r,z in prof: rings.append([bm.verts.new((c[0]+r*math.cos(2*math.pi*i/n),c[1]+r*math.sin(2*math.pi*i/n),c[2]+z)) for i in range(n)])
    for a,b in zip(rings,rings[1:]):
        for i in range(n): bm.faces.new((a[i],a[(i+1)%n],b[(i+1)%n],b[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    me=bpy.data.meshes.new('l'); bm.to_mesh(me); o=bpy.data.objects.new('l',me); bpy.context.collection.objects.link(o)
    for p in me.polygons: p.use_smooth=True
    return tag(o,k)
def arc(R,a0,a1,n,ri,ro,z0,z1,k):
    bm=bmesh.new(); vs=[]
    for i in range(n+1):
        a=a0+(a1-a0)*i/n
        for rr in (ri,ro):
            for z in (z0,z1): vs.append(bm.verts.new((math.sin(a)*rr,-math.cos(a)*rr+R,z)))
    for i in range(n):
        b=i*4; q=b+4
        for f in ((b,q,q+1,b+1),(b+2,b+3,q+3,q+2),(b+1,q+1,q+3,b+3),(b,b+2,q+2,q)): bm.faces.new([vs[x] for x in f])
    bm.faces.new([vs[x] for x in (0,1,3,2)]); bm.faces.new([vs[x] for x in (n*4,n*4+2,n*4+3,n*4+1)])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new('a'); bm.to_mesh(me); o=bpy.data.objects.new('a',me); bpy.context.collection.objects.link(o); return tag(o,k)
def rig():
    sc=bpy.context.scene; w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
    bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.55,0.45,0.35,1); bg.inputs[1].default_value=0.12
    for loc,rot,e,col,sz in (((1.5,-3,3.2),(math.radians(50),0,math.radians(25)),120,(1,0.72,0.45),3),((-3,1,2.2),(math.radians(70),0,math.radians(-110)),30,(1,0.6,0.3),2)):
        l=bpy.data.lights.new('k','AREA'); l.energy=e; l.color=col; l.size=sz; o=bpy.data.objects.new('k',l); sc.collection.objects.link(o); o.location=loc; o.rotation_euler=rot
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=S; sc.cycles.max_bounces=4
    sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium Low Contrast'; sc.view_settings.exposure=0.3
    b=sc.render.bake; b.margin=12; b.margin_type='EXTEND'; b.use_pass_direct=b.use_pass_indirect=b.use_pass_diffuse=b.use_pass_emit=True; b.use_pass_glossy=True
    sc.render.image_settings.file_format='JPEG'; sc.render.image_settings.quality=88
def bake_join(objs,atlas,res):
    """join non-glow objs, uv, bake to atlas; return baked object"""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); j=bpy.context.object
    while j.data.uv_layers: j.data.uv_layers.remove(j.data.uv_layers[0])
    j.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55),island_margin=0.006)
    bpy.ops.uv.pack_islands(margin=0.004,rotate=True,scale=True,margin_method='FRACTION',shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    im=bpy.data.images.new(atlas,res,res,float_buffer=True)
    for m in j.data.materials:
        nt=m.node_tree; n=nt.nodes.new('ShaderNodeTexImage'); n.image=im
        for x in nt.nodes: x.select=False
        n.select=True; nt.nodes.active=n
    j.select_set(True); bpy.context.view_layer.objects.active=j
    bpy.ops.object.bake(type='COMBINED')
    p=f'{DST}/{atlas}.jpg'; im.save_render(p,scene=bpy.context.scene)
    um=bpy.data.materials.new(atlas); um.use_nodes=True; nt=um.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(p); bg=nt.nodes.new('ShaderNodeBackground'); out=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs[0],bg.inputs[0]); nt.links.new(bg.outputs[0],out.inputs[0])
    j.data.materials.clear(); j.data.materials.append(um); return j
def export(name,objs,desc,lodr=0.5,extra=None,off=None):
    pts=[o.matrix_world@v.co for o in objs for v in o.data.vertices]
    mn=V([min(p[i] for p in pts) for i in range(3)]); mx=V([max(p[i] for p in pts) for i in range(3)])
    if off is None: off=V(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
    for o in objs: o.data.transform(o.matrix_world); o.matrix_world=Matrix(); o.data.transform(Matrix.Translation(-off))
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    def tris(): return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs)
    def ex(fn):
        bpy.ops.export_scene.gltf(filepath=f'{DST}/{fn}',export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_image_format='JPEG',export_yup=True,export_apply=True)
        return os.path.getsize(f'{DST}/{fn}')
    t0=tris(); b0=ex(name+'.glb')
    for o in objs:
        if len(o.data.polygons)>60:
            d=o.modifiers.new('d','DECIMATE'); d.ratio=lodr; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
    t1=tris(); b1=ex(name+'_lod1.glb'); dims=mx-mn
    rec={'file':name+'.glb','name':desc,'scale':1.0,'lod1':name+'_lod1.glb','dims_mm':{'x':round(dims.x*1000,1),'y':round(dims.z*1000,1),'z':round(dims.y*1000,1)},
     'tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':len({m.name for o in objs for m in o.data.materials}),'materials':sorted({m.name for o in objs for m in o.data.materials}),
     'unlit_baked':True,'room':'cantina','method':'procedural+CC0 PBR bake','date':datetime.datetime.now().astimezone().isoformat(timespec='seconds')}
    if extra: rec.update(extra)
    print('PIECE',json.dumps(rec)); return rec
def piece(name,desc,res,build,lodr=0.5,extra=None):
    reset(); mats(); rig(); PARTS.clear(); build()
    gl=[o for o in PARTS if o['glow']]; nb=[o for o in PARTS if not o['glow']]
    j=bake_join(nb,name+'_atlas',res)
    gj=[]
    for mname in {o.data.materials[0].name for o in gl}:
        g=[o for o in gl if o.data.materials[0].name==mname]
        bpy.ops.object.select_all(action='DESELECT')
        for o in g: o.select_set(True)
        bpy.context.view_layer.objects.active=g[0]; bpy.ops.object.join(); x=bpy.context.object; x.name=name+'_'+mname; gj.append(x)
    j.name=name; return export(name,[j]+gj,desc,lodr,extra)
