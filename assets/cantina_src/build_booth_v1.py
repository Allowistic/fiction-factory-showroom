import sys,os,json; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from robots import *
import bmesh
name='cantina_dj_booth'
reset(); mats2(); rig(); PARTS.clear()
W,D,H=2.0,0.75,0.98      # booth body; crowd side = -Y (glTF +Z), DJ stands at +Y
def body():
    part('body',box,(0,0,0.05),(W-0.06,D-0.06,0.1),'char')                       # recessed plinth
    part('body',box,(0,0.02,0.52),(W,D-0.04,0.84),'walnut')                       # carcass
    part('body',box,(0,0,H-0.02),(W+0.06,D+0.04,0.04),'brass_old')                # top lip
    part('body',box,(0,0.01,H+0.005),(W-0.04,D-0.06,0.012),'leather')            # leather top pad
    for sx in (-1,1): part('body',box,(sx*(W/2-0.02),-D/2+0.01,0.52),(0.04,0.04,0.86),'brass_old')   # corner posts
    part('body',box,(0,-D/2-0.004,0.115),(W-0.02,0.02,0.03),'brass_old')          # kick rail
    # screen bezel on the crowd face
    part('body',box,(0,-D/2-0.012,0.58),(1.52,0.03,0.49),'brass_old')
    part('body',box,(0,-D/2-0.022,0.58),(1.47,0.012,0.435),'char')
    for sx in (-1,1):   # vent slots either side of the screen
        for i in range(5): part('body',box,(sx*0.9,-D/2-0.006,0.42+i*0.07),(0.1,0.012,0.022),'char')
    # decks: A on the DJ's left (+X), B on the DJ's right (-X)
    for deck,sx in (('A',1),('B',-1)):
        x=sx*0.56
        part('body',box,(x,0.02,H+0.05),(0.47,0.37,0.08),'steel_dk')
        part('body',box,(x,0.02,H+0.092),(0.45,0.35,0.006),'steel')
        part('body',cyl,(x+0.02*sx,0.0,H+0.098),0.165,0.006,'char',n=40)            # platter well
        ax=x-sx*0.17; part('body',cyl,(ax,0.13,H+0.11),0.025,0.03,'brass_old',n=12)  # tonearm base
        limb('body',(ax,0.13,H+0.13),(ax+sx*0.03,-0.09,H+0.125),0.006,'brass_old',n=6)
        part('body',box,(ax+sx*0.03,-0.1,H+0.122),(0.02,0.035,0.012),'char')         # headshell
        part('body',box,(x-sx*0.19,-0.08,H+0.098),(0.025,0.12,0.004),'char')          # pitch slot
        part('body',box,(x-sx*0.19,-0.06,H+0.104),(0.035,0.015,0.01),'brass_old')
        part('body',cyl,(x+sx*0.17,-0.12,H+0.1),0.016,0.012,'brass_old',n=10)        # start/stop
        # platter (separate node, spins about its own centre)
        px,py,pz=x+0.02*sx,0.0,H+0.101
        part('platter_'+deck,cyl,(px,py,pz+0.009),0.155,0.018,'brass_old',n=48)      # brass rim
        part('platter_'+deck,cyl,(px,py,pz+0.0195),0.148,0.003,'char',n=48)          # vinyl
        part('platter_'+deck,cyl,(px,py,pz+0.0215),0.05,0.001,'leather',n=24)        # label
        part('platter_'+deck,box,(px+0.03,py,pz+0.0222),(0.03,0.006,0.0006),'brass_old')  # label stripe (shows spin)
        part('platter_'+deck,cyl,(px,py,pz+0.03),0.004,0.02,'steel',n=6)             # spindle
        PIV[deck]=(px,py,pz)
    # 2-channel mixer
    part('body',box,(0,0.02,H+0.04),(0.3,0.38,0.07),'steel_dk')
    part('body',box,(0,0.02,H+0.077),(0.28,0.36,0.004),'char')
    for ch,cx in ((1,-0.06),(2,0.06)):
        for i,ky in enumerate((0.15,0.1,0.05,0.0)): part('body',cyl,(cx,ky,H+0.088),0.014,0.018,'brass_old' if i else 'steel',n=10)
        part('body',box,(cx,-0.08,H+0.08),(0.008,0.1,0.003),'visor'); part('body',box,(cx,-0.07,H+0.088),(0.024,0.014,0.016),'steel')
        for i in range(6): part('body',box,(cx*1.8,0.11-i*0.012,H+0.081),(0.012,0.006,0.002),('cantina_glow_teal',TEAL,2.5))  # VU
    part('body',box,(0,-0.15,H+0.08),(0.12,0.008,0.003),'visor'); part('body',box,(0.02,-0.15,H+0.088),(0.016,0.026,0.016),'brass_old')   # crossfader
    # cove LED strip under the top lip (crowd side) - the only teal on the body
    part('body',box,(0,-D/2-0.012,H-0.048),(W-0.02,0.012,0.012),('cantina_glow_teal',TEAL,2.5))
PIV={}
body()
# --- screen: own mesh + material, UV 0..1 (u left->right, v bottom->top as seen by the crowd), 32:9
sw,sh=1.44,0.405; z0=0.58
bm=bmesh.new(); vs=[bm.verts.new(p) for p in ((-sw/2,-D/2-0.0285,z0-sh/2),(sw/2,-D/2-0.0285,z0-sh/2),(sw/2,-D/2-0.0285,z0+sh/2),(-sw/2,-D/2-0.0285,z0+sh/2))]   # normal -Y (crowd)
f=bm.faces.new(vs); uv=bm.loops.layers.uv.new('UVMap')
for l,(u,v) in zip(f.loops,((0,0),(1,0),(1,1),(0,1))): l[uv].uv=(u,v)
me=bpy.data.meshes.new('cantina_dj_screen'); bm.to_mesh(me); scr=bpy.data.objects.new('cantina_dj_screen',me); bpy.context.collection.objects.link(scr)
# placeholder image
pp=f'{OUT}/cantina_dj_screen_placeholder.jpg'
if not os.path.exists(pp): import subprocess; subprocess.run(['python3',f'{SRC}/screen_placeholder.py',pp],check=True)

sm=bpy.data.materials.new('cantina_dj_screen'); sm.use_nodes=True; nt=sm.node_tree; nt.nodes.clear()
t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(pp); bg=nt.nodes.new('ShaderNodeBackground'); o=nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(t.outputs[0],bg.inputs[0]); nt.links.new(bg.outputs[0],o.inputs[0]); me.materials.append(sm)
# --- bake body+platters together, then split platters back out
objs=[o for o in PARTS if o.name in bpy.data.objects]
for o in objs:
    vg=o.vertex_groups.new(name=o['grp']); vg.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
gl=[o for o in objs if o['glow']]; nb=[o for o in objs if not o['glow']]
for o in nb:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
RES=1024; scr.hide_render=True
j=bake_join(nb,name+'_atlas',RES); j.name=name
def split(src,grp,newname):
    bpy.ops.object.select_all(action='DESELECT'); src.select_set(True); bpy.context.view_layer.objects.active=src
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
    src.vertex_groups.active_index=src.vertex_groups[grp].index; bpy.ops.object.vertex_group_select(); bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT'); n=[o for o in bpy.context.selected_objects if o!=src][0]; n.name=newname; n.data.name=newname; return n
plat={}
for deck in 'AB':
    p=split(j,'platter_'+deck,'platter_'+deck)
    px,py,pz=PIV[deck]; p.data.transform(Matrix.Translation((-px,-py,-pz))); p.location=(px,py,pz); plat[deck]=p
gls={}
GRPS={}
for o in gl: GRPS.setdefault(o.data.materials[0].name,[]).append(o)
for mname,g in sorted(GRPS.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for o in g: o.select_set(True)
    bpy.context.view_layer.objects.active=g[0]; bpy.ops.object.join(); x=bpy.context.object; x.name=name+'_'+mname; x.data.name=x.name; gls[mname]=x
# merge glow meshes into one object with 2 material slots (amber VU + teal)
bpy.ops.object.select_all(action='DESELECT')
for x in gls.values(): x.select_set(True)
G0=list(gls.values())[0]; bpy.context.view_layer.objects.active=G0; bpy.ops.object.join(); G0.name=name+'_glow'; G0.data.name=G0.name
for o in [j,G0,scr]+list(plat.values()):
    for vg in list(getattr(o,'vertex_groups',[])): o.vertex_groups.remove(vg)
scr.hide_render=False
ALL=[j,G0,scr,plat['A'],plat['B']]
for o in ALL: o.select_set(True)
def ex2(fn):
    for o in bpy.context.scene.objects: o.select_set(o in ALL)
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{fn}',export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_image_format='JPEG',export_yup=True,export_apply=True)
    return os.path.getsize(f'{OUT}/{fn}')
t0=tris(ALL); d0=draws(ALL); b0=ex2(name+'.glb')
bpy.ops.wm.save_as_mainfile(filepath=f'{SRC}/{name}.blend')
render(f'{OUT}/{name}_preview_front.png',ALL,(0.0,-3.4,1.5),(0,0,0.8),res=(1400,900))
render(f'{OUT}/{name}_preview_3q.png',ALL,(1.9,2.3,2.0),(0,0,0.95),res=(1400,900))   # DJ-side view
dx=os.path.join(OUT,'cantina_robot_dex.glb')
if os.path.exists(dx):
    before=set(bpy.context.scene.objects); bpy.ops.import_scene.gltf(filepath=dx); new=[o for o in bpy.context.scene.objects if o not in before]
    for o in new:
        if o.parent is None: o.location=(0,0.62,0)
    render(f'{OUT}/{name}_preview_with_dex.png',ALL+new,(-1.6,-3.2,1.9),(0,0.2,1.1),res=(1400,1000))
    for o in new: bpy.data.objects.remove(o)
lod([j],0.4); lod(list(plat.values()),0.5); t1=tris(ALL); b1=ex2(name+'_lod1.glb')
pv={d:[round(PIV[d][0],3),round(PIV[d][2],3),round(-PIV[d][1],3)] for d in 'AB'}
rec={'file':name+'.glb','name':'DJ booth: walnut/brass, 2 decks (A = DJ-left, B = DJ-right) with spinning platters, 2-ch mixer, 32:9 crowd-facing video screen, teal cove strip',
 'scale':1.0,'lod1':name+'_lod1.glb','tris':t0,'tris_lod1':t1,'bytes':b0,'bytes_lod1':b1,'draws':d0,
 'materials':sorted({m.name for o in ALL for m in o.data.materials}),'nodes':[o.name for o in ALL],'platter_pivots_gltf':pv,
 'screen':{'node':'cantina_dj_screen','material':'cantina_dj_screen','size_m':[sw,sh],'aspect':'32:9','center_gltf':[0,z0,round(D/2+0.0285,4)],'faces':'+Z (crowd)','placeholder':'cantina_dj_screen_placeholder.jpg'},
 'unlit_baked':True,'room':'cantina','method':'procedural + CC0 PBR bake','date':datetime.datetime.now().astimezone().isoformat(timespec='seconds'),'source':f'{SRC}/{name}.blend'}
print('PIECE',json.dumps(rec)); json.dump(rec,open(f'{SRC}/{name}.json','w'),indent=1)
