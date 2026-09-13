"""RFC-007: original reusable passage marker, without modern signs or lettering.

The pale stone footing and short wrapped post identify a deliberate passage.
Placed beside existing thresholds; it does not imply a historical sign system.
"""
ico('marker_footing', (0, 0, .11), (.30, .28, .15), 'sandstone')
cone('marker_post', (0, 0, .51), .10, .075, .83, 'wood', 6)
for z in [.68, .75, .82]:
    cone('marker_wrap', (0, 0, z), .111, .111, .035, 'rope', 6)
box('marker_pale_top', (0, 0, .94), (.21, .19, .10), 'cloth', .02)
export('passage_marker')
