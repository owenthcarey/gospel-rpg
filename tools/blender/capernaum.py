"""Original RFC-009 modular kit, isolated from every existing Blender scene.

Run through Blender MCP with GOSPEL_RPG_ROOT set, or via assets:build:capernaum.
Only this kit's exports and its separate workshop are written.
"""
import bpy
import math
import os
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get('GOSPEL_MODEL_OUTPUT', ROOT / 'public/assets/models'))
import sys
sys.path.insert(0, str(ROOT / 'tools/blender'))
from shading import bake_vertex_shading
OUT.mkdir(parents=True, exist_ok=True)
prior = bpy.context.window.scene
try:
    scene = bpy.data.scenes.new('The Way - Capernaum craft workshop')
    bpy.context.window.scene = scene
    palette = {
        'stone': (.27, .30, .28, 1), 'edge': (.48, .47, .36, 1),
        'wood': (.33, .21, .11, 1), 'worn': (.61, .44, .24, 1),
        'linen': (.86, .78, .57, 1), 'ochre': (.57, .28, .14, 1),
        'leaf': (.28, .38, .20, 1), 'silver': (.45, .52, .32, 1),
        'bread': (.72, .45, .22, 1), 'rope': (.66, .56, .34, 1),
    }
    mats = {}
    for name, color in palette.items():
        m = bpy.data.materials.new('Capernaum ' + name)
        m.diffuse_color = color
        mats[name] = m
    parts, exports = [], []

    def finish(obj, name, color):
        obj.name = name
        obj.data.materials.append(mats[color])
        parts.append(obj)
        return obj

    def box(name, p, size, color, bevel=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=p)
        o = bpy.context.object
        o.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            m = o.modifiers.new('Worn corners', 'BEVEL')
            m.width, m.segments = bevel, 1
            bpy.ops.object.modifier_apply(modifier=m.name)
        return finish(o, name, color)

    def beam(name, a, b, width, color):
        delta = Vector(b) - Vector(a)
        o = box(name, (Vector(a)+Vector(b))/2, (width,width,delta.length), color)
        o.rotation_euler = delta.to_track_quat('Z','Y').to_euler()
        return o

    def cone(name, p, bottom, top, depth, color, vertices=8):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=bottom,radius2=top,depth=depth,location=p)
        return finish(bpy.context.object,name,color)

    def export(name):
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts)>1: bpy.ops.object.join()
        o=bpy.context.object
        o.name=name
        scene.cursor.location=(0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        colors=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly in o.data.polygons:
            color=o.data.materials[poly.material_index].diffuse_color
            for loop in poly.loop_indices: colors.data[loop].color=color
            poly.material_index=0
        o.data.materials.clear()
        m=bpy.data.materials.new('Capernaum vertex palette')
        m.use_nodes=True
        shader=m.node_tree.nodes['Principled BSDF']
        shader.inputs['Roughness'].default_value=.95
        vertex=m.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name='Color'
        m.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
        o.data.materials.append(m)
        bake_vertex_shading(o, name)
        bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False,export_yup=True)
        o.location=((len(exports)%3)*3.4,(len(exports)//3)*3.4,0)
        exports.append(name)
        parts.clear()

    # Broad, irregular basalt slabs with a pale dry edge. Repeated in the landing.
    box('Dry stone', (0,0,.035),(1.06,1.06,.07),'stone',.04)
    for x,y,w,d in [(-.26,-.24,.47,.48),(.27,-.23,.48,.50),(-.27,.28,.45,.43),(.27,.29,.48,.42)]:
        box('Worn upper course',(x,y,.083),(w,d,.032),'edge',.025)
    export('quay_stones')

    # Exactly 1.30m long, along X: the runtime's east/west supported orientation.
    for y in [-.16,.16]: box('Crossing board',(0,y,.095),(1.30,.29,.09),'worn',.012)
    for x in [-.49,.49]: box('Under brace',(x,0,.035),(.105,.62,.07),'wood')
    for x in [-.48,.48]:
        for y in [-.18,.18]: cone('Wooden peg',(x,y,.148),.022,.022,.018,'wood',6)
    export('crossing_plank')

    # Net work: open frame, a low working surface, and sparse diagonal flax strands.
    for x in [-.66,.66]:
        for y in [-.27,.27]: box('Trestle leg',(x,y,.36),(.09,.09,.72),'wood')
    for x in [-.45,-.15,.15,.45]: box('Bench top',(x,0,.72),(.28,.72,.065),'worn')
    for x in [-.68,.68]: box('Net upright',(x,.29,1.12),(.055,.055,.8),'wood')
    beam('Net rail',(-.7,.29,1.49),(.7,.29,1.49),.06,'worn')
    for i in range(7):
        x=-.58+i*.19
        beam('Flax warp',(x,.27,.83),(x,.27,1.43),.014,'rope')
    for z in [.90,1.08,1.26,1.43]: beam('Flax weft',(-.6,.265,z),(.6,.265,z),.013,'rope')
    export('net_workbench')

    # A shallow canopy mounted on architecture; no freestanding posts obstruct doors.
    for x in [-.72,.72]: beam('Awning bracket',(x,.10,1.58),(x,-.65,2.07),.065,'wood')
    for i in range(5):
        o=box('Linen panel',(-.64+i*.32,-.25,2.18),(.32,.95,.045),'ochre' if i%2 else 'linen')
        o.rotation_euler.x=.12
    beam('Front rail',(-.86,-.71,2.12),(.86,-.71,2.12),.065,'worn')
    export('door_awning')

    for x in [-.43,.43]: box('Planter end',(x,0,.18),(.13,.7,.36),'stone',.025)
    for y in [-.31,.31]: box('Planter side',(0,y,.18),(.82,.12,.36),'edge',.025)
    box('Soil',(0,0,.24),(.73,.51,.05),'wood')
    for i in range(5):
        x=-.29+i*.145
        beam('Herb stem',(x,.06,.25),(x,.06,.62+(i%2)*.11),.018,'wood')
        for side in [-1,1]:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x+side*.055,side*.11,.50+(i%2)*.11))
            o=bpy.context.object;o.scale=(.12,.20,.10)
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            finish(o,'Sage leaves','leaf' if side==1 else 'silver')
    export('courtyard_planter')

    box('Bread board',(0,0,.025),(.8,.56,.05),'worn',.02)
    for x,y in [(-.19,-.10),(.18,-.07),(0,.16)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,.12))
        o=bpy.context.object;o.scale=(.16,.14,.08)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        finish(o,'Round loaf','bread')
    beam('Kneading pin',(-.36,.32,.10),(.36,.32,.10),.055,'wood')
    export('bread_board')

    for i in range(3): box('Threshold slab',(-.44+i*.44,0,.055),(.42,.50,.11),'edge',.035)
    export('stone_threshold')

    cone('Stone foot',(0,0,.10),.23,.20,.20,'stone')
    cone('Mooring timber',(0,0,.46),.10,.085,.70,'wood')
    beam('Mooring crosspiece',(-.25,0,.64),(.25,0,.64),.09,'worn')
    for i in range(2):
        for j in range(10):
            a,b=j*math.tau/10,(j+1)*math.tau/10
            beam('Coiled flax',(.16*math.cos(a),.16*math.sin(a),.14+i*.036),(.16*math.cos(b),.16*math.sin(b),.14+i*.036),.021,'rope')
    export('harbor_bollard')

    for row in range(2):
        for i in range(4): box('Basalt footing',(-.60+i*.40+(row%2)*.06,0,.09+row*.16),(.38,.20,.15),'stone' if (i+row)%2 else 'edge',.02)
    export('wall_footing')

    scene.world=bpy.data.worlds.new('Capernaum workshop daylight')
    scene.world.color=(.55,.63,.69)
    (ROOT/'assets/source').mkdir(parents=True,exist_ok=True)
    bpy.data.libraries.write(str(ROOT/'assets/source/capernaum-kit.blend'),{scene},fake_user=True,compress=True)
    report={'blender':bpy.app.version_string,'assets':exports,'bytes':sum((OUT/(n+'.glb')).stat().st_size for n in exports),'source':'assets/source/capernaum-kit.blend','preservedScene':prior.name}
    # Build reports are review artifacts; the RFC-009 evidence record stays historical.
    (ROOT/'artifacts/rfc011').mkdir(parents=True,exist_ok=True)
    (ROOT/'artifacts/rfc011/capernaum-kit.json').write_text(json.dumps(report,indent=2)+'\n')
    bpy.context.window.scene=prior
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
