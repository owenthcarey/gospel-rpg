"""RFC-011 characters: individual people on the shared twelve-bone rig.

Run through Blender MCP (with GOSPEL_RPG_ROOT set) or `npm run assets:build`. The
recipe builds each actor from a declarative spec: build, face, hair, beard, head
cover and garments. Arm, hand, seat and foot positions are identical for everyone,
because contact tests measure the imported poses of rowing, seated, carrying and
procession work. Individuality comes from girth, shoulders, heads, hair, colour
and clothing silhouettes instead. Portraits are rendered from the exported files.
"""
import hashlib
import importlib
import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get('GOSPEL_MODEL_OUTPUT', ROOT / 'public/assets/models'))
PORTRAITS = Path(os.environ.get('GOSPEL_PORTRAIT_OUTPUT', ROOT / 'public/assets/portraits'))
REPORT = ROOT / 'artifacts/rfc011'
for folder in (OUT, PORTRAITS, REPORT):
    folder.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/blender'))
import kit_common
import rigging
import shading
for module in (kit_common, shading, rigging):
    importlib.reload(module)
from kit_common import box, ico, beam, cone, lathe, smooth, drape, parts, M

# name: garment, mantle, skin, hair colour, hair style, beard, build, cover, extras
SPECS = [
    ('traveler', dict(robe='teal', mantle='cloth', skin='skin', hair='hair', style='short',
                      beard=None, girth=1.0, shoulders=1.0, head=(1, 1, 1), extras=['satchel'])),
    ('simon', dict(robe='rope', mantle='teal', skin='skin_deep', hair='hair_black', style='curly',
                   beard='full', girth=1.08, shoulders=1.1, head=(1.04, 1, .98), extras=['sash'])),
    ('miriam', dict(robe='red', mantle='cloth', skin='skin', hair='hair', style='bound',
                    beard=None, girth=.96, shoulders=.92, head=(.97, .97, 1), cover='mantle')),
    ('jesus', dict(robe='cloth', mantle='rope', skin='skin', hair='hair', style='long',
                   beard='trim', girth=1.0, shoulders=1.0, head=(1, 1, 1))),
    ('villager', dict(robe='umber', mantle='rope', skin='skin_deep', hair='hair_grey', style='receding',
                      beard='grey', girth=1.1, shoulders=.98, head=(1.02, 1.02, .97), extras=['sash'])),
    ('james', dict(robe='teal', mantle='red', skin='skin', hair='hair_black', style='short',
                   beard='full', girth=1.04, shoulders=1.06, head=(1.02, 1, 1), extras=['sash'])),
    ('john', dict(robe='terra', mantle='cloth', skin='skin_light', hair='hair_auburn', style='curly',
                  beard=None, girth=.94, shoulders=.95, head=(.96, .98, 1.02))),
    ('hannah', dict(robe='cloth', mantle='red', skin='skin', hair='hair', style='bound',
                    beard=None, girth=1.06, shoulders=.94, head=(1.02, 1, .98), cover='mantle',
                    extras=['apron'])),
    ('amos', dict(robe='teal', mantle='rope', skin='skin_deep', hair='hair_grey', style='receding',
                  beard='grey', girth=1.02, shoulders=.96, head=(1, 1, .98), extras=['sash'])),
    ('ruth', dict(robe='red', mantle='teal', skin='skin_light', hair='hair_black', style='bound',
                  beard=None, girth=.95, shoulders=.93, head=(.96, .97, 1), cover='scarf')),
    ('bearer', dict(robe='rope', mantle='cloth', skin='skin_deep', hair='hair_black', style='short',
                    beard='short', girth=1.1, shoulders=1.12, head=(1.04, 1.02, .98))),
    ('healed_man', dict(robe='cloth', mantle='teal', skin='skin', hair='hair', style='short',
                        beard='short', girth=.92, shoulders=.96, head=(.98, .98, 1))),
    ('widow', dict(robe='slate_cloth', mantle='indigo', skin='skin', hair='hair_grey', style='bound',
                   beard=None, girth=.98, shoulders=.92, head=(.98, .97, 1), cover='mantle')),
    ('young_man', dict(robe='cloth', mantle='lightwood', skin='skin_light', hair='hair', style='curly',
                       beard=None, girth=.93, shoulders=.97, head=(.97, .98, 1.02))),
    ('leah', dict(robe='ochre_wrap', mantle='teal', skin='skin', hair='hair_auburn', style='bound',
                  beard=None, girth=1.0, shoulders=.93, head=(.98, .98, 1), cover='scarf',
                  extras=['apron'])),
]


def person(spec, seed):
    """One person in the shared rest pose. Part names select their rig bone."""
    rng = random.Random(seed)
    skin, hair, robe, mantle = spec['skin'], spec['hair'], spec['robe'], spec['mantle']
    g, sw = spec['girth'], spec['shoulders']
    hx, hy, hz = spec['head']
    # Feet: shaped sandals with a toe line, same footprint and floor contact as before.
    for x in [-.13, .13]:
        box('sandals', (x, -.06, .03), (.19, .34, .05), 'wood', .02)
        box('sandals_foot', (x, -.075, .085), (.14, .26, .07), skin, .025)
        box('sandals_strap', (x, -.10, .1), (.15, .03, .03), 'wood', .006)
        smooth(cone('lower_leg', (x, 0, .28), .07, .062, .36, skin, 8))
    # Robe: a folded surface of revolution, flaring at the hem.
    folds = lambda a, r: (.035 * math.sin(a * 5 + seed) if r == 0 else .012 * math.sin(a * 5 + seed))
    # Near-circular like the original robe: reclining and seated supports rest on its back.
    lathe('robe', [(.225, .37 * g, .355 * g), (.55, .32 * g, .31 * g), (.9, .278 * g, .27 * g),
                   (1.135, .25 * g, .25 * g)], robe, 14, True, wobble=folds)
    lathe('robe_hem', [(.215, .376 * g, .361 * g), (.255, .374 * g, .359 * g)], mantle, 14, True)
    # Torso with shoulders that round over, instead of a flat box.
    lathe('tunic', [(.88, .25 * g, .165 * g), (1.14, .255 * g * sw, .17 * g), (1.3, .235 * sw, .155),
                    (1.38, .15 * sw, .11), (1.41, .09, .07)], robe, 12, True)
    box('belt', (0, 0, .91), (.52 * g, .35 * g, .06), 'wood', .01)
    box('belt_knot', (.10, -.18 * g, .91), (.06, .04, .06), mantle, .01)
    beam('belt_tail', (.10, -.183 * g, .89), (.125, -.2 * g, .76), .011, mantle, 4, 1)
    for x in [-.31, .31]:
        side = 1 if x > 0 else -1
        smooth(ico('sleeve_shoulder', (x * .8, 0, 1.3), (.09 * sw, .085, .08), robe, 1))
        smooth(beam('sleeve', (x * .77, 0, 1.3), (x, 0, .95), .09, robe, 8, 1.22))
        smooth(beam('forearm', (x, 0, .98), (x, -.045, .76), .052, skin, 8, .9))
        # Mitten hand and thumb at the forearm tip; rigid to the forearm joint.
        smooth(ico('hand', (x, -.052, .715), (.048, .04, .068), skin, 1))
        box('hand_thumb', (x - side * .035, -.07, .74), (.025, .03, .05), skin, .008)
    smooth(cone('neck', (0, 0, 1.43), .07, .08, .16, skin, 8))
    # Head: a smooth, slightly tapered skull with jaw, nose, brows, eyes and ears.
    smooth(ico('head', (0, -.012, 1.63), (.18 * hx, .17 * hy, .225 * hz), skin, 2))
    smooth(ico('head_jaw', (0, -.07, 1.535), (.13 * hx, .1 * hy, .085 * hz), skin, 1))
    nose = box('nose', (0, -.188 * hy, 1.615), (.05, .055, .08), skin, .012)
    nose.rotation_euler.x = -.18
    for x in [-.075, .075]:
        smooth(ico('head_eye', (x * hx, -.158 * hy, 1.665), (.02, .016, .015), 'eye', 1))
        brow = box('head_brow', (x * hx, -.158 * hy, 1.705), (.06, .02, .016), 'brow' if hair != 'hair_grey' else 'hair_grey', .003)
        brow.rotation_euler.y = .12 if x < 0 else -.12
        smooth(ico('head_ear', (math.copysign(.172 * hx, x), .008, 1.62), (.033, .03, .058), skin, 1))
    if not spec['beard']:
        box('head_lip', (0, -.168 * hy, 1.535), (.058, .013, .013), 'lip', .003)
    style = spec['style']
    # Hair styles give silhouettes that read from the play camera. Every cap sits
    # clear of the skull so no scalp shows through at the crown.
    cap = (0, .028, 1.745)
    cap_size = (.196 * hx, .184 * hy, .158)
    if style in ('short', 'bound'):
        smooth(ico('hair', cap, cap_size, hair, 2))
    elif style == 'curly':
        smooth(ico('hair', cap, (cap_size[0] * .98, cap_size[1] * .98, cap_size[2] * .96), hair, 2))
        golden = math.pi * (3 - math.sqrt(5))
        for i in range(20):
            t = math.acos(1 - (i + .5) / 20 * .75)
            a = i * golden + seed
            smooth(ico('hair_curl', (cap[0] + math.sin(t) * math.cos(a) * cap_size[0],
                                     cap[1] + math.sin(t) * math.sin(a) * cap_size[1] + .01,
                                     cap[2] + math.cos(t) * cap_size[2]), (.052, .052, .046), hair, 1))
    elif style == 'long':
        # The reclining storm composition rests this exact back-of-head extent on the cushion.
        smooth(ico('hair', (0, .025, 1.74), (.198, .175, .16), hair, 1))
        box('hair_back', (0, .135, 1.58), (.30, .08, .31), hair, .035)
        for x in [-.15, .15]:
            box('hair_side', (x * hx, .05, 1.56), (.06, .13, .26), hair, .02)
    elif style == 'receding':
        smooth(ico('hair', (0, .075, 1.715), (.19 * hx, .15 * hy, .135), hair, 2))
        for x in [-.155, .155]:
            smooth(ico('hair_side', (x * hx, .05, 1.63), (.05, .1, .085), hair, 1))
    if style == 'bound':
        smooth(ico('hair_bun', (0, .18, 1.68), (.075, .06, .065), hair, 1))
    for x in [-.14, .14]:
        if style not in ('receding',):
            smooth(ico('hair_temple', (x * hx, .035, 1.69), (.06, .12, .12 if spec['beard'] else .09), hair, 1))
    beard = spec['beard']
    if beard:
        colour = 'hair_grey' if beard == 'grey' else hair
        size = {'full': (.16, .13, .16), 'trim': (.145, .12, .13), 'short': (.14, .11, .1), 'grey': (.155, .13, .16)}[beard]
        smooth(ico('beard', (0, -.075, 1.5), size, colour, 2))
        box('beard_moustache', (0, -.176 * hy, 1.565), (.09, .025, .022), colour, .006)
    # Head coverings fall from the crown over the shoulders, open at the face.
    cover = spec.get('cover')
    if cover == 'mantle':
        smooth(ico('head_cover', (0, .045, 1.765), (.214 * hx, .204 * hy, .165), mantle, 2))
        drape('head_cover_veil', [(1.84, .205 * hx, .195 * hy), (1.68, .222 * hx, .214 * hy),
                                  (1.52, .205, .19), (1.4, .27 * sw, .21), (1.14, .29 * g, .22 * g)],
              (-.75, math.pi + .75), mantle, 12, .02)
    elif cover == 'scarf':
        smooth(ico('head_scarf', (0, .055, 1.755), (.205 * hx, .196 * hy, .15), mantle, 2))
        drape('head_scarf_tail', [(1.72, .2 * hx, .19 * hy), (1.56, .19, .18), (1.44, .16, .15)],
              (-.1, math.pi + .1), mantle, 10, .018)
    # Mantle over the left shoulder, hugging the chest and back down to the hip.
    smooth(ico('shoulder_wrap', (-.17, .0, 1.31), (.14 * sw, .19 * g, .1), mantle, 2))
    drape('draped_wrap', [(1.36, .2 * sw, .14), (1.2, .27 * g * sw, .19 * g),
                          (.98, .27 * g, .19 * g), (.76, .3 * g, .24 * g)],
          (math.pi + .15, math.pi + 1.05), mantle, 6, .022)
    drape('draped_wrap_back', [(1.36, .2 * sw, .14), (1.2, .27 * g * sw, .19 * g),
                               (.98, .27 * g, .19 * g), (.8, .29 * g, .23 * g)],
          (math.pi * .55, math.pi - .1), mantle, 6, .022)
    extras = spec.get('extras', [])
    if 'sash' in extras:
        beam('sash', (-.22 * sw, -.16 * g, 1.3), (.2 * g, -.2 * g, .93), .025, mantle, 6, 1)
    if 'mantle' in extras:
        box('mantle_back', (0, .17 * g, 1.08), (.46 * g, .05, .56), mantle, .03)
    if 'apron' in extras:
        box('apron', (0, -.205 * g, .72), (.24, .025, .3), 'cloth', .01)
    if 'satchel' in extras:
        box('satchel', (.24, .16, .86), (.29, .19, .32), 'lightwood', .04)
        box('satchel_flap', (.24, .269, .92), (.29, .018, .15), 'wood', .015)
        beam('satchel_strap', (-.18, -.185, 1.35), (.22, -.185, .90), .014, 'wood', 4, 1)
    return rng


def build(names=None, report=None):
    prior = bpy.context.window.scene
    original = sorted(o.name for o in prior.objects)
    scene = kit_common.begin('The Way - RFC-011 people workshop')
    built = []
    try:
        for index, (name, spec) in enumerate(SPECS):
            if names and name not in names:
                continue
            person(spec, index * 7 + 3)
            rigging.export_character(name, parts, scene, str(OUT), index)
            built.append(name)
        bpy.data.libraries.write(str(ROOT / 'assets/source/people-kit.blend'), {scene},
                                 fake_user=True, compress=True)
    finally:
        bpy.context.window.scene = prior
        assert sorted(o.name for o in prior.objects) == original
    return built


def portraits(names=None):
    """Render head-and-shoulders portraits from the exported GLBs, not source meshes."""
    prior = bpy.context.window.scene
    review = bpy.data.scenes.new('The Way - RFC-011 portrait review')
    bpy.context.window.scene = review
    try:
        review.render.engine = 'BLENDER_EEVEE'
        review.world = bpy.data.worlds.new('Portrait backdrop')
        review.world.use_nodes = True
        bg = next(n for n in review.world.node_tree.nodes if n.type == 'BACKGROUND')
        bg.inputs['Color'].default_value = (.56, .6, .58, 1)
        bg.inputs['Strength'].default_value = .7
        review.render.resolution_x, review.render.resolution_y = 288, 336
        review.render.resolution_percentage = 100
        review.render.film_transparent = True
        review.render.image_settings.file_format = 'WEBP'
        review.render.image_settings.color_mode = 'RGBA'
        review.render.image_settings.quality = 82
        review.view_settings.view_transform = 'Standard'
        camera_data = bpy.data.cameras.new('Portrait camera')
        camera = bpy.data.objects.new('Portrait camera', camera_data)
        review.collection.objects.link(camera)
        camera.location = (.62, -3.6, 1.72)
        camera.rotation_euler = (Vector((0, 0, 1.52)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera_data.type = 'ORTHO'
        camera_data.ortho_scale = 1.02
        review.camera = camera
        for label, pos, power, size, colour in [('Key', (-2.6, -3.4, 3.4), 460, 2.5, (1, .93, .82)),
                                                ('Fill', (2.8, -2.2, 1.6), 80, 3, (.8, .88, 1)),
                                                ('Rim', (1.6, 2.2, 2.6), 260, 2, (1, .9, .75))]:
            light = bpy.data.lights.new(label, 'AREA')
            light.energy, light.shape, light.size, light.color = power, 'DISK', size, colour
            obj = bpy.data.objects.new(label, light)
            review.collection.objects.link(obj)
            obj.location = pos
            obj.rotation_euler = (Vector((0, 0, 1.5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        rendered = []
        for name, _ in SPECS:
            if names and name not in names:
                continue
            before = set(review.objects)
            bpy.ops.import_scene.gltf(filepath=str(OUT / (name + '.glb')))
            imported = set(review.objects) - before
            rig = next(o for o in imported if o.type == 'ARMATURE')
            if rig.animation_data:
                rig.animation_data.action = None
                for track in rig.animation_data.nla_tracks:
                    track.mute = True
            for bone in rig.pose.bones:
                bone.rotation_mode = 'XYZ'
                bone.rotation_euler = (0, 0, 0)
                bone.location = (0, 0, 0)
                bone.scale = (1, 1, 1)
            review.frame_set(1)
            review.render.filepath = str(PORTRAITS / (name + '.webp'))
            bpy.ops.render.render(write_still=True, scene=review.name)
            rendered.append(name)
            for obj in imported:
                obj.hide_render = True
        return rendered
    finally:
        bpy.context.window.scene = prior


def run(names=None):
    built = build(names)
    from pack_palette import pack_palette
    from prune_channels import prune_channels
    for name in built:
        pack_palette(OUT / (name + '.glb'))
        prune_channels(OUT / (name + '.glb'))
    rendered = portraits(names)
    report = {
        'blender': bpy.app.version_string,
        'exports': [{'id': n, 'bytes': (OUT / (n + '.glb')).stat().st_size,
                     'sha256': hashlib.sha256((OUT / (n + '.glb')).read_bytes()).hexdigest()} for n in built],
        'portraits': rendered,
        'portraitBytes': sum(p.stat().st_size for p in PORTRAITS.glob('*.webp')),
    }
    (REPORT / 'people.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__' or os.environ.get('GOSPEL_RUN_CHARACTERS'):
    print(json.dumps(run()))
