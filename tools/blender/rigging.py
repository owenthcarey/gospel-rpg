"""Shared original character rig and deterministic game clips.

Mesh parts are rigidly weighted to bones to retain the established chunky style.
The armature supports independent elbows, hips, knees, head and body poses.
"""
import bpy
import math
import os

CLIPS = {
    "Idle": 60, "Walk": 24, "Carry": 24, "Gesture": 60,
    "Sit": 60, "Row": 36, "Haul": 40, "Kneel": 60, "Recline": 60, "Rise": 60, "MatCarry": 24, "Use": 60,
    "PickUp": 36, "PutDown": 36, "Repair": 60, "SitDown": 72,
    "SitUp": 60, "FrameCarry": 60, "TouchFrame": 60,
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
        elif obj.name.startswith("forearm"):
            bone = "forearm_" + side
        elif obj.name.startswith("sandals"):
            bone = "leg_" + side
        elif obj.name.startswith("lower_leg"):
            bone = "leg_" + side
        else:
            bone = "body"
        if obj.name.startswith(("robe", "draped_wrap")):
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
            p["head"].rotation_euler.y = math.sin(phase*math.tau)*.025
            p["body"].rotation_euler.x = math.sin(phase*math.tau)*.012
        if clip in ("Walk", "Carry", "MatCarry"):
            for side, sign in [("left", 1), ("right", -1)]:
                p["thigh_" + side].rotation_euler.x = sign*wave*.30
                p["leg_" + side].rotation_euler.x = max(0, -sign*wave)*.16
                p["arm_" + side].rotation_euler.x = -sign*wave*.28
        if clip in ("Carry", "MatCarry", "Use"):
            for side in ("left", "right"):
                p["arm_" + side].rotation_euler.x = -.55
                p["forearm_" + side].rotation_euler.x = -.72
        if clip == "Gesture":
            p["arm_right"].rotation_euler.x = -.6 - .12*wave
            p["forearm_right"].rotation_euler.x = -.65
            p["head"].rotation_euler.z = .06
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
