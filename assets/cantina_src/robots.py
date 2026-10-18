"""Cantina robots (bartender 'Tapper', DJ 'Dex') + DJ booth. Blender 4.3, original procedural geometry, CC0 ambientCG textures.
Robots: one skinned mesh (rigid weights) + armature -> pivots at the joints, 2 draws. Booth: body + spinning platters + video screen."""
import sys,os,json,math,datetime; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from props2 import *
from mathutils import Vector as V, Matrix, Euler
OUT=os.environ.get('OUTDIR',DST)
GRP={}
def G(o,g): o['grp']=g; return o
def part(g,fn,*a,**k): return G(fn(*a,**k),g)
TEAL_D=(0.1,0.85,0.8)
def mats2():
    mats()
    M['steel_dk']=texmat('steel_dk','Metal046B',(0.45,0.47,0.48),0.85,0.55,1.5)   # dark gunmetal, satin (no plastic gloss)
    M['brass_old']=texmat('brass_old','Metal032',(0.72,0.5,0.24),1.0,0.5,1.0)
    M['visor']=flat('visor',(0.012,0.02,0.02),0.25)
    m=flat('lamp_amber',(1.0,0.5,0.12),0.5); b=m.node_tree.nodes['Principled BSDF']; b.inputs['Emission Color'].default_value=(1.0,0.5,0.12,1); b.inputs['Emission Strength'].default_value=2.2; M['lamp_amber']=m   # baked into the atlas (no extra draw)
    M['copper']=texmat('copper','Metal032',(0.85,0.42,0.26),1.0,0.5,1.0)
def arc2(R,a0,a1,n,r0,r1,z0,z1,th,k):
    """curved panel whose radius goes r0 (at z0) -> r1 (at z1), thickness th: flared apron"""
    bm=bmesh.new(); vs=[]
    for i in range(n+1):
        a=a0+(a1-a0)*i/n
        for z,r in ((z0,r0),(z1,r1)):
            for rr in (r,r+th): vs.append(bm.verts.new((math.sin(a)*rr,-math.cos(a)*rr+R,z)))
    # order per column: (z0,in),(z0,out),(z1,in),(z1,out)
    for i in range(n):
        b=i*4; q=b+4
        for f in ((b,q,q+2,b+2),(b+1,b+3,q+3,q+1),(b+2,q+2,q+3,b+3),(b,b+1,q+1,q)): bm.faces.new([vs[x] for x in f])
    bm.faces.new([vs[x] for x in (0,2,3,1)]); bm.faces.new([vs[x] for x in (n*4,n*4+1,n*4+3,n*4+2)])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new('a2'); bm.to_mesh(me); o=bpy.data.objects.new('a2',me); bpy.context.collection.objects.link(o); return tag(o,k)
# ---------------- robot primitives ----------------
def capsule(g,c,r,h,k,n=12,rot=(0,0,0)):   # cylinder with half-sphere-ish ends via lathe
    prof=[(0,-h/2-r*0.9)]+[(r*math.sin(a),-h/2-r*0.9*math.cos(a)) for a in (0.6,1.2)]+[(r,-h/2),(r,h/2)]+[(r*math.sin(a),h/2+r*0.9*math.cos(a)) for a in (1.2,0.6)]+[(0,h/2+r*0.9)]
    prof=[(max(p[0],0.0005),p[1]) for p in prof]
    o=lathe((0,0,0),prof,k,n=n); o.rotation_euler=rot; o.location=c
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.transform_apply(location=True,rotation=True)
    return G(o,g)
def sph(g,c,r,k,seg=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=r,location=c); o=bpy.context.object
    for p in o.data.polygons: p.use_smooth=True
    return G(tag(o,k),g)
def limb(g,a,b,r,k,n=10,r2=None):
    a=V(a); b=V(b); d=b-a; L=d.length
    q=d.to_track_quat('Z','Y').to_euler()
    return part(g,cyl,tuple((a+b)/2),r,L,k,n=n,r2=r2,rot=tuple(q))
def hand(g,w,x,z,s=1.0,side=1):
    """3-finger claw around wrist point w (fingers pointing -Z, palm facing inward)"""
    wx,wy,wz=w
    part(g,box,(wx,wy,wz-0.045*s),(0.05*s,0.075*s,0.07*s),'steel_dk')
    for i,dy in enumerate((-0.025,0.0,0.025)):
        limb(g,(wx,wy+dy*s,wz-0.08*s),(wx+side*0.004,wy+dy*s*1.1,wz-0.15*s),0.011*s,'brass_old',n=6)
    limb(g,(wx+side*0.025*s,wy-0.03*s,wz-0.06*s),(wx+side*0.045*s,wy-0.05*s,wz-0.11*s),0.011*s,'brass_old',n=6)   # thumb
def arm(side,sh,el,wr,ur,fr,cuff='brass_old',main='steel_dk'):
    S='R' if side<0 else 'L'; A,F='arm'+S,'fore'+S
    U=ur*1.3                                   # upper arm 1.3x (Nova)
    sph(A,sh,U*1.32,'brass_old',14,8)          # shoulder ball (was 1.45*ur -> now 1.72*ur)
    limb(A,sh,el,U,main,n=14,r2=U*0.85)
    sph(F,el,U*1.02,'brass_old',14,8)          # elbow ball (was 1.05*ur -> now 1.33*ur)
    limb(F,el,wr,fr,main,n=14,r2=fr*0.8)
    part(F,cyl,(wr[0],wr[1],wr[2]+0.035),fr*1.15,0.04,cuff,n=10)
    hand(F,wr,0,0,1.0,side)
BONES={}
def bone(name,head,parent=None): BONES[name]=(V(head),parent)   # every bone points +Z with roll 0 -> identity rest rotation in glTF

def tapper():
    """Bartender 'Tapper': barrel torso, lantern head with teal visor slit, oxblood wrap apron, column on a wheeled plinth.
    Stands behind a 1.05 m bar, so the readable part is 1.0-1.85 m. Faces -Y (glTF +Z), right arm on -X."""
    BONES.clear()
    # stepped base + 1.7x column + flared brass collar: bar-stool column
    part('root',cyl,(0,0,0.025),0.3,0.05,'steel_dk',n=20)
    part('root',cyl,(0,0,0.055),0.305,0.012,'brass_old',n=20)
    part('root',cyl,(0,0,0.085),0.235,0.05,'steel_dk',n=20)
    part('root',cyl,(0,0,0.115),0.24,0.012,'brass_old',n=20)
    part('root',cyl,(0,0,0.14),0.18,0.04,'steel_dk',n=18)
    part('root',cyl,(0,0,0.45),0.145,0.58,'steel',n=16)
    for z in (0.3,0.6): part('root',cyl,(0,0,z),0.152,0.018,'brass_old',n=16)
    part('root',lathe,(0,0,0.74),[(0.15,0),(0.16,0.05),(0.19,0.1),(0.215,0.14),(0.215,0.16),(0.0005,0.16)],'brass_old',n=24)   # flared collar
    sph('root',(0,0,0.96),0.15,'brass_old',18,8)
    # barrel with a hard shoulder line: belly -> straight flank -> flat shoulder ledge -> neck
    part('torso',lathe,(0,0,0.97),[(0.17,0),(0.215,0.08),(0.235,0.2),(0.235,0.34),(0.25,0.36),(0.25,0.4),(0.16,0.43),(0.11,0.5),(0.11,0.52),(0.0005,0.52)],'steel_dk',n=24)
    part('torso',cyl,(0,0,1.25),0.24,0.025,'brass_old',n=24)
    part('torso',cyl,(0,0,1.36),0.258,0.03,'brass_old',n=24)            # shoulder flange (silhouette break)
    part('torso',box,(0,-0.232,1.2),(0.11,0.02,0.07),'brass_old')
    for i in range(4): part('torso',box,(0,-0.243,1.17+i*0.02),(0.09,0.006,0.007),'char')
    part('torso',box,(0,-0.236,1.105),(0.07,0.02,0.03),'char')                                     # bow tie knot
    for sx in (-1,1): part('torso',box,(sx*0.045,-0.236,1.105),(0.05,0.016,0.045),'char')
    part('torso',arc2,0.0,math.radians(-82),math.radians(82),12,0.255,0.205,0.7,1.09,0.012,'leather')     # A-line apron flares out below the waist
    part('torso',arc,0.0,math.radians(-86),math.radians(86),12,0.2,0.226,1.07,1.105,'brass_old')            # apron band = waist line
    part('torso',arc2,0.0,math.radians(-22),math.radians(22),4,0.258,0.24,0.8,0.94,0.008,'leather')       # pocket
    part('torso',box,(0,0,1.43),(0.56,0.18,0.06),'brass_old')
    part('head',cyl,(0,0,1.53),0.045,0.07,'steel',n=10)
    H0=len(PARTS)
    part('head',lathe,(0,0,1.56),[(0.13,0),(0.15,0.03),(0.155,0.12),(0.14,0.18),(0.09,0.215),(0.0005,0.22)],'brass_old',n=16)
    part('head',arc,0.0,math.radians(-70),math.radians(70),12,0.15,0.163,1.615,1.685,'visor')
    part('head',arc,0.0,math.radians(-50),math.radians(50),10,0.163,0.168,1.64,1.66,('cantina_glow_teal',TEAL,2.5))
    for sx in (-1,1): part('head',cyl,(sx*0.158,0,1.65),0.04,0.025,'steel_dk',n=12,rot=(0,math.pi/2,0)); part('head',cyl,(sx*0.172,0,1.65),0.022,0.01,'brass_old',n=10,rot=(0,math.pi/2,0))
    for o in PARTS[H0:]:   # Nova/Quinn: head 1.3x incl. visor, scaled about the head base so the neck and shoulders stay put
        o.matrix_world=Matrix.Translation((0,0,1.56))@Matrix.Scale(1.3,4)@Matrix.Translation((0,0,-1.56))@o.matrix_world
    part('antenna',cyl,(0,0,1.86),0.007,0.17,'brass_old',n=6); sph('antenna',(0,0,1.95),0.018,'brass_old',8,5)
    for side in (-1,1):
        sx=side*0.29; arm(side,(sx,0,1.4),(sx+side*0.03,-0.02,1.12),(sx+side*0.03,-0.06,0.88),0.05,0.042)
    bone('root',(0,0,0)); bone('torso',(0,0,0.96),'root'); bone('head',(0,0,1.5),'torso'); bone('antenna',(0,0,1.775),'head')
    for side,S in ((-1,'R'),(1,'L')):
        sx=side*0.29; bone('arm'+S,(sx,0,1.4),'torso'); bone('fore'+S,(sx+side*0.03,-0.02,1.12),'arm'+S)

def dex():
    """DJ Dex: proportions match Jules's placeholder (shoulders 1.04, elbows 0.77 above the root; Dex stands on the booth's 0.25 m riser).
    Dark-glass face with teal eyes, brass headphones with teal rings, oxblood leather jacket shell, brass chest plate with a teal level meter."""
    BONES.clear()
    part('root',cyl,(0,0,0.04),0.162,0.08,'steel_dk',n=24); part('root',cyl,(0,0,0.085),0.17,0.012,'brass_old',n=24)   # base fits the riser behind the counter (front edge 0.1 m clear of counter back)
    part('root',cyl,(0,0,0.34),0.105,0.52,'steel',n=28)                 # column 1.4x (family with Tapper)
    part('root',cyl,(0,0,0.5),0.116,0.024,'brass_old',n=40)             # single brass collar ring
    part('root',cyl,(0,0,0.6),0.11,0.1,'steel_dk',n=32,r2=0.13); sph('root',(0,0,0.68),0.115,'brass_old',28,12)
    # jacket torso: narrow waist -> brass belt at ~60% down -> broad squared chest -> flat shoulder yoke
    w=part('torso',lathe,(0,0,0.68),[(0.11,0),(0.122,0.08),(0.135,0.15),(0.0005,0.15)],'leather',n=40)            # waist, straight taper (0.68-0.83)
    part('torso',cyl,(0,0,0.845),0.165,0.04,'brass_old',n=64)                                                     # belt band
    part('torso',box,(0,-0.163,0.845),(0.05,0.012,0.032),'copper')                                               # buckle (copper trim accent)
    c=part('torso',lathe,(0,0,0.855),[(0.15,0),(0.2,0.06),(0.225,0.14),(0.23,0.19),(0.0005,0.19)],'leather',n=8)  # chest: 8-sided -> squared
    c.rotation_euler=(0,0,math.pi/8); c.scale=(1.12,0.82,1.0); bpy.context.view_layer.objects.active=c
    bpy.ops.object.select_all(action='DESELECT'); c.select_set(True); bpy.ops.object.transform_apply(rotation=True,scale=True)
    part('torso',box,(0,0,1.075),(0.48,0.2,0.055),'leather')                                                       # flat squared shoulder yoke
    part('torso',box,(0,0,1.1045),(0.44,0.17,0.008),'steel_dk')                                                     # yoke top seam (inset, own height)
    for sx in (-1,1):
        part('torso',box,(sx*0.24,0,1.078),(0.11,0.218,0.074),'steel_dk')                                          # square shoulder pads (closed, proud of the yoke on all sides)
        lp=part('torso',box,(sx*0.04,-0.17,0.965),(0.055,0.018,0.17),'leather',rz=-sx*0.35)                           # lapels angled in -> concave chest
        lp2=part('torso',box,(sx*0.06,-0.168,1.045),(0.06,0.016,0.04),'steel_dk',rz=-sx*0.45)                        # collar
    part('torso',box,(0,-0.172,0.955),(0.01,0.01,0.2),'brass_old')                                                # zip seam in the recessed V centre
    for i in range(5): part('torso',box,(0.11+i*0.0,-0.176,0.9+0.022*i),(0.04,0.006,0.012),'lamp_amber')            # small amber level meter on the jacket breast (baked, no draw)
    part('head',cyl,(0,0,1.15),0.04,0.07,'steel',n=10)
    part('head',lathe,(0,0,1.18),[(0.1,0),(0.14,0.025),(0.15,0.1),(0.14,0.18),(0.1,0.21),(0.0005,0.22)],'steel_dk',n=16)
    part('head',arc,0.0,math.radians(-60),math.radians(60),10,0.142,0.155,1.22,1.345,'visor')
    for sx in (-1,1):
        part('head',cyl,(sx*0.05,-0.157,1.29),0.022,0.008,('cantina_glow_teal',TEAL,3.0),n=10,rot=(math.pi/2,0,0))
        part('head',cyl,(sx*0.16,0,1.29),0.062,0.05,'brass_old',n=16,rot=(0,math.pi/2,0))
        part('head',cyl,(sx*0.186,0,1.29),0.045,0.008,'char',n=14,rot=(0,math.pi/2,0)); part('head',cyl,(sx*0.19,0,1.29),0.025,0.006,'brass_old',n=10,rot=(0,math.pi/2,0))
    pts=[(0.17*math.cos(a),0,1.29+0.17*math.sin(a)) for a in [math.radians(x) for x in range(0,181,15)]]
    for a,b in zip(pts,pts[1:]): limb('head',a,b,0.013,'brass_old',n=6)
    part('antenna',cyl,(0.0,0.07,1.43),0.005,0.06,'brass_old',n=6); sph('antenna',(0.0,0.07,1.465),0.013,('cantina_glow_teal',TEAL,3.0),8,5)
    for side in (-1,1):
        sx=side*0.25; arm(side,(sx,0,1.04),(sx+side*0.01,0,0.77),(sx+side*0.01,-0.01,0.48),0.045,0.038)
    bone('root',(0,0,0)); bone('torso',(0,0,0.68),'root'); bone('head',(0,0,1.18),'torso'); bone('antenna',(0,0.07,1.4),'head')
    for side,S in ((-1,'R'),(1,'L')):
        sx=side*0.25; bone('arm'+S,(sx,0,1.04),'torso'); bone('fore'+S,(sx+side*0.01,0,0.77),'arm'+S)

# ---------------- animation clips (rest pose = what is baked) ----------------
def key(arm,clip,frames,fps=30):
    """frames: list of (t_s, {bone: (rx,ry,rz) degrees local})"""
    act=bpy.data.actions.new(clip); arm.animation_data_create(); arm.animation_data.action=act
    bones={b for _,d in frames for b in d}
    for t,d in frames:
        for b in bones:
            pb=arm.pose.bones[b]; pb.rotation_mode='ZYX'   # Blender ZYX == three.js Euler 'XYZ'
            r=d.get(b,(0,0,0)); pb.rotation_euler=r   # radians; bone axes = glTF axes (x right, y up, z forward) because rest rotations are identity
            pb.keyframe_insert('rotation_euler',frame=1+round(t*fps))
    act.use_fake_user=True
    tr=arm.animation_data.nla_tracks.new(); tr.name=clip; tr.strips.new(clip,1,act); tr.mute=True
    arm.animation_data.action=None
    return act

def rig_and_join(name,clips):
    # armature
    bpy.ops.object.armature_add(location=(0,0,0)); A=bpy.context.object; A.name=name+'_rig'; A.data.name=name+'_rig'
    bpy.ops.object.mode_set(mode='EDIT'); eb=A.data.edit_bones; eb.remove(eb[0])
    for n,(h,p) in BONES.items():
        b=eb.new(n); b.head=h; b.tail=h+V((0,0,0.08)); b.roll=0
        if p: b.parent=eb[p]; b.use_connect=False
        b.use_deform=True
    bpy.ops.object.mode_set(mode='OBJECT')
    objs=[o for o in PARTS if o.name in bpy.data.objects and o.get('grp')]
    # vertex groups per part (rigid)
    for o in objs:
        vg=o.vertex_groups.new(name=o['grp']); vg.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
    gl=[o for o in objs if o['glow']]; nb=[o for o in objs if not o['glow']]
    for o in nb:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
        bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    j=bake_join(nb,name+'_atlas',RES)
    gj=[]
    GR={}
    for o in gl: GR.setdefault(o.data.materials[0].name,[]).append(o)
    for mname,g in sorted(GR.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for o in g: o.select_set(True)
        bpy.context.view_layer.objects.active=g[0]; bpy.ops.object.join(); gj.append(bpy.context.object)
    # one skinned mesh: atlas + glow as 2 material slots (2 draws)
    bpy.ops.object.select_all(action='DESELECT')
    for o in [j]+gj: o.select_set(True)
    bpy.context.view_layer.objects.active=j; bpy.ops.object.join(); j.name=name; j.data.name=name
    # glow verts need UVs: they got none in bake_join -> joined UV layer gives zeros, fine (emissive flat colour)
    m=j.modifiers.new('rig','ARMATURE'); m.object=A; j.parent=A
    for c,frames in clips.items(): key(A,c,frames)
    return A,j

def tris(objs): return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs if o.type=='MESH')
def draws(objs): return sum(len({p.material_index for p in o.data.polygons}) for o in objs if o.type=='MESH')
def ex(fn,sel,anim=True):
    for o in bpy.context.scene.objects: o.select_set(o in sel)
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{fn}',export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,
        export_image_format='JPEG',export_yup=True,export_apply=False,export_animations=anim,export_animation_mode='ACTIONS',
        export_skins=True,export_def_bones=True,export_force_sampling=True,export_optimize_animation_size=True)
    return os.path.getsize(f'{OUT}/{fn}')
def lod(objs,ratio,min_faces=int(os.environ.get('LODMIN','100'))):
    """decimate big islands only; small closed parts (pads, plates, fingers) are kept whole so nothing tears open"""
    for o in objs:
        if o.type!='MESH': continue
        nm=o.name; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
        pieces=list(bpy.context.selected_objects)
        for p in pieces:
            if len(p.data.polygons)>=min_faces:
                d=p.modifiers.new('d','DECIMATE'); d.ratio=ratio; d.use_collapse_triangulate=True
                bpy.context.view_layer.objects.active=p
                while p.modifiers[0].name!='d': bpy.ops.object.modifier_move_up(modifier='d')
                bpy.ops.object.modifier_apply(modifier='d')
        bpy.ops.object.select_all(action='DESELECT')
        for p in pieces: p.select_set(True)
        keep=[p for p in pieces if p.name==nm] or pieces[:1]; bpy.context.view_layer.objects.active=keep[0]; bpy.ops.object.join(); keep[0].name=nm
def nonmanifold(o):
    import bmesh as _b
    bm=_b.new(); bm.from_mesh(o.data); n=sum(1 for e in bm.edges if len(e.link_faces)!=2); bm.free(); return n
def render(path,objs,cam,look,res=(900,1200),frame=None,arm=None,clip=None):
    sc=bpy.context.scene
    for o in sc.objects:
        if o.type in('MESH','ARMATURE'): o.hide_render=o not in objs
    c=bpy.data.cameras.new('c'); c.lens=50; co=bpy.data.objects.new('cam',c); sc.collection.objects.link(co); co.location=cam
    d=V(look)-V(cam); co.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); sc.camera=co
    sc.render.resolution_x,sc.render.resolution_y=res; sc.render.engine='BLENDER_EEVEE_NEXT'
    sc.world.node_tree.nodes['Background'].inputs[0].default_value=(0.03,0.028,0.026,1); sc.world.node_tree.nodes['Background'].inputs[1].default_value=1
    sc.render.image_settings.file_format='PNG'
    if arm and clip:
        arm.animation_data.action=bpy.data.actions[clip]; sc.frame_set(frame)
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
    if arm: arm.animation_data.action=None; sc.frame_set(1)
    bpy.data.objects.remove(co)
RES=1024
