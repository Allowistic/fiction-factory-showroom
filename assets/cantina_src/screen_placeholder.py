import sys,math
from PIL import Image, ImageDraw
im=Image.new('RGB',(1024,512),(6,14,16)); dr=ImageDraw.Draw(im)
for x in range(0,1024,32): dr.line([(x,0),(x,512)],fill=(10,40,42))
for y in range(0,512,32): dr.line([(0,y),(1024,y)],fill=(10,40,42))
for i in range(48):
    h=int(30+110*abs(math.sin(i*0.7))); col=(214,150,62) if i%3 else (176,120,54)   # warm amber / brass bars
    dr.rectangle([60+i*19,440-h*2,72+i*19,440],fill=col)
    if h>118: dr.rectangle([60+i*19,440-h*2,72+i*19,440-h*2+10],fill=(40,190,175))   # teal only on the peaks
dr.rectangle([2,2,1021,509],outline=(184,135,62),width=3); dr.text((24,18),'DJ SCREEN 2:1 (1024x512)  -  replace map with VideoTexture',fill=(255,170,90))
im.save(sys.argv[1],quality=88)
