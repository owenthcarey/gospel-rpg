"""Inspect shipped Living Galilee GLBs without modifying unrelated scenes.

Run via npm run assets:inspect:galilee, or execute this file through Blender MCP
with GOSPEL_RPG_ROOT set. Produces kit, connected-channel and resting-place images.
"""
import bpy
import os
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUTPUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT', ROOT / 'docs/verification'))
OUTPUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('The Way - exported Living Galilee review')
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

# Inspect actual shipped geometry, with the runtime placements in Blender Z-up.
kit = set()
for asset, position in [
    ('leah', (-4, 1, 0)), ('supply_rack', (-1, 1, 0)),
    ('channel_scoop', (-1, 1, .69)), ('resting_mat', (2, 1, 0)),
    ('reed_screen', (5, 1, 0)), ('water_basin', (-3, -3, 0)),
    ('channel_straight', (0, -3, 0)), ('channel_bend', (3, -3, 0)),
]:
    kit |= model(asset, position, 'Idle' if asset == 'leah' else None)
    if asset != 'channel_scoop':
        kit |= label('rack + scoop' if asset == 'supply_rack' else asset.replace('_', ' '), position[0]-1, position[1]-1.7)
channel = set()
# North solution: entry EW, central turn WN, north branch SE.
for asset, position, turn in [
    ('channel_straight', (-2, 0, 0), 1), ('channel_bend', (0, 0, 0), 3),
    ('channel_bend', (0, -2, 0), 1), ('channel_bend', (0, 2, 0), 2),
    ('water_basin', (2, -2, 0), 0), ('water_basin', (2, 2, 0), 0),
]:
    channel |= model(asset, position, rotation=turn*math.pi/2)
channel |= label('Source -> north basin / open ports', -3, -4)
rest = set()
rest |= model('resting_mat', (0, 0, .03))
rest |= model('bench', (0, -.9, 0))
rest |= model('jug', (.95, .35, .03))
rest |= model('reed_screen', (0, -1.4, .03))
for x in [-.4, .4]:
    rest |= model('villager', (x, -.9, .02), 'Sit')
rest |= model('leah', (-2, .5, 0), 'Gesture')
rest |= label('Open southern approach', -2, 2)
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
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1500, 1000, 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.frame_set(1)
for name, objects, location, target, scale in [
    ('living-galilee-kit', kit, (9, -15, 16), (0, 0, .5), 15),
    ('living-galilee-channel', channel, (2, -5, 12), (0, 0, .2), 9),
    ('living-galilee-rest', rest, (5, 7, 6), (0, -.2, .7), 6.7),
]:
    for group in [kit, channel, rest]:
        group_visibility(group, group is objects)
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(OUTPUT / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('REVIEW_IMAGE', scene.render.filepath)
import hashlib
models = sorted((ROOT / 'public/assets/models').glob('*.glb'))
(OUTPUT / 'living-galilee-assets.json').write_text(json.dumps({
    'blender': bpy.app.version_string, 'models': len(models),
    'bytes': sum(p.stat().st_size for p in models), 'capBytes': 5*1024*1024,
    'review': 'Shipped GLBs independently imported using Blender MCP; unrelated scenes preserved.',
    'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in models},
}, indent=2)+'\n')
