"""Shared original character rig and deterministic game clips.

Mesh parts are rigidly weighted to bones to retain the established chunky style.
The armature supports independent elbows, hips, knees, head and body poses.
"""
import bpy
import math
import os
from shading import bake_vertex_shading

CLIPS = {
    "Idle": 90, "Walk": 24, "Carry": 24, "Gesture": 60,
    "Sit": 60, "Row": 36, "Haul": 40, "Kneel": 60, "Recline": 60, "Rise": 60, "MatCarry": 24, "Use": 60,
    "PickUp": 36, "PutDown": 36, "Repair": 60, "SitDown": 72,
    "SitUp": 60, "FrameCarry": 60, "TouchFrame": 60,
    "Greet": 42, "Listen": 96, "Respond": 72,
}

def export_character(name, parts, scene, output, grid_index):
    bpy.ops.object.select_all(action="DESELECT")
    arm_data = bpy.data.armatures.new(name + "_skeleton")
    rig = bpy.data.objects.new(name + "_rig", arm_data)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = [
        ("root", (0, 0, 0), (0, 0, .20), None),
        ("body", (0, 0, .85), (0, 0, 1.35), "root"),
        ("robe", (0, 0, .90), (0, 0, .30), "body"),
        ("head", (0, 0, 1.40), (0, 0, 1.84), "body"),
    ]
    for side, x in [("left", -.13), ("right", .13)]:
        sign = -1 if side == "left" else 1
        bones.extend([
            ("arm_" + side, (sign*.24, 0, 1.30), (sign*.31, 0, .98), "body"),
            ("forearm_" + side, (sign*.31, 0, .98), (sign*.31, -.045, .75), "arm_" + side),
            ("thigh_" + side, (x, 0, .85), (x, 0, .43), "root"),
            ("leg_" + side, (x, 0, .43), (x, -.03, .08), "thigh_" + side),
        ])
    for bone_name, head, tail, parent in bones:
        bone = arm_data.edit_bones.new(bone_name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    # Bake each part into a bone-local vertex group, then join to a single skin.
    for obj in parts:
        side = "left" if obj.location.x < 0 else "right"
        if obj.name.startswith(("head", "hair", "nose", "beard", "neck")):
            bone = "head"
        elif obj.name.startswith("sleeve"):
            bone = "arm_" + side
        elif obj.name.startswith(("forearm", "hand")):
            bone = "forearm_" + side
        elif obj.name.startswith("sandals"):
            bone = "leg_" + side
        elif obj.name.startswith("lower_leg"):
            bone = "leg_" + side
        else:
            bone = "body"
        if obj.name.startswith(("head_cover_veil", "head_scarf_tail")):
            # Veils follow the head above the collar and the shoulders below it.
            for group_name in ("head", "body"):
                indices = [v.index for v in obj.data.vertices
                           if ((obj.matrix_world @ v.co).z >= 1.42) == (group_name == "head")]
                if indices:
                    obj.vertex_groups.new(name=group_name).add(indices, 1, "REPLACE")
        elif obj.name.startswith(("robe", "draped_wrap", "apron", "mantle_back")):
            # The hem folds from the waist, keeping the upper tunic attached to the torso.
            for group_name in ("body", "robe"):
                indices = [v.index for v in obj.data.vertices
                           if ((obj.matrix_world @ v.co).z >= .9) == (group_name == "body")]
                if indices:
                    obj.vertex_groups.new(name=group_name).add(indices, 1, "REPLACE")
        else:
            group = obj.vertex_groups.new(name=bone)
            group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    skin = bpy.context.object
    skin.name = name + "_skin"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    skin.parent = rig
    # One palette primitive per skin keeps crowds affordable. Preserve all
    # corner colors before collapsing material slots, including facial accents.
    colors = skin.data.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    for poly in skin.data.polygons:
        color = skin.data.materials[poly.material_index].diffuse_color
        for loop in poly.loop_indices:
            colors.data[loop].color = color
        poly.material_index = 0
    skin.data.materials.clear()
    palette = bpy.data.materials.get("Way character palette")
    if palette is None:
        palette = bpy.data.materials.new("Way character palette")
        palette.use_nodes = True
        shader = next(n for n in palette.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        shader.inputs["Roughness"].default_value = .95
        vertex = palette.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex.layer_name = "Color"
        palette.node_tree.links.new(vertex.outputs["Color"], shader.inputs["Base Color"])
    skin.data.materials.append(palette)
    # RFC-011: occlusion under the chin, arms and hem, baked in the shared rest pose.
    bake_vertex_shading(skin, name, reach=.3, strength=.5, jitter=.02)
    modifier = skin.modifiers.new("Shared character skeleton", "ARMATURE")
    modifier.object = rig
    # Carry point is a deliberately stable root-space grip for two-handed baskets.
    socket = bpy.data.objects.new("carry_socket", None)
    scene.collection.objects.link(socket)
    socket.parent = rig
    socket.location = (0, -.48, .80)
    socket.empty_display_size = .08
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"

    def pose(clip, phase):
        for bone in rig.pose.bones:
            bone.rotation_euler = (0, 0, 0)
            bone.location = (0, 0, 0)
            bone.scale = (1, 1, 1)
        p = rig.pose.bones
        wave = math.sin(phase * math.tau)
        if clip in ("Idle", "Gesture"):
            # Breathing, a slow weight shift and an occasional glance.
            breath = math.sin(phase*math.tau)
            p["body"].rotation_euler.x = breath*.014
            p["root"].rotation_euler.z = math.sin(phase*math.tau + 1.1)*.012
            p["body"].rotation_euler.z = -math.sin(phase*math.tau + 1.1)*.016
            p["head"].rotation_euler.y = math.sin(phase*math.tau*2)*.035 if clip == "Idle" else breath*.025
            p["head"].rotation_euler.x = -breath*.012
            for side, sign in [("left", 1), ("right", -1)]:
                p["arm_" + side].rotation_euler.y = sign*.05
                p["arm_" + side].rotation_euler.x = -.035 - breath*.012
                p["forearm_" + side].rotation_euler.x = -.12
        if clip in ("Walk", "Carry", "MatCarry"):
            # Heel strike, passing and push-off: hips twist and bob, shoulders counter.
            stride = .36 if clip == "Walk" else .27
            # Lowest at heel strike (legs spread), highest at passing (leg vertical).
            p["root"].location.y = -.04*(1 - abs(wave))
            p["root"].rotation_euler.y = wave*.07
            p["body"].rotation_euler.y = -wave*.11
            p["body"].rotation_euler.x = -.035
            p["head"].rotation_euler.y = wave*.05
            p["root"].rotation_euler.z = math.sin(phase*math.tau*2)*.015
            for side, sign in [("left", 1), ("right", -1)]:
                swing = sign*wave
                p["thigh_" + side].rotation_euler.x = swing*stride
                lift = math.sin(phase*math.tau + (0 if sign > 0 else math.pi) - .9)
                p["leg_" + side].rotation_euler.x = max(0, lift)*.55
                p["arm_" + side].rotation_euler.x = -swing*.34
                p["arm_" + side].rotation_euler.y = sign*.04
                p["forearm_" + side].rotation_euler.x = -.18 - max(0, -swing)*.22
        if clip in ("Carry", "MatCarry", "Use"):
            for side in ("left", "right"):
                p["arm_" + side].rotation_euler.x = -.55
                p["forearm_" + side].rotation_euler.x = -.72
        if clip == "Gesture":
            # An open, teaching hand that rises, pauses and turns outward.
            lift = .5 - .5*math.cos(phase*math.tau)
            p["arm_right"].rotation_euler.x = -.55 - .22*lift
            p["arm_right"].rotation_euler.z = -.12*lift
            p["forearm_right"].rotation_euler.x = -.7 - .1*lift
            p["forearm_right"].rotation_euler.y = .35*lift
            p["arm_left"].rotation_euler.x = -.18*lift
            p["body"].rotation_euler.y = .05*lift
            p["head"].rotation_euler.z = .06
            p["head"].rotation_euler.x = -.03*lift
        if clip == "Greet":
            # A small bow with the right hand to the chest, then an open palm.
            reach = math.sin(math.pi * phase) ** 2
            bow = math.sin(math.pi * min(1, phase*1.6)) ** 2
            p["body"].rotation_euler.x = -.14 * bow
            p["head"].rotation_euler.x = -.12 * bow
            p["arm_right"].rotation_euler.x = -.82 * reach
            p["arm_right"].rotation_euler.z = -.18 * reach
            p["forearm_right"].rotation_euler.x = -.75 * reach
            p["forearm_right"].rotation_euler.y = .3 * reach
        if clip == "Listen":
            # Attentive: a slight lean, two gentle nods and hands clasped low.
            nod = max(0, math.sin(phase * math.tau * 2)) ** 2
            p["head"].rotation_euler.x = -.05 - .06 * nod
            p["head"].rotation_euler.z = .04 * math.sin(phase * math.tau)
            p["body"].rotation_euler.x = -.03 + .008 * wave
            p["root"].rotation_euler.z = .01 * math.sin(phase * math.tau)
            for side in ("left", "right"):
                p["arm_" + side].rotation_euler.x = -.22
                p["forearm_" + side].rotation_euler.x = -.55
        if clip == "Respond":
            # Both hands open outward as the speaker explains, then settle.
            reach = math.sin(math.pi * phase) ** 2
            beat = math.sin(phase * math.tau * 2) * reach
            p["arm_left"].rotation_euler.x = -.5 * reach
            p["forearm_left"].rotation_euler.x = -.6 * reach
            p["arm_left"].rotation_euler.z = .2 * reach
            p["arm_right"].rotation_euler.x = -.36 * reach
            p["forearm_right"].rotation_euler.x = -.5 * reach - .08 * beat
            p["arm_right"].rotation_euler.z = -.14 * reach
            p["head"].rotation_euler.z = -.07 * reach
            p["head"].rotation_euler.x = -.04 * beat
            p["body"].rotation_euler.z = -.025 * reach
        if clip in ("Sit", "Row"):
            for side in ("left", "right"):
                p["thigh_" + side].rotation_euler.x = -1.25
                p["leg_" + side].rotation_euler.x = 1.2
            p["root"].location.y = -.43
            p["robe"].rotation_euler.x = -1.1
            p["robe"].scale.y = .85
            if clip == "Row":
                p["body"].rotation_euler.x = wave*.12
                for side in ("left", "right"):
                    p["arm_" + side].rotation_euler.x = -.7 + wave*.27
                    p["forearm_" + side].rotation_euler.x = -.5 - wave*.3
        if clip == "Haul":
            p["body"].rotation_euler.x = -.14 - .1*wave
            for side, sign in [("left", 1), ("right", -1)]:
                p["arm_" + side].rotation_euler.x = -.95 + sign*wave*.2
                p["forearm_" + side].rotation_euler.x = -.8
        if clip in ("Recline", "Rise"):
            amount = 1 if clip == "Recline" else 1 - min(phase*1.5, 1)
            p["root"].rotation_euler.x = -math.pi/2 * amount
            p["root"].location.y = .12*amount
        if clip == "Use":
            p["body"].rotation_euler.x = -.12
            p["forearm_right"].rotation_euler.x += wave*.2
        if clip == "SitUp":
            # From the same supported reclining pose to a seated pose. The scene
            # offsets the root so the pelvis remains above the carrying frame.
            amount = phase * phase * (3 - 2 * phase)
            p["root"].rotation_euler.x = -math.pi/2 * (1-amount)
            p["root"].location.y = .12 * (1-amount)
            p["robe"].rotation_euler.x = -math.pi/2 * amount
            for side in ("left", "right"):
                p["thigh_" + side].rotation_euler.x = -math.pi/2 * amount
        if clip in ("FrameCarry", "TouchFrame"):
            # The forearms extend toward -Y, the modeled actor's front. Hand
            # centers meet the 0.84 m handrails with actors 0.93 m from center.
            for side in (("left", "right") if clip == "FrameCarry" else ("right",)):
                p["arm_" + side].rotation_euler.x = -.45
                p["forearm_" + side].rotation_euler.x = -.40
        if clip == "Kneel":
            p["root"].location.y = -.38
            p["robe"].scale.y = .68
            p["body"].rotation_euler.x = -.10
            for side in ("left", "right"):
                p["thigh_" + side].rotation_euler.x = -.15
                p["leg_" + side].rotation_euler.x = 1.70
                p["arm_" + side].rotation_euler.x = -.25
        # Finite practical gestures. All settle at the neutral pose; Carry is
        # sampled separately after pickup, so a stationary traveler never steps.
        if clip in ("PickUp", "PutDown", "Repair"):
            reach = math.sin(math.pi * phase) ** 2
            p["body"].rotation_euler.x = -.32 * reach
            p["head"].rotation_euler.x = -.12 * reach
            p["root"].location.y = -.12 * reach
            for side in ("left", "right"):
                p["thigh_" + side].rotation_euler.x = -.15 * reach
                p["leg_" + side].rotation_euler.x = .26 * reach
                p["arm_" + side].rotation_euler.x = -.72 * reach
                p["forearm_" + side].rotation_euler.x = -.55 * reach
            if clip == "PickUp":
                p["forearm_right"].rotation_euler.x -= .30 * reach * phase
            if clip == "PutDown":
                p["forearm_left"].rotation_euler.x -= .28 * reach * (1-phase)
            if clip == "Repair":
                p["forearm_right"].rotation_euler.x += .28 * math.sin(phase*math.tau*2) * reach
                p["body"].rotation_euler.z = .06 * math.sin(phase*math.tau) * reach
        if clip == "SitDown":
            # Ease down, hold a readable seat, then stand. No accumulated root motion.
            amount = min(phase/.25, 1, (1-phase)/.25)
            amount = amount*amount*(3-2*amount)
            p["root"].location.y = -.35 * amount
            p["robe"].rotation_euler.x = -1.1 * amount
            p["robe"].scale.y = 1 - .15 * amount
            for side in ("left", "right"):
                p["thigh_" + side].rotation_euler.x = -1.25 * amount
                p["leg_" + side].rotation_euler.x = 1.2 * amount
                p["forearm_" + side].rotation_euler.x = -.45 * amount

    scene.render.fps = 30
    for clip, duration in CLIPS.items():
        specialist = {"SitUp": "young_man", "FrameCarry": "bearer", "TouchFrame": "jesus"}
        if clip in specialist and name != specialist[clip]:
            continue
        rig.animation_data_create()
        rig.animation_data.action = None
        for step in range(9):
            frame = 1 + duration*step/8
            pose(clip, step/8)
            for bone in rig.pose.bones:
                bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
                bone.keyframe_insert("location", frame=frame, group=bone.name)
                bone.keyframe_insert("scale", frame=frame, group=bone.name)
        action = rig.animation_data.action
        action.name = name + "_" + clip
        slot = getattr(rig.animation_data, "action_slot", None)
        track = rig.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 1, action)
        if slot is not None:
            strip.action_slot = slot
        rig.animation_data.action = None
    pose("Idle", 0)
    scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [rig, skin, socket]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(output, name + ".glb"), export_format="GLB",
        use_selection=True, use_active_scene=True, export_cameras=False, export_lights=False,
        export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
    )
    rig.location = ((grid_index % 5)*7, (grid_index // 5)*7, 0)
    parts.clear()
