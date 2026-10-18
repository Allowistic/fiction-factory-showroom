import sys,os,json; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from robots import *
WHO=os.environ.get('WHO','tapper')
PV=f'{OUT}'
import math as _m
P=json.load(open(f'{SRC}/dex_poses.json'))
def wave_frames(arm_z=-2.55,amp=0.55,n=3,per=0.8,extra=None):
    f=[(0,{}),(0.35,{'armR':(0,0,arm_z),'foreR':(0,0,0)})]
    for i in range(n*4): t=0.35+(i+1)*per/4; f.append((t,{'armR':(0,0,arm_z),'foreR':(0,0,amp*_m.sin((i+1)*_m.pi/2)),'head':(0,0,0.08*_m.sin(t*2.5))}))
    f.append((0.35+n*per+0.5,{})); return f
CLIPS={   # same angles as Jules's procedural behaviour in showroom/bartender.js + dj.js (radians, three.js axes); optional, the code can drive the joints directly
 'tapper':{
  'idle':[(t,{'torso':(0,_m.sin(t*0.9)*0.06,_m.sin(t*0.6)*0.025),'head':(_m.sin(t*0.7)*0.05,_m.sin(t*0.5+1)*0.12,0),'armR':(0.05,0,0.08),'foreR':(-1.05+0.04*_m.sin(t*1.3),0,0),'armL':(0.05,0,-0.08),'foreL':(-1.1+0.04*_m.sin(t*1.1+2),0,0),'antenna':(0,0,_m.sin(t*3.1)*0.15)}) for t in [i*0.35 for i in range(21)]],
  'turn_to_player':[(0,{}),(0.25,{'head':(0,0.45,0)}),(0.7,{'root':(0,0.8,0),'head':(0,0.15,0)}),(0.9,{'root':(0,0.8,0)})],
  'wave':wave_frames(),
  'beckon':[(0,{}),(0.4,{'armR':(-1.25,0,-0.15),'foreR':(-0.25,0,0),'torso':(0.06,0,0),'head':(0.1,0,0)})]+[(0.4+k*0.1875,{'armR':(-1.25,0,-0.15),'foreR':(-0.25-1.25*(1-_m.cos(k*0.1875*_m.pi*2/0.75))/2,0,0),'torso':(0.06,0,0),'head':(0.1,0,0)}) for k in range(1,9)]+[(2.9,{})],
 },
 'dex':{   # deck poses solved by dex_ik.py (dex_poses.json): fingertips on the inner platter rims (+-0.328,1.085,0.02) / xfader cap (0,1.09,0.15)
  'hands_on_decks':[(t,{'torso':(0.04,0,0),'armR':P['hands_on_decks']['R']['arm'],'foreR':P['hands_on_decks']['R']['fore'],'armL':P['hands_on_decks']['L']['arm'],'foreL':P['hands_on_decks']['L']['fore']}) for t in (0,1)],
  'idle_nod':[(t*0.125,{'head':(0.12*_m.sin((t%4)/4*_m.pi)**2,0,0),'torso':(0.04+0.03*_m.sin(t/4*_m.pi*2),0,0),'armR':P['hands_on_decks']['R']['arm'],'foreR':P['hands_on_decks']['R']['fore'],'armL':P['hands_on_decks']['L']['arm'],'foreL':P['hands_on_decks']['L']['fore']}) for t in range(17)],
  'scratch_R':[(t*0.125,{'torso':(0.04,0,0),'armR':P['scratch_R']['R_fwd' if t%2 else 'R_back']['arm'],'foreR':P['scratch_R']['R_fwd' if t%2 else 'R_back']['fore'],
     'armL':P['scratch_R'][('L_xfader_left','L_xfader','L_xfader_right','L_xfader')[(t//4)%4]]['arm'],'foreL':P['scratch_R'][('L_xfader_left','L_xfader','L_xfader_right','L_xfader')[(t//4)%4]]['fore']}) for t in range(17)],
  'wave':wave_frames(),
 }}
DESC={'tapper':'Cantina robot bartender "Tapper": skinned rigid rig, joints named per ROBOT_MANIFEST (root/torso/head/armR/foreR/armL/foreL/antenna), identity rest rotations, brass + gunmetal + oxblood apron, teal visor',
      'dex':'Robot DJ Dex: skinned rigid rig, joints named per ROBOT_MANIFEST (root/torso/head/armR/foreR/armL/foreL/antenna), identity rest rotations, leather jacket, brass headphones, teal eyes + level meter'}
reset(); mats2(); rig(); PARTS.clear()
(tapper if WHO=='tapper' else dex)()
name='cantina_robot_bartender' if WHO=='tapper' else 'cantina_robot_dex'
A,J=rig_and_join(name,CLIPS[WHO])
import bpy as _bpy
pts=[J.matrix_world@v.co for v in J.data.vertices]; H=max(p.z for p in pts); W=max(p.x for p in pts)-min(p.x for p in pts); Dp=max(p.y for p in pts)-min(p.y for p in pts)
NM0=nonmanifold(J)
t0=tris([J]); d0=draws([J]); b0=ex(name+'.glb',[A,J])
bpy.ops.wm.save_as_mainfile(filepath=f'{SRC}/{name}.blend')
render(f'{PV}/{name}_preview_front.png',[A,J],(0.0,-3.1,1.35),(0,0,1.1))
render(f'{PV}/{name}_preview_3q.png',[A,J],(-1.9,-2.4,1.6),(0,0,1.15))
c=list(CLIPS[WHO])[2]
render(f'{PV}/{name}_preview_pose.png',[A,J],(-1.2,-2.8,1.5),(0,0,1.2),frame=1+round(30*0.95),arm=A,clip='wave')
if WHO=='dex': render(f'{PV}/{name}_preview_decks.png',[A,J],(-1.2,-2.8,1.3),(0,0,0.9),frame=10,arm=A,clip='hands_on_decks')
render(f'{PV}/{name}_preview_top.png',[A,J],(0.35,-0.9,2.9),(0,0,1.0))   # VR visitors look down on him
lod([J],float(os.environ.get('LODR','0.33'))); t1=tris([J]); NM1=nonmanifold(J); b1=ex(name+'_lod1.glb',[A,J])
bn={b.name:{'pos_gltf':[round(v,3) for v in (b.head_local.x,b.head_local.z,-b.head_local.y)],'parent':b.parent.name if b.parent else None} for b in A.data.bones}
rec={'file':name+'.glb','name':DESC[WHO],'pivots':{'root':'root','torso':'torso','head':'head','arm':'armR','forearm':'foreR','armL':'armL','forearmL':'foreL','antenna':'antenna'},'scale':1.0,'lod1':name+'_lod1.glb','tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':d0,
     'materials':[m.name for m in J.data.materials],'joints':bn,'height_m':round(H,3),'width_m':round(W,3),'depth_m':round(Dp,3),'nonmanifold_edges':{'lod0':NM0,'lod1':NM1},'clips':list(CLIPS[WHO]),'unlit_baked':True,'room':'cantina','method':'procedural + CC0 PBR bake, skinned rigid rig',
     'date':datetime.datetime.now().astimezone().isoformat(timespec='seconds'),'source':f'{SRC}/{name}.blend'}
print('PIECE',json.dumps(rec)); json.dump(rec,open(f'{SRC}/{name}.json','w'),indent=1)
