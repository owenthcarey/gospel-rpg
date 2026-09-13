"""RFC-006 original lake landmarks and functional landing kit.

Executed in the isolated procedural workshop after the existing assets.
"""
# A low pier: landward end +Y, boats moor beside the outer end.
for i in range(11):
    box('landing_board', (0, -.95 + i*.19, .13), (1.8, .17, .11), 'lightwood')
for x in [-.83, .83]:
    for y in [-.95, .95]:
        cone('landing_post', (x, y, .13), .085, .065, 1.0, 'wood', 6)
# Shallow contrasting edge strips leave both boarding ends and the deck open.
for x in [-.86, .86]:
    box('landing_edge', (x, 0, .21), (.09, 2.08, .08), 'wood')
    for y in [-.95, .95]:
        cone('landing_post_cap', (x, y, .65), .105, .075, .07, 'lightwood', 6)
beam('mooring_rope', (-.85, -.96, .48), (-.85, -.5, .16), .025, 'rope')
export('landing_pier')

# Reeds face exposed water; fan silhouette remains readable at a distance.
ico('reed_bank_ground', (0, 0, .09), (1.8, 1.05, .20), 'sandstone')
for i in range(13):
    x = -.95 + (i % 7)*.31
    y = -.45 + (i//7)*.65
    height = 1.2 + (i % 4)*.24
    beam('reed_stem', (x, y, .1), (x + .20, y, height), .035, 'leaf')
    cone('reed_seedhead', (x + .20, y, height), .07, .045, .28, 'rope', 5)
export('reed_bank')

# Two pale faces with an unmistakable opening; this geometry carries the clue.
ico('split_left', (-.56, 0, .78), (.47, .65, .96), 'sandstone')
ico('split_right', (.56, .12, .91), (.47, .72, 1.12), 'cloth')
ico('split_base', (0, .25, .06), (1.35, .95, .18), 'stone')
export('split_rock')

# Long dark headland, used at both map scales. Geometry stays within export bounds.
for i in range(5):
    ico('headland_rock', (0.18*math.sin(i), -2.6+i*1.3, .5 + (i%2)*.22), (1.45, 1.1, 1.1+(i%2)*.2), 'stone')
    ico('headland_cap', (.1, -2.6+i*1.3, 1.2), (.9, .75, .35), 'leafdark')
export('cove_headland')

box('cushion', (0,0,.09), (.66,.5,.18), 'cloth', .06)
box('cushion_seam', (0,-.255,.09), (.5,.014,.018), 'rope')
export('boat_cushion')
