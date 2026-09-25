"""Pack untextured GLBs using core glTF types, with no decoder or extension.

Rigid skin weights are exactly 0/1. Palette channels use normalized bytes
(maximum error 1/510). Positions, normals, topology and animation stay exact.
All alignment and buffer lengths are rebuilt; running twice is harmless.
"""
import json
import struct
from pathlib import Path


def pack_palette(path):
    path = Path(path)
    data = path.read_bytes()
    assert data[:4] == b'glTF'
    json_length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20+json_length])
    assert not gltf.get('images') and len(gltf['buffers']) == 1
    binary = data[28+json_length:]
    views = gltf['bufferViews']
    replace = {}
    remove = set()
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            attrs = primitive['attributes']
            uv = attrs.pop('TEXCOORD_0', None)
            if uv is not None:
                accessor = gltf['accessors'][uv]
                remove.add(accessor.pop('bufferView'))
                accessor.pop('byteOffset', None)
            for semantic in ['COLOR_0', 'WEIGHTS_0']:
                if semantic not in attrs:
                    continue
                accessor = gltf['accessors'][attrs[semantic]]
                if accessor['componentType'] != 5126:
                    continue
                vi = accessor['bufferView']
                view = views[vi]
                assert 'byteStride' not in view and not accessor.get('byteOffset', 0)
                components = int(accessor['type'][-1])
                count = accessor['count'] * components
                values = struct.unpack_from('<'+'f'*count, binary, view.get('byteOffset', 0))
                if semantic == 'WEIGHTS_0':
                    assert all(v in (0, 1) for v in values), 'Only exact rigid weights can be packed by this recipe.'
                replace[vi] = bytes(round(max(0, min(1, v))*255) for v in values)
                accessor['componentType'], accessor['normalized'] = 5121, True
    chunks = bytearray()
    rebuilt, mapping = [], {}
    for i, view in enumerate(views):
        if i in remove:
            continue
        mapping[i] = len(rebuilt)
        payload = replace.get(i, binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']])
        chunks.extend(b'\0' * (-len(chunks) % 4))
        rebuilt.append({**view, 'byteOffset': len(chunks), 'byteLength': len(payload)})
        chunks.extend(payload)
    for accessor in gltf['accessors']:
        if 'bufferView' in accessor:
            accessor['bufferView'] = mapping[accessor['bufferView']]
    gltf['bufferViews'] = rebuilt
    gltf['buffers'][0]['byteLength'] = len(chunks)
    chunks.extend(b'\0' * (-len(chunks) % 4))
    encoded = json.dumps(gltf, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    header = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(chunks))
    path.write_bytes(header+struct.pack('<II', len(encoded), 0x4e4f534a)+encoded+struct.pack('<II', len(chunks), 0x004e4942)+chunks)


if __name__ == '__main__':
    import sys
    for file in sys.argv[1:]:
        pack_palette(file)
