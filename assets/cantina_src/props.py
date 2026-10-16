import bpy, math, json, os, sys
from mathutils import Vector as V, Matrix
DST='/workspace/loft-xr/assets/builds-opt'; PREV='/workspace/loft-xr/assets/cantina_src'
def reset():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
MATS={}
def body_mat():
    if 'cantina_body' in MATS: return MATS['cantina_body']
    m=bpy.data.materials.new('cantina_body'); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=nt.nodes.new('ShaderNodeVertexColor'); c.layer_name='Col'; nt.links.new(c.outputs[0],b.inputs['Base Color'])
    b.inputs['Roughness'].default_value=0.55; b.inputs['Metallic'].default_value=0.2; MATS['cantina_body']=m; return m
def glow_mat(n,col,st):
    if n in MATS: return MATS[n]
    m=bpy.data.materials.new(n); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Emission Color'].default_value=(*col,1); b.inputs['Emission Strength'].default_value=st
    MATS[n]=m; return m
AMBER=(1.0,0.55,0.15); TEAL=(0.1,0.85,0.8)
PARTS=[]
def tag(o,col,glow=None):
    o.data.materials.clear()
    if glow: o.data.materials.append(glow_mat(*glow))
    else: o.data.materials.append(body_mat())
    ca=o.data.color_attributes.new('Col','BYTE_COLOR','CORNER')
    for d in ca.data: d.color=(*col,1)
    PARTS.append(o); return o
def box(c,s,col,glow=None,rz=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c,rotation=(0,0,rz)); o=bpy.context.object; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); return tag(o,col,glow)
def cyl(c,r,h,col,n=12,glow=None,r2=None,rot=(0,0,0)):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=c,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r2,depth=h,location=c,rotation=rot)
    o=bpy.context.object; return tag(o,col,glow)
def sph(c,r,col,seg=10,ring=6,sz=1,glow=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=ring,radius=r,location=c); o=bpy.context.object; o.scale.z=sz
    bpy.ops.object.transform_apply(scale=True); return tag(o,col,glow)
def arc_strip(R,a0,a1,n,r_in,r_out,z0,z1,col,glow=None):
    # annular sector solid around origin (center at (0,R) so arc bulges toward +Z... built in XY then mapped)
    import bmesh
    bm=bmesh.new(); vs=[]
    for i in range(n+1):
        a=a0+(a1-a0)*i/n
        for rr in (r_in,r_out):
            for z in (z0,z1): vs.append(bm.verts.new((math.sin(a)*rr,-math.cos(a)*rr+R,z)))
    for i in range(n):
        b=i*4; q=b+4
        for f in ((b+0,q+0,q+1,b+1),(b+2,b+3,q+3,q+2),(b+1,q+1,q+3,b+3),(b+0,b+2,q+2,q+0)): bm.faces.new([vs[k] for k in f])
    bm.faces.new([vs[k] for k in (0,1,3,2)]); bm.faces.new([vs[k] for k in (n*4+0,n*4+2,n*4+3,n*4+1)])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new('arc'); bm.to_mesh(me); o=bpy.data.objects.new('arc',me); bpy.context.collection.objects.link(o); return tag(o,col,glow)
def finish(name,desc,lod_ratio=0.5,extra=None):
    # join per material, origin bottom-center, export lod0+lod1
    out={}
    groups={}
    for o in PARTS: groups.setdefault(o.data.materials[0].name,[]).append(o)
    objs=[]
    for mn,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); j=bpy.context.object; j.name=name+'_'+mn.replace('cantina_',''); objs.append(j)
    pts=[o.matrix_world@V(c) for o in objs for c in o.bound_box]
    mn=V([min(p[i] for p in pts) for i in range(3)]); mx=V([max(p[i] for p in pts) for i in range(3)])
    off=V(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
    for o in objs:
        o.data.transform(Matrix.Translation(-off)); o.data.shade_flat() if hasattr(o.data,'shade_flat') else None
    def tris(): return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs)
    def exp(fn):
        bpy.ops.export_scene.gltf(filepath=f'{DST}/{fn}',export_format='GLB',export_draco_mesh_compression_enable=True,export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_vertex_color='ACTIVE')
        return os.path.getsize(f'{DST}/{fn}')
    t0=tris(); b0=exp(name+'.glb')
    for o in objs:
        if len(o.data.polygons)>40:
            d=o.modifiers.new('d','DECIMATE'); d.ratio=lod_ratio; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
    t1=tris(); b1=exp(name+'_lod1.glb')
    dims=mx-mn
    rec={'file':name+'.glb','name':desc,'scale':1.0,'lod1':name+'_lod1.glb','dims_mm':{'x':round(dims.x*1000,1),'y':round(dims.z*1000,1),'z':round(dims.y*1000,1)},
         'tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':len(objs),'materials':sorted(groups),'room':'cantina','method':'procedural','date':__import__('datetime').datetime.now().astimezone().isoformat(timespec='seconds')}
    if extra: rec.update(extra)
    print('PIECE',json.dumps(rec)); return rec
