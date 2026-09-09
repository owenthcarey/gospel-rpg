"""Original Living Capernaum props; executed in generate_kit's workshop.

Blue edging and paired stitches are shared evidence, not arbitrary decoration.
Bench seats are 0.5 m high. All variants keep the same navigation footprint.
"""
M['blue'] = mat('pouch_blue', (.08, .23, .48))

def paired_stitches(y, z, width=.5):
    for i in range(4):
        x = -width/2 + i*width/3
        for offset in [-.022, .022]:
            beam('paired_stitch', (x+offset, y, z), (x+offset, y-.055, z+.02), .009, 'cloth')

box('pouch_body', (0, 0, .17), (.48, .3, .32), 'cloth', .045)
box('blue_flap', (0, -.015, .33), (.51, .32, .065), 'blue', .015)
box('blue_seam', (0, -.161, .22), (.5, .018, .075), 'blue')
paired_stitches(-.174, .235, .36)
beam('pouch_tie', (-.08, -.18, .33), (0, -.20, .18), .018, 'rope')
beam('pouch_tie', (.08, -.18, .33), (0, -.20, .18), .018, 'rope')
export('sewing_pouch')

box('clue_stone', (0, 0, .10), (.62, .42, .20), 'sandstone', .035)
for a, b in [((-.23, -.1, .21), (-.04, .08, .22)), ((-.04, .08, .22), (.13, -.02, .22)), ((.13, -.02, .22), (.27, -.23, .10))]:
    beam('blue_thread', a, b, .018, 'blue')
export('thread_clue')

box('cloth_tray', (0, 0, .04), (.78, .60, .08), 'lightwood', .025)
box('folded_cloth', (0, 0, .11), (.62, .45, .08), 'cloth', .02)
box('blue_edging', (0, -.17, .157), (.64, .10, .016), 'blue')
paired_stitches(-.17, .17)
export('mending_cloth')

for j in range(3):
    for i in range(12):
        a, b = i*math.tau/12, (i+1)*math.tau/12
        r = .16 + j*.04
        beam('spare_cord', (math.cos(a)*r, math.sin(a)*r, .035+j*.022), (math.cos(b)*r, math.sin(b)*r, .035+j*.022), .022, 'rope')
beam('loose_end', (.2, 0, .04), (.34, -.2, .04), .022, 'rope')
export('lashing_cord')

box('brace', (0, 0, .055), (.85, .16, .11), 'lightwood', .018)
box('brace_end', (.34, 0, .10), (.16, .22, .09), 'wood', .015)
export('wood_brace')

for variant in ['loose', 'lashed', 'braced']:
    box('seat', (0, 0, .5), (2.1, .60, .12), 'lightwood', .025)
    for x in [-.76, .76]:
        for y in [-.2, .2]:
            box('leg', (x, y, .24), (.14, .14, .48), 'wood', .012)
    beam('back_support', (-.76, .2, .3), (.76, .2, .3), .045, 'wood')
    if variant == 'loose':
        box('loose_joint', (.75, -.22, .37), (.19, .06, .18), 'dark')
    if variant == 'lashed':
        for offset in [-.035, .035]:
            beam('cross_lashing', (.59+offset, -.29, .15), (.90+offset, -.29, .47), .022, 'rope')
            beam('cross_lashing', (.59+offset, -.29, .47), (.90+offset, -.29, .15), .022, 'rope')
        beam('tightened_support', (.76, -.2, .28), (.18, -.2, .43), .055, 'wood')
    if variant == 'braced':
        beam('fitted_brace', (.76, -.22, .13), (.13, -.22, .44), .08, 'lightwood')
        box('brace_end', (.13, -.22, .44), (.22, .22, .08), 'wood')
    export('bench_' + variant)

for i in range(3):
    part = box('loose_piece', (-.32+i*.27, 0, .04+i*.012), (.43, .10, .065), 'wood', .008)
    part.rotation_euler.z = -.35+i*.42
export('bench_pieces')
