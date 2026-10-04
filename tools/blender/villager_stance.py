"""Villager-only authored foot articulation and stance after GLB compaction.

The Blender recipe still exports the original finite poses. Fresh source-part
membership identifies feet; packed channels add articulation and matched socket
displacement. No review artifact or prepatched binary is an authoring dependency.
"""
from __future__ import annotations

import bisect
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import time

TOLERANCE = 3e-6
MOVING_CLIPS = {"Walk", "Carry", "MatCarry"}
FOOT_PARTS = {"sandals", "sandals_foot", "sandals_strap"}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
FORMATS = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
MOVING = MOVING_CLIPS


def source_signature():
    folder = Path(__file__).resolve().parent
    return {name: hashlib.sha256((folder / name).read_bytes()).hexdigest()
            for name in ("characters.py", "kit_common.py", "rigging.py", "villager_stance.py")}


def decode_glb(data):
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    cursor, chunks = 12, {}
    while cursor < length:
        size, kind = struct.unpack_from("<II", data, cursor)
        cursor += 8
        assert kind not in chunks and size % 4 == 0 and cursor + size <= length
        chunks[kind] = data[cursor:cursor + size]
        cursor += size
    assert cursor == length and set(chunks) == {0x4E4F534A, 0x004E4942}
    gltf, binary = json.loads(chunks[0x4E4F534A]), chunks[0x004E4942]
    assert len(gltf["buffers"]) == 1 and "uri" not in gltf["buffers"][0]
    assert gltf["buffers"][0]["byteLength"] <= len(binary)
    return gltf, binary


def serialize(gltf, binary):
    gltf = copy.deepcopy(gltf)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    gltf["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(gltf, separators=(",", ":"), allow_nan=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    return (struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary))
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def capture_membership(parts, roles, seed):
    """Read this build's source meshes before joining; never classify by height."""
    assert seed == 31
    tagged = {obj.as_pointer(): (name, side) for name, side, obj in roles}
    assert len(tagged) == 8
    records = []
    for index, obj in enumerate(parts):
        tag = tagged.get(obj.as_pointer())
        name, side = tag if tag is not None else (obj.name, None)
        positions = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        converted = [[value.x, value.z, -value.y] for value in positions]
        bottom = set()
        if name == "sandals":
            for polygon in obj.data.polygons:
                normal = (obj.matrix_world.to_3x3() @ polygon.normal).normalized()
                if normal.z < -.999999:
                    bottom.update(polygon.vertices)
            assert bottom
        records.append({
            "id": f"part-{index}", "sourceName": name, "side": side,
            "sourceObjectName": obj.name, "sourceCreationIndex": index,
            "gltfRestPositions": converted,
            "sourcePolygons": [list(polygon.vertices) for polygon in obj.data.polygons],
            "bottomRestPositions": [converted[i] for i in sorted(bottom)],
        })
    assert set(tagged) <= {obj.as_pointer() for obj in parts}
    assert {(row["sourceName"], row["side"]) for row in records if row["side"]} == {
        (name, side) for name in (*sorted(FOOT_PARTS), "lower_leg")
        for side in ("left", "right")}
    return {
        "actor": "villager", "seed": seed,
        "classification": "original source part membership; no height classification",
        "coordinateMapping": "source (x,y,z) -> glTF (x,z,-y)",
        "sourceSha256": source_signature(),
        "parts": records,
    }


def accessor(gltf, binary, index, normalized=True):
    item = gltf["accessors"][index]
    assert "sparse" not in item and "bufferView" in item
    view = gltf["bufferViews"][item["bufferView"]]
    assert view["buffer"] == 0
    width = WIDTH[item["type"]]
    form = FORMATS[item["componentType"]]
    size = struct.calcsize("<" + form * width)
    stride = view.get("byteStride", size)
    start = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    values = [list(struct.unpack_from("<" + form * width, binary, start + i * stride))
              for i in range(item["count"])]
    if normalized and item.get("normalized"):
        component = item["componentType"]
        maximum = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[component]
        values = [[max(-1, value / maximum) for value in row] for row in values]
    return values


def identity():
    return [[float(i == j) for j in range(4)] for i in range(4)]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)]
            for i in range(4)]


def inverse(a):
    # General affine inversion preserves the original small exporter scale terms.
    rows = [list(row) + identity()[i] for i, row in enumerate(a)]
    for column in range(4):
        pivot = max(range(column, 4), key=lambda i: abs(rows[i][column]))
        assert abs(rows[pivot][column]) > 1e-12
        rows[column], rows[pivot] = rows[pivot], rows[column]
        denominator = rows[column][column]
        rows[column] = [value / denominator for value in rows[column]]
        for i in range(4):
            if i == column:
                continue
            factor = rows[i][column]
            rows[i] = [a - factor * b for a, b in zip(rows[i], rows[column])]
    return [row[4:] for row in rows]


def point(matrix, value):
    return [sum(matrix[i][j] * value[j] for j in range(3)) + matrix[i][3]
            for i in range(3)]


def from_column_major(values):
    return [[values[column * 4 + row] for column in range(4)] for row in range(4)]


def column_major(matrix):
    return [matrix[row][column] for column in range(4) for row in range(4)]


def normalize_quaternion(q):
    length = math.sqrt(sum(value * value for value in q))
    assert length > 1e-12
    return [value / length for value in q]


def trs(node):
    if "matrix" in node:
        return from_column_major(node["matrix"])
    x, y, z, w = normalize_quaternion(node.get("rotation", [0, 0, 0, 1]))
    sx, sy, sz = node.get("scale", [1, 1, 1])
    tx, ty, tz = node.get("translation", [0, 0, 0])
    return [
        [(1 - 2 * (y*y + z*z))*sx, 2*(x*y-z*w)*sy, 2*(x*z+y*w)*sz, tx],
        [2*(x*y+z*w)*sx, (1-2*(x*x+z*z))*sy, 2*(y*z-x*w)*sz, ty],
        [2*(x*z-y*w)*sx, 2*(y*z+x*w)*sy, (1-2*(x*x+y*y))*sz, tz],
        [0, 0, 0, 1],
    ]


def translation(value):
    matrix = identity()
    for i in range(3):
        matrix[i][3] = value[i]
    return matrix


def rotation_quaternion(matrix):
    # Require a rigid matrix instead of silently removing significant shear/scale.
    columns = [[matrix[i][j] for i in range(3)] for j in range(3)]
    lengths = [math.sqrt(sum(v*v for v in column)) for column in columns]
    assert max(abs(value - 1) for value in lengths) < 1e-5
    assert max(abs(sum(columns[i][k] * columns[j][k] for k in range(3)))
               for i in range(3) for j in range(i)) < 1e-5
    r = [[matrix[i][j] / lengths[j] for j in range(3)] for i in range(3)]
    trace = sum(r[i][i] for i in range(3))
    if trace > 0:
        s = math.sqrt(trace + 1) * 2
        q = [(r[2][1]-r[1][2])/s, (r[0][2]-r[2][0])/s,
             (r[1][0]-r[0][1])/s, s/4]
    else:
        i = max(range(3), key=lambda n: r[n][n])
        j, k = (i+1) % 3, (i+2) % 3
        s = math.sqrt(1 + r[i][i] - r[j][j] - r[k][k]) * 2
        q = [0, 0, 0, (r[k][j] - r[j][k]) / s]
        q[i], q[j], q[k] = s/4, (r[j][i]+r[i][j])/s, (r[k][i]+r[i][k])/s
    return normalize_quaternion(q)


def slerp(a, b, amount):
    a, b = normalize_quaternion(a), normalize_quaternion(b)
    dot = sum(x*y for x, y in zip(a, b))
    if dot < 0:
        b, dot = [-value for value in b], -dot
    dot = min(1, max(-1, dot))
    if dot > .9995:
        return normalize_quaternion([(1-amount)*x + amount*y for x, y in zip(a, b)])
    angle = math.acos(dot)
    a_weight = math.sin((1-amount)*angle) / math.sin(angle)
    b_weight = math.sin(amount*angle) / math.sin(angle)
    return [a_weight*x + b_weight*y for x, y in zip(a, b)]


def posed_nodes(gltf, binary, animation=None, time=0):
    nodes = copy.deepcopy(gltf["nodes"])
    if animation is not None:
        for channel in animation["channels"]:
            sampler = animation["samplers"][channel["sampler"]]
            interpolation = sampler.get("interpolation", "LINEAR")
            assert interpolation in ("LINEAR","STEP"), "unsupported original sampler interpolation"
            times = [row[0] for row in accessor(gltf, binary, sampler["input"])]
            values = accessor(gltf, binary, sampler["output"])
            assert len(times) == len(values) and all(a < b for a, b in zip(times, times[1:]))
            high = bisect.bisect_right(times, time)
            if high == 0:
                value = values[0]
            elif high == len(times):
                value = values[-1]
            elif interpolation == "STEP":
                value = values[high-1]
            else:
                low = high-1
                amount = (time-times[low]) / (times[high]-times[low])
                value = (slerp(values[low], values[high], amount)
                         if channel["target"]["path"] == "rotation"
                         else [(1-amount)*a + amount*b for a, b in zip(values[low], values[high])])
            nodes[channel["target"]["node"]][channel["target"]["path"]] = value
    parents = {}
    for i, node in enumerate(nodes):
        for child in node.get("children", []):
            assert child not in parents
            parents[child] = i
    world = {}

    def visit(i):
        if i not in world:
            local = trs(nodes[i])
            world[i] = multiply(visit(parents[i]), local) if i in parents else local
        return world[i]

    for i in range(len(nodes)):
        visit(i)
    return world


def append_accessor(gltf, binary, rows, kind, component=5126, normalized=False):
    binary.extend(b"\0" * (-len(binary) % 4))
    start = len(binary)
    form = FORMATS[component]
    flat = [value for row in rows for value in row]
    binary.extend(struct.pack("<" + form * len(flat), *flat))
    view = len(gltf["bufferViews"])
    gltf["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": len(binary)-start})
    item = {"bufferView": view, "componentType": component, "count": len(rows), "type": kind}
    if normalized:
        item["normalized"] = True
    index = len(gltf["accessors"])
    gltf["accessors"].append(item)
    return index


def master_timeline(gltf, binary, animation):
    timelines = [(sampler["input"],[row[0] for row in accessor(gltf,binary,sampler["input"])])
                 for sampler in animation["samplers"]]
    index,times = max(timelines,key=lambda item:len(item[1]))
    assert times and all(a<b for a,b in zip(times,times[1:]))
    supported = set(times)
    for _,original_times in timelines:
        assert original_times and original_times[0]==times[0] and original_times[-1]==times[-1]
        assert set(original_times)<=supported, "original timeline is not an endpoint-compatible subset"
    return index,times


def membership(gltf, binary, ledger):
    assert ledger["actor"] == "villager" and ledger["seed"] == 31
    assert ledger["classification"] == "original source part membership; no height classification"
    primitives = gltf["meshes"][0]["primitives"]
    assert len(primitives) == 1 and "targets" not in primitives[0]
    positions = accessor(gltf, binary, primitives[0]["attributes"]["POSITION"])
    skin_node = next(i for i, node in enumerate(gltf["nodes"]) if node.get("skin") == 0)
    mesh_world = posed_nodes(gltf, binary)[skin_node]
    parts = ledger["parts"]
    assert {(p["sourceName"], p["side"]) for p in parts if p["sourceName"] in FOOT_PARTS} == {
        (name, side) for name in FOOT_PARTS for side in ("left", "right")}
    result, coverage = {}, {p["id"]: set() for p in parts if p["sourceName"] in FOOT_PARTS}
    for i, position in enumerate(positions):
        position = point(mesh_world, position)
        matches = []
        for part in parts:
            source_matches = [j for j, source in enumerate(part["gltfRestPositions"])
                              if max(abs(a-b) for a, b in zip(source, position)) <= TOLERANCE]
            if source_matches:
                matches.append((part, source_matches))
        feet = [(p, indices) for p, indices in matches if p["sourceName"] in FOOT_PARTS]
        if not feet:
            continue
        assert len(matches) == 1, f"ambiguous source membership at GLB vertex {i}"
        part, source_indices = feet[0]
        coverage[part["id"]].update(source_indices)
        result[i] = {"side": part["side"], "part": part["id"], "sourceName": part["sourceName"]}
    for part in parts:
        if part["sourceName"] in FOOT_PARTS:
            assert coverage[part["id"]] == set(range(len(part["gltfRestPositions"]))), (
                f"incomplete source component {part['id']}")
    assert len(result) == 576, 'source foot vertex count changed'
    return result


def rigid_geometry(gltf, binary):
    primitive = gltf["meshes"][0]["primitives"][0]
    skin = gltf["skins"][0]
    attributes = primitive["attributes"]
    positions = accessor(gltf, binary, attributes["POSITION"])
    joints = accessor(gltf, binary, attributes["JOINTS_0"], normalized=False)
    weights = accessor(gltf, binary, attributes["WEIGHTS_0"])
    slots = []
    for row in weights:
        assert sum(weight != 0 for weight in row) == 1 and max(row) == 1
        slots.append(row.index(1))
    return {"positions":positions,"joints":[row[slot] for row,slot in zip(joints,slots)],
            "nodes":skin["joints"],"ibm":[from_column_major(row) for row in accessor(gltf,binary,skin["inverseBindMatrices"])]}


def skin_points(gltf, binary, geometry, animation, phase):
    world = posed_nodes(gltf, binary, animation, phase)
    matrices = [multiply(world[node], ibm) for node, ibm in zip(geometry["nodes"],geometry["ibm"])]
    return [point(matrices[joint],position) for joint,position in zip(geometry["joints"],geometry["positions"])], world


def articulate(original, old_binary, ledger, deadline):
    require_time(deadline)
    assert len(original["skins"]) == len(original["meshes"]) == 1
    assert len(original["skins"][0]["joints"]) == 14, "expected unmodified bench rig"
    assert len(original["animations"]) == 20
    assert len({animation["name"] for animation in original["animations"]}) == 20
    gltf, binary = copy.deepcopy(original), bytearray(old_binary)
    assignments = membership(original, old_binary, ledger)
    assert len(gltf["skins"]) == 1 and len(gltf["meshes"]) == 1
    skin = gltf["skins"][0]
    names = {node["name"]:i for i, node in enumerate(gltf["nodes"])}
    assert len(names) == len(gltf["nodes"]) and not any("foot_" in name for name in names)
    root = names["root"]
    rest = posed_nodes(original, old_binary)
    joint_map = {node:i for i, node in enumerate(skin["joints"])}
    ibm = accessor(original, old_binary, skin["inverseBindMatrices"])
    old_ibm_count = len(ibm)
    foot = {}
    for side, x in (("left", -.13), ("right", .13)):
        leg = names["leg_" + side]
        # Source Z-up/front -Y -> glTF Y-up/front +Z, using source leg tail.
        pivot = point(inverse(rest[leg]), [x, .08, .03])
        node_index = len(gltf["nodes"])
        gltf["nodes"].append({"name":"foot_"+side, "translation":pivot})
        gltf["nodes"][leg].setdefault("children", []).append(node_index)
        index = len(skin["joints"])
        skin["joints"].append(node_index)
        ibm.append(column_major(multiply(inverse(translation(pivot)),
                                        from_column_major(ibm[joint_map[leg]]))))
        foot[side] = {"node":node_index,"joint":index,"leg":leg,"pivot":pivot,
                      "restRotation":"identity child; inherits original leg basis",
                      "inverseBindRule":"inverse(Tpivot) * original leg inverse bind"}
    skin["inverseBindMatrices"] = append_accessor(gltf, binary, ibm, "MAT4")
    primitive = gltf["meshes"][0]["primitives"][0]
    old_joint_accessor = original["meshes"][0]["primitives"][0]["attributes"]["JOINTS_0"]
    joint_rows = accessor(original, old_binary, old_joint_accessor, normalized=False)
    weights = accessor(original, old_binary, primitive["attributes"]["WEIGHTS_0"])
    for vertex, entry in assignments.items():
        slots = [slot for slot, weight in enumerate(weights[vertex]) if weight != 0]
        assert len(slots) == 1 and weights[vertex][slots[0]] == 1
        side = entry["side"]
        assert joint_rows[vertex][slots[0]] == joint_map[foot[side]["leg"]]
        joint_rows[vertex][slots[0]] = foot[side]["joint"]
    old_joint_info = original["accessors"][old_joint_accessor]
    assert old_joint_info["componentType"] in (5121, 5123)
    primitive["attributes"]["JOINTS_0"] = append_accessor(
        gltf, binary, joint_rows, "VEC4", old_joint_info["componentType"])
    chosen_timelines = {}
    for old_animation, animation in zip(original["animations"], gltf["animations"]):
        require_time(deadline)
        old_times_index,times = master_timeline(original,old_binary,old_animation)
        chosen_timelines[animation["name"]] = {"existingInputAccessor":old_times_index,"count":len(times),
                                               "first":times[0],"last":times[-1]}
        moving = animation["name"] in MOVING_CLIPS
        if moving:
            assert len(times) == 25
            assert abs(times[0]-1/30) < 1e-7 and abs(times[-1]-25/30) < 1e-7
        values = {side:[] for side in foot}
        for time in times:
            require_time(deadline)
            world = posed_nodes(original, old_binary, old_animation, time) if moving else None
            for side, info in foot.items():
                if moving:
                    # Desired orientation: sampled root deformation × original leg rest basis.
                    desired = multiply(multiply(world[root], inverse(rest[root])), rest[info["leg"]])
                    basis = multiply(inverse(world[info["leg"]]), desired)
                    q = rotation_quaternion(basis)
                else:
                    q = [0, 0, 0, 1]
                if values[side] and sum(a*b for a, b in zip(values[side][-1], q)) < 0:
                    q = [-v for v in q]
                values[side].append(q)
        for side, rows in values.items():
            output = append_accessor(gltf, binary, rows, "VEC4")
            sampler = len(animation["samplers"])
            animation["samplers"].append({"input":old_times_index,"output":output,"interpolation":"LINEAR"})
            animation["channels"].append({"sampler":sampler,"target":{"node":foot[side]["node"],"path":"rotation"}})
    # Every original accessor/channel remains bitwise/logically unchanged. Added
    # matrices/joints/channels append data; no original binary byte is rewritten.
    assert bytes(binary[:len(old_binary)]) == old_binary
    assert gltf["accessors"][:len(original["accessors"])] == original["accessors"]
    assert gltf["bufferViews"][:len(original["bufferViews"])] == original["bufferViews"]
    assert gltf["materials"] == original["materials"]
    for old, new in zip(original["animations"], gltf["animations"]):
        assert new["channels"][:-2] == old["channels"]
        assert new["samplers"][:-2] == old["samplers"]
    assert skin["joints"][:-2] == original["skins"][0]["joints"]
    assert ibm[:old_ibm_count] == accessor(original, old_binary, original["skins"][0]["inverseBindMatrices"])
    for i, old in enumerate(original["nodes"]):
        expected_node = copy.deepcopy(old)
        for info in foot.values():
            if i == info["leg"]:
                expected_node.setdefault("children", []).append(info["node"])
        assert gltf["nodes"][i] == expected_node
    return gltf, binary, assignments


def require_time(deadline):
    if time.monotonic() >= deadline:
        raise TimeoutError("combined authored-stance diagnostic cap reached")


def parents_and_descendants(gltf, root):
    parents = {}
    for parent, node in enumerate(gltf["nodes"]):
        for child in node.get("children", []):
            assert child not in parents, "unexpected multiple node parents"
            parents[child] = parent
    descendants, pending = set(), [root]
    while pending:
        node = pending.pop()
        assert node not in descendants, "unexpected node cycle"
        descendants.add(node)
        pending.extend(gltf["nodes"][node].get("children", []))
    return parents, descendants


def local_delta(parent_world, world_y):
    # Difference of transformed points removes inverse affine translation.
    matrix = inverse(parent_world)
    zero, raised = point(matrix, [0, 0, 0]), point(matrix, [0, world_y, 0])
    return [a-b for a, b in zip(raised, zero)]


def propose_channels(gltf, binary, ledger, deadline):
    require_time(deadline)
    assert len(gltf["meshes"]) == len(gltf["skins"]) == 1
    assert len(gltf["skins"][0]["joints"]) == 16
    names = {node["name"]:index for index, node in enumerate(gltf["nodes"])}
    assert len(names) == len(gltf["nodes"])
    # Use the exact name captured by this export, never a suffix guess.
    root, socket = names["root"], names[ledger["socketName"]]
    parents, descendants = parents_and_descendants(gltf, root)
    assert root in parents and socket in parents
    assert parents[root] == parents[socket], "root/socket common parent changed"
    assert set(gltf["skins"][0]["joints"]) <= descendants
    assert socket not in descendants, "socket mapping differs from owned source"
    assert not gltf["nodes"][socket].get("children"), "unexpected packed socket descendants"
    assert "matrix" not in gltf["nodes"][root]
    assert "matrix" not in gltf["nodes"][socket]
    assert set(MOVING) <= {animation["name"] for animation in gltf["animations"]}
    assert len(gltf["animations"]) == 20
    assert len({animation["name"] for animation in gltf["animations"]}) == 20
    rest = posed_nodes(gltf, binary)
    geometry = rigid_geometry(gltf, binary)
    assert len(geometry["positions"]) == 3112
    joint_names = [gltf["nodes"][node]["name"] for node in geometry["nodes"]]
    lower = [i for i, joint in enumerate(geometry["joints"])
             if joint_names[joint] in {"leg_left", "leg_right", "foot_left", "foot_right"}]
    assert all(sum(joint_names[joint] == "foot_"+side for joint in geometry["joints"]) == 288
               for side in ("left", "right"))
    assert lower and len(lower) > 576
    result, packed = copy.deepcopy(gltf), bytearray(binary)
    report = {"status":"in-memory-proposal-only", "datums":{}, "changes":[],
              "exportedNodes":{"root":root, "socket":socket, "socketName":ledger["socketName"], "commonParent":parents[root]},
              "allowlist":"3 root output references; 20 appended socket channels",
              "notAccepted":["serialization", "full-phase-floor", "seams", "pitch", "Actor", "visual"]}
    for index, original in enumerate(gltf["animations"]):
        require_time(deadline)
        animation = result["animations"][index]
        input_index, times = master_timeline(gltf, binary, original)
        assert not any(channel["target"]["node"] == socket for channel in original["channels"]), \
            "unexpected original socket animation; do not override it"
        datum = 0.
        if original["name"] in MOVING:
            assert len(times) == 25
            assert abs(times[0]-1/30) < 1e-7 and abs(times[-1]-25/30) < 1e-7
            points, _ = skin_points(gltf, binary, geometry, original, 0.)
            minimum = min(points[vertex][1] for vertex in lower)
            assert math.isfinite(minimum)
            datum = max(0., -minimum)
            # Preserve the reviewed authored datum. Reject a changed source pose
            # instead of automatically padding an unrelated regenerated rig.
            assert abs(datum-.035) <= .000002
            targets = [channel for channel in original["channels"]
                       if channel["target"] == {"node":root, "path":"translation"}]
            assert len(targets) == 1
            sampler_index = targets[0]["sampler"]
            assert sum(channel["sampler"] == sampler_index for channel in original["channels"]) == 1
            sampler = original["samplers"][sampler_index]
            assert sampler.get("interpolation", "LINEAR") in ("LINEAR", "STEP")
            assert gltf["accessors"][sampler["output"]]["type"] == "VEC3"
            delta = local_delta(rest[parents[root]] if root in parents else identity(), datum)
            rows = [[value+delta[axis] for axis, value in enumerate(row)]
                    for row in accessor(gltf, binary, sampler["output"])]
            output = append_accessor(result, packed, rows, "VEC3")
            animation["samplers"][sampler_index]["output"] = output
            report["datums"][original["name"]] = {"rawFrameZeroMinimum":minimum,
                "constantWorldY":datum, "rootLocalDelta":delta,
                "sourceInput":sampler["input"], "sourceOutput":sampler["output"],
                "preservedInterpolation":sampler.get("interpolation", "LINEAR")}
            report["changes"].append({"clip":original["name"], "rootSampler":sampler_index,
                                      "oldOutput":sampler["output"], "newOutput":output})
        # Root/socket parents must be static at every existing timeline sample.
        # The future dense audit repeats this guard at every requested interior.
        for phase in [0., *times]:
            require_time(deadline)
            world = posed_nodes(gltf, binary, original, phase)
            for node in (root, socket):
                if node in parents:
                    parent = parents[node]
                    assert max(abs(world[parent][r][c]-rest[parent][r][c])
                               for r in range(4) for c in range(4)) <= 1e-12
        delta = local_delta(rest[parents[socket]] if socket in parents else identity(), datum)
        neutral = gltf["nodes"][socket].get("translation", [0., 0., 0.])
        socket_row = [value+delta[axis] for axis, value in enumerate(neutral)]
        output = append_accessor(result, packed, [socket_row[:] for _ in times], "VEC3")
        sampler = len(animation["samplers"])
        animation["samplers"].append({"input":input_index, "output":output, "interpolation":"LINEAR"})
        animation["channels"].append({"sampler":sampler, "target":{"node":socket, "path":"translation"}})
        report["changes"].append({"clip":original["name"], "socketSampler":sampler,
                                  "neutralReset":original["name"] not in MOVING,
                                  "socketLocalDelta":delta})
    assert bytes(packed[:len(binary)]) == binary
    assert result["nodes"] == gltf["nodes"]
    assert result["skins"] == gltf["skins"]
    assert result["meshes"] == gltf["meshes"]
    assert result["accessors"][:len(gltf["accessors"])] == gltf["accessors"]
    assert result["bufferViews"][:len(gltf["bufferViews"])] == gltf["bufferViews"]
    assert result["materials"] == gltf["materials"]
    for before, after in zip(gltf["animations"], result["animations"]):
        assert after["channels"][:-1] == before["channels"]
        for sampler_index, (a, b) in enumerate(zip(before["samplers"], after["samplers"])):
            permitted = before["name"] in MOVING and any(
                channel["sampler"] == sampler_index and channel["target"] == {"node":root,"path":"translation"}
                for channel in before["channels"])
            assert {key:value for key,value in a.items() if key != "output"} == \
                   {key:value for key,value in b.items() if key != "output"}
            assert permitted or a["output"] == b["output"]
    require_time(deadline)
    return result, packed, report

def validate_components(gltf, binary, ledger, assignments, deadline):
    """Require full source coverage, leg/foot ownership and real sole identities."""
    require_time(deadline)
    assert len(gltf["meshes"]) == len(gltf["skins"]) == 1
    primitive = gltf["meshes"][0]["primitives"][0]
    assert len(gltf["meshes"][0]["primitives"]) == 1
    assert "targets" not in primitive and primitive.get("mode", 4) == 4
    weights = accessor(gltf, binary, primitive["attributes"]["WEIGHTS_0"])
    assert all(row == [1., 0., 0., 0.] for row in weights)
    geometry = rigid_geometry(gltf, binary)
    assert len(geometry["positions"]) == 3112 and len(geometry["nodes"]) == 16
    names = [gltf["nodes"][node]["name"] for node in geometry["nodes"]]
    assert len(set(names)) == 16
    assert membership(gltf, binary, ledger) == assignments
    mesh_nodes = [i for i, node in enumerate(gltf["nodes"]) if node.get("skin") == 0]
    assert len(mesh_nodes) == 1
    rest = posed_nodes(gltf, binary)
    positions = [point(rest[mesh_nodes[0]], value) for value in geometry["positions"]]
    seen = set()
    for part in ledger["parts"]:
        if part["sourceName"] not in FOOT_PARTS | {"lower_leg"}:
            continue
        require_time(deadline)
        role = part["sourceName"], part["side"]
        assert role not in seen
        seen.add(role)
        joint = ("leg_" if part["sourceName"] == "lower_leg" else "foot_") + part["side"]
        groups = []
        for source in part["gltfRestPositions"]:
            matches = [i for i, position in enumerate(positions)
                       if max(abs(a - b) for a, b in zip(source, position)) <= TOLERANCE]
            assert matches and all(names[geometry["joints"][i]] == joint for i in matches)
            groups.append(matches)
        indices = {i for group in groups for i in group}
        if part["sourceName"] == "lower_leg":
            assert len(indices) == 36
        else:
            assert len(indices) == 96
            assert all(assignments[i]["part"] == part["id"] for i in indices)
        if part["sourceName"] == "sandals":
            bottom = {i for i, source in enumerate(part["gltfRestPositions"])
                      if any(max(abs(a - b) for a, b in zip(source, original)) <= TOLERANCE
                             for original in part["bottomRestPositions"])}
            assert bottom and any(set(polygon) <= bottom for polygon in part["sourcePolygons"])
            assert len({i for source in bottom for i in groups[source]}) == 16
    assert seen == {(name, side) for name in FOOT_PARTS | {"lower_leg"}
                    for side in ("left", "right")}
    for side in ("left", "right"):
        assert sum(names[joint] == "foot_" + side for joint in geometry["joints"]) == 288
        assert sum(names[joint] in {"foot_" + side, "leg_" + side}
                   for joint in geometry["joints"]) == 324


def finalize_villager(path, ledger):
    """Apply once to a compacted legacy villager; preserve a failed temporary file."""
    deadline = time.monotonic() + 60
    path = Path(path)
    assert path.name == "villager.glb" and path.is_file()
    assert ledger["sourceSha256"] == source_signature(), "authoring source changed"
    before_bytes = path.read_bytes()
    before, before_binary = decode_glb(before_bytes)
    assert isinstance(ledger["socketName"], str) and ledger["socketName"]
    raw, raw_binary, assignments = articulate(before, before_binary, ledger, deadline)
    # Match the reviewed two serialized stages, including Float32 output payloads.
    raw_bytes = serialize(raw, raw_binary)
    raw, raw_binary = decode_glb(raw_bytes)
    validate_components(raw, raw_binary, ledger, assignments, deadline)
    after, after_binary, changes = propose_channels(raw, raw_binary, ledger, deadline)
    result = serialize(after, after_binary)
    decoded, packed = decode_glb(result)
    validate_components(decoded, packed, ledger, assignments, deadline)
    assert packed[:len(before_binary)] == before_binary
    assert decoded["materials"] == before["materials"]
    assert decoded["accessors"][:len(before["accessors"])] == before["accessors"]
    assert decoded["bufferViews"][:len(before["bufferViews"])] == before["bufferViews"]
    names = {node["name"]: i for i, node in enumerate(decoded["nodes"])}
    socket = names[ledger["socketName"]]
    for old, new in zip(before["animations"], decoded["animations"]):
        assert new["channels"][:-3] == old["channels"]
        # Finite root outputs and every legacy non-root sampler are exact.
        for i, sampler in enumerate(old["samplers"]):
            updated = new["samplers"][i]
            permitted = old["name"] in MOVING and any(
                channel["sampler"] == i and
                channel["target"] == {"node": names["root"], "path": "translation"}
                for channel in old["channels"])
            assert {k: v for k, v in sampler.items() if k != "output"} == {
                k: v for k, v in updated.items() if k != "output"}
            assert permitted or sampler["output"] == updated["output"]
        if old["name"] not in MOVING:
            for channel in new["channels"][-3:-1]:
                sampler = new["samplers"][channel["sampler"]]
                assert all(row == [0., 0., 0., 1.]
                           for row in accessor(decoded, packed, sampler["output"]))
            channel = new["channels"][-1]
            assert channel["target"] == {"node": socket, "path": "translation"}
            neutral = decoded["nodes"][socket].get("translation", [0., 0., 0.])
            neutral = list(struct.unpack("<fff", struct.pack("<fff", *neutral)))
            assert all(row == neutral for row in accessor(
                decoded, packed, new["samplers"][channel["sampler"]]["output"]))
    require_time(deadline)
    assert ledger["sourceSha256"] == source_signature(), "authoring source changed during finalization"
    assert path.read_bytes() == before_bytes, "villager input changed during finalization"
    require_time(deadline)
    temporary = path.with_suffix(".stance16.tmp")
    with temporary.open("xb") as output:
        output.write(result)
    temporary.replace(path)
    return {
        "actor": "villager", "joints": 16, "footVertices": len(assignments),
        "baselineBytes": len(before_bytes), "bytes": len(result),
        "baselineSha256": hashlib.sha256(before_bytes).hexdigest(),
        "sha256": hashlib.sha256(result).hexdigest(),
        "socketName": ledger["socketName"], "channels": changes,
    }
