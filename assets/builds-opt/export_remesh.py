#!/usr/bin/env python3
"""Join STLs → voxel remesh → decimate to target → orient/scale → Draco GLB."""
import bpy, json, sys, os
from mathutils import Vector, Euler
from math import radians

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
OUT = job['out']
TARGET = int(job['target_tris'])
PARTS = job['parts']
ORIENT = job.get('orient', 'flat_face')
STL_UNIT_MM = float(job.get('stl_unit_mm', 1.0))
VOXEL = float(job.get('voxel_mm', 0.8))  # in STL units
MM_TO_M = 0.001 * STL_UNIT_MM

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

imported = []
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
    obj.name = part.get('name', f'p{i}')
    # average color later — paint single material from first/dominant
    imported.append((obj, part))

# Join all for remesh (single material: mid grey or use vertex colors — use grey base)
bpy.ops.object.select_all(action='DESELECT')
for obj, _ in imported:
    obj.select_set(True)
bpy.context.view_layer.objects.active = imported[0][0]
if len(imported) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = 'Crest'

# Material: blend grey/white as mid — better: keep two materials by NOT joining colors.
# For remesh we lose materials. Use light grey.
mat = bpy.data.materials.new('CrestMat')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
# prefer white-ish plaque look with grey tint
bsdf.inputs['Base Color'].default_value = (0.7, 0.7, 0.72, 1)
bsdf.inputs['Roughness'].default_value = 0.55
obj.data.materials.clear()
obj.data.materials.append(mat)

# Orient before remesh
if ORIENT == 'flat_face':
    obj.rotation_euler = Euler((radians(90), 0, 0), 'XYZ')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

# Bounds / center
min_c = Vector((1e9,)*3); max_c = Vector((-1e9,)*3)
for corner in obj.bound_box:
    w = obj.matrix_world @ Vector(corner)
    min_c = Vector(tuple(min(a,b) for a,b in zip(min_c,w)))
    max_c = Vector(tuple(max(a,b) for a,b in zip(max_c,w)))
center = Vector(((min_c.x+max_c.x)/2, (min_c.y+max_c.y)/2, min_c.z))
dims = [float(max_c[i]-min_c[i]) for i in range(3)]
obj.location -= center
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

print(f'BEFORE_REMESH tris={len(obj.data.polygons)} dims={dims} voxel={VOXEL}')
# Voxel remesh
mod = obj.modifiers.new('rm', 'REMESH')
mod.mode = 'VOXEL'
mod.voxel_size = VOXEL
bpy.ops.object.modifier_apply(modifier='rm')
print(f'AFTER_REMESH tris={len(obj.data.polygons)}')

# Decimate to target
passes = 0
while len(obj.data.polygons) > TARGET and passes < 8:
    n = len(obj.data.polygons)
    mod = obj.modifiers.new(f'd{passes}', 'DECIMATE')
    mod.ratio = max(0.05, min(0.95, TARGET / max(1, n)))
    bpy.ops.object.modifier_apply(modifier=f'd{passes}')
    passes += 1
    print(f'DECIMATE_PASS {passes} tris={len(obj.data.polygons)}')

obj.scale = (MM_TO_M, MM_TO_M, MM_TO_M)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_yup=True,
)
meta = {'out': OUT, 'dims_mm': [round(d,3) for d in dims], 'tris': len(obj.data.polygons),
        'parts': 1, 'orient': ORIENT, 'stl_unit_mm': STL_UNIT_MM, 'method': 'remesh'}
json.dump(meta, open(OUT + '.meta.json', 'w'), indent=2)
print('DONE', json.dumps(meta))
