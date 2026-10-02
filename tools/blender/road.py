"""Original Road to Nain kit, executed in the shared procedural workshop.

Meter scale, Z up, front -Y. These forms are artistic interpretations. No
archaeological measurements, third-party geometry or downloaded textures.
"""
M['pale_stone'] = mat('pale_road_stone', (.77, .72, .57))
M['spring_water'] = mat('spring_water', (.23, .45, .45))
M['slate_cloth'] = mat('slate_cloth', (.23, .28, .29))

person('slate_cloth', 'cloth')
ico('head_cover', (0, .045, 1.77), (.23, .21, .18), 'slate_cloth')
box('head_cover_back', (0, .15, 1.53), (.40, .07, .37), 'slate_cloth', .03)
export('widow')
person('cloth', 'lightwood')
export('young_man')

# A broad opening, visibly separate piers and lintel. Scale stays within the
# existing eight-meter local-vertex bound; obstacles are authored with the kit.
for x in [-3.4, 3.4]:
    box('gate_pier', (x, 0, 1.9), (3.8, 2, 3.8), 'plaster', .07)
    box('gate_footing', (x, 0, .24), (3.84, 2.04, .48), 'stone', .04)
    box('gate_cap', (x, 0, 3.88), (3.98, 2.12, .20), 'pale_stone', .03)
    for row in range(4):
        for dx in [-.9, .4]:
            # Both faces are visible as the traveler approaches and leaves the
            # gate. Static glTF props reverse Blender Y in the game view.
            for face in [-1.02, 1.02]:
                box('weathered_course', (x+dx, face, .75+row*.58), (1.05, .07, .34), 'pale_stone', .025)
box('gate_lintel', (0, 0, 3.15), (3.1, 1.6, .55), 'lightwood', .04)
box('gate_crossbeam', (0, -.83, 3.08), (3.4, .17, .23), 'wood', .02)
export('town_gate')

for row in range(3):
    for i in range(8):
        box('terrace_course', (-2.65+i*.75+(row%2)*.13, 0, .16+row*.25), (.72, .48, .28), 'stone' if row < 2 else 'sandstone', .035)
export('terrace_wall')

cone('spring_basin', (0, 0, .08), .72, .66, .16, 'sandstone', 10)
cone('spring_pool', (0, -.1, .17), .44, .44, .018, 'spring_water', 12)
box('single_dark_stone', (0, .32, .58), (.55, .28, .9), 'stone', .06)
# Branch mark is physically modeled on the front of the stone, pointing west.
beam('branch_mark', (.16, .17, .70), (-.18, .17, .70), .018, 'cloth')
beam('branch_mark', (-.18, .17, .70), (-.06, .17, .80), .018, 'cloth')
beam('branch_mark', (-.18, .17, .70), (-.06, .17, .60), .018, 'cloth')
# Marks on both faces stay legible from either approach after glTF handedness
# conversion. Their world-X direction remains west on both sides.
beam('branch_mark', (.16, .47, .70), (-.18, .47, .70), .018, 'cloth')
beam('branch_mark', (-.18, .47, .70), (-.06, .47, .80), .018, 'cloth')
beam('branch_mark', (-.18, .47, .70), (-.06, .47, .60), .018, 'cloth')
export('spring_marker')

for x, h in [(-.29, .85), (.29, .66)]:
    box('paired_pale_stone', (x, 0, h/2), (.42, .4, h), 'pale_stone', .05)
beam('branch_mark', (-.14, -.212, .55), (-.42, -.212, .55), .019, 'wood')
beam('branch_mark', (-.42, -.212, .55), (-.32, -.212, .65), .019, 'wood')
beam('branch_mark', (-.42, -.212, .55), (-.32, -.212, .45), .019, 'wood')
beam('branch_mark', (-.14, .212, .55), (-.42, .212, .55), .019, 'wood')
beam('branch_mark', (-.42, .212, .55), (-.32, .212, .65), .019, 'wood')
beam('branch_mark', (-.42, .212, .55), (-.32, .212, .45), .019, 'wood')
export('terrace_marker')

for x in [-2.4, 2.4]:
    for y in [-1.6, 1.6]:
        beam('shelter_post', (x, y, 0), (x, y, 2.5), .105, 'wood')
# Static glTF props map Blender -Y to game +Z; put the back wall at the
# farm layout's northern edge, leaving its southern path open.
box('shelter_back', (0, -1.6, .65), (4.8, .3, 1.3), 'stone', .03)
for y in [-1.6, 1.6]:
    beam('shelter_crossbeam', (-2.6, y, 2.45), (2.6, y, 2.45), .10, 'lightwood')
for i in range(11):
    box('woven_shelter', (-2.5+i*.5, 0, 2.56), (.5, 3.65, .10), 'rope' if i%2 else 'cloth')
box('shelter_mat', (0, .4, .025), (2.4, 1.5, .05), 'rope')
export('farm_shelter')

def build_split_olive():
    """Broad olive facets retain the landmark's fork and original outer bounds."""
    from shading import bake_vertex_shading

    # The ordinary olive's local colors; other vegetation keeps its own palette.
    canopy_colors = {'light': (.29, .39, .18), 'dark': (.22, .32, .12)}
    palettes = {name: tuple(M[key].diffuse_color[:3])
                for name, key in [('wood', 'wood'), ('light', 'leaflight'), ('dark', 'leaf')]}
    beam('split_base', (0, 0, 0), (0, 0, .7), .24, 'wood')
    for sign in [-1, 1]:
        beam('split_trunk', (0, 0, .55), (sign*.60, .1, 1.9), .16, 'wood')
        beam('split_branch', (sign*.42, .07, 1.3), (sign*1.0, -.1, 2.3), .10, 'wood')
        ico('olive_crown', (sign*.8, .1, 2.75), (1.0, .9, .78),
            'leaflight' if sign < 0 else 'leaf', 2)
    # Retain the fork's existing baked colors before simplifying its two crowns.
    export('split_olive')
    tree = bpy.context.object
    staging = tree.location.copy()
    tree.location = (0, 0, 0)
    try:
        original = tree.data
        original_colors = original.color_attributes['Color']
        groups = {name: [] for name in palettes}
        for polygon in original.polygons:
            rgb = original_colors.data[polygon.loop_start].color[:3]
            for name, palette in palettes.items():
                factor = sum(a*b for a, b in zip(rgb, palette)) / sum(c*c for c in palette)
                if max(abs(rgb[i] - palette[i]*factor) for i in range(3)) < .000002:
                    groups[name].append(polygon)
                    break
            else:
                raise ValueError('Unknown split olive palette')
        used = sorted({index for polygon in groups['wood'] for index in polygon.vertices})
        mapping = {index: i for i, index in enumerate(used)}
        mesh = bpy.data.meshes.new('split_olive_fork')
        mesh.from_pydata([tuple(original.vertices[index].co) for index in used], [],
            [tuple(mapping[index] for index in polygon.vertices) for polygon in groups['wood']])
        mesh.update()
        mesh.materials.append(original.materials[0])
        colors = mesh.color_attributes.new(name='Color',
            type=original_colors.data_type, domain=original_colors.domain)
        for polygon, old in zip(mesh.polygons, groups['wood']):
            polygon.use_smooth = old.use_smooth
            for new_loop, old_loop in zip(polygon.loop_indices, old.loop_indices):
                colors.data[new_loop].color = original_colors.data[old_loop].color
        tree.data = mesh
        crowns = []
        for name, color in canopy_colors.items():
            used = {index for polygon in groups[name] for index in polygon.vertices}
            low = [min(original.vertices[index].co[axis] for index in used) for axis in range(3)]
            high = [max(original.vertices[index].co[axis] for index in used) for axis in range(3)]
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0, 0, 0))
            crown = bpy.context.object
            crown.name = 'split_olive_crown_' + name
            start_low = [min(vertex.co[axis] for vertex in crown.data.vertices) for axis in range(3)]
            start_high = [max(vertex.co[axis] for vertex in crown.data.vertices) for axis in range(3)]
            for vertex in crown.data.vertices:
                for axis in range(3):
                    vertex.co[axis] = low[axis] + (vertex.co[axis] - start_low[axis]) / \
                        (start_high[axis] - start_low[axis]) * (high[axis] - low[axis])
            crown.data.update()
            crown.data.materials.append(mesh.materials[0])
            crown_colors = crown.data.color_attributes.new(name='Color',
                type=colors.data_type, domain=colors.domain)
            for corner in crown_colors.data:
                corner.color = (*color, 1)
            bpy.context.view_layer.update()
            SHADING.append(bake_vertex_shading(crown, 'split_olive_crown_' + name,
                strength=.36, grounded=False))
            crowns.append(crown)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [tree, *crowns]:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = tree
        bpy.ops.object.join()
        # These corner colors are baked; preserve them during the final export.
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'split_olive.glb'),
            export_format='GLB', use_selection=True, use_active_scene=True,
            export_cameras=False, export_lights=False, export_yup=True)
    finally:
        tree.location = staging


build_split_olive()

# Open frame: no lid, no enclosing box. Its long handrails align with four
# bearers facing inward. A linen support makes the reclining pose legible.
for x in [-.60, .60]:
    beam('carrying_rail', (x, -1.65, 0), (x, 1.65, 0), .05, 'lightwood')
for y in [-1.1, -.55, 0, .55, 1.1]:
    box('frame_crosspiece', (0, y, -.055), (1.22, .12, .09), 'wood', .015)
box('linen_support', (0, 0, .015), (1.06, 2.35, .055), 'cloth', .015)
for x in [-.53, .53]:
    beam('linen_edge', (x, -1.17, .05), (x, 1.17, .05), .024, 'rope')
export('procession_frame')
