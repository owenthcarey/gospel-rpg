"""Losslessly share identical glTF buffer views, accessors and animation samplers.

No quantization, simplification, removed channels or changed samples. Works on
self-contained GLB 2 exports from the workshop and preserves all named contracts.
"""
import json
import struct
import hashlib
from pathlib import Path


def semantic_document(data):
    """Resolve storage references so exact payloads can be compared before writing."""
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    views = []
    for view in doc['bufferViews']:
        start = view.get('byteOffset', 0)
        views.append({**{k: v for k, v in view.items() if k not in ('buffer', 'byteOffset')},
                      'payload': hashlib.sha256(binary[start:start + view['byteLength']]).hexdigest()})
    accessors = [{**a, 'bufferView': views[a['bufferView']]} for a in doc['accessors']]
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                primitive['indices'] = accessors[primitive['indices']]
            for attributes in [primitive['attributes'], *primitive.get('targets', [])]:
                for key, value in attributes.items():
                    attributes[key] = accessors[value]
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = accessors[skin['inverseBindMatrices']]
    for image in doc.get('images', []):
        if 'bufferView' in image:
            image['bufferView'] = views[image['bufferView']]
    for animation in doc.get('animations', []):
        samplers = [{**s, 'input': accessors[s['input']], 'output': accessors[s['output']]} for s in animation.pop('samplers')]
        for channel in animation['channels']:
            channel['sampler'] = samplers[channel['sampler']]
    for key in ('buffers', 'bufferViews', 'accessors'):
        del doc[key]
    return doc


def compact(path):
    path = Path(path)
    original = path.read_bytes()
    if original[:4] != b'glTF' or struct.unpack_from('<I', original, 4)[0] != 2:
        raise ValueError('Expected GLB 2')
    size = struct.unpack_from('<I', original, 12)[0]
    doc = json.loads(original[20:20 + size])
    if len(doc['buffers']) != 1 or doc['buffers'][0].get('uri'):
        raise ValueError('Expected one local buffer')
    binary = original[28 + size:]
    packed = bytearray()
    views, view_map, seen = [], {}, {}
    for i, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        metadata = {k: v for k, v in view.items() if k != 'byteOffset'}
        key = (json.dumps(metadata, sort_keys=True), payload)
        if key not in seen:
            seen[key] = len(views)
            offset = len(packed)
            packed.extend(payload)
            packed.extend(b'\x00' * ((-len(packed)) % 4))
            views.append({**metadata, 'byteOffset': offset})
        view_map[i] = seen[key]
    accessors, accessor_map, seen = [], {}, {}
    for i, accessor in enumerate(doc['accessors']):
        if 'sparse' in accessor:
            raise ValueError('Sparse accessors require a separate remapper')
        a = {**accessor, 'bufferView': view_map[accessor['bufferView']]}
        key = json.dumps(a, sort_keys=True)
        if key not in seen:
            seen[key] = len(accessors)
            accessors.append(a)
        accessor_map[i] = seen[key]
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                primitive['indices'] = accessor_map[primitive['indices']]
            for attributes in [primitive['attributes'], *primitive.get('targets', [])]:
                for key, value in attributes.items():
                    attributes[key] = accessor_map[value]
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
    for image in doc.get('images', []):
        if 'bufferView' in image:
            image['bufferView'] = view_map[image['bufferView']]
    for animation in doc.get('animations', []):
        samplers, mapping, seen = [], {}, {}
        for i, sampler in enumerate(animation['samplers']):
            s = {**sampler, 'input': accessor_map[sampler['input']], 'output': accessor_map[sampler['output']]}
            key = json.dumps(s, sort_keys=True)
            if key not in seen:
                seen[key] = len(samplers)
                samplers.append(s)
            mapping[i] = seen[key]
        for channel in animation['channels']:
            channel['sampler'] = mapping[channel['sampler']]
        animation['samplers'] = samplers
    doc['bufferViews'], doc['accessors'] = views, accessors
    doc['buffers'][0]['byteLength'] = len(packed)
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(packed)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(packed), b'BIN\x00') + packed
    if semantic_document(original) != semantic_document(result):
        raise ValueError('Compaction changed a model contract or payload; original retained')
    if len(result) < len(original):
        path.write_bytes(result)
    return len(original), min(len(original), len(result))


def compact_kit(directory):
    counts = [compact(p) for p in sorted(Path(directory).glob('*.glb'))]
    result = {'before': sum(a for a, _ in counts), 'after': sum(b for _, b in counts)}
    print('Lossless GLB compaction:', result)
    return result


if __name__ == '__main__':
    import sys
    compact_kit(sys.argv[1])
