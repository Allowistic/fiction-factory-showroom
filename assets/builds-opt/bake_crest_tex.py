#!/usr/bin/env python3
"""Bake high-res crest front to 512, apply to remeshed low GLB with front-projected UVs."""
import bpy, json, sys, os, bmesh
from mathutils import Vector, Euler, Matrix
from math import radians

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
LOW, OUT, TEX = argv[1], argv[2], argv[3]
PARTS = job['parts']
ORIENT = job.get('orient', 'flat_face')

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

hi = []
for i, part in enumerate(PARTS):
    before = set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=part['path'])
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if len(new) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in new: o.select_set(True)
        bpy.context.view_layer.objects.active = new[0]
        bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
    else:
        obj = new[0]
    obj.name = f'hi_{i}'
    mat = bpy.data.materials.new(f'hi_mat_{i}')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    r, g, b = part['color']
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
    bsdf.inputs['Roughness'].default_value = 0.55
    obj.data.materials.clear(); obj.data.materials.append(mat)
    if ORIENT == 'flat_face':
        obj.rotation_euler = Euler((radians(90), 0, 0), 'XYZ')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        obj.select_set(False)
    hi.append(obj)

min_c = Vector((1e9,)*3); max_c = Vector((-1e9,)*3)
for obj in hi:
    for corner in obj.bound_box:
        w = obj.matrix_world @ Vector(corner)
        min_c = Vector(tuple(min(a,b) for a,b in zip(min_c, w)))
        max_c = Vector(tuple(max(a,b) for a,b in zip(max_c, w)))
center = Vector(((min_c.x+max_c.x)/2, (min_c.y+max_c.y)/2, (min_c.z+max_c.z)/2))
for obj in hi:
    obj.location -= center
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    obj.select_set(False)

size = max(max_c.x - min_c.x, max_c.z - min_c.z) * 1.02
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = size
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.location = (0, -(max_c.y - min_c.y) - size, 0)
cam.rotation_euler = Euler((radians(90), 0, 0), 'XYZ')
bpy.context.scene.camera = cam

world = bpy.data.worlds.new('w'); bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.45, 0.45, 0.47, 1)  # grey fill matching plaque
bg.inputs[1].default_value = 1.0
light_data = bpy.data.lights.new('L', 'SUN'); light_data.energy = 2.5
light = bpy.data.objects.new('L', light_data)
bpy.context.scene.collection.objects.link(light)
light.rotation_euler = Euler((radians(50), 0, radians(20)), 'XYZ')

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = TEX
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)
print('TEX_WRITTEN', TEX)

for obj in hi:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
bpy.data.objects.remove(light, do_unlink=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=LOW)
low_objs = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in low_objs: o.select_set(True)
bpy.context.view_layer.objects.active = low_objs[0]
if len(low_objs) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

# After glTF import into Blender, Y-up becomes Z-up; front (+Z glTF) → -Y Blender.
# Project UVs from XZ onto 0-1 using object bounds (front atlas).
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(obj.data)
uv_layer = bm.loops.layers.uv.verify()
# world bounds of mesh
bmesh.update_edit_mesh(obj.data)
bpy.ops.object.mode_set(mode='OBJECT')
# recompute bounds
min_c = Vector((1e9,)*3); max_c = Vector((-1e9,)*3)
for corner in obj.bound_box:
    w = obj.matrix_world @ Vector(corner)
    min_c = Vector(tuple(min(a,b) for a,b in zip(min_c, w)))
    max_c = Vector(tuple(max(a,b) for a,b in zip(max_c, w)))
# In Blender-after-gltf: width=X, height=Z, depth=Y
# Map u = (x-minx)/(maxx-minx), v = (z-minz)/(maxz-minz)
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(obj.data)
uv_layer = bm.loops.layers.uv.verify()
dx = max(max_c.x - min_c.x, 1e-9)
dz = max(max_c.z - min_c.z, 1e-9)
for face in bm.faces:
    for loop in face.loops:
        co = obj.matrix_world @ loop.vert.co
        u = (co.x - min_c.x) / dx
        v = (co.z - min_c.z) / dz
        loop[uv_layer].uv = (u, v)
bmesh.update_edit_mesh(obj.data)
bpy.ops.object.mode_set(mode='OBJECT')

img = bpy.data.images.load(TEX)
mat = bpy.data.materials.new('CrestTex')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
tex.extension = 'CLIP'
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.55
obj.data.materials.clear(); obj.data.materials.append(mat)

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); bpy.context.view_layer.objects.active = obj
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_yup=True, export_texcoords=True, export_image_format='AUTO',
)
meta = json.load(open(LOW + '.meta.json')) if os.path.isfile(LOW + '.meta.json') else {}
meta.update({'out': OUT, 'tris': len(obj.data.polygons), 'method': 'remesh+tex512', 'texture': TEX})
json.dump(meta, open(OUT + '.meta.json', 'w'), indent=2)
print('DONE_BAKE', OUT, 'tris', len(obj.data.polygons))
