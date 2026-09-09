"""Original modular Capernaum kit, executed in the shared asset workshop namespace.

Coordinates follow the base kit: Z up, front toward -Y. These are artistic
reconstructions, not archaeological measurements. No downloaded geometry.
"""
for actor, robe, wrap, beard in [
    ('hannah', 'cloth', 'red', False), ('amos', 'teal', 'rope', True),
    ('ruth', 'red', 'teal', False), ('bearer', 'rope', 'cloth', True),
    ('healed_man', 'cloth', 'teal', True),
]:
    person(robe, wrap, beard)
    export(actor)

box('wall', (0, 0, 1.5), (3, .3, 3), 'plaster', .03)
box('foundation', (0, 0, .18), (3, .34, .36), 'stone')
export('room_wall')
box('garden_wall', (0, 0, .48), (3, .42, .96), 'stone', .04)
box('cap', (0, 0, .98), (3.08, .47, .12), 'sandstone', .02)
export('low_wall')
for x in [-1.1, 1.1]:
    box('doorpost', (x, 0, 1.5), (.8, .35, 3), 'plaster', .03)
box('lintel', (0, 0, 2.65), (3, .42, .7), 'lightwood', .03)
export('doorway')
for x in [-2, 2]:
    box('roof_earth', (x, 0, 0), (2, 6, .2), 'roof')
for y in [-2.1, 2.1]:
    box('roof_earth', (0, y, 0), (2, 1.8, .2), 'roof')
for x in [-1.1, 1.1]:
    beam('opening_beam', (x, -3, -.15), (x, 3, -.15), .08, 'wood')
export('roof_opening')
box('roof_earth', (0, 0, 0), (6, 6, .18), 'roof')
for x in [-2, 0, 2]:
    beam('beam', (x, -3, -.16), (x, 3, -.16), .09, 'wood')
export('roof_panel')
for x in [-1.4, 1.4]:
    beam('gatepost', (x, 0, 0), (x, 0, 1.25), .08, 'wood')
for z in [.3, .7, 1.1]:
    box('gate_rail', (0, 0, z), (2.8, .12, .13), 'lightwood')
export('gate')
for i in range(10):
    box('step', (0, i*.32, (i+1)*.15), (1.4, .34, (i+1)*.3), 'stone')
export('exterior_steps')
cone('oven_body', (0, 0, .55), .9, .7, 1.1, 'terra', 12)
ico('oven_dome', (0, 0, 1.1), (.72, .72, .55), 'terra', 2)
box('oven_mouth', (0, -.77, .55), (.56, .08, .65), 'dark', .05)
box('hearth', (0, -.5, .07), (1.8, 1.8, .14), 'stone')
export('oven')
for name, width, depth, height in [('worktable', 2, 1.2, .85), ('bench', 2.4, .55, .5), ('stool', .55, .55, .5)]:
    box('top', (0, 0, height), (width, depth, .12), 'lightwood', .02)
    for x in [-width*.37, width*.37]:
        for y in [-depth*.32, depth*.32]:
            box('leg', (x, y, height/2), (.11, .11, height), 'wood')
    export(name)
for z in [.35, .9, 1.45]:
    box('shelf', (0, 0, z), (1.7, .55, .1), 'lightwood')
for x in [-.76, .76]:
    box('upright', (x, .15, .75), (.1, .1, 1.5), 'wood')
export('shelf')
cone('jug_body', (0, 0, .22), .18, .23, .44, 'terra', 10)
cone('jug_neck', (0, 0, .48), .23, .09, .13, 'terra', 10)
cone('jug_mouth', (0, 0, .58), .09, .11, .09, 'dark', 10)
beam('handle', (.18, 0, .2), (.31, 0, .48), .035, 'terra')
beam('handle', (.31, 0, .48), (.1, 0, .52), .035, 'terra')
export('jug')
basket()
for i in range(5):
    ico('loaf', (math.sin(i*2.4)*.17, math.cos(i*2.4)*.17, .51), (.17, .13, .09), 'bread')
export('bread_basket')
box('cart_bed', (0, 0, .58), (1.2, 1.8, .13), 'wood')
for x in [-.6, .6]:
    box('cart_side', (x, 0, .9), (.1, 1.8, .6), 'lightwood')
    wheel = cone('wheel', (x*1.25, 0, .4), .4, .4, .13, 'wood', 12)
    wheel.rotation_euler.y = math.pi/2
export('handcart')
for x in [-.34, .34]:
    beam('handle_shaft', (x, -.65, 0), (x, .65, 0), .045, 'wood')
beam('handle_grip', (-.34, -.65, 0), (.34, -.65, 0), .05, 'lightwood')
export('cart_handle')
box('mat', (0, 0, .04), (.9, 2, .07), 'rope')
for i in range(14):
    beam('weave', (-.44, -.94+i*.145, .085), (.44, -.94+i*.145, .085), .012, 'cloth')
for x in [-.5, .5]:
    beam('mat_edge', (x, -1.12, .06), (x, 1.12, .06), .035, 'wood')
export('mat_flat')
roll = cone('rolled_mat', (0, 0, 0), .18, .18, .9, 'rope', 12)
roll.rotation_euler.y = math.pi/2
for x in [-.27, .27]:
    box('binding', (x, 0, 0), (.06, .37, .37), 'cloth', .08)
export('mat_rolled')
ico('sack', (0, 0, .35), (.32, .3, .4), 'cloth', 2)
cone('tied_mouth', (0, 0, .73), .12, .08, .17, 'rope', 8)
export('flour_sack')
