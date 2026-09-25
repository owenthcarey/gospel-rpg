"""RFC-011 architecture refinement: the town gate of Nain, rebuilt with the same footprint.

The piers keep their positions and extents (the runtime authors the gate's obstacles
separately); the flat lintel becomes a voussoir arch, and towers gain battered bases,
wrapping stone courses, a parapet, window slits and heavy open doors. Seeded; runs through
Blender MCP or `npm run assets:build`. Existing user scenes are preserved.
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
from kit_common import box, M, mat

prior = bpy.context.window.scene
original = sorted(o.name for o in prior.objects)
try:
    scene = kit_common.begin('The Way - RFC-011 architecture workshop')
    M['pale_stone'] = mat('pale_road_stone', (.77, .72, .57))
    shaded = []
    rng = random.Random(1207)

    for x in [-3.4, 3.4]:
        side = 1 if x > 0 else -1
        # A battered base, the plastered tower and a slightly overhanging cap.
        box('gate_footing', (x, 0, .3), (3.96, 2.16, .6), 'stone', .05)
        box('gate_batter', (x, 0, .78), (3.86, 2.08, .4), 'stone', .06)
        box('gate_pier', (x, 0, 2.1), (3.72, 1.96, 2.6), 'plaster', .07)
        box('gate_cap', (x, 0, 3.52), (3.9, 2.1, .24), 'pale_stone', .04)
        # Parapet with merlons, stepped back from the cap edge.
        for i in range(5):
            mx = x - 1.5 + i * .75
            for face in [-.88, .88]:
                box('gate_merlon', (mx, face, 3.86), (.42, .24, .46), 'plaster')
        box('gate_parapet_floor', (x, 0, 3.68), (3.6, 1.8, .1), 'roof', .02)
        # Stone courses that wrap three faces, irregular in length and tone.
        for row in range(5):
            z = 1.05 + row * .5
            for face in [-1.0, 1.0]:
                along = -1.7
                while along < 1.6:
                    length = rng.uniform(.45, .9)
                    if along + length > 1.75:
                        length = 1.75 - along
                    if length > .2:
                        box('gate_course', (x + along + length / 2, face, z), (length - .04, .07, .3),
                            'pale_stone' if rng.random() > .3 else 'sandstone')
                    along += length + .06
            box('gate_course_end', (x + side * 1.88, 0, z), (.07, 1.7, .3), 'pale_stone')
        # Narrow window slits on both faces.
        for face in [-1.0, 1.0]:
            box('gate_slit', (x - side * .7, face * 1.0, 2.6), (.16, .06, .62), 'dark')
            box('gate_slit_lintel', (x - side * .7, face * 1.02, 2.98), (.42, .08, .12), 'pale_stone', .02)
    # A voussoir arch spanning the 3 m opening between the piers.
    span, rise, spring = 1.52, 1.0, 2.55
    for i in range(11):
        a0, a1 = math.pi * i / 11, math.pi * (i + 1) / 11
        mid = (a0 + a1) / 2
        cx, cz = math.cos(mid) * span, spring + math.sin(mid) * rise
        stone = box('gate_voussoir', (cx, 0, cz), (.34, 1.9, .34), 'pale_stone' if i % 2 else 'sandstone')
        stone.rotation_euler.y = -(mid - math.pi / 2)
    box('gate_arch_fill', (0, 0, 3.62), (3.1, 1.86, .36), 'plaster', .04)
    box('gate_keystone', (0, 0, spring + rise + .12), (.3, 1.96, .4), 'pale_stone', .03)
    # Heavy doors swung open against the piers, with iron-dark straps.
    for side in [-1, 1]:
        box('gate_door', (side * 1.44, -.62, 1.25), (.12, 1.1, 2.4), 'wood', .02)
        for z in [.6, 1.9]:
            box('gate_door_strap', (side * 1.37, -.62, z), (.03, 1.12, .1), 'dark')
    kit_common.export_static('town_gate', str(OUT), report=shaded)

    bpy.data.libraries.write(str(ROOT / 'assets/source/architecture-kit.blend'), {scene}, fake_user=True, compress=True)
    exports = kit_common.STATE['exports'][:]
    report = {
        'blender': bpy.app.version_string,
        'exports': [{'id': n, 'bytes': (OUT / (n + '.glb')).stat().st_size,
                     'sha256': hashlib.sha256((OUT / (n + '.glb')).read_bytes()).hexdigest()} for n in exports],
        'shading': shaded,
    }
    (REPORT / 'architecture.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
    assert sorted(o.name for o in prior.objects) == original
