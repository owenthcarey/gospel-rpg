"""Original 64 px inventory sprites rendered from the shipped, faceted quest props.

Run with Blender MCP or `python3 tools/build_assets.py --items`. The isolated
workshop preserves the open scene, uses transparent backgrounds and includes a
small dark silhouette rim so brown tools stay readable on the satchel's slots.
No gameplay models, story identifiers, sockets, or clips are modified.
"""
import contextlib
import ast
import hashlib
import json
import os
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get('GOSPEL_ITEM_OUTPUT') or ROOT / 'public/assets/items')
REPORT = ROOT / 'artifacts/rfc011'
SIZE = 64

# Canonical sprite name, existing game model, view direction. Carry aliases such
# as empty-jug, water-jug and rest-water share the same physical jug silhouette.
SPRITES = [
    ('net', 'net_folded', (1.4, -2.0, 4.5)),
    ('bread', 'bread_bundle', (1.5, -3.0, 3.7)),
    ('empty-basket', 'basket_empty', (2.0, -3.0, 2.6)),
    ('bread-basket', 'bread_basket', (2.0, -3.0, 2.6)),
    ('jug', 'jug', (1.2, -4.0, 2.0)),
    ('cart-handle', 'cart_handle', (1.5, -2.0, 4.2)),
    ('sewing-pouch', 'sewing_pouch', (1.4, -3.8, 2.5)),
    ('lashing-cord', 'lashing_cord', (1.4, -2.0, 4.3)),
    ('wood-brace', 'wood_brace', (1.6, -3.5, 3.3)),
    ('channel-scoop', 'channel_scoop', (2.0, -2.7, 3.7)),
    ('rest-mat', 'resting_mat', (1.2, -2.0, 4.2)),
    ('rest-screen', 'reed_screen', (1.2, 4.0, 2.4)),
]


def enum_value(owner, property_name, preferred):
    """Check RNA identifiers before assigning version-dependent Blender enums."""
    identifiers = {item.identifier for item in owner.bl_rna.properties[property_name].enum_items}
    if identifiers == {'NONE'}:
        # OCIO view transforms are dynamic: RNA exposes only its sentinel. The
        # setter reports the actual installed choices when given that sentinel.
        current = getattr(owner, property_name)
        try:
            setattr(owner, property_name, next(iter(identifiers)))
        except TypeError as error:
            identifiers = set(ast.literal_eval(str(error).split(' not found in ', 1)[1]))
        finally:
            setattr(owner, property_name, current)
    if preferred not in identifiers:
        raise RuntimeError(f'{property_name}: {preferred} is unavailable in Blender {bpy.app.version_string}')
    return preferred


def run(names=None):
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    prior = bpy.context.window.scene
    original = sorted(obj.name for obj in prior.objects)
    scene = bpy.data.scenes.new('The Way - original item sprite workshop')
    bpy.context.window.scene = scene
    rendered = []
    try:
        # Render-engine identifiers are dynamic; keep a valid starting value and
        # verify the version's Eevee identifier before switching the new workshop.
        scene.render.engine = prior.render.engine
        try:
            scene.render.engine = 'BLENDER_EEVEE' if bpy.app.version >= (5, 0, 0) else 'BLENDER_EEVEE_NEXT'
        except TypeError as error:
            raise RuntimeError(f'Item sprites require Eevee: {error}') from error
        scene.render.resolution_x = scene.render.resolution_y = SIZE
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = True
        settings = scene.render.image_settings
        settings.file_format = enum_value(settings, 'file_format', 'WEBP')
        settings.color_mode = enum_value(settings, 'color_mode', 'RGBA')
        settings.quality = 96
        scene.view_settings.view_transform = enum_value(scene.view_settings, 'view_transform', 'Standard')
        scene.world = bpy.data.worlds.new('Item sprite ambient')
        scene.world.use_nodes = True
        background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
        background.inputs['Color'].default_value = (.6, .62, .59, 1)
        background.inputs['Strength'].default_value = .7

        camera_data = bpy.data.cameras.new('Item sprite camera')
        camera_data.type = enum_value(camera_data, 'type', 'ORTHO')
        camera = bpy.data.objects.new('Item sprite camera', camera_data)
        scene.collection.objects.link(camera)
        scene.camera = camera
        for label, position, power in [('Key', (-3, -4, 5), 360), ('Fill', (4, 1, 3), 100)]:
            light_data = bpy.data.lights.new('Item ' + label, enum_value(bpy.types.Light, 'type', 'AREA'))
            light_data.energy = power
            light_data.shape = enum_value(light_data, 'shape', 'DISK')
            light_data.size = 4
            light = bpy.data.objects.new('Item ' + label, light_data)
            scene.collection.objects.link(light)
            light.location = position
            light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

        outline = bpy.data.materials.new('Item sprite dark edge')
        outline.use_nodes = True
        shader = next(node for node in outline.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = (.018, .016, .012, 1)
        shader.inputs['Roughness'].default_value = 1

        for index, (name, model, view) in enumerate(SPRITES):
            if names and name not in names:
                continue
            before = set(scene.objects)
            source = ROOT / 'public/assets/models' / (model + '.glb')
            bpy.ops.import_scene.gltf(filepath=str(source))
            imported = set(scene.objects) - before
            meshes = [obj for obj in imported if obj.type == 'MESH']
            points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
            minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
            maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
            centre = (minimum + maximum) / 2
            scale = 1.5 / max(maximum - minimum)
            normalize = Matrix.Translation(-centre * scale) @ Matrix.Scale(scale, 4)
            for obj in meshes:
                obj.matrix_world = normalize @ obj.matrix_world
            bpy.context.view_layer.update()

            direction = Vector(view).normalized()
            rotation = (-direction).to_track_quat('-Z', 'Y')
            right, up = rotation @ Vector((1, 0, 0)), rotation @ Vector((0, 1, 0))
            points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
            projected = [(point.dot(right), point.dot(up)) for point in points]
            x0, x1 = min(p[0] for p in projected), max(p[0] for p in projected)
            y0, y1 = min(p[1] for p in projected), max(p[1] for p in projected)
            target = right * ((x0 + x1) / 2) + up * ((y0 + y1) / 2)
            camera.location = target + direction * 5
            camera.rotation_euler = rotation.to_euler()
            camera_data.ortho_scale = max(x1 - x0, y1 - y0) * 1.16

            rims = []
            for obj in meshes:
                rim = obj.copy()
                rim.data = obj.data.copy()
                rim.name = name + ' silhouette edge'
                scene.collection.objects.link(rim)
                rim.parent = None
                rim.matrix_world = Matrix.Translation(-direction * .075) @ Matrix.Scale(1.045, 4) @ obj.matrix_world
                rim.data.materials.clear()
                rim.data.materials.append(outline)
                for face in rim.data.polygons:
                    face.material_index = 0
                rims.append(rim)
            scene.render.filepath = str(OUT / (name + '.webp'))
            bpy.ops.render.render(write_still=True, scene=scene.name)
            rendered.append({'id': name, 'model': model, 'bytes': (OUT / (name + '.webp')).stat().st_size,
                             'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest()})
            # Keep the full recipe workshop while only the current item renders.
            for obj in [*imported, *rims]:
                obj.hide_render = True
                if obj.parent is None:
                    obj.location.x += index * 3
        if not names:
            bpy.data.libraries.write(str(ROOT / 'assets/source/items-kit.blend'), {scene},
                                     fake_user=True, compress=True)
        report = {'blender': bpy.app.version_string, 'size': SIZE, 'transparent': True,
                  'viewTransform': scene.view_settings.view_transform,
                  'sprites': rendered, 'preservedScene': prior.name}
        (REPORT / 'item-icons.json').write_text(json.dumps(report, indent=2) + '\n')
        return report
    finally:
        bpy.context.window.scene = prior
        assert sorted(obj.name for obj in prior.objects) == original


if __name__ == '__main__':
    REPORT.mkdir(parents=True, exist_ok=True)
    with (REPORT / 'item-icons-render.log').open('w') as log:
        with contextlib.redirect_stdout(log):
            report = run()
    print(json.dumps(report))
