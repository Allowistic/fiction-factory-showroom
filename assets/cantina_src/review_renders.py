"""Quinn's review renders: (a) Tapper behind the real bar from visitor eye height, + hand/bar clearance check,
(b) lod1 silhouette sheet, (c) 4 m / 7 m readability (Quest-like ~19 px/deg), (d) heights. Clay frame: door origin, +Z into room (glTF)."""
import bpy, os, sys, json, math
from mathutils import Vector as V, Matrix
from mathutils.bvhtree import BVHTree
B='/workspace/loft-xr/assets/builds-opt'; OUT=os.environ.get('OUTDIR',B); SRC='/workspace/loft-xr/assets/cantina_src'
RB=os.environ.get('RB',B)    # where the new robot/booth GLBs are
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.02,0.018,0.016,1)
def imp(path,pos,rot_deg):
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); new=[o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None: o.rotation_mode='XYZ'; o.location=(pos[0],-pos[2],pos[1]); o.rotation_euler=(0,0,math.radians(rot_deg))
    return new
def pose(objs,clip,t):
    arm=[o for o in objs if o.type=='ARMATURE']
    if not arm: return
    arm=arm[0]; arm.animation_data_create()
    acts=[a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_') or a.name.startswith(clip+'.')]
    arm.animation_data.action=acts[0] if acts else None
    sc.frame_set(1+round(t*30))
def cam(loc,look,hfov=60,res=(1150,800),name='c'):
    c=bpy.data.cameras.new(name); c.sensor_fit='HORIZONTAL'; c.angle=math.radians(hfov); o=bpy.data.objects.new(name,c); sc.collection.objects.link(o)
    o.location=loc; o.rotation_euler=(V(look)-V(loc)).to_track_quat('-Z','Y').to_euler(); sc.camera=o; sc.render.resolution_x,sc.render.resolution_y=res; return o
def shot(path,objs_visible):
    for o in bpy.data.objects:
        if o.type=='MESH': o.hide_render=o not in objs_visible
    sc.render.filepath=path; sc.render.image_settings.file_format='PNG'; bpy.ops.render.render(write_still=True)
G=lambda p: (p[0],-p[2],p[1])   # glTF -> Blender
rep={}
# ---------- scene: bar + back bar + Tapper, booth + Dex ----------
bar=imp(f'{B}/cantina_bar.glb',(-2.024,0,3.2),90); back=imp(f'{B}/cantina_back_bar.glb',(-3.73,0,4.3),90)
tap=imp(f'{RB}/cantina_robot_bartender.glb',(-3.0,0,3.3),90)
booth=imp(f'{RB}/cantina_dj_booth.glb',(3.1,0,1.15),-90); dex=imp(f'{RB}/cantina_robot_dex.glb',(3.55,0.25,1.15),-90)
M=lambda L:[o for o in L if o.type=='MESH']
dg=bpy.context.evaluated_depsgraph_get()
def bvh(objs):
    vs=[];fs=[]
    for o in objs:
        e=o.evaluated_get(dg); me=e.to_mesh(); mw=o.matrix_world; b=len(vs)
        vs+= [mw@v.co for v in me.vertices]; fs+=[[b+i for i in p.vertices] for p in me.polygons]; e.to_mesh_clear()
    return BVHTree.FromPolygons(vs,fs),vs
# (a) hand clearance vs the bar over every clip (sampled), visitor-eye renders
barT,_=bvh(M(bar)+M(back))
rob=M(tap)[0]; arm=[o for o in tap if o.type=='ARMATURE'][0]
clr={}
for clip,dur in (('idle',7),('turn_to_player',0.9),('wave',3.25),('beckon',2.9)):
    lo=9; hi=-9; gap=9; hits=0
    for k in range(0,int(dur*30)+1,2):
        pose(tap,clip,k/30); dg.update(); e=rob.evaluated_get(dg); me=e.to_mesh(); mw=rob.matrix_world
        hand_vg={rob.vertex_groups[n].index for n in ('foreR','foreL') if n in rob.vertex_groups}
        for v in me.vertices:
            if not any(g.group in hand_vg and g.weight>0.5 for g in v.groups): continue
            p=mw@v.co; lo=min(lo,p.z); hi=max(hi,p.z); n=barT.find_nearest(p); gap=min(gap,n[3]) if n[0] is not None else gap
        tT,_=bvh([rob]); hits+=len(tT.overlap(barT)); e.to_mesh_clear()
    clr[clip]={'forearm+hand_lowest_z_m':round(lo,3),'forearm+hand_highest_z_m':round(hi,3),'min_gap_hand_to_bar_or_backbar_m':round(gap,3),'mesh_overlaps_with_bar':hits}
rep['tapper_vs_bar']=clr
eye=G((-1.0,1.6,3.3)); look=G((-3.0,1.25,3.3))
cam(eye,look,hfov=70,res=(1400,1000),name='a')
for clip,t,tag in (('idle',0,'rest'),('wave',0.95,'wave'),('beckon',1.35,'beckon')):
    pose(tap,clip,t); shot(f'{OUT}/cantina_robot_bartender_review_bar_{tag}.png',M(tap)+M(bar)+M(back))

# Dex reach check (booth-local glTF coords): closest hand vertex to each target, and Dex-vs-booth mesh overlaps
broot=[o for o in booth if o.parent is None][0]; inv=broot.matrix_world.inverted()
dexm=M(dex)[0]; bothT,_=bvh(M(booth))
def handpts(grp):
    e=dexm.evaluated_get(dg); me=e.to_mesh(); gi=dexm.vertex_groups[grp].index
    P=[inv@(dexm.matrix_world@v.co) for v in me.vertices if any(g.group==gi and g.weight>0.5 for g in v.groups)]; e.to_mesh_clear()
    return [(p.x,p.z,-p.y) for p in P]
def near(P,t): 
    d,p=min(((sum((a-b)**2 for a,b in zip(q,t))**0.5,q) for q in P)); return {'target':t,'closest_hand_vertex':[round(x,3) for x in p],'gap_m':round(d,3)}
dexchk={}
for clip,t,targets in (('hands_on_decks',0,{'foreR':(-0.48,1.09,0.02),'foreL':(0.48,1.09,0.02)}),('scratch_R',0.125,{'foreR':(-0.48,1.09,0.02),'foreL':(0,1.075,0.15)})):
    pose(dex,clip,t); dg.update(); dT,_=bvh([dexm])
    dexchk[clip]={g:near(handpts(g),tg) for g,tg in targets.items()}; dexchk[clip]['mesh_overlaps_with_booth']=len(dT.overlap(bothT))
    # rim distance: closest hand vertex to the platter rim circle (r 0.152 about platter centre)
    for g,tg in targets.items():
        if abs(tg[0])>0.1:
            P=handpts(g); dexchk[clip][g]['closest_to_rim_m']=round(min(abs(((p[0]-tg[0])**2+(p[2]-tg[2])**2)**0.5-0.152)+abs(p[1]-1.09) for p in P),3)
rep['dex_reach']=dexchk
pose(dex,'hands_on_decks',0)
cam(G((3.1-1.3,2.05,1.15+0.9)),G((3.25,1.05,1.15)),hfov=55,res=(1400,1000),name='dx'); shot(f'{OUT}/cantina_review_dex_hands_on_decks.png',M(booth)+M(dex))
pose(dex,'scratch_R',0.125); shot(f'{OUT}/cantina_review_dex_scratch.png',M(booth)+M(dex))
# (c) readability 4 m / 7 m at ~19 px/deg (60 deg over 1150 px), eye 1.6 m
pose(tap,'wave',0.95); pose(dex,'hands_on_decks',0)
for d in (4,7):
    cam(G((-3.0+d,1.6,3.3)),G((-3.0,1.3,3.3)),name=f't{d}'); shot(f'{OUT}/cantina_review_tapper_{d}m.png',M(tap)+M(bar)+M(back))
    cam(G((3.1-d,1.6,1.15)),G((3.1,1.35,1.15)),name=f'd{d}'); shot(f'{OUT}/cantina_review_booth_dex_{d}m.png',M(booth)+M(dex))
# (d) heights in rest pose (Blender world, metres)
for o in [a for a in bpy.data.objects if a.type=='ARMATURE']: o.animation_data and setattr(o.animation_data,'action',None)
sc.frame_set(1); dg.update()
def H(objs,base=0):
    _,vs=bvh(objs); return round(max(v.z for v in vs)-base,3),round(min(v.z for v in vs),3)
rep['heights_m']={'tapper':H(M(tap))[0],'dex_model':H(M(dex),0.25)[0],'dex_top_on_riser_world':H(M(dex))[0],'booth_incl_screen':H(M(booth))[0],'bar_top':H(M(bar))[0]}
# (b) lod1 silhouette sheet: black on white, front + side, ortho, same scale
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
w.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
blk=bpy.data.materials.new('blk'); blk.use_nodes=True; nt=blk.node_tree; nt.nodes.clear(); e=nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value=(0,0,0,1); o_=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o_.inputs[0])
xs=0; items=[]
for f,wid in (('cantina_robot_bartender_lod1.glb',0.7),('cantina_robot_dex_lod1.glb',0.7),('cantina_dj_booth_lod1.glb',1.8)):
    for view in ('front','side'):
        objs=imp(f'{RB}/{f}',(xs+wid/2,0,0),0 if view=='front' else -90)
        for o in objs:
            if o.type=='MESH': o.data.materials.clear(); o.data.materials.append(blk)
        xs+=wid+0.25
c=bpy.data.cameras.new('o'); c.type='ORTHO'; c.ortho_scale=xs+0.2; co=bpy.data.objects.new('o',c); sc.collection.objects.link(co)
co.location=(xs/2,-10,1.2); co.rotation_euler=(math.pi/2,0,0); sc.camera=co; sc.render.resolution_x=2400; sc.render.resolution_y=int(2400*2.6/(xs+0.2))
sc.render.filepath=f'{OUT}/cantina_robots_lod1_silhouettes.png'; bpy.ops.render.render(write_still=True)
json.dump(rep,open(f'{SRC}/review_report.json','w'),indent=1); print('REPORT',json.dumps(rep))
