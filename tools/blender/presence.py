"""RFC-010 settlement refinement, rebuilt on the shared kit module in RFC-011.

Existing scenes are preserved. House footprints and doors are unchanged; masonry,
roof reeds, side windows and the upper room make recognizable neighborhood forms.
People and portraits now come from characters.py; vegetation from vegetation.py.
"""
import hashlib
import importlib
import json
import os
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
from kit_common import box, beam

prior = bpy.context.window.scene
original_objects = sorted(o.name for o in prior.objects)
try:
    scene = kit_common.begin('The Way - Presence workshop')
    shaded = []

    def export(name):
        kit_common.export_static(name, str(OUT), report=shaded)

    def house(w, d, h):
        box('plastered_walls', (0, 0, h/2), (w, d, h), 'plaster', .07)
        box('stone_foundation', (0, 0, .23), (w+.06, d+.06, .46), 'stone', .04)
        box('roof', (0, 0, h+.02), (w+.26, d+.26, .19), 'roof', .04)
        for y in [-d/2, d/2]:
            box('parapet', (0, y, h+.29), (w+.2, .18, .48), 'plaster', .035)
        for x in [-w/2, w/2]:
            box('parapet', (x, 0, h+.29), (.18, d, .48), 'plaster', .035)
        box('door_recess', (0, -d/2-.013, .83), (.83, .055, 1.53), 'dark')
        box('door_wood', (.12, -d/2-.05, .74), (.47, .04, 1.36), 'wood')
        box('lintel', (0, -d/2-.06, 1.66), (1.13, .18, .18), 'lightwood', .02)
        box('doorstep', (0, -d/2-.24, .08), (1.1, .6, .16), 'sandstone', .02)
        for x in [-w*.32, w*.32]:
            box('window', (x, -d/2-.02, h*.67), (.48, .04, .56), 'dark')
            for dx in [-.14, 0, .14]:
                box('window_slats', (x+dx, -d/2-.055, h*.67), (.035, .035, .56), 'lightwood')
        for i in range(6):
            box('exposed_stone', (-w/2+.22+(i % 2)*.22, -d/2-.025, .58+i*.25), (.42, .09, .17), 'sandstone', .02)
        for x in [-w*.37, w*.37]:
            beam('roof_beam', (x, -d/2-.26, h-.06), (x, d/2+.2, h-.06), .09, 'wood')

    for name, w, d, h in [('house', 3.7, 3.2, 2.65), ('house_large', 4.7, 4, 3.3)]:
        house(w, d, h)
        for y, sign in [(-d/2-.025, -1), (d/2+.025, 1)]:
            for row in range(2):
                for i in range(int(w/.5)):
                    x = -w/2+.28+i*.50+(row % 2)*.09
                    if x > w/2-.15 or (sign == -1 and abs(x) < .56):
                        continue
                    box('basalt_course', (x, y, .16+row*.20), (.46, .075, .16), 'stone' if i % 3 else 'sandstone', .022)
        for side in [-1, 1]:
            for i in range(int(d/.5)):
                box('side_foundation', (side*(w/2+.025), -d/2+.25+i*.5, .23), (.075, .46, .30), 'stone', .025)
            box('side_window_shadow', (side*(w/2+.012), .25, h*.63), (.035, .52, .54), 'dark')
            box('side_window_lintel', (side*(w/2+.055), .25, h*.63+.32), (.14, .69, .13), 'lightwood', .015)
            for y in [.08, .25, .42]:
                box('side_window_screen', (side*(w/2+.035), y, h*.63), (.04, .025, .54), 'wood')
        for i in range(int(w/.28)):
            x = -w/2+.15+i*.28
            beam('roof_reed', (x, -d/2+.13, h+.13), (x+.025, d/2-.13, h+.13), .018, 'rope' if i % 3 else 'roof')
        # RFC-011: a few plaster patches worn back to stone, and a darker splash line.
        for i, (fx, fz, fw, fh) in enumerate([(-.3, .85, .5, .32), (.28, 1.55, .38, .26), (-.12, 1.9, .3, .2)]):
            box('worn_plaster', (fx*w, -d/2-.018, fz*h/2.65), (fw, .03, fh), 'sandstone' if i % 2 else 'stone', .02)
        box('splash_line', (0, -d/2-.012, .52), (w-.1, .02, .1), 'roof')
        if name == 'house_large':
            box('upper_room', (.8, .55, 3.94), (2.3, 2.2, 1.1), 'plaster', .05)
            box('upper_roof', (.8, .55, 4.52), (2.6, 2.5, .15), 'roof', .03)
            box('upper_window', (.8, -.56, 3.99), (.49, .035, .56), 'dark')
            box('upper_lintel', (.8, -.61, 4.32), (.68, .14, .12), 'wood', .015)
            for x in [-.15, .8, 1.75]:
                beam('upper_beam', (x, -.74, 4.46), (x, 1.80, 4.46), .052, 'wood')
        export(name)

    # Room modules retain their original three-meter footprint. Details are
    # part of the wall mesh, so runtime cutaways lower them with the wall.
    box('wall', (0, 0, 1.5), (3, .3, 3), 'plaster', .03)
    box('foundation', (0, 0, .18), (3, .34, .36), 'stone')
    for side in [-1, 1]:
        for i in range(6):
            box('wall_basalt_course', (-1.24+i*.49, side*.176, .21), (.46, .026, .24), 'stone' if i % 3 else 'sandstone', .012)
        box('wall_timber_band', (0, side*.163, 2.73), (2.97, .035, .11), 'lightwood')
        box('wall_plaster_border', (0, side*.161, .55), (2.98, .025, .034), 'sandstone')
    export('room_wall')

    source_path = ROOT / 'assets/source/presence-kit.blend'
    bpy.data.libraries.write(str(source_path), {scene}, fake_user=True, compress=True)
    exports = kit_common.STATE['exports'][:]
    report = {
        'blender': bpy.app.version_string, 'source': str(source_path.relative_to(ROOT)),
        'preservedScene': prior.name, 'preservedObjects': original_objects,
        'exports': [{'id': n, 'bytes': (OUT/(n+'.glb')).stat().st_size,
                     'sha256': hashlib.sha256((OUT/(n+'.glb')).read_bytes()).hexdigest()} for n in exports],
        'shading': shaded,
    }
    (REPORT / 'presence.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
    assert sorted(o.name for o in prior.objects) == original_objects
