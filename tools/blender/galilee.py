"""Living Galilee: original functional props. Runs in the isolated shared workshop.

Recipe-space ports use -Y for north and +X for east; the runtime corrects
static glTF handedness before applying saved turns. Open ends define the puzzle.
Static geometry has one palette primitive.
"""
M['ochre_wrap'] = mat('leah_ochre', (.65, .39, .16))
person('ochre_wrap', 'teal')
box('head_scarf', (0, .10, 1.73), (.40, .15, .26), 'teal')
export('leah')

for shape in ['straight', 'bend']:
    # Uninterrupted open bed; elbow walls terminate at the corner rather than
    # crossing the other arm. North is Blender -Y / game +Z.
    if shape == 'straight':
        box('straight_bed', (0, 0, .06), (.58, 2, .12), 'sandstone')
        for sign in [-1, 1]:
            box('straight_edge', (sign*.35, 0, .17), (.12, 2, .34), 'pale_stone')
    else:
        box('north_bed', (0, -.645, .06), (.58, .71, .12), 'sandstone')
        box('channel_centre', (0, 0, .06), (.58, .58, .12), 'sandstone')
        box('east_bed', (.645, 0, .06), (.71, .58, .12), 'sandstone')
        box('outer_west', (-.35, -.355, .17), (.12, 1.29, .34), 'pale_stone')
        box('outer_south', (.325, .35, .17), (1.35, .12, .34), 'pale_stone')
        box('inner_north', (.35, -.645, .17), (.12, .71, .34), 'pale_stone')
        box('inner_east', (.705, -.35, .17), (.59, .12, .34), 'pale_stone')
    export('channel_' + shape)

box('basin_floor', (0, 0, .08), (1.35, 1.35, .16), 'sandstone')
for sign in [-1, 1]:
    box('basin_wall', (0, sign*.70, .24), (1.6, .16, .48), 'pale_stone')
    box('west_inlet_side', (-.70, sign*.485, .24), (.16, .27, .48), 'pale_stone')
box('basin_wall', (.70, 0, .24), (.16, 1.24, .48), 'pale_stone')
# The connecting lip spans the .2m gap from the branch port.
box('inlet_bed', (-.90, 0, .08), (.40, .58, .16), 'sandstone')
export('water_basin')

box('scoop_bowl', (0, 0, .04), (.30, .43, .08), 'lightwood')
for x in [-.16, .16]:
    box('scoop_side', (x, 0, .09), (.035, .43, .18), 'wood')
beam('scoop_handle', (0, .18, .07), (0, .70, .09), .035, 'lightwood')
export('channel_scoop')

for x in [-.65, .65]:
    for y in [-.30, .30]:
        beam('rack_leg', (x, y, 0), (x, y, .65), .045, 'wood')
for i in range(7):
    box('rack_slat', (-.66+i*.22, 0, .64), (.19, .76, .055), 'lightwood')
export('supply_rack')

box('woven_ground', (0, 0, .025), (1.5, 1.35, .05), 'rope')
for i in range(12):
    box('woven_stripe', (0, -.60+i*.11, .054), (1.48, .025, .01), 'cloth' if i%3 else 'teal')
export('resting_mat')

for x in [-.75, 0, .75]:
    beam('screen_upright', (x, 0, 0), (x, 0, 1.65), .045, 'wood')
for i in range(15):
    box('screen_reed', (-.70+i*.1, 0, .85), (.07, .055, 1.5), 'rope' if i%2 else 'lightwood')
for z in [.30, 1.30]:
    beam('screen_binding', (-.76, -.05, z), (.76, -.05, z), .018, 'teal')
for x in [-.75, .75]:
    box('screen_foot', (x, 0, .035), (.18, .55, .07), 'wood')
export('reed_screen')
