"""Independent shipped-GLB and Babylon-pose review for RFC-009.

Generate HARBOR_REVIEW_OUTPUT with harbor-staging.test.ts first. Run via MCP or
assets:inspect:capernaum. Generated reviews default to artifacts/reviews/capernaum/;
copy selected evidence into docs only after review. No source model is used to
stand in for shipped bytes.
"""
import bpy
import os
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(os.environ.get('GOSPEL_RPG_ROOT') or Path(__file__).resolve().parents[2])
OUTPUT = Path(os.environ.get('GOSPEL_REVIEW_OUTPUT', ROOT / 'artifacts/reviews/capernaum'))
OUTPUT.mkdir(parents=True, exist_ok=True)
prior = bpy.context.window.scene
try:
    scene = bpy.data.scenes.new('The Way - independent Capernaum review')
    bpy.context.window.scene = scene
    groups = {'kit': set()}
    assets = json.loads((ROOT/'docs/verification/rfc009/kit-generation.json').read_text())['assets']
    for i, name in enumerate(assets):
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models'/(name+'.glb')))
        added = set(scene.objects)-before
        for o in added:
            if o.parent not in added: o.location = ((i%3)*2.2,(i//3)*2.3,0)
        groups['kit'] |= added
    poses = json.loads(Path(os.environ['GOSPEL_HARBOR_POSES']).read_text())
    for key, items in poses.items():
        group = set()
        for item in items:
            # Babylon line lists are not triangle surfaces. The browser reviews their route overlay.
            if item['name'] == 'landing-tested-route': continue
            mesh = bpy.data.meshes.new(item['name'])
            indices = item['indices']
            mesh.from_pydata(item['vertices'], [], [indices[i:i+3] for i in range(0,len(indices),3)])
            obj = bpy.data.objects.new(item['name'],mesh)
            scene.collection.objects.link(obj)
            colors = mesh.color_attributes.new(name='Runtime palette',type='FLOAT_COLOR',domain='CORNER')
            rgba = item['colors'];stride = len(rgba)//len(item['vertices']) if rgba else 0
            for polygon in mesh.polygons:
                for loop in polygon.loop_indices:
                    vertex = mesh.loops[loop].vertex_index
                    color = rgba[vertex*stride:vertex*stride+stride] if rgba else item['faceColors'][polygon.index]
                    colors.data[loop].color = (*color[:3],color[3] if len(color)>3 else 1)
            m = bpy.data.materials.new('Runtime colors');m.use_nodes = True
            shader=m.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.95
            vertex=m.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Runtime palette'
            m.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
            mesh.materials.append(m);group.add(obj)
        groups[key]=group
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
    floor=bpy.context.object
    floor.data.materials.append(bpy.data.materials.new('Review sand'))
    floor.data.materials[0].diffuse_color=(.38,.37,.28,1)
    scene.world=bpy.data.worlds.new('Review daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.66,.76,.9,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    bpy.ops.object.light_add(type='SUN',location=(0,0,12))
    bpy.context.object.data.energy=2;bpy.context.object.rotation_euler=(.3,-.4,-.4)
    bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=16
    scene.render.resolution_x=1100;scene.render.resolution_y=760;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
    views=[('net-work',(.1,9.2,.8),(4,-6,4),4),('kit',(2.2,2.3,.5),(6,-9,8),9),('north',(3.8,13.1,.1),(4,-6,7),7),('south',(3.8,13.1,.1),(4,-6,7),7),('bakehouse',(2.8,-4.2,.8),(4,-6,5),5.5),('gathering-house',(-3.2,-2,.7),(5,-6,5),6),('capernaum-lanes',(-9,-6.1,1.6),(5,7,5),6)]
    images=[]
    for key,target,offset,scale in views:
        for group,objects in groups.items():
            for o in objects:o.hide_render=group!=key
        camera.location=Vector(target)+Vector(offset)
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=scale
        scene.render.filepath=str(OUTPUT/('blender-'+key+'.png'))
        bpy.ops.render.render(write_still=True);images.append(Path(scene.render.filepath).name)
    report={'blender':bpy.app.version_string,'images':images,'inputs':{n:hashlib.sha256((ROOT/'public/assets/models'/(n+'.glb')).read_bytes()).hexdigest() for n in assets},'poses':'Actual imported Babylon geometry, sampled in reduced-motion poses; independent final GLB kit import.','preservedScene':prior.name}
    (OUTPUT/'blender-review.json').write_text(json.dumps(report,indent=2)+'\n')
    bpy.context.window.scene=prior
    print(json.dumps(report))
finally:
    bpy.context.window.scene = prior
