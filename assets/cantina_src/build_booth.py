"""DJ booth, laid out to match Jules's placeholder in showroom/bartender.js + dj.js (booth-local: counter faces +Z toward visitors,
deck A at -X = visitors' left, Dex on a 0.25 m riser at z -0.45, screen 1.4 x 0.7 at (0, 2.18, -0.66) tipped 0.06 rad toward visitors).
One skinned mesh (bones booth / platterA / platterB / xfader, identity rest rotations) = atlas + glow; screen = own mesh + material."""
import sys,os,json; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from robots import *
import bmesh
name='cantina_dj_booth'
reset(); mats2(); rig(); PARTS.clear(); BONES.clear()
# Blender: x = glTF x, Blender -y = glTF +z (visitors), Blender z = glTF y.  helper: g(x,y_up,z_fwd) -> blender coords
def g(x,yu,zf): return (x,-zf,yu)
CW,CD,CH=1.5,0.55,0.96
# counter
part('booth',box,g(0,0.04,0),(CW-0.04,CD-0.04,0.08),'char')
part('booth',box,g(0,0.5,0),(CW,CD,0.86),'walnut')
part('booth',box,g(0,0.98,0),(CW+0.06,CD+0.05,0.04),'brass_old')                 # top lip
part('booth',box,g(0,1.003,0),(CW-0.02,CD-0.03,0.008),'leather')                  # leather top pad
for sx in (-1,1): part('booth',box,g(sx*0.62,0.5,CD/2+0.006),(0.03,0.014,0.8),'brass_old')   # pilasters
part('booth',box,g(0,0.9,CD/2+0.008),(1.52,0.014,0.022),'brass_old')                       # brass rail
for i in range(7): part('booth',box,g(0,0.3+i*0.07,CD/2+0.004),(1.12,0.008,0.018),'brass_old' if i%3==0 else 'char')  # front grille slats
part('booth',box,g(0,0.07,CD/2+0.006),(1.52,0.012,0.012),('cantina_glow_teal',TEAL,2.5))     # teal kick light (cove)
part('booth',box,g(0.55,0.62,CD/2+0.012),(0.24,0.012,0.14),'brass_old')                       # 'request a song' bezel (pick proxy dj-request)
part('booth',box,g(0.55,0.62,CD/2+0.02),(0.2,0.006,0.1),'brass_old')                          # engraved brass 'request' plaque
for i,(w,yy) in enumerate(((0.15,0.645),(0.12,0.62),(0.15,0.595))): part('booth',box,g(0.55,yy,CD/2+0.0235),(w,0.002,0.008),'char')   # engraved lines
for sx in (-1,1): part('booth',cyl,g(0.55+sx*0.085,0.62,CD/2+0.024),0.007,0.004,'char',n=8,rot=(math.pi/2,0,0))                 # screw heads
# riser for Dex
part('booth',box,g(0,0.121,-0.5),(1.3,0.5,0.242),'steel_dk'); part('booth',box,g(0,0.246,-0.5),(1.32,0.5,0.008),'brass_old')   # riser top exactly y 0.25 = Dex root
part('booth',box,g(0,0.24,-0.248),(1.3,0.012,0.012),'lamp_amber')           # riser nosing light (amber, baked)
# decks
TOP=1.0
for d,sx in (('A',-1),('B',1)):
    x=sx*0.48
    part('booth',box,g(x,TOP+0.025,0.02),(0.44,0.4,0.05),'steel_dk')
    part('booth',box,g(x,TOP+0.051,0.02),(0.42,0.38,0.004),'steel')
    part('booth',cyl,g(x,TOP+0.054,0.02),0.168,0.004,'char',n=40)
    ax,az=x+sx*0.18,-0.12
    part('booth',cyl,g(ax,TOP+0.065,az),0.022,0.02,'brass_old',n=12)
    limb('booth',g(ax,TOP+0.075,az),g(x+sx*0.12,TOP+0.072,0.1),0.006,'brass_old',n=6)
    part('booth',box,g(x+sx*0.115,TOP+0.07,0.115),(0.02,0.035,0.01),'char')
    part('booth',box,g(x+sx*0.17,TOP+0.054,0.12),(0.012,0.1,0.004),'char'); part('booth',box,g(x+sx*0.17,TOP+0.058,0.1),(0.03,0.012,0.008),'brass_old')  # pitch
    part('booth',cyl,g(x-sx*0.17,TOP+0.056,0.17),0.014,0.008,'lamp_amber',n=10)   # start/stop light (amber, baked)
    # platter: own bone at its centre, spins about +Y
    P='platter'+d; py=1.07
    part(P,cyl,g(x,py-0.006,0.02),0.158,0.012,'brass_old',n=48)
    part(P,cyl,g(x,py+0.0015,0.02),0.152,0.003,'char',n=48)
    part(P,cyl,g(x,py+0.0035,0.02),0.052,0.001,'leather' if d=='A' else 'brass_old',n=24)
    part(P,box,g(x,py+0.0045,0.02+0.105),(0.012,0.1,0.0008),'brass_old')        # stripe so the spin reads
    part(P,cyl,g(x,py+0.012,0.02),0.004,0.02,'steel',n=6)
    bone(P,g(x,py,0.02),'booth')
# 2-channel mixer
part('booth',box,g(0,TOP+0.035,0.02),(0.3,0.38,0.07),'steel_dk'); part('booth',box,g(0,TOP+0.071,0.02),(0.28,0.36,0.003),'char')
for sx in (-1,1):
    for k in range(3): part('booth',cyl,g(sx*0.065,TOP+0.08,-0.12+k*0.06),0.014,0.018,'brass_old',n=10)
    part('booth',box,g(sx*0.065,TOP+0.073,0.08),(0.008,0.1,0.003),'visor'); part('booth',box,g(sx*0.065,TOP+0.08,0.08),(0.03,0.02,0.016),'steel')
    for i in range(6): part('booth',box,g(sx*0.02,TOP+0.073,-0.15+i*0.02),(0.012,0.012,0.002),'lamp_amber')   # channel meters (amber, baked)
part('booth',box,g(0,TOP+0.073,0.15),(0.16,0.012,0.003),'visor')
part('xfader',box,g(0,1.078,0.15),(0.024,0.03,0.016),'brass_old'); bone('xfader',g(0,1.075,0.15),'booth')
# screen frame on two brass posts rising from the riser back
SZ,SY,SW,SH,TILT=-0.66,2.18,1.4,0.7,0.06   # v4: raised 0.10 m so Dex's headphones clear the frame from the floor
PZ=SZ-0.085   # brass pipe posts (r 0.032 ~ Tapper's new column weight at this scale) with flange, coupling and elbow fittings
for sx in (-1,1):
    X=sx*0.6
    part('booth',cyl,g(X,0.258,PZ),0.06,0.016,'brass_old',n=16)                     # floor flange on the riser
    limb('booth',g(X,0.26,PZ),g(X,SY+0.12,PZ),0.032,'brass_old',n=14)               # vertical pipe
    part('booth',cyl,g(X,1.2,PZ),0.04,0.05,'brass_old',n=14)                        # coupling
    sph('booth',g(X,SY+0.12,PZ),0.042,'brass_old',14,8)                              # elbow fitting
    limb('booth',g(X,SY+0.12,PZ),g(X,SY+0.12,SZ-0.03),0.032,'brass_old',n=14)       # short arm into the frame back
    part('booth',cyl,g(X,SY+0.12,SZ-0.045),0.042,0.02,'brass_old',n=14,rot=(math.pi/2,0,0))   # frame flange
fr=part('booth',box,g(0,SY,SZ-0.025),(SW+0.06,0.03,SH+0.06),'brass_old')
fr2=part('booth',box,g(0,SY,SZ-0.015),(SW+0.01,0.012,SH+0.01),'char')
for o in (fr,fr2):   # tip toward visitors about the screen centre (rotation about x)
    o.data.transform(Matrix.Translation(V(g(0,SY,SZ)))@Matrix.Rotation(TILT,4,'X')@Matrix.Translation(-V(g(0,SY,SZ))))
bone('booth',(0,0,0))
_b=BONES.pop('booth'); _it=list(BONES.items()); BONES.clear(); BONES['booth']=_b; BONES.update(_it)
# screen mesh (UV 0..1, u left->right and v bottom->top as visitors see it; normal toward +Z glTF)
bm=bmesh.new(); vs=[bm.verts.new(g(*p)) for p in ((-SW/2,SY-SH/2,SZ),(SW/2,SY-SH/2,SZ),(SW/2,SY+SH/2,SZ),(-SW/2,SY+SH/2,SZ))]
f=bm.faces.new(vs); uvl=bm.loops.layers.uv.new('UVMap')
for l,(u,v) in zip(f.loops,((0,0),(1,0),(1,1),(0,1))): l[uvl].uv=(u,v)
bm.normal_update()
me=bpy.data.meshes.new('dj-screen'); bm.to_mesh(me); scr=bpy.data.objects.new('dj-screen',me); bpy.context.collection.objects.link(scr)
me.transform(Matrix.Translation(V(g(0,SY,SZ)))@Matrix.Rotation(TILT,4,'X')@Matrix.Translation(-V(g(0,SY,SZ))))
pp=f'{OUT}/cantina_dj_screen_placeholder.jpg'
import subprocess; subprocess.run(['python3',f'{SRC}/screen_placeholder.py',pp],check=True)
sm=bpy.data.materials.new('cantina_dj_screen'); sm.use_nodes=True; nt=sm.node_tree; nt.nodes.clear()
t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(pp); bg=nt.nodes.new('ShaderNodeBackground'); o=nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(t.outputs[0],bg.inputs[0]); nt.links.new(bg.outputs[0],o.inputs[0]); me.materials.append(sm)
scr.hide_render=True
A,J=rig_and_join(name,{})
scr.hide_render=False; scr.parent=A
ALL=[A,J,scr]
t0=tris([J,scr]); d0=draws([J,scr]); b0=ex(name+'.glb',ALL,anim=False)
bpy.ops.wm.save_as_mainfile(filepath=f'{SRC}/{name}.blend')
render(f'{OUT}/{name}_preview_front.png',ALL,(0.6,-3.6,1.6),(0,0,1.25),res=(1400,1000))
render(f'{OUT}/{name}_preview_3q.png',ALL,(-2.0,-2.2,2.2),(0,0,1.1),res=(1400,1000))
dx=os.path.join(OUT,'cantina_robot_dex.glb')
if os.path.exists(dx):
    before=set(bpy.context.scene.objects); bpy.ops.import_scene.gltf(filepath=dx); new=[o for o in bpy.context.scene.objects if o not in before]
    arm=[o for o in new if o.type=='ARMATURE'][0]
    arm.location=g(0,0.25,-0.45)
    arm.animation_data_create(); acts=[x for x in bpy.data.actions if x.name.startswith('hands_on_decks')]
    arm.animation_data.action=acts[0]; bpy.context.scene.frame_set(1)   # exported clip = dex_poses.json IK pose (fingertips on platter rims)
    render(f'{OUT}/{name}_preview_with_dex.png',ALL+new,(1.1,-3.3,2.2),(0,0,1.3),res=(1400,1000))
    render(f'{OUT}/{name}_preview_with_dex_dj.png',ALL+new,(-0.9,1.7,2.1),(0,-0.1,1.05),res=(1400,1000))
NM0=nonmanifold(J); lod([J],0.4,min_faces=30); t1=tris([J,scr]); NM1=nonmanifold(J); b1=ex(name+'_lod1.glb',ALL,anim=False)
bn={b.name:{'pos_gltf':[round(v,3) for v in (b.head_local.x,b.head_local.z,-b.head_local.y)],'parent':b.parent.name if b.parent else None} for b in A.data.bones}
rec={'file':name+'.glb','name':'DJ booth: walnut/brass counter, 2 decks (A at -X = visitors\' left) with spinning platters, 2-ch mixer + crossfader, Dex riser, 1.4 x 0.7 m video screen on brass posts, teal kick/riser/request lights',
 'scale':1.0,'lod1':name+'_lod1.glb','tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':d0,
 'materials':sorted({m.name for o in (J,scr) for m in o.data.materials}),'pivots':{'root':'booth','platters':['platterA','platterB'],'crossfader':'xfader'},'joints':bn,'nonmanifold_edges':{'lod0':NM0,'lod1':NM1},
 'screen':{'node':'dj-screen','material':'cantina_dj_screen','size_m':[SW,SH],'aspect':'2:1 (canvas 1024x512)','center_gltf':[0,SY,SZ],'tilt_x_rad':TILT,'faces':'+Z (visitors)','placeholder':'cantina_dj_screen_placeholder.jpg','uv':'0..1, u left->right, v bottom->top as seen by visitors'},
 'dex_spot':{'pos_booth_local':[0,0.25,-0.45],'note':'Dex root on the riser, same as showroom.js'},
 'unlit_baked':True,'room':'cantina','method':'procedural + CC0 PBR bake, skinned rigid rig','date':datetime.datetime.now().astimezone().isoformat(timespec='seconds'),'source':f'{SRC}/{name}.blend'}
print('PIECE',json.dumps(rec)); json.dump(rec,open(f'{SRC}/{name}.json','w'),indent=1)
