"""Inspect shipped Across the Lake GLBs without modifying unrelated scenes.

Run via npm run assets:inspect:lake, or execute this file through Blender MCP
with GOSPEL_RPG_ROOT and GOSPEL_LAKE_POSES set. Produces kit, rower and stern images.
"""
import bpy
import os
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUTPUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT', ROOT / 'artifacts/reviews/across-the-lake'))
OUTPUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('The Way - exported Across the Lake review')
bpy.context.window.scene = scene

def model(asset, position, clip=None, phase=0, rotation=0):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (asset+'.glb')))
    added = set(scene.objects)-before
    roots = [o for o in added if o.parent not in added]
    anchor = bpy.data.objects.new('review-placement-' + asset, None)
    scene.collection.objects.link(anchor)
    anchor.location = position
    anchor.rotation_euler.z = rotation
    for root in roots:
        root.parent = anchor
    added.add(anchor)
    rig = next((o for o in added if o.type == 'ARMATURE'), None)
    if rig and clip:
        data = rig.animation_data
        data.action = None
        for track in data.nla_tracks:
            track.mute = track.name.split('.')[0] != clip
            for strip in track.strips:
                strip.use_animated_time = True
                strip.strip_time = strip.action_frame_start + (strip.action_frame_end-strip.action_frame_start)*phase
    return added

def label(text, x, y):
    bpy.ops.object.text_add(location=(x, y, .02))
    obj = bpy.context.object
    obj.data.body = text
    obj.data.size = .28
    obj.data.extrude = .001
    return {obj}

def group_visibility(objects, visible):
    for obj in objects:
        obj.hide_render = not visible
        obj.hide_viewport = not visible

# Independently import the five final shipped kit GLBs.
kit = set()
for asset, position in [('landing_pier', (-5, 0, 0)), ('reed_bank', (-2, 0, 0)), ('split_rock', (1, 0, 0)), ('cove_headland', (5, 0, 0)), ('boat_cushion', (0, -4, 0))]:
    kit |= model(asset, position)
    kit |= label(asset.replace('_', ' '), position[0]-1, position[1]-1.8)
# Exact posed geometry from the real Babylon importer/contact checks. This catches
# coordinate-conversion differences that a Blender-only pose review can miss.
pose_path = os.environ.get('GOSPEL_LAKE_POSES')
if not pose_path:
    raise RuntimeError('Run assets:inspect:lake, or set GOSPEL_LAKE_POSES to the contact-test geometry JSON.')
poses = json.loads(Path(pose_path).read_text())
def baked_group(key):
    group = set()
    for item in poses[key]:
        mesh = bpy.data.meshes.new(item['name'])
        indices = item['indices']
        mesh.from_pydata(item['vertices'], [], [indices[i:i+3] for i in range(0,len(indices),3)])
        obj = bpy.data.objects.new(item['name'],mesh)
        scene.collection.objects.link(obj)
        colors=mesh.color_attributes.new(name='Runtime colors',type='FLOAT_COLOR',domain='CORNER')
        rgba=item['colors']
        stride=len(rgba)//len(item['vertices']) if rgba else 0
        for polygon in mesh.polygons:
            for loop in polygon.loop_indices:
                vertex=mesh.loops[loop].vertex_index
                value=rgba[vertex*stride:vertex*stride+stride] if rgba else item.get('faceColors',[item['color']]*len(mesh.polygons))[polygon.index]
                colors.data[loop].color=(*value[:3], value[3] if len(value)>3 else 1)
        material=bpy.data.materials.new('Runtime palette')
        material.use_nodes=True
        shader=material.node_tree.nodes['Principled BSDF']
        shader.inputs['Roughness'].default_value=.95
        vertex=material.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name='Runtime colors'
        material.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
        mesh.materials.append(material)
        group.add(obj)
    return group
rower=baked_group('rower')
storm=baked_group('stern')
bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
floor.location.z = -.025
mat = bpy.data.materials.new('Road review sand')
mat.diffuse_color = (.46, .41, .30, 1)
mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.28, .31, .23, 1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
floor.data.materials.append(mat)
scene.world = bpy.data.worlds.new('Road review daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .75, .86, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .55
for position, energy, size in [((-6, -7, 12), 2000, 8), ((8, 3, 10), 1300, 7)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size = energy, 'DISK', size
    light.rotation_euler = (Vector((0, 0, .7))-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 800, 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.frame_set(1)
floor.location.z = -.28
for name, objects, location, target, scale in [
    ('across-the-lake-kit', kit, (10,-17,16), (0,0,.6), 17),
    ('across-the-lake-rower', rower, (5,-7,5), (0,0,.4), 6.5),
    ('across-the-lake-stern', storm, (5,-8,6), (0,0,.5), 7),
]:
    for group in [kit,rower,storm]: group_visibility(group, group is objects)
    camera.location=location
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    scene.render.filepath=str(OUTPUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('REVIEW_IMAGE', scene.render.filepath)
import hashlib
models=sorted((ROOT/'public/assets/models').glob('*.glb'))
(OUTPUT/'across-the-lake-assets.json').write_text(json.dumps({
    'blender':bpy.app.version_string, 'models':len(models),
    'bytes':sum(p.stat().st_size for p in models), 'capBytes':5*1024*1024,
    'review':'Five new kit GLBs independently imported in Blender; rower and stern geometry imported from actual Babylon poses. Unrelated scenes preserved.',
    'source':{'path':'assets/source/galilee-kit.blend','sha256':hashlib.sha256((ROOT/'assets/source/galilee-kit.blend').read_bytes()).hexdigest()},
    'recipes':{name:hashlib.sha256((ROOT/'tools/blender'/name).read_bytes()).hexdigest() for name in ['generate_kit.py','crossing.py','compact_glb.py','inspect_crossing.py']},
    'images':{name:hashlib.sha256((OUTPUT/name).read_bytes()).hexdigest() for name in ['across-the-lake-kit.png','across-the-lake-rower.png','across-the-lake-stern.png']},
    'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in models},
},indent=2)+'\n')
