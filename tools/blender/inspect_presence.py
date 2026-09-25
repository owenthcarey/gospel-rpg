"""Independently import the RFC-010 delivery and render a small review gallery.

The source workshop is never loaded. Run via Blender MCP or --inspect-presence.
The caller's scene is restored and outputs remain in ignored artifacts/.
"""
import bpy
import hashlib
import json
import os
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT') or ROOT / 'artifacts/rfc010/blender')
OUT.mkdir(parents=True, exist_ok=True)
prior = bpy.context.window.scene
try:
    scene = bpy.data.scenes.new('The Way - Final exported presence')
    bpy.context.window.scene = scene
    scene.world = bpy.data.worlds.new('Final review daylight')
    scene.world.use_nodes = True
    background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (.63, .68, .66, 1)
    background.inputs['Strength'].default_value = .65
    report = []
    # Review works in a fresh checkout, without generated or ignored recipe reports.
    exported_ids = ['traveler', 'simon', 'miriam', 'jesus', 'villager', 'james', 'john',
                    'hannah', 'amos', 'ruth', 'bearer', 'healed_man', 'widow', 'young_man',
                    'leah', 'house', 'house_large', 'olive', 'room_wall']
    featured = {'traveler':(-3,0,0), 'simon':(-1,0,0), 'miriam':(1,0,0), 'jesus':(3,0,0),
                'house':(-4,5,0), 'house_large':(3.8,5,0), 'olive':(.0,5,0), 'room_wall':(-7,3,0)}
    for index, name in enumerate(exported_ids):
        path = ROOT / 'public/assets/models' / (name+'.glb')
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        objects = set(scene.objects)-before
        meshes = [o for o in objects if o.type == 'MESH']
        position = featured.get(name, (index*2, 20, 0))
        for obj in objects:
            obj.hide_render = name not in featured
            if obj.parent is None:
                obj.location += Vector(position)
            if obj.type == 'ARMATURE':
                obj.animation_data.action = None
                clip = 'Greet' if name == 'traveler' else 'Respond' if name == 'simon' else 'Listen'
                for track in obj.animation_data.nla_tracks:
                    track.mute = track.name != clip
        report.append({'id':name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                       'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
                       'meshCount':len(meshes), 'materials':sum(len(o.data.materials) for o in meshes)})
    scene.frame_set(18)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0,0,-.02))
    floor = bpy.context.object
    floor.name = 'Review ground (not delivered)'
    mat = bpy.data.materials.new('Review ground')
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (.36,.38,.30,1)
    shader.inputs['Roughness'].default_value = 1
    floor.data.materials.append(mat)
    for name, position, power, size in [('Key',(-6,-7,12),1800,7),('Fill',(7,-3,7),900,6)]:
        light = bpy.data.lights.new(name,'AREA')
        light.energy, light.shape, light.size = power,'DISK',size
        obj = bpy.data.objects.new(name,light)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0,1,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('Export review camera')
    camera=bpy.data.objects.new('Export review camera',camera_data)
    scene.collection.objects.link(camera)
    camera_data.type='ORTHO'
    scene.camera=camera
    scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1200,800,100
    scene.render.image_settings.file_format='WEBP'
    scene.render.image_settings.quality=92
    for file, position, target, scale in [('kit',(9,-13,10),(0,2,1.3),16),('people',(2,-10,3.8),(0,0,1),8.2)]:
        camera.location=position
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera_data.ortho_scale=scale
        scene.render.filepath=str(OUT/(file+'.webp'))
        bpy.ops.render.render(write_still=True)
    (OUT/'independent-imports.json').write_text(json.dumps({'blender':bpy.app.version_string,'exports':report,'preservedScene':prior.name},indent=2)+'\n')
    print(json.dumps({'imported':len(report),'output':str(OUT),'preservedScene':prior.name}))
finally:
    bpy.context.window.scene=prior
