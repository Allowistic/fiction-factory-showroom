import sys,os,json,math; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from props2 import *
import random; random.seed(7)
ONLY=os.environ.get('ONLY','').split(',') if os.environ.get('ONLY') else None
recs=[]
R=6.0; A=4.0/R/2
def bar():
    arc(R,-A,A,20,R-0.55,R-0.06,0.12,1.0,'walnut')
    arc(R,-A,A,20,R-0.62,R+0.02,1.0,1.05,'brass')
    arc(R,-A,A,20,R-0.5,R-0.1,0.0,0.12,'char')
    for i in range(9):
        a=-A+2*A*(i+0.5)/9; arc(R,a-0.005,a+0.005,1,R-0.07,R-0.03,0.15,0.98,'brass')
    arc(R,-A,A,20,R+0.1,R+0.13,0.2,0.23,'brass')
    arc(R,-A,A,20,R-0.075,R-0.06,0.10,0.12,('cantina_glow_amber',AMBER,3))
    arc(R,-A,A,20,R+0.02,R+0.03,1.0,1.012,('cantina_glow_teal',TEAL,2.5))  # teal rim on bar front lip
def backbar():
    box((0,0,0.45),(3.2,0.45,0.9),'walnut'); box((0,0.02,0.92),(3.3,0.5,0.04),'brass')
    box((0,0.22,1.65),(3.2,0.06,1.4),'walnut')
    for k,z in enumerate((1.22,1.58,1.94)):
        box((0,0.08,z),(3.0,0.24,0.025),'brass')
        box((0,0.185,z+0.2),(2.9,0.01,0.3),('cantina_glow_backlight',(1.0,0.33,0.045),1.05))   # amber backlight panel
        x=-1.42
        while x<1.4:
            if random.random()<0.18: x+=0.16+random.random()*0.12; continue   # gaps
            kind=random.choice(['wine','squat','tall','flask'])
            h={'wine':0.30,'squat':0.18,'tall':0.34,'flask':0.22}[kind]*(0.85+0.3*random.random()); r=0.032 if kind!='squat' else 0.045
            prof=[(r,0),(r,h*0.62),(r*0.45,h*0.78),(0.012,h*0.85),(0.012,h)] if kind!='flask' else [(r*1.2,0),(r*1.2,h*0.7),(0.014,h*0.8),(0.014,h)]
            lathe((x,0.07,z+0.0125),prof,random.choice(['glass','amberglass','glass']),n=8)
            x+=2*r+0.03+random.random()*0.04
    cyl((1.1,0.16,2.33),0.2,0.06,'brass',n=20,rot=(math.pi/2,0,0)); cyl((1.1,0.125,2.33),0.165,0.02,('cantina_glow_backlight',(1.0,0.33,0.045),1.05),n=20,rot=(math.pi/2,0,0))
def stools():
    for i in range(4):
        a=(i-1.5)*0.65/(R+0.45); x=math.sin(a)*(R+0.45); y=-math.cos(a)*(R+0.45)+R
        cyl((x,y,0.02),0.2,0.04,'steel',n=14); cyl((x,y,0.37),0.03,0.66,'brass',n=8); cyl((x,y,0.29),0.16,0.02,'brass',n=14)
        lathe((x,y,0.69),[(0.19,0),(0.2,0.03),(0.18,0.07),(0.0,0.075)],'leather',n=14); cyl((x,y,0.685),0.17,0.02,'char',n=14)
def ring(ri,ro,z0,z1,k,n=18): return arc(0,math.radians(50),math.radians(310),n,ri,ro,z0,z1,k)
def booth():
    ring(0.95,1.5,0.0,0.32,'walnut'); ring(0.97,1.48,0.32,0.46,'leather'); ring(1.36,1.53,0.46,1.07,'leather'); ring(1.53,1.6,0.0,1.1,'walnut')
    cyl((0,0,0.02),0.3,0.04,'steel',n=16); cyl((0,0,0.37),0.06,0.68,'brass',n=10); cyl((0,0,0.73),0.5,0.04,'walnut',n=32); cyl((0,0,0.755),0.505,0.012,'brass',n=32)
    cyl((0,0,2.0),0.006,1.0,'char',n=4); cyl((0,0,1.42),0.22,0.18,'brass',n=16,r2=0.05); cyl((0,0,1.33),0.2,0.01,('cantina_glow_amber',AMBER,4),n=16)
P=[('cantina_bar','Cantina arc bar 4 m, 1.05 m, walnut/brass, amber underglow + teal rim',1024,bar,0.6,None),
   ('cantina_back_bar','Cantina back bar: walnut, brass shelves, varied bottles, amber backlight, porthole screen',1024,backbar,0.5,None),
   ('cantina_stools','4 bar stools 0.75 m (oxblood leather, brass), on bar arc',512,stools,0.5,{'note':'same transform as cantina_bar'}),
   ('cantina_booth','Curved oxblood-leather booth (3-4), 1.0 m walnut/brass table, amber pendant',1024,booth,0.5,{'note':'opening faces +Z; rotate toward ent center'})]
for a in P:
    if ONLY and a[0] not in ONLY: continue
    recs.append(piece(*a))
# small props on one shared atlas
def smalls():
    reset(); mats(); rig(); D={}
    def grp(n,f,x):
        PARTS.clear(); f(x); obs=list(PARTS)
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); D[n]=bpy.context.object; D[n].name='cantina_prop_'+n
    defs={
     'cargo_A':(lambda x:[box((x,0,0.25),(0.7,0.5,0.5),'walnut'),*[box((x+sx*0.33,sy*0.23,0.25),(0.05,0.05,0.52),'steel') for sx in(-1,1) for sy in(-1,1)],box((x,-0.255,0.25),(0.5,0.01,0.06),'brass')],'Walnut cargo crate, steel corners'),
     'cargo_A_stacked':(lambda x:[box((x,0,0.25),(0.7,0.5,0.5),'walnut'),box((x+0.05,0,0.73),(0.6,0.45,0.46),'walnut'),box((x,0,0.5),(0.72,0.52,0.03),'steel'),box((x+0.05,0,0.96),(0.62,0.47,0.03),'steel')],'Stacked walnut crates'),
     'containers_B':(lambda x:[cyl((x+dx,0,0.3),0.12,0.6,'steel',n=14) for dx in(-0.26,0,0.26)]+[cyl((x+dx,0,0.61),0.05,0.04,'brass',n=10) for dx in(-0.26,0,0.26)],'Steel fuel canisters x3'),
     'containers_D':(lambda x:[lathe((x,0,0),[(0.2,0),(0.23,0.35),(0.2,0.7),(0.0,0.7)],'walnut',n=14),cyl((x,0,0.15),0.215,0.03,'brass',n=14),cyl((x,0,0.55),0.215,0.03,'brass',n=14),cyl((x,0,0.73),0.04,0.06,'brass',n=8)],'Walnut keg, brass bands'),
     'lights':(lambda x:[cyl((x,0,0.02),0.18,0.04,'steel',n=16),cyl((x,0,0.6),0.02,1.15,'brass',n=8),lathe((x,0,1.15),[(0.18,0),(0.12,0.12),(0.03,0.2),(0,0.2)],'brass',n=16)],'Brass floor lamp'),
     'jar_A_large':(lambda x:[lathe((x,0,0),[(0.07,0),(0.08,0.15),(0.05,0.22),(0.05,0.25),(0,0.25)],'amberglass',n=12),cyl((x,0,0.255),0.052,0.02,'brass',n=12)],'Amber glass jar'),
     'jar_C_medium':(lambda x:[lathe((x+dx,0,0),[(0.035,0),(0.035,0.14+h),(0.012,0.19+h),(0.012,0.24+h),(0,0.24+h)],'glass',n=8) for dx,h in((-0.05,0),(0.03,0.04),(0.0,-0.03))],'Dark glass bottle trio'),
     'menu':(lambda x:[box((x,0,0.01),(0.16,0.1,0.02),'brass'),box((x,0,0.14),(0.14,0.01,0.22),'walnut'),box((x,-0.006,0.15),(0.11,0.002,0.17),'char')],'Brass/walnut menu stand'),
     'food_dinner':(lambda x:[cyl((x,0,0.01),0.16,0.02,'steel',n=20),lathe((x,0,0.02),[(0.14,0),(0.13,0.07),(0.08,0.12),(0.0,0.13)],'brass',n=16),cyl((x,0,0.16),0.012,0.03,'brass',n=8)],'Brass cloche on plate'),
     'pot_large':(lambda x:[lathe((x,0,0),[(0.1,0),(0.14,0.05),(0.15,0.2),(0.1,0.3),(0.06,0.34),(0,0.34)],'brass',n=14),cyl((x+0.16,0,0.12),0.012,0.08,'brass',n=6,rot=(0,math.pi/2,0))],'Brass samovar')}
    x=0
    for n,(f,_) in defs.items(): grp(n,f,x); x+=1.2
    obs=list(D.values())
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
        while o.data.uv_layers: o.data.uv_layers.remove(o.data.uv_layers[0])
        o.data.uv_layers.new(name='UVMap')
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55),island_margin=0.006)
    bpy.ops.uv.pack_islands(margin=0.004,rotate=True,scale=True,margin_method='FRACTION',shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    im=bpy.data.images.new('cantina_props_atlas',1024,1024,float_buffer=True)
    for m in {m for o in obs for m in o.data.materials}:
        nt=m.node_tree; nd=nt.nodes.new('ShaderNodeTexImage'); nd.image=im
        for q in nt.nodes: q.select=False
        nd.select=True; nt.nodes.active=nd
    bpy.ops.object.bake(type='COMBINED')
    p=f'{DST}/cantina_props_atlas.jpg'; im.save_render(p,scene=bpy.context.scene)
    um=bpy.data.materials.new('cantina_props_atlas'); um.use_nodes=True; nt=um.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(p); bg=nt.nodes.new('ShaderNodeBackground'); out=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs[0],bg.inputs[0]); nt.links.new(bg.outputs[0],out.inputs[0])
    out=[]
    for n,o in D.items():
        o.data.materials.clear(); o.data.materials.append(um)
    for n,o in D.items():
        r=export('cantina_prop_'+n,[o],'Cantina prop: '+defs[n][1],0.5,{'note':'shares cantina_props_atlas with all cantina_prop_* (merge to 1 draw)'}); out.append(r)
    return out
if not ONLY or 'props' in ONLY: recs+=smalls()
json.dump(recs,open(f'{SRC}/pieces2_{os.environ.get("ONLY","all").replace(",","_")}.json','w'),indent=1)
