import sys,json,math; sys.path.insert(0,'/workspace/loft-xr/assets/cantina_src')
from props import *
recs=[]
RUST=(0.35,0.12,0.06); CHAR=(0.08,0.07,0.07); BRASS=(0.7,0.5,0.2); STEEL=(0.35,0.36,0.38); WOOD=(0.25,0.14,0.07); VEL=(0.45,0.1,0.06); CREAM=(0.8,0.75,0.65); GLASS=(0.25,0.5,0.45)
R=6.0; A=4.0/R/2  # 4 m front arc
def P(): PARTS.clear(); reset()
# 1 bar
P()
arc_strip(R,-A,A,16,R-0.55,R-0.05,0.12,1.0,CHAR)            # body
arc_strip(R,-A,A,16,R-0.6,R,1.0,1.05,BRASS)                  # top
arc_strip(R,-A,A,16,R-0.5,R-0.02,0.0,0.12,CHAR)              # plinth
arc_strip(R,-A,A,16,R-0.06,R-0.04,0.10,0.13,AMBER,glow=('cantina_glow_amber',AMBER,3))  # under glow
for i in range(8): # ribs
    a=-A+2*A*(i+0.5)/8; arc_strip(R,a-0.004,a+0.004,1,R-0.06,R-0.03,0.15,0.97,RUST)
arc_strip(R,-A,A,16,R+0.08,R+0.11,0.2,0.23,BRASS)            # footrail
recs.append(finish('cantina_bar','Cantina arc bar 4 m, 1.05 m high',0.6))
# 2 back bar
P()
box((0,0.0,0.45),(3.2,0.45,0.9),CHAR); box((0,0.05,0.92),(3.3,0.5,0.04),BRASS)
box((0,0.2,1.6),(3.2,0.08,1.3),RUST)
for k,z in enumerate((1.25,1.6,1.95)):
    box((0,0.08,z),(3.0,0.22,0.025),STEEL); box((0,0.15,z+0.01),(3.0,0.02,0.01),TEAL,glow=('cantina_glow_teal',TEAL,3))
    for i in range(11):
        x=-1.4+i*0.28+0.05*((k+i)%2); h=0.22+0.06*((i*7+k)%3)
        cyl((x,0.06,z+0.0125+h/2),0.035,h,[GLASS,BRASS,(0.4,0.2,0.08)][(i+k)%3],n=6)
cyl((1.1,0.15,2.45),0.28,0.06,BRASS,n=20,rot=(math.pi/2,0,0)); cyl((1.1,0.12,2.45),0.23,0.02,TEAL,n=20,rot=(math.pi/2,0,0),glow=('cantina_glow_teal',TEAL,2))
recs.append(finish('cantina_back_bar','Cantina back bar: bottle shelves + porthole screen',0.5))
# 3 stools x4 (one piece, along arc spacing 0.65)
P()
for i in range(4):
    a=(i-1.5)*0.65/(R+0.45); x=math.sin(a)*(R+0.45); y=-math.cos(a)*(R+0.45)+R
    cyl((x,y,0.02),0.2,0.04,STEEL,n=12); cyl((x,y,0.37),0.03,0.66,BRASS,n=8); cyl((x,y,0.29),0.16,0.02,BRASS,n=12)
    cyl((x,y,0.72),0.2,0.06,VEL,n=14); cyl((x,y,0.70),0.21,0.02,CHAR,n=14)
recs.append(finish('cantina_stools','4 bar stools 0.75 m, spaced 0.65 m on bar arc',0.5,{'note':'positions already follow the bar arc; place with same transform as cantina_bar'}))
# 4 booth + table + pendant
P()
Rb=1.25
arc_strip(Rb*0+1.0,-1.2,1.2,14,0.9,1.45,0.0,0.45,VEL) if False else None
import bmesh
def ring(r_in,r_out,z0,z1,a0,a1,col,n=16,glow=None):
    o=arc_strip(0,a0,a1,n,r_in,r_out,z0,z1,col,glow); return o
# booth: horseshoe around origin, opening toward -Y (front)
ring(0.95,1.5,0.0,0.45,math.radians(-130)+math.pi,math.radians(130)+math.pi,VEL)
ring(1.38,1.55,0.45,1.15,math.radians(-130)+math.pi,math.radians(130)+math.pi,VEL)
ring(1.55,1.6,0.0,1.2,math.radians(-130)+math.pi,math.radians(130)+math.pi,BRASS)
cyl((0,0,0.02),0.3,0.04,STEEL,n=16); cyl((0,0,0.37),0.06,0.68,BRASS,n=10); cyl((0,0,0.73),0.5,0.04,WOOD,n=32); cyl((0,0,0.755),0.5,0.012,BRASS,n=32)
cyl((0,0,2.0),0.006,1.0,CHAR,n=4); cyl((0,0,1.42),0.22,0.18,BRASS,n=16,r2=0.05); cyl((0,0,1.33),0.2,0.01,AMBER,n=16,glow=('cantina_glow_amber',AMBER,4))
recs.append(finish('cantina_booth','Curved rust-velvet booth (3-4) around 1.0 m table, low pendant',0.5,{'note':'pendant cord top at 2.5 m; booth opening faces +Z — rotate toward the entertainment center'}))
# small props, each one draw (shared cantina_body material)
SM=[]
def small(name,desc,fn):
    P(); fn(); r=finish(name,desc,0.5); SM.append(r)
small('cantina_prop_keg','Brass-banded keg',lambda:[cyl((0,0,0.35),0.22,0.7,WOOD,n=16),cyl((0,0,0.15),0.225,0.04,BRASS,n=16),cyl((0,0,0.55),0.225,0.04,BRASS,n=16),cyl((0,0,0.72),0.06,0.06,STEEL,n=8)])
small('cantina_prop_crate','Ribbed cargo crate',lambda:[box((0,0,0.25),(0.8,0.5,0.5),RUST),box((0,0,0.25),(0.82,0.4,0.42),CHAR),box((-0.3,0,0.25),(0.05,0.52,0.52),STEEL),box((0.3,0,0.25),(0.05,0.52,0.52),STEEL)])
small('cantina_prop_canisters','Stacked fuel canisters x3',lambda:[cyl((x,0,0.3),0.12,0.6,c,n=12) for x,c in((-0.26,STEEL),(0,RUST),(0.26,STEEL))]+[cyl((0,0,0.75),0.12,0.3,BRASS,n=12,rot=(0,math.pi/2,0))])
small('cantina_prop_bottles','Bar-top bottle cluster',lambda:[cyl((math.cos(i)*0.08,math.sin(i)*0.08,0.13+0.02*(i%3)),0.03,0.26+0.04*(i%3),[GLASS,BRASS,RUST][i%3],n=8) for i in range(6)]+[cyl((math.cos(i)*0.08,math.sin(i)*0.08,0.32+0.04*(i%3)),0.012,0.08,CHAR,n=6) for i in range(6)])
small('cantina_prop_mugs','Three tankard mugs',lambda:[[cyl((x,0,0.07),0.045,0.14,STEEL,n=12),box((x+0.06,0,0.07),(0.03,0.015,0.09),BRASS)] for x in(-0.15,0,0.15)])
small('cantina_prop_console','Retro wall console with dials',lambda:[box((0,0,0.5),(0.9,0.25,1.0),CHAR),box((0,-0.13,0.75),(0.7,0.02,0.3),GLASS)]+[cyl((-0.3+i*0.15,-0.14,0.35),0.035,0.03,[BRASS,AMBER,TEAL][i%3],n=10,rot=(math.pi/2,0,0)) for i in range(5)])
small('cantina_prop_jukebox','Rounded retro music machine',lambda:[box((0,0,0.55),(0.7,0.45,1.1),WOOD),cyl((0,0,1.1),0.35,0.45,WOOD,n=20,rot=(math.pi/2,0,0)),box((0,-0.23,0.7),(0.5,0.02,0.5),AMBER),cyl((0,-0.21,1.1),0.28,0.03,TEAL,n=20,rot=(math.pi/2,0,0))])
small('cantina_prop_plant','Spiky alien succulent in brass pot',lambda:[cyl((0,0,0.18),0.18,0.36,BRASS,n=12,r2=0.22)]+[cyl((math.cos(i*1.3)*0.08,math.sin(i*1.3)*0.08,0.36+0.2+0.03*(i%3)),0.04,0.4+0.06*(i%3),(0.15,0.35,0.2),n=5,r2=0.0) for i in range(7)])
small('cantina_prop_radio','Antenna comms box',lambda:[box((0,0,0.12),(0.4,0.22,0.24),STEEL),box((0,-0.115,0.14),(0.3,0.01,0.12),CHAR),cyl((0.15,0,0.44),0.006,0.4,BRASS,n=4),sph((0.15,0,0.65),0.02,AMBER,6,4)])
small('cantina_prop_vent','Wall vent/pipe panel',lambda:[box((0,0,0.6),(1.0,0.06,1.2),CHAR)]+[cyl((-0.35+i*0.35,-0.06,0.6),0.04,1.15,[BRASS,STEEL,RUST][i],n=10) for i in range(3)]+[box((0,-0.04,0.2+0.1*i),(0.8,0.02,0.03),STEEL) for i in range(4)])
recs+=SM
json.dump(recs,open('/workspace/loft-xr/assets/cantina_src/pieces.json','w'),indent=1)
