#!/usr/bin/env python3
"""Blender headless STL(s) → decimate → meters → bottom-center → orient for glTF (+Y up, face +Z) → Draco GLB.
Usage: blender -b --python-exit-code 1 -P export_one.py -- <job.json>
"""
import bpy, json, sys, os
from mathutils import Vector, Euler
from math import radians

argv = sys.argv
argv = argv[argv.index('--') + 1:] if '--' in argv else []
job = json.load(open(argv[0]))

OUT = job['out']
TARGET_TRIS = int(job.get('target_tris', 20000))
PARTS = job['parts']
ORIENT = job.get('orient', 'as_is')  # as_is | flat_face | upright_y
STL_UNIT_MM = float(job.get('stl_unit_mm', 1.0))
MM_TO_M = 0.001 * STL_UNIT_MM

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

imported = []
for i, part in enumerate(PARTS):
    before = set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=part['path'])
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if not new:
        raise RuntimeError(f"no mesh from {part['path']}")
    if len(new) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in new:
            o.select_set(True)
        bpy.context.view_layer.objects.active = new[0]
        bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
    else:
        obj = new[0]
    name = part.get('name', f'part_{i}')
    obj.name = name
    # optional per-part offset in mm (before centering)
    off = part.get('offset_mm')
    if off:
        obj.location = (obj.location.x + off[0], obj.location.y + off[1], obj.location.z + off[2])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        obj.select_set(False)
    mat = bpy.data.materials.new(name=f'mat_{name}')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    r, g, b = part['color']
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
    bsdf.inputs['Roughness'].default_value = float(part.get('roughness', 0.55))
    bsdf.inputs['Metallic'].default_value = float(part.get('metallic', 0.0))
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    imported.append(obj)

def world_bounds(objs):
    min_c = Vector((1e9, 1e9, 1e9))
    max_c = Vector((-1e9, -1e9, -1e9))
    for obj in objs:
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            min_c = Vector((min(min_c.x, w.x), min(min_c.y, w.y), min(min_c.z, w.z)))
            max_c = Vector((max(max_c.x, w.x), max(max_c.y, w.y), max(max_c.z, w.z)))
    return min_c, max_c

def apply_all(objs):
    for obj in objs:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

# Orient in Blender so that after glTF Y-up export (Blender -Y → glTF +Z):
#   flat_face: print XY art with +Z front → stand upright, face -Y
#   upright_y: model already tall on Z, front +Y → rotate to face -Y
#   as_is: only bottom-center + scale
if ORIENT == 'flat_face':
    # (x,y,z) -> (x, -z, y): width X, former +Z face → -Y, former Y → +Z up
    for obj in imported:
        obj.rotation_euler = Euler((radians(90), 0, 0), 'XYZ')
    apply_all(imported)
elif ORIENT == 'upright_y':
    # front was +Y → need -Y: rotate 180° around Z
    for obj in imported:
        obj.rotation_euler = Euler((0, 0, radians(180)), 'XYZ')
    apply_all(imported)
elif ORIENT == 'rocket_z':
    # rockets tall on Z, hero/front = -Y already → as_is for facing
    pass

min_c, max_c = world_bounds(imported)
center = Vector(((min_c.x + max_c.x) * 0.5, (min_c.y + max_c.y) * 0.5, min_c.z))
dims_mm = [float(max_c.x - min_c.x), float(max_c.y - min_c.y), float(max_c.z - min_c.z)]

for obj in imported:
    obj.location = obj.location - center
apply_all(imported)

for obj in imported:
    obj.scale = (MM_TO_M, MM_TO_M, MM_TO_M)
apply_all(imported)

total = sum(len(o.data.polygons) for o in imported)
print(f'TOTAL_TRIS_BEFORE {total} dims_mm={dims_mm} orient={ORIENT}')
total_after = total
passes = 0
while total_after > TARGET_TRIS and passes < 6:
    ratio = max(0.02, min(0.95, TARGET_TRIS / max(1, total_after)))
    for obj in imported:
        n = len(obj.data.polygons)
        if n < 4:
            continue
        mod = obj.modifiers.new(f'dec{passes}', 'DECIMATE')
        # proportional share of remaining budget
        share = n / max(1, total_after)
        part_target = max(40, int(TARGET_TRIS * share))
        mod.ratio = min(1.0, max(0.01, part_target / max(1, n)))
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=f'dec{passes}')
    total_after = sum(len(o.data.polygons) for o in imported)
    passes += 1
    print(f'DECIMATE_PASS {passes} tris={total_after} ratio={ratio:.4f}')
print(f'TOTAL_TRIS_AFTER {total_after}')

bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_yup=True,
)
meta = {
    'out': OUT,
    'dims_mm': [round(d, 3) for d in dims_mm],
    'tris': total_after,
    'parts': len(imported),
    'orient': ORIENT,
    'stl_unit_mm': STL_UNIT_MM,
}
json.dump(meta, open(OUT + '.meta.json', 'w'), indent=2)
print('DONE', json.dumps(meta))
