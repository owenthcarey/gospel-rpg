"""Render exported props and sampled clips in an isolated Blender review scene.

Run with Blender --background --python tools/blender/inspect_life.py.
This reads the shipped GLBs; it never overwrites an open workshop or source blend.
"""
import bpy
import os
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT', Path(__file__).resolve().parents[2]))
OUTPUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT', '/private/tmp/gospel-rpg-blender-review'))
OUTPUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('The Way - exported Living Capernaum review')
bpy.context.window.scene = scene

def model(asset, position, clip=None, phase=.5):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (asset+'.glb')))
    added = set(scene.objects)-before
    roots = [o for o in added if o.parent not in added]
    for root in roots:
        root.location = position
    rig = next((o for o in added if o.type == 'ARMATURE'), None)
    if rig and clip:
        data = rig.animation_data
        print('CLIP', clip, 'tracks', [t.name for t in data.nla_tracks])
        data.action = None
        for track in data.nla_tracks:
            track.mute = track.name.split('.')[0] != clip
            for strip in track.strips:
                strip.use_animated_time = True
                strip.strip_time = strip.action_frame_start + (strip.action_frame_end-strip.action_frame_start)*phase
    return added

for x, asset in [(-3, 'bench_loose'), (0, 'bench_lashed'), (3, 'bench_braced')]:
    model(asset, (x, 2, 0))
model('bench_pieces', (-3, 2, .01))
for i, asset in enumerate(['sewing_pouch', 'thread_clue', 'mending_cloth', 'lashing_cord', 'wood_brace']):
    model(asset, (-3.2+i*1.6, .35, .12))
for i, clip in enumerate(['Carry', 'PickUp', 'PutDown', 'Repair', 'SitDown']):
    x = -4+i*2
    actor = model('traveler', (x, -2, 0), clip, 0 if clip == 'Carry' else .5)
    if clip == 'Carry':
        pouch = model('sewing_pouch', (x, -2.48, .8))
    if clip == 'SitDown':
        model('bench_braced', (x, -2, 0))
    bpy.ops.object.text_add(location=(x-.65, -3, .015))
    label = bpy.context.object
    label.data.body = clip
    label.data.size = .22
    label.data.extrude = .001

bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
floor.location.z = -.025
mat = bpy.data.materials.new('Review sand')
mat.diffuse_color = (.38, .32, .23, 1)
mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.18, .20, .16, 1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
floor.data.materials.append(mat)
scene.world = bpy.data.worlds.new('Review daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .75, .86, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .55
for position, energy, size in [((-5, -5, 10), 1600, 7), ((5, 2, 8), 900, 5)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size = energy, 'DISK', size
    light.rotation_euler = (Vector((0, 0, .7))-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(7, -12, 10))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .7))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 12.8
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1400, 1050, 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(OUTPUT / 'living-capernaum-kit.png')
scene.frame_set(1)
bpy.ops.render.render(write_still=True)
print('REVIEW_IMAGE', scene.render.filepath)
