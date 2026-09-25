"""Shared, importable workshop helpers for every recipe (RFC-011).

Earlier recipes defined these inline and later passes parsed generate_kit.py to
reuse them. Now one module owns the palette, primitive builders and static export,
so recipes can import rather than execute each other. All dimensions are meters,
Z up, front toward -Y. Nothing here touches scenes other than the workshop scene.
"""
import math
import os

import bpy
from mathutils import Vector

# Palette colors are Blender linear values, copied into COLOR_0 at export.
PALETTE = {
    'plaster': ('warm_lime', (0.68, 0.57, 0.39)),
    'stone': ('basalt', (0.26, 0.29, 0.26)),
    'sandstone': ('sandstone', (0.56, 0.46, 0.30)),
    'roof': ('earthen_roof', (0.45, 0.37, 0.24)),
    'wood': ('olive_wood', (0.27, 0.17, 0.09)),
    'lightwood': ('sun_bleached_wood', (0.52, 0.36, 0.19)),
    'dark': ('shadow', (0.09, 0.12, 0.11)),
    'leaf': ('olive_leaf', (0.29, 0.39, 0.18)),
    'leaflight': ('olive_silver', (0.39, 0.46, 0.25)),
    'leafdark': ('olive_shade', (0.20, 0.29, 0.15)),
    'terra': ('terracotta', (0.60, 0.28, 0.14)),
    'rope': ('flax', (0.62, 0.51, 0.31)),
    'cloth': ('natural_linen', (0.86, 0.78, 0.57)),
    'teal': ('dyed_teal', (0.17, 0.36, 0.34)),
    'red': ('ochre_cloth', (0.57, 0.23, 0.12)),
    'skin': ('warm_skin', (0.56, 0.34, 0.20)),
    'hair': ('dark_hair', (0.12, 0.09, 0.06)),
    'bread': ('baked_bread', (0.75, 0.49, 0.21)),
    # RFC-011 additions for individual people and ground cover.
    'skin_light': ('light_warm_skin', (0.63, 0.41, 0.26)),
    'skin_deep': ('deep_warm_skin', (0.44, 0.25, 0.14)),
    'hair_black': ('black_hair', (0.045, 0.038, 0.032)),
    'hair_grey': ('grey_hair', (0.44, 0.42, 0.38)),
    'hair_auburn': ('auburn_hair', (0.21, 0.095, 0.045)),
    'eye': ('eye_warm_dark', (.055, .045, .031)),
    'brow': ('brow', (.11, .075, .046)),
    'lip': ('muted_lip', (.30, .16, .105)),
    'stitch': ('linen_stitch', (.68, .60, .43)),
    'slate_cloth': ('slate_cloth', (.23, .28, .29)),
    'ochre_wrap': ('leah_ochre', (.65, .39, .16)),
    'indigo': ('indigo_wool', (.11, .14, .22)),
    'olive_cloth': ('olive_wool', (.30, .31, .15)),
    'umber': ('umber_wool', (.28, .17, .10)),
    'grass': ('dry_grass', (0.40, 0.46, 0.20)),
    'grass_dry': ('straw_grass', (0.60, 0.53, 0.28)),
    'flower_white': ('chamomile', (0.86, 0.84, 0.74)),
    'flower_red': ('anemone', (0.62, 0.08, 0.06)),
    'flower_yellow': ('mustard_flower', (0.82, 0.62, 0.10)),
    'pebble': ('pale_pebble', (0.50, 0.46, 0.38)),
}
M = {}
parts = []
STATE = {'scene': None, 'exports': []}


def mat(name, color):
    m = bpy.data.materials.new('way_' + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = 0.95
    return m


def begin(scene_name, world_color=(0.65, 0.72, 0.78)):
    """Create an isolated workshop scene and the shared palette materials."""
    scene = bpy.data.scenes.new(scene_name)
    bpy.context.window.scene = scene
    scene.world = bpy.data.worlds.new('Galilee daylight')
    scene.world.color = world_color
    M.clear()
    for key, (name, color) in PALETTE.items():
        M[key] = mat(name, color)
    parts.clear()
    STATE['scene'] = scene
    STATE['exports'] = []
    return scene


def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(M[material])
    parts.append(obj)
    return obj


def box(name, pos, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('worn_edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, material)


def cone(name, pos, r1, r2, depth, material, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=pos)
    return finish(bpy.context.object, name, material)


def ico(name, pos, size, material, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=pos)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material)


def beam(name, a, b, radius, material, vertices=6, taper=.88):
    delta = Vector(b) - Vector(a)
    o = cone(name, (Vector(a) + Vector(b)) / 2, radius, radius * taper, delta.length, material, vertices)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = delta.to_track_quat('Z', 'Y')
    return o


def lathe(name, rings, material, segments=12, smooth=True, cap_top=True, cap_bottom=True,
          wobble=None):
    """A closed surface of revolution from (z, rx, ry) rings, bottom to top.

    `wobble(angle, ring_index)` may return a radial offset, for garment folds.
    """
    verts, faces = [], []
    for r_index, (z, rx, ry) in enumerate(rings):
        for s in range(segments):
            a = s * math.tau / segments
            k = 1 + (wobble(a, r_index) if wobble else 0)
            verts.append((math.cos(a) * rx * k, math.sin(a) * ry * k, z))
    for r in range(len(rings) - 1):
        for s in range(segments):
            a, b = r * segments + s, r * segments + (s + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    if cap_bottom:
        faces.append(tuple(reversed(range(segments))))
    if cap_top:
        top = (len(rings) - 1) * segments
        faces.append(tuple(range(top, top + segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    o = bpy.data.objects.new(name, mesh)
    STATE['scene'].collection.objects.link(o)
    return finish(o, name, material)


def smooth(obj, value=True):
    for poly in obj.data.polygons:
        poly.use_smooth = value
    return obj


def palette_colors(o):
    """Copy each face's material color into one corner color layer and one material."""
    colors = o.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for poly in o.data.polygons:
        color = o.data.materials[poly.material_index].diffuse_color
        for loop in poly.loop_indices:
            colors.data[loop].color = color
        poly.material_index = 0
    o.data.materials.clear()
    if 'way_vertex_palette' not in bpy.data.materials:
        palette = bpy.data.materials.new('way_vertex_palette')
        palette.diffuse_color = (1, 1, 1, 1)
        palette.use_nodes = True
        shader = next(n for n in palette.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Roughness'].default_value = .95
        vertex = palette.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.name = 'Palette colors'
        vertex.layer_name = 'Color'
        palette.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    o.data.materials.append(bpy.data.materials['way_vertex_palette'])
    return colors


def export_static(name, out, sockets=(), shade=True, report=None, strength=.62):
    """Join the pending parts at the origin and export one palette-colored GLB."""
    from shading import bake_vertex_shading
    scene = STATE['scene']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    palette_colors(o)
    if shade:
        summary = bake_vertex_shading(o, name, strength=strength)
        if report is not None:
            report.append(summary)
    socket_nodes = []
    for socket_name, position in sockets:
        socket = bpy.data.objects.new(socket_name, None)
        scene.collection.objects.link(socket)
        socket.parent = o
        socket.location = position
        socket.select_set(True)
        socket_nodes.append(socket)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, name + '.glb'), export_format='GLB',
                              use_selection=True, use_active_scene=True, export_cameras=False,
                              export_lights=False, export_yup=True)
    exports = STATE['exports']
    o.location = ((len(exports) % 5) * 7, (len(exports) // 5) * 7, 0)
    exports.append(name)
    parts.clear()
    return o


def drape(name, rings, arc, material, segments=8, thickness=.018, smooth_faces=True):
    """A cloth panel following an elliptical surface: rings of (z, rx, ry) swept over `arc`.

    Angles are radians counterclockwise from +X, so -Y (the front) is -pi/2.
    The single surface is thickened with a solidify so both sides render.
    """
    a0, a1 = arc
    verts, faces = [], []
    for z, rx, ry in rings:
        for s in range(segments + 1):
            a = a0 + (a1 - a0) * s / segments
            verts.append((math.cos(a) * rx, math.sin(a) * ry, z))
    width = segments + 1
    for r in range(len(rings) - 1):
        for s in range(segments):
            a, b = r * width + s, r * width + s + 1
            faces.append((a, a + width, b + width, b))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    STATE['scene'].collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    solid = o.modifiers.new('cloth_thickness', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = 1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    for poly in o.data.polygons:
        poly.use_smooth = smooth_faces
    return finish(o, name, material)
