"""RFC-010 original character and settlement refinement, through MCP or Blender CLI.

Existing scenes are preserved. The base recipe's functions define the immutable
meter-scale rig and house footprints; this pass supplies the final visual kit.
Portraits are rendered from independently imported *exported* GLBs, never from
the source meshes. No network resources or downloaded artwork are used.
"""
import ast
import bpy
import hashlib
import importlib
import json
import math
import os
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUT = ROOT / 'public/assets/models'
PORTRAITS = ROOT / 'public/assets/portraits'
REPORT = ROOT / 'artifacts/rfc010'
for folder in (OUT, PORTRAITS, REPORT):
    folder.mkdir(parents=True, exist_ok=True)
prior = bpy.context.window.scene
original_objects = sorted(o.name for o in prior.objects)
prior_model_output = os.environ.get('GOSPEL_MODEL_OUTPUT')
os.environ['GOSPEL_RPG_ROOT'] = str(ROOT)
os.environ['GOSPEL_MODEL_OUTPUT'] = str(OUT)
sys.path.insert(0, str(ROOT / 'tools/blender'))
import rigging
from pack_palette import pack_palette
importlib.reload(rigging)

try:
    source = (ROOT / 'tools/blender/generate_kit.py').read_text()
    kit = {'__file__': str(ROOT / 'tools/blender/generate_kit.py')}
    exec(compile(source.split('\nhouse(3.7', 1)[0], 'generate_kit.py', 'exec'), kit)
    person_node = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == 'person')
    exec(compile(ast.Module(body=[person_node], type_ignores=[]), 'generate_kit.py', 'exec'), kit)
    scene, M = kit['scene'], kit['M']
    scene.name = 'The Way - Presence workshop'
    box, ico, beam, cone, export, person = [kit[n] for n in ['box', 'ico', 'beam', 'cone', 'export', 'person']]
    M['eye'] = kit['mat']('eye_warm_dark', (.055, .045, .031))
    M['brow'] = kit['mat']('brow', (.11, .075, .046))
    M['slate_cloth'] = kit['mat']('slate_cloth', (.23, .28, .29))
    M['ochre_wrap'] = kit['mat']('leah_ochre', (.65, .39, .16))
    M['stitch'] = kit['mat']('linen_stitch', (.68, .60, .43))
    M['lip'] = kit['mat']('muted_lip', (.30, .16, .105))
    specs = [
        ('traveler', 'teal', 'cloth', False), ('simon', 'rope', 'teal', True),
        ('miriam', 'red', 'cloth', False), ('jesus', 'cloth', 'rope', True),
        ('villager', 'rope', 'red', True), ('james', 'teal', 'red', True),
        ('john', 'terra', 'cloth', False), ('hannah', 'cloth', 'red', False),
        ('amos', 'teal', 'rope', True), ('ruth', 'red', 'teal', False),
        ('bearer', 'rope', 'cloth', True), ('healed_man', 'cloth', 'teal', True),
        ('widow', 'slate_cloth', 'cloth', False), ('young_man', 'cloth', 'lightwood', False),
        ('leah', 'ochre_wrap', 'teal', False),
    ]
    for index, (name, cloth, shawl, beard) in enumerate(specs):
        person(cloth, shawl, beard)
        # Small eyes and brows remain matte; no oversized doll-like sclera.
        for x in [-.077, .077]:
            ico('head_eye', (x, -.163, 1.66), (.020, .018, .016), 'eye', 1)
            brow = box('head_brow', (x, -.159, 1.70), (.060, .021, .016), 'brow', .003)
            brow.rotation_euler.y = (.12 if x < 0 else -.12) * (1 if beard else .5)
            ico('head_ear', (math.copysign(.178, x), .008, 1.61), (.035, .035, .062), 'skin', 1)
        if not beard:
            box('head_lip', (0, -.174, 1.53), (.058, .013, .013), 'lip', .003)
        # Separate lock and side profile shapes distinguish heads in silhouette.
        for x in [-.145, .145]:
            ico('hair_temple', (x, .035, 1.70), (.065, .13, .14 if beard else .10), 'hair', 1)
        if name in ('miriam', 'widow', 'hannah'):
            cover = 'slate_cloth' if name == 'widow' else shawl
            ico('head_cover', (0, .06, 1.78), (.227, .212, .172), cover, 2)
            box('head_cover_back', (0, .16, 1.53), (.40, .085, .39), cover, .03)
            for x in [-.20, .20]:
                box('head_cover_fold', (x, .04, 1.61), (.055, .14, .32), cover, .02)
        if name == 'leah':
            box('head_scarf', (0, .10, 1.73), (.40, .15, .26), 'teal', .02)
        if name == 'jesus':
            box('hair_back', (0, .135, 1.58), (.30, .08, .31), 'hair', .035)
        if name == 'traveler':
            box('satchel', (.24, .16, .86), (.29, .19, .32), 'lightwood', .04)
            box('satchel_flap', (.24, .269, .92), (.29, .018, .15), 'wood', .015)
            beam('satchel_strap', (-.18, -.18, 1.35), (.22, -.18, .90), .020, 'wood')
        # Garment borders sit on the original surfaces and keep all support and
        # carrying dimensions unchanged. Hem vertices retain the robe weighting.
        for z in [.285, .31]:
            for segment in range(8):
                a, b = (segment+.5)*math.tau/8, (segment+1.5)*math.tau/8
                beam('robe_hem', (.347*math.cos(a), .347*math.sin(a), z), (.347*math.cos(b), .347*math.sin(b), z), .008, shawl)
        box('belt_knot', (.10, -.186, .91), (.064, .045, .066), 'rope', .009)
        beam('belt_tail', (.10, -.188, .88), (.12, -.208, .73), .013, 'rope')
        box('wrap_border', (-.255, -.216, .99), (.014, .012, .43), 'stitch')
        export(name)

    # Preserve each house footprint/door. Distinct masonry, imperfect roof reeds,
    # shaded side windows and the upper room create recognizable neighborhood forms.
    for name, w, d, h in [('house', 3.7, 3.2, 2.65), ('house_large', 4.7, 4, 3.3)]:
        kit['house'](w, d, h)
        for y, sign in [(-d/2-.025, -1), (d/2+.025, 1)]:
            for row in range(2):
                for i in range(int(w/.5)):
                    x = -w/2+.28+i*.50+(row%2)*.09
                    if x > w/2-.15 or (sign == -1 and abs(x) < .56):
                        continue
                    box('basalt_course', (x, y, .16+row*.20), (.46, .075, .16), 'stone' if i%3 else 'sandstone', .022)
        for side in [-1, 1]:
            for i in range(int(d/.5)):
                box('side_foundation', (side*(w/2+.025), -d/2+.25+i*.5, .23), (.075, .46, .30), 'stone', .025)
            box('side_window_shadow', (side*(w/2+.012), .25, h*.63), (.035, .52, .54), 'dark')
            box('side_window_lintel', (side*(w/2+.055), .25, h*.63+.32), (.14, .69, .13), 'lightwood', .015)
            for y in [.08, .25, .42]:
                box('side_window_screen', (side*(w/2+.035), y, h*.63), (.04, .025, .54), 'wood')
        for i in range(int(w/.28)):
            x = -w/2+.15+i*.28
            beam('roof_reed', (x, -d/2+.13, h+.13), (x+.025, d/2-.13, h+.13), .018, 'rope' if i%3 else 'roof')
        if name == 'house_large':
            box('upper_room', (.8, .55, 3.94), (2.3, 2.2, 1.1), 'plaster', .05)
            box('upper_roof', (.8, .55, 4.52), (2.6, 2.5, .15), 'roof', .03)
            box('upper_window', (.8, -.56, 3.99), (.49, .035, .56), 'dark')
            box('upper_lintel', (.8, -.61, 4.32), (.68, .14, .12), 'wood', .015)
            for x in [-.15, .8, 1.75]:
                beam('upper_beam', (x, -.74, 4.46), (x, 1.80, 4.46), .052, 'wood')
        export(name)

    # A branching olive silhouette with small overlapping clusters and silver
    # leaf planes rather than three large featureless spheres.
    beam('olive_trunk', (0, 0, 0), (.13, .02, 1.75), .20, 'wood')
    for branch in range(5):
        a = branch*math.tau/5 + .15
        x, y = math.cos(a), math.sin(a)
        beam('olive_branch', (.05, 0, .85), (x*.91, y*.91, 2.15+(branch%2)*.16), .09, 'wood')
        for tip in range(3):
            b = a+(tip-1)*.60
            px, py, pz = x*.65+math.cos(b)*.35, y*.65+math.sin(b)*.35, 2.30+(tip%2)*.40
            beam('olive_twigs', (x*.65, y*.65, 1.95), (px, py, pz), .04, 'wood')
            ico('olive_leaf_cluster', (px, py, pz+.25), (.70, .62, .40), ['leaf', 'leaflight', 'leafdark'][(branch+tip)%3], 1)
    ico('olive_top', (.12, -.08, 3.05), (.78, .72, .43), 'leaflight', 1)
    export('olive')

    # Room modules retain their original three-meter footprint. Details are
    # part of the wall mesh, so runtime cutaways lower them with the wall.
    box('wall', (0, 0, 1.5), (3, .3, 3), 'plaster', .03)
    box('foundation', (0, 0, .18), (3, .34, .36), 'stone')
    for side in [-1, 1]:
        for i in range(6):
            box('wall_basalt_course', (-1.24+i*.49, side*.176, .21), (.46, .026, .24), 'stone' if i%3 else 'sandstone', .012)
        box('wall_timber_band', (0, side*.163, 2.73), (2.97, .035, .11), 'lightwood')
        box('wall_plaster_border', (0, side*.161, .55), (2.98, .025, .034), 'sandstone')
    export('room_wall')

    source_path = ROOT / 'assets/source/presence-kit.blend'
    bpy.data.libraries.write(str(source_path), {scene}, fake_user=True, compress=True)
    exports = kit['exports'][:]
    for name in exports:
        pack_palette(OUT / (name+'.glb'))
    # Independent export review. Every portrait uses its shipped file on disk.
    review = bpy.data.scenes.new('The Way - Imported presence review')
    bpy.context.window.scene = review
    review.world = bpy.data.worlds.new('Presence portrait daylight')
    review.world.use_nodes = True
    world_shader = next(n for n in review.world.node_tree.nodes if n.type == 'BACKGROUND')
    world_shader.inputs['Color'].default_value = (.63, .69, .70, 1)
    world_shader.inputs['Strength'].default_value = .65
    review.render.resolution_x, review.render.resolution_y, review.render.resolution_percentage = 192, 224, 100
    review.render.film_transparent = True
    review.render.image_settings.file_format = 'WEBP'
    review.render.image_settings.color_mode = 'RGBA'
    review.render.image_settings.quality = 85
    camera_data = bpy.data.cameras.new('Portrait camera')
    camera = bpy.data.objects.new('Portrait camera', camera_data)
    review.collection.objects.link(camera)
    camera.location = (.55, -4.5, 1.91)
    camera.rotation_euler = (Vector((0, 0, 1.25))-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 1.55
    review.camera = camera
    for name, pos, power, size in [('Key', (-3, -4, 5), 380, 4), ('Rim', (2, 1, 3), 220, 3)]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.shape, light.size = power, 'DISK', size
        obj = bpy.data.objects.new(name, light)
        review.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector((0, 0, 1.2))-obj.location).to_track_quat('-Z', 'Y').to_euler()
    inspected = []
    for index, (name, *_rest) in enumerate(specs):
        before = set(review.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT / (name+'.glb')))
        imported = set(review.objects)-before
        rig = next(o for o in imported if o.type == 'ARMATURE')
        if rig.animation_data:
            rig.animation_data.action = None
            for track in rig.animation_data.nla_tracks: track.mute = True
        for bone in rig.pose.bones:
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = (0, 0, 0)
            bone.location = (0, 0, 0)
            bone.scale = (1, 1, 1)
        review.frame_set(1)
        review.render.filepath = str(PORTRAITS / (name+'.webp'))
        bpy.ops.render.render(write_still=True)
        triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in imported if o.type == 'MESH')
        inspected.append({'id': name, 'triangles': triangles, 'skinPrimitives': sum(len(o.data.materials) for o in imported if o.type == 'MESH')})
        for obj in imported:
            obj.hide_render = True
        # Keep the actual imported models together for a native viewport review.
        for obj in imported:
            if obj.parent is None: obj.location += Vector(((index%5)*2, (index//5)*2, 0))
    report = {
        'blender': bpy.app.version_string, 'source': str(source_path.relative_to(ROOT)),
        'preservedScene': prior.name, 'preservedObjects': original_objects,
        'exports': [{'id': n, 'bytes': (OUT/(n+'.glb')).stat().st_size, 'sha256': hashlib.sha256((OUT/(n+'.glb')).read_bytes()).hexdigest()} for n in exports],
        'independentImports': inspected,
        'portraitBytes': sum(p.stat().st_size for p in PORTRAITS.glob('*.webp')),
    }
    (REPORT / 'generation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
    if prior_model_output is None:
        os.environ.pop('GOSPEL_MODEL_OUTPUT', None)
    else:
        os.environ['GOSPEL_MODEL_OUTPUT'] = prior_model_output
    assert sorted(o.name for o in prior.objects) == original_objects
