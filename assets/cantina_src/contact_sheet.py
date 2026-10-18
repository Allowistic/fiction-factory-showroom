# cantina_robots_preview.png: labelled contact sheet of the v3 previews (python3 + PIL, outside Blender)
import sys,os
from PIL import Image,ImageDraw
D=sys.argv[1]; T=[
 ('cantina_robot_bartender_preview_front.png','Tapper front'),('cantina_robot_bartender_preview_3q.png','Tapper 3/4'),('cantina_robot_bartender_preview_pose.png','Tapper wave'),('cantina_robot_bartender_review_bar_rest.png','Tapper behind bar, eye 1.6 m @ 2 m'),
 ('cantina_robot_dex_preview_front.png','Dex front'),('cantina_robot_dex_preview_3q.png','Dex 3/4'),('cantina_robot_dex_preview_top.png','Dex from above'),('cantina_review_dex_hands_on_decks.png','Dex hands_on_decks'),
 ('cantina_dj_booth_preview_front.png','Booth front'),('cantina_review_dex_scratch.png','Dex scratch_R (L on xfader)'),('cantina_review_booth_dex_4m.png','Booth + Dex @ 4 m'),('cantina_robots_lod1_silhouettes.png','lod1 silhouettes')]
W,H=480,360; sh=Image.new('RGB',(W*4,(H+28)*3),(24,22,20)); d=ImageDraw.Draw(sh)
for i,(f,l) in enumerate(T):
    im=Image.open(os.path.join(D,f)).convert('RGB'); im.thumbnail((W,H)); x,y=(i%4)*W,(i//4)*(H+28)
    sh.paste(im,(x+(W-im.width)//2,y+(H-im.height)//2)); d.text((x+8,y+H+6),l,fill=(230,200,140))
sh.save(os.path.join(D,'cantina_robots_preview.png'))
