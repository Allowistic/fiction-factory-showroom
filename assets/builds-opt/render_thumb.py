#!/usr/bin/env python3
"""Low-memory EEVEE thumb of one GLB → PNG."""
import bpy, sys, math
from mathutils import Vector, Euler
from math import radians

glb, out_png, size = sys.argv[sys.argv.index('--')+1:]
size = int(size)

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=glb)
meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
if not meshes:
    raise RuntimeError('no mesh')

# bounds
min_c = Vector((1e9,)*3); max_c = Vector((-1e9,)*3)
for obj in meshes:
    for corner in obj.bound_box:
        w = obj.matrix_world @ Vector(corner)
        min_c = Vector(tuple(min(a,b) for a,b in zip(min_c,w)))
        max_c = Vector(tuple(max(a,b) for a,b in zip(max_c,w)))
center = (min_c + max_c) * 0.5
extent = max((max_c - min_c).length, 1e-4)

# camera 3/4 front-right
cam_data = bpy.data.cameras.new('C')
cam = bpy.data.objects.new('C', cam_data)
bpy.context.scene.collection.objects.link(cam)
dist = extent * 1.6
cam.location = center + Vector((dist*0.55, -dist*0.9, dist*0.45))
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
cam_data.clip_start = extent * 0.01
cam_data.clip_end = extent * 20

world = bpy.data.worlds.new('W'); bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.22, 0.23, 0.25, 1)
bg.inputs[1].default_value = 0.6

light = bpy.data.lights.new('L', 'AREA')
light.energy = 40; light.size = extent
L = bpy.data.objects.new('L', light)
bpy.context.scene.collection.objects.link(L)
L.location = center + Vector((extent, -extent, extent))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = size
scene.render.resolution_y = size
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = out_png
# faster
if hasattr(scene.eevee, 'taa_render_samples'):
    scene.eevee.taa_render_samples = 8
bpy.ops.render.render(write_still=True)
print('THUMB', out_png)
