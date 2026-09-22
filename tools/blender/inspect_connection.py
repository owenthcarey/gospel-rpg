"""RFC-007 independent shipped-export and actual Babylon-pose review.

First run CONNECTION_REVIEW_OUTPUT=/private/tmp/connected-journey-poses.json
npx vitest run tests/unit/connection-staging.test.ts, then execute via Blender MCP.
Set GOSPEL_RPG_ROOT, GOSPEL_CONNECTION_POSES; GOSPEL_REVIEW_OUTPUT is optional.
Unrelated open scenes and source data are preserved.
"""
import bpy
import os
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUTPUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT', ROOT / 'artifacts/reviews/connected-journey'))
OUTPUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('The Way - exported Connected Journey review')
bpy.context.window.scene = scene
groups = {}

def imported(asset, position):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (asset + '.glb')))
    added = set(scene.objects) - before
    for obj in added:
        if obj.parent not in added:
            obj.location = position
    return added

groups['kit'] = imported('passage_marker', (-1.5, 0, 0)) | imported('landing_pier', (1.2, 0, 0))
poses = json.loads(Path(os.environ['GOSPEL_CONNECTION_POSES']).read_text())
for key, items in poses.items():
    group = set()
    for item in items:
        mesh = bpy.data.meshes.new(item['name'])
        indices = item['indices']
        mesh.from_pydata(item['vertices'], [], [indices[i:i+3] for i in range(0, len(indices), 3)])
        obj = bpy.data.objects.new(item['name'], mesh)
        scene.collection.objects.link(obj)
        colors = mesh.color_attributes.new(name='Runtime palette', type='FLOAT_COLOR', domain='CORNER')
        rgba = item['colors']
        stride = len(rgba) // len(item['vertices']) if rgba else 0
        for polygon in mesh.polygons:
            for loop in polygon.loop_indices:
                vertex = mesh.loops[loop].vertex_index
                value = rgba[vertex*stride:vertex*stride+stride] if rgba else item['faceColors'][polygon.index]
                colors.data[loop].color = (*value[:3], value[3] if len(value) > 3 else 1)
        material = bpy.data.materials.new('Connected journey runtime palette')
        material.use_nodes = True
        shader = material.node_tree.nodes['Principled BSDF']
        shader.inputs['Roughness'].default_value = .95
        vertex = material.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name = 'Runtime palette'
        material.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
        mesh.materials.append(material)
        group.add(obj)
    groups[key] = group

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.025))
floor = bpy.context.object
material = bpy.data.materials.new('Connected journey review floor')
material.use_nodes = True
shader = material.node_tree.nodes['Principled BSDF']
shader.inputs['Base Color'].default_value = (.29, .31, .23, 1)
shader.inputs['Roughness'].default_value = 1
floor.data.materials.append(material)
scene.world = bpy.data.worlds.new('Connected journey review daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .75, .86, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
for position, energy in [((-7, -8, 12), 2200), ((5, 3, 10), 1500)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.data.energy = energy
    light.data.size = 8
    light.rotation_euler = (Vector((0, -2, .6))-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 800, 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
images = []
for key, target, offset, scale in [
    ('kit', (0, 0, .35), (5, -7, 5), 5.5),
    ('company', (-7, 1.9, .85), (4, -7, 4), 4.2),
    ('holding', (0, 0, .9), (4, -7, 4), 3.0),
    ('holding', (3.3, -7, .75), (4, -7, 4), 3.1),
    ('working', (3, -6.8, .7), (4, -7, 4), 3.4),
]:
    for name, objects in groups.items():
        for obj in objects:
            obj.hide_render = name != key
            obj.hide_viewport = name != key
    camera.location = Vector(target) + Vector(offset)
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    suffix = 'seated' if key == 'holding' and target[0] else key
    name = 'connected-journey-' + suffix + '.png'
    scene.render.filepath = str(OUTPUT / name)
    bpy.ops.render.render(write_still=True)
    images.append(name)
    print('REVIEW_IMAGE', scene.render.filepath)

digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
models = sorted((ROOT / 'public/assets/models').glob('*.glb'))
(OUTPUT / 'connected-journey-assets.json').write_text(json.dumps({
    'blender': bpy.app.version_string, 'models': len(models),
    'bytes': sum(p.stat().st_size for p in models), 'capBytes': 5*1024*1024,
    'review': 'Two final shipped GLBs independently imported; holding, working, seated and return-company geometry baked through the real Babylon importer. Unrelated Blender scenes preserved.',
    'source': {'path': 'assets/source/galilee-kit.blend', 'sha256': digest(ROOT / 'assets/source/galilee-kit.blend')},
    'recipes': {name: digest(ROOT / 'tools/blender' / name) for name in ['generate_kit.py', 'crossing.py', 'connection.py', 'inspect_connection.py']},
    'images': {name: digest(OUTPUT / name) for name in images},
    'files': {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in models},
}, indent=2) + '\n')
