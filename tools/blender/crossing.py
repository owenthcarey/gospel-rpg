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

def build_reed_bank():
    """Keep the landmark's stems and footprint, with broad green reed leaves."""
    from shading import bake_vertex_shading

    M['reed_seedhead'] = mat('reed_seedhead', (.24, .14, .06))
    M['reed_blade'] = mat('reed_blade', (.21, .33, .12))
    M['reed_blade_dark'] = mat('reed_blade_dark', (.18, .28, .09))
    ico('reed_bank_ground', (0, 0, .09), (1.8, 1.05, .20), 'sandstone')
    for i in range(13):
        x = -.95 + (i % 7)*.31
        y = -.45 + (i//7)*.65
        height = 1.2 + (i % 4)*.24
        beam('reed_stem', (x, y, .1), (x + .20, y, height), .035, 'leaf')
        cone('reed_seedhead', (x + .20, y, height), .07, .045, .28, 'reed_seedhead', 5)
    # Bake the original landmark before adding leaves, retaining its contact shade.
    export('reed_bank')
    reed = bpy.context.object
    staging = reed.location.copy()
    reed.location = (0, 0, 0)
    try:
        leaves = [
            (0, (-.8, -.6)), (2, (-.35, -.94)), (3, (.25, -.97)),
            (5, (.65, -.76)), (6, (.8, -.6)),
            (8, (-.4, .92)), (10, (.2, .98)), (12, (.6, .8)),
        ]
        vertices, faces = [], []
        for index, direction in leaves:
            x = -.95 + (index % 7)*.31
            y = -.45 + (index//7)*.65
            height = 1.2 + (index % 4)*.24
            outward = Vector((*direction, 0)).normalized()
            side = Vector((-outward.y, outward.x, 0))
            base = Vector((x + .2*.18, y, .1 + (height - .1)*.18))
            points = [base,
                      Vector((base.x, y, height*.65)) + outward*.20,
                      Vector((base.x, y, height*.88)) + outward*.42]
            widths = [.014, .11 + (index % 2)*.025, .004]
            first = len(vertices)
            for point, width in zip(points, widths):
                vertices.extend([tuple(point - side*width), tuple(point + side*width)])
            faces.extend([(first, first + 1, first + 3, first + 2),
                          (first + 2, first + 3, first + 5, first + 4)])
        mesh = bpy.data.meshes.new('reed_bank_blades')
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        blades = bpy.data.objects.new('reed_bank_blades', mesh)
        scene.collection.objects.link(blades)
        mesh.materials.append(M['reed_blade'])
        mesh.materials.append(M['reed_blade_dark'])
        for polygon in mesh.polygons:
            polygon.material_index = (polygon.index//2) % 2
        kit_common.palette_colors(blades)
        SHADING.append(bake_vertex_shading(blades, 'reed_bank_blades',
            reach=.3, strength=.2, grounded=False, jitter=.02))
        bpy.ops.object.select_all(action='DESELECT')
        reed.select_set(True)
        blades.select_set(True)
        bpy.context.view_layer.objects.active = reed
        bpy.ops.object.join()
        # Both color layers are already baked; export without shading them again.
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'reed_bank.glb'),
            export_format='GLB', use_selection=True, use_active_scene=True,
            export_cameras=False, export_lights=False, export_yup=True)
    finally:
        reed.location = staging


build_reed_bank()

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
