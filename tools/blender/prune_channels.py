"""Remove animation channels that never leave a node's rest transform (RFC-011).

A channel is dropped only when *every* clip holds the node at exactly its rest
value, so switching clips at runtime can never leave a stale pose behind: the
node simply stays at rest, as it did before. Unreferenced samplers, accessors and
buffer views are then collected. Geometry, skins and every moving channel are
untouched; running twice is harmless.
"""
import json
import struct
from pathlib import Path

EPSILON = 1e-5
REST = {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}


def _read(path):
    data = Path(path).read_bytes()
    assert data[:4] == b'glTF'
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), bytearray(data[28 + size:])


def _floats(gltf, binary, index):
    accessor = gltf['accessors'][index]
    assert accessor['componentType'] == 5126
    view = gltf['bufferViews'][accessor['bufferView']]
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    count = accessor['count'] * width
    values = struct.unpack_from('<' + 'f' * count, binary, start)
    return [values[i:i + width] for i in range(0, count, width)]


def _write(path, gltf, binary):
    encoded = json.dumps(gltf, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary = bytes(binary) + b'\0' * (-len(binary) % 4)
    header = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
    Path(path).write_bytes(header + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                           + struct.pack('<II', len(binary), 0x004e4942) + binary)


def _collect(gltf, binary):
    """Drop accessors and views nothing references, rebuilding a compact buffer."""
    used = set()
    for mesh in gltf.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                used.add(primitive['indices'])
            used.update(primitive['attributes'].values())
            for target in primitive.get('targets', []):
                used.update(target.values())
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            used.add(skin['inverseBindMatrices'])
    for animation in gltf.get('animations', []):
        for sampler in animation['samplers']:
            used.update((sampler['input'], sampler['output']))
    accessor_map = {}
    accessors = []
    for i, accessor in enumerate(gltf['accessors']):
        if i in used:
            accessor_map[i] = len(accessors)
            accessors.append(accessor)
    views_used = sorted({a['bufferView'] for a in accessors if 'bufferView' in a}
                        | {img['bufferView'] for img in gltf.get('images', []) if 'bufferView' in img})
    view_map, views, out = {}, [], bytearray()
    for old in views_used:
        view = gltf['bufferViews'][old]
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        out.extend(b'\0' * (-len(out) % 4))
        view_map[old] = len(views)
        views.append({**view, 'byteOffset': len(out), 'byteLength': len(payload)})
        out.extend(payload)
    for accessor in accessors:
        if 'bufferView' in accessor:
            accessor['bufferView'] = view_map[accessor['bufferView']]
    for image in gltf.get('images', []):
        if 'bufferView' in image:
            image['bufferView'] = view_map[image['bufferView']]
    remap = lambda i: accessor_map[i]
    for mesh in gltf.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                primitive['indices'] = remap(primitive['indices'])
            primitive['attributes'] = {k: remap(v) for k, v in primitive['attributes'].items()}
            if 'targets' in primitive:
                primitive['targets'] = [{k: remap(v) for k, v in t.items()} for t in primitive['targets']]
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = remap(skin['inverseBindMatrices'])
    for animation in gltf.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'], sampler['output'] = remap(sampler['input']), remap(sampler['output'])
    gltf['accessors'] = accessors
    gltf['bufferViews'] = views
    gltf['buffers'][0]['byteLength'] = len(out)
    return out


def prune_channels(path):
    gltf, binary = _read(path)
    animations = gltf.get('animations', [])
    if not animations:
        # Still collect accessors other passes left unreferenced (for example stripped UVs).
        _write(path, gltf, _collect(gltf, binary))
        return {'removed': 0}
    moving = set()
    targets = set()
    for animation in animations:
        for channel in animation['channels']:
            node, prop = channel['target']['node'], channel['target']['path']
            targets.add((node, prop))
            rest = gltf['nodes'][node].get(prop, REST[prop])
            sampler = animation['samplers'][channel['sampler']]
            for value in _floats(gltf, binary, sampler['output']):
                if any(abs(a - b) > EPSILON for a, b in zip(value, rest)):
                    # A quaternion and its negation are the same rotation.
                    if prop == 'rotation' and all(abs(a + b) <= EPSILON for a, b in zip(value, rest)):
                        continue
                    moving.add((node, prop))
                    break
    removed = 0
    for animation in animations:
        kept = []
        for channel in animation['channels']:
            key = (channel['target']['node'], channel['target']['path'])
            if key in moving:
                kept.append(channel)
            else:
                removed += 1
        samplers = sorted({c['sampler'] for c in kept})
        sampler_map = {old: new for new, old in enumerate(samplers)}
        animation['samplers'] = [animation['samplers'][i] for i in samplers]
        for channel in kept:
            channel['sampler'] = sampler_map[channel['sampler']]
        animation['channels'] = kept
    binary = _collect(gltf, binary)
    _write(path, gltf, binary)
    return {'removed': removed, 'kept': sum(len(a['channels']) for a in animations)}


if __name__ == '__main__':
    import sys
    for file in sys.argv[1:]:
        print(file, prune_channels(file))
