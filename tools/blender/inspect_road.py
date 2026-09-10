"""Inspect the shipped Road to Nain GLBs, without modifying unrelated scenes.

Run via npm run assets:inspect:road, or execute this file through Blender MCP
with GOSPEL_RPG_ROOT set. Produces kit, carrying-contact and pose review images.
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
scene = bpy.data.scenes.new('The Way - exported Road to Nain review')
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

kit = set()
for asset, position in [
    ('town_gate', (-6, 6, 0)), ('farm_shelter', (5, 5, 0)),
    ('split_olive', (9, 5, 0)), ('terrace_wall', (-7, 0, 0)),
    ('spring_marker', (-1, 0, 0)), ('terrace_marker', (2, 0, 0)),
    ('widow', (5, 0, 0)), ('young_man', (7, 0, 0)),
]:
    kit |= model(asset, position, 'Idle' if asset in ['widow', 'young_man'] else None)
    kit |= label(asset.replace('_', ' '), position[0]-1, position[1]-2)

contact = set()
contact |= model('procession_frame', (0, 0, .84))
contact |= model('young_man', (0, .8, .84), 'Recline')
for x, y in [(-.93, -.8), (.93, -.8), (-.93, .8), (.93, .8)]:
    # Blender actors face -Y. Face each pair inward toward the long handrail.
    contact |= model('bearer', (x, y, 0), 'FrameCarry', rotation=math.pi/2 if x < 0 else -math.pi/2)
contact |= model('jesus', (-.95, .25, 0), 'TouchFrame', rotation=math.pi/2)
contact |= model('widow', (-2.9, -1, 0), 'Idle')
contact |= label('Four bearers / supported frame', -2.6, -2.6)

poses = set()
for i, phase in enumerate([0, .5, 1]):
    x = -4 + i*4
    poses |= model('procession_frame', (x, 0, .84))
    eased = phase*phase*(3-2*phase)
    poses |= model('young_man', (x, .8-.85*(1-math.cos(math.pi/2*eased)), .84+.12*eased-.85*math.sin(math.pi/2*eased)), 'SitUp', phase)
    poses |= label('SitUp ' + str(phase), x-1, -2.1)

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
    ('road-to-nain-kit', kit, (14, -23, 22), (0, 3, .7), 25),
    ('road-to-nain-contact', contact, (5, -8, 6), (0, 0, .8), 7.7),
    ('road-to-nain-poses', poses, (4, -12, 8), (0, 0, .9), 12.5),
]:
    for group in [kit, contact, poses]:
        group_visibility(group, group is objects)
    camera.location = location
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(OUTPUT / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('REVIEW_IMAGE', scene.render.filepath)

models = sorted((ROOT / 'public/assets/models').glob('*.glb'))
(OUTPUT / 'road-to-nain-assets.json').write_text(json.dumps({
    'blender': bpy.app.version_string, 'models': len(models),
    'bytes': sum(p.stat().st_size for p in models), 'capBytes': 5*1024*1024,
    'review': 'Shipped GLBs imported into an isolated Blender scene; original procedural assets.',
    'files': {p.name: p.stat().st_size for p in models},
}, indent=2)+'\n')
