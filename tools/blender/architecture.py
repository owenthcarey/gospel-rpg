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

    # The fishing boat: the verified hull, floor, seats, sockets and extents are unchanged
    # (contact and clearance tests measure them); plank seams, ribs and raised posts are added
    # strictly inside that envelope.
    from kit_common import beam, finish, STATE
    from mathutils import Vector
    outline = [(0, -2), (.64, -1.15), (.73, .9), (.40, 1.65), (0, 1.94), (-.40, 1.65), (-.73, .9), (-.64, -1.15)]
    bottom = [Vector((x * .68, y * .86, .10)) for x, y in outline]
    top = [Vector((x, y, .65)) for x, y in outline]
    verts = [tuple(v) for v in bottom] + [tuple(v) for v in top]
    faces = [tuple(range(7, -1, -1))] + [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
    mesh = bpy.data.meshes.new('boat_hull')
    mesh.from_pydata(verts, [], faces)
    hull = bpy.data.objects.new('hull', mesh)
    STATE['scene'].collection.objects.link(hull)
    finish(hull, 'hull', 'wood')
    solid = hull.modifiers.new('plank_thickness', 'SOLIDIFY')
    solid.thickness = .07
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = hull
    hull.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    for i, (x, y) in enumerate(outline):
        xx, yy = outline[(i + 1) % 8]
        beam('gunwale', (x, y, .66), (xx, yy, .66), .06, 'lightwood')
    for y in [-.8, .45, 1.05]:
        box('seat', (0, y, .44), (1.15, .25, .08), 'lightwood')
    centre = Vector((0, 0, .38))
    # Plank seams: three strakes on the outer hull, just proud of the planking.
    for t in [.3, .52, .74]:
        ring = [b.lerp(u, t) for b, u in zip(bottom, top)]
        for i in range(8):
            a, b = ring[i], ring[(i + 1) % 8]
            mid = (a + b) / 2
            push = Vector((mid.x, mid.y * .15, 0)).normalized() * .012 if mid.length else Vector()
            beam('hull_strake', a + push, b + push, .011, 'wood', 4, 1)
    # Interior ribs following the hull section at several stations.
    def half_width(poly, y):
        for i in range(8):
            a, b = poly[i], poly[(i + 1) % 8]
            if a.x >= 0 and b.x >= 0 and min(a.y, b.y) <= y <= max(a.y, b.y) and a.y != b.y:
                return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)
        return 0
    for y in [-1.25, -.35, .2, .8, 1.35]:
        wb, wt = half_width(bottom, y), half_width(top, y)
        for side in [-1, 1]:
            beam('hull_rib', (side * wb * .9, y, .12), (side * wt * .9, y, .6), .032, 'wood', 5, 1)
        beam('hull_floor_frame', (-wb * .88, y, .125), (wb * .88, y, .125), .024, 'wood', 4, 1)
    # Raised stem and sternpost, inside the hull's plan extents.
    beam('stem_post', (0, -1.7, .12), (0, -1.97, .8), .05, 'wood', 6, .8)
    beam('stern_post', (0, 1.66, .12), (0, 1.92, .74), .05, 'wood', 6, .8)
    box('bow_cap', (0, -1.9, .66), (.14, .2, .05), 'lightwood', .01)
    kit_common.export_static('boat', str(OUT), [
        ('seat_front', (0, -1.15, .46)), ('seat_middle', (0, 0, .46)),
        ('seat_back', (0, 1.05, .46)), ('net_socket', (.8, .2, .5)),
        ('oar_left', (-.72, -.2, .66)), ('oar_right', (.72, -.2, .66)),
    ], report=shaded)

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
