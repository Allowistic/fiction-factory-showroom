"""Solve Dex's deck poses (three.js Euler XYZ, radians, joint-local; all rest rotations identity).
Dex root at booth-local (0, 0.25, -0.45) (unchanged). Forearm lengthened: fingertip = elbow + (0,-0.44,0.01)."""
import numpy as np, json
from scipy.optimize import minimize
def Rx(a): c,s=np.cos(a),np.sin(a); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def Rz(a): c,s=np.cos(a),np.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
def E(r): return Rx(r[0])@Ry(r[1])@Rz(r[2])          # three.js 'XYZ'
ROOT=np.array([0,0.25,-0.45]); TORSO=np.array([0,0.68,0]); TOR=(0.04,0,0)
def tip(side,arm,fore):
    sh=np.array([0.25*side,0.36,0]); el=np.array([0.01*side,-0.27,0]); ft=np.array([0.004*side,-0.44,0.01])
    Rt=E(TOR); Ra=Rt@E(arm); Rf=Ra@E(fore)
    return ROOT+TORSO+Rt@sh+Ra@el+Rf@ft, ROOT+TORSO+Rt@sh+Ra@el
def solve(side,target,guess=None):
    def f(p):
        arm=p[:3]; fore=(p[3],0,0); t,el=tip(side,arm,fore)
        pen=10*max(0,p[3])**2+10*max(0,-2.4-p[3])**2   # elbow bends forward only
        shy=ROOT[1]+0.68+0.36; shz=ROOT[2]
        pen+=0.02*(p[1]**2)+50*max(0,el[1]-(shy-0.15))**2             # elbow clearly below the shoulder (natural, not a chicken wing)
        pen+=50*max(0,(shz-0.05)-el[2])**2                             # elbow not behind the back
        pen+=50*max(0,side*el[0]-0.42)**2                              # elbow not flared far out
        for u in np.linspace(0,0.7,8):                                   # forearm (minus the hand) clears the deck/mixer tops (1.075) by its radius
            q=el+(t-el)*u
            if -0.25<q[2]<0.25: pen+=400*max(0,1.125-q[1])**2
        return np.sum((t-target)**2)*1e4+pen
    best=None
    for g in ([-0.9,0.1*side,0.25*side,-0.6],[-1.2,0,0.4*side,-0.3],[-0.6,-0.2*side,0.1*side,-1.0]) if guess is None else [guess]:
        r=minimize(f,np.array(g,float),method='Nelder-Mead',options=dict(xatol=1e-6,fatol=1e-9,maxiter=20000))
        if best is None or r.fun<best.fun: best=r
    p=best.x; t,el=tip(side,p[:3],(p[3],0,0))
    return dict(arm=[round(v,4) for v in p[:3]],fore=[round(p[3],4),0,0],tip=[round(v,4) for v in t],err_mm=round(1000*np.linalg.norm(t-target),1),elbow=[round(v,3) for v in el])
R_RIM=np.array([-0.328,1.101,0.02]); L_RIM=np.array([0.328,1.101,0.02]); XF=np.array([0.0,1.11,0.15])   # +16/20 mm: measured hand mesh sits ~25 mm below the model fingertip
out={'note':'targets: inner rim point of each platter on its z=0.02 centreline (x = +-0.328) (platter centre (+-0.48,1.07,0.02), r 0.152) and the xfader cap top (0,1.086,0.15); torso (0.04,0,0)',
 'torso':list(TOR),'hands_on_decks':{'R':solve(-1,R_RIM),'L':solve(1,L_RIM)},
 'scratch_R':{'R_fwd':solve(-1,R_RIM+[0,0,0.035]),'R_back':solve(-1,R_RIM-[0,0,0.035]),'L_xfader':solve(1,XF),'L_xfader_left':solve(1,XF+[-0.04,0,0]),'L_xfader_right':solve(1,XF+[0.04,0,0])}}
json.dump(out,open('/workspace/loft-xr/assets/cantina_src/dex_poses.json','w'),indent=1)
print(json.dumps(out,indent=1))
