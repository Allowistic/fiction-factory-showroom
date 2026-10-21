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
