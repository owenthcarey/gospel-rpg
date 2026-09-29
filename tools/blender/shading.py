"""Deterministic baked shading for the vertex-color palette (RFC-011).

Every export keeps one palette primitive; this pass multiplies its corner colors by
ray-cast ambient occlusion, a grounded grime gradient, a gentle sky lift on
up-facing faces and a small per-face tone jitter on faceted surfaces. Rays use a
fixed Fibonacci hemisphere, so rebuilding produces the same colors on any machine.
No textures, render engine or random state are involved.
"""
import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Held or hanging props must not darken as though they stand on the ground.
UNGROUNDED = {
    'oar', 'basket_empty', 'basket_fish', 'bread_bundle', 'jug', 'bread_basket', 'cart_handle',
    'flour_sack', 'sewing_pouch', 'thread_clue', 'mending_cloth', 'lashing_cord', 'wood_brace',
    'net_cast', 'net_full', 'net_folded', 'channel_scoop', 'resting_mat', 'reed_screen',
    'mat_rolled', 'mat_flat', 'boat_cushion', 'roof_opening', 'roof_panel', 'procession_frame',
    'crossing_plank', 'landing_mat',
}
SAMPLES = 20


def _hemisphere(count):
    golden = math.pi * (3 - math.sqrt(5))
    out = []
    for i in range(count):
        z = 1 - (i + .5) / count
        r = math.sqrt(max(0, 1 - z * z))
        a = i * golden
        out.append(Vector((math.cos(a) * r, math.sin(a) * r, z)).normalized())
    return out


_DIRECTIONS = _hemisphere(SAMPLES)


def _basis(normal):
    helper = Vector((0, 0, 1)) if abs(normal.z) < .9 else Vector((1, 0, 0))
    tangent = normal.cross(helper).normalized()
    return tangent, normal.cross(tangent).normalized()


def _hash(v):
    n = math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7) * 43758.5453
    return n - math.floor(n)


def bake_vertex_shading(obj, name, reach=None, strength=.62, grounded=None, jitter=.05):
    """Multiply `obj`'s corner color attribute "Color" by baked lighting terms.

    `obj` must be a single mesh with applied transforms and an existing corner
    color layer. Smooth faces bake per vertex so shared vertices keep one colour and
    stay merged on export; faceted faces bake per face corner. Returns a summary.
    """
    mesh = obj.data
    colors = mesh.color_attributes.get('Color')
    if colors is None or colors.domain != 'CORNER':
        return {'id': name, 'skipped': True}
    grounded = name not in UNGROUNDED if grounded is None else grounded
    dims = obj.dimensions
    size = max(dims.x, dims.y, dims.z, .05)
    reach = reach or min(1.6, max(.18, size * .45))
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    world = obj.matrix_world
    rotation = world.to_3x3()
    ground_z = min((world @ v.co).z for v in mesh.vertices)
    cache = {}
    darkest = 1.0
    for poly in mesh.polygons:
        face_normal = (rotation @ poly.normal).normalized()
        centre = world @ poly.center
        face_tone = 1.0 if poly.use_smooth else 1 + (_hash(centre) - .5) * 2 * jitter
        for loop_index in poly.loop_indices:
            vertex = mesh.loops[loop_index].vertex_index
            position = world @ mesh.vertices[vertex].co
            if poly.use_smooth:
                normal = (rotation @ mesh.vertices[vertex].normal).normalized()
                key = (vertex,)
                origin = position + normal * .003
            else:
                normal = face_normal
                key = (vertex, round(normal.x, 3), round(normal.y, 3), round(normal.z, 3))
                # Nudge toward the face centre so edge rays do not start inside neighbours.
                origin = position.lerp(centre, .04) + normal * .003
            ao = cache.get(key)
            if ao is None:
                tangent, bitangent = _basis(normal)
                hits = 0.0
                for d in _DIRECTIONS:
                    direction = (tangent * d.x + bitangent * d.y + normal * d.z).normalized()
                    hit = tree.ray_cast(origin, direction, reach)
                    if hit[0] is not None:
                        hits += 1 - (hit[3] / reach) * .5
                    elif grounded and direction.z < 0:
                        t = (origin.z - ground_z) / -direction.z
                        if t < reach:
                            hits += (1 - (t / reach) * .5) * .8
                ao = 1 - strength * (hits / SAMPLES)
                cache[key] = ao
            sky = 1 + .05 * max(0.0, normal.z) - .07 * max(0.0, -normal.z)
            grime = 1.0
            if grounded:
                height = position.z - ground_z
                grime = .86 + .14 * min(1.0, height / max(.35, min(1.2, size * .35)))
            factor = max(.28, ao * grime * sky * face_tone)
            darkest = min(darkest, factor)
            c = colors.data[loop_index].color
            colors.data[loop_index].color = (c[0] * factor, c[1] * factor, c[2] * factor, c[3])
    return {'id': name, 'reach': round(reach, 3), 'darkest': round(darkest, 3), 'grounded': grounded}
