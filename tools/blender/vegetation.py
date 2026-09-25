"""RFC-011 vegetation and ground cover, seeded and reproducible.

Rebuilds the olive, palm, cypress, reeds and rock with organic silhouettes, and adds
four small ground-cover pieces that the runtime scatters with thin instances outside
walkable paths. Run through Blender MCP or `npm run assets:build`. Existing user
scenes are preserved. Wind sway is applied at runtime by height, so trunks and
bases stay put.
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
REPORT = ROOT / 'artifacts/rfc011'
for folder in (OUT, REPORT):
    folder.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/blender'))
import kit_common
import shading
for module in (shading, kit_common):
    importlib.reload(module)
from kit_common import box, cone, ico, beam, lathe, finish, smooth, STATE


def jitter(obj, rng, amount, keep_base=None):
    """Displace vertices deterministically, optionally pinning those below a height."""
    for v in obj.data.vertices:
        if keep_base is not None and v.co.z <= keep_base:
            continue
        v.co += Vector((rng.uniform(-amount, amount), rng.uniform(-amount, amount),
                        rng.uniform(-amount, amount) * .7))
    obj.data.update()
    return obj


def strip(name, points, widths, material, normal=Vector((0, 0, 1))):
    """A flat ribbon through points, for fronds and grass blades."""
    verts, faces = [], []
    for i, (p, w) in enumerate(zip(points, widths)):
        p = Vector(p)
        direction = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        side = direction.cross(normal).normalized() * w
        verts.extend([p - side, p + side])
    for i in range(len(points) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    STATE['scene'].collection.objects.link(o)
    return finish(o, name, material)


prior = bpy.context.window.scene
original = sorted(o.name for o in prior.objects)
try:
    scene = kit_common.begin('The Way - RFC-011 vegetation workshop')
    shaded = []

    def export(name, **kwargs):
        kit_common.export_static(name, str(OUT), report=shaded, **kwargs)

    # Olive: a twisted, leaning trunk dividing into limbs, crowned by broken silver-green masses.
    rng = random.Random(1101)
    trunk = [Vector((0, 0, 0))]
    for i in range(5):
        trunk.append(trunk[-1] + Vector((rng.uniform(-.07, .09), rng.uniform(-.06, .06), .38)))
    for i in range(5):
        beam('olive_trunk', trunk[i], trunk[i + 1], .24 - i * .03, 'wood', 7, .9)
    smooth(jitter(cone('olive_root_flare', (0, 0, .1), .36, .2, .2, 'wood', 9), rng, .03, .0))
    top = trunk[-1]
    for branch in range(5):
        a = branch * math.tau / 5 + rng.uniform(-.2, .2)
        mid = trunk[3] + Vector((math.cos(a) * .45, math.sin(a) * .45, .35))
        end = mid + Vector((math.cos(a) * .55, math.sin(a) * .55, .45 + rng.uniform(0, .25)))
        beam('olive_branch', trunk[3], mid, .1, 'wood', 6, .8)
        beam('olive_branch', mid, end, .075, 'wood', 6, .7)
        for tip in range(3):
            b = a + (tip - 1) * .7
            leaf = end + Vector((math.cos(b) * .32, math.sin(b) * .32, .18 + (tip % 2) * .22))
            cluster = ico('olive_leaf_cluster', leaf, (.62, .55, .36), ['leaf', 'leaflight', 'leafdark'][(branch + tip) % 3], 1)
            jitter(cluster, rng, .07)
    jitter(ico('olive_top', top + Vector((.08, -.05, .95)), (.7, .66, .4), 'leaflight', 1), rng, .08)
    export('olive')

    # Palm: a ringed, gently curving trunk with drooping, notched fronds and a date cluster.
    rng = random.Random(2203)
    rings = []
    for i in range(9):
        z = i * .47
        lean = (z / 4) ** 2 * .45
        rings.append((z, lean))
    for i in range(8):
        (z0, x0), (z1, x1) = rings[i], rings[i + 1]
        beam('palm_trunk', (x0, 0, z0), (x1, 0, z1 + .02), .19 - i * .007, 'lightwood', 7, .86)
        smooth(cone('palm_ring', (x1, 0, z1 - .04), .19 - i * .007, .15 - i * .007, .07, 'wood', 7), False)
    crown = Vector((rings[-1][1], 0, rings[-1][0] + .08))
    for i in range(9):
        a = i * math.tau / 9 + rng.uniform(-.12, .12)
        length = rng.uniform(1.8, 2.3)
        droop = rng.uniform(.9, 1.3)
        dead = i in (2, 6)
        points = []
        for s in range(7):
            t = s / 6
            points.append(crown + Vector((math.cos(a) * length * t, math.sin(a) * length * t,
                                          .35 * math.sin(t * math.pi * .8) - droop * t * t)))
        widths = [.02, .16, .24, .24, .2, .12, .02]
        strip('palm_frond', points, widths, 'lightwood' if dead else ('leaf' if i % 2 else 'leafdark'))
    for i in range(6):
        a = i * 1.05
        ico('palm_dates', crown + Vector((math.cos(a) * .16, math.sin(a) * .16, -.25)), (.08, .08, .11), 'bread', 1)
    export('palm')

    # Cypress: stacked, jittered tiers that taper to a narrow flame.
    rng = random.Random(3307)
    cone('cypress_trunk', (0, 0, .45), .13, .1, .9, 'wood', 7)
    for i, (z, r) in enumerate([(1.0, .62), (1.6, .58), (2.2, .5), (2.8, .4), (3.35, .28), (3.8, .15)]):
        tier = cone('cypress_foliage', (rng.uniform(-.03, .03), rng.uniform(-.03, .03), z), r, r * .45, .9, 'leafdark' if i % 2 else 'leaf', 9)
        jitter(tier, rng, .045)
    cone('cypress_tip', (0, 0, 4.25), .12, .01, .5, 'leafdark', 7)
    export('cypress')

    # Reeds: thin stems with leaf blades and brown heads, leaning in the prevailing breeze.
    rng = random.Random(4409)
    for i in range(14):
        x, y = rng.uniform(-.42, .42), rng.uniform(-.42, .42)
        h = rng.uniform(.6, 1.35)
        lean = rng.uniform(.04, .16)
        beam('reed', (x, y, 0), (x + lean, y, h), .014, 'leaflight', 5, .7)
        if i % 2 == 0:
            cone('reed_head', (x + lean, y, h + .06), .03, .02, .18, 'rope', 5)
        strip('reed_blade', [(x, y, 0), (x + lean * .3 + .08, y + .03, h * .35), (x + lean * .5 + .2, y + .05, h * .6)],
              [.02, .018, .002], 'leaf', Vector((0, 1, 0)))
    export('reeds')

    # Rock: a faceted field stone with a smaller companion, same footprint as before.
    rng = random.Random(5501)
    jitter(ico('shore_stone', (0, 0, .22), (.62, .5, .42), 'sandstone', 1), rng, .06)
    jitter(ico('shore_stone_small', (.42, -.2, .09), (.2, .17, .14), 'stone', 1), rng, .03)
    export('rock')

    # Ground cover, small enough to scatter by the hundred with thin instances.
    rng = random.Random(6607)
    for i in range(9):
        a = i * 2.4 + rng.uniform(-.3, .3)
        h = rng.uniform(.22, .42)
        out = rng.uniform(.06, .16)
        base = Vector((math.cos(a) * .04, math.sin(a) * .04, 0))
        tip = Vector((math.cos(a) * out, math.sin(a) * out, h))
        normal = Vector((-math.sin(a), math.cos(a), 0))
        strip('grass_blade', [base, base.lerp(tip, .55) + Vector((0, 0, .02)), tip], [.035, .025, .002],
              'grass' if i % 3 else 'grass_dry', normal)
    # Thin blades occlude themselves; a lighter bake keeps them readable from above.
    export('grass_tuft', strength=.22)

    rng = random.Random(7703)
    for i in range(6):
        a = i * 1.1
        r = .18 if i else 0
        jitter(ico('shrub_mass', (math.cos(a) * r, math.sin(a) * r, .24 + (0 if i else .1)), (.26, .24, .22),
                   'leafdark' if i % 2 else 'leaf', 1), rng, .04)
    beam('shrub_stem', (0, 0, 0), (0, 0, .18), .03, 'wood', 5)
    export('shrub', strength=.4)

    rng = random.Random(8807)
    for i, colour in enumerate(['flower_white', 'flower_red', 'flower_yellow', 'flower_white', 'flower_red']):
        a = i * 1.3
        x, y = math.cos(a) * .12, math.sin(a) * .12
        h = rng.uniform(.18, .32)
        beam('flower_stem', (x, y, 0), (x * 1.2, y * 1.2, h), .008, 'grass', 4, .8)
        ico('flower_head', (x * 1.2, y * 1.2, h + .02), (.045, .045, .025), colour, 1)
    for i in range(5):
        a = i * 1.26 + .6
        strip('flower_leaf', [(0, 0, 0), (math.cos(a) * .12, math.sin(a) * .12, .12)], [.03, .004],
              'grass', Vector((-math.sin(a), math.cos(a), 0)))
    # Thin blades occlude themselves; a lighter bake keeps them readable from above.
    export('flowers', strength=.22)

    rng = random.Random(9901)
    for i in range(6):
        a = i * 1.05 + rng.uniform(0, .5)
        r = rng.uniform(.05, .26)
        s = rng.uniform(.05, .11)
        jitter(ico('pebble', (math.cos(a) * r, math.sin(a) * r, s * .5), (s, s * .85, s * .6),
                   'pebble' if i % 2 else 'sandstone', 1), rng, s * .12)
    export('pebbles')

    bpy.data.libraries.write(str(ROOT / 'assets/source/vegetation-kit.blend'), {scene}, fake_user=True, compress=True)
    exports = kit_common.STATE['exports'][:]
    report = {
        'blender': bpy.app.version_string,
        'exports': [{'id': n, 'bytes': (OUT / (n + '.glb')).stat().st_size,
                     'sha256': hashlib.sha256((OUT / (n + '.glb')).read_bytes()).hexdigest()} for n in exports],
        'shading': shaded,
    }
    (REPORT / 'vegetation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
    assert sorted(o.name for o in prior.objects) == original
