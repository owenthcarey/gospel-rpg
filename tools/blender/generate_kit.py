"""Deterministic, original low-poly assets. Run inside Blender 4.2+.

Uses a separate scene; existing user scenes are preserved. All dimensions are meters.
Each GLB is exported at the origin, with applied transforms and named materials.
"""
import bpy
import math
import os
import random
import sys
from pathlib import Path
from mathutils import Vector

ROOT = os.environ.get("GOSPEL_RPG_ROOT")
if not ROOT:
    script = globals().get("__file__", "")
    if os.path.basename(script) != "generate_kit.py":
        raise RuntimeError("Set GOSPEL_RPG_ROOT to the repository path before running via MCP.")
    ROOT = str(Path(script).resolve().parents[2])
sys.path.insert(0, os.path.join(ROOT, "tools/blender"))
from rigging import export_character

OUT = os.path.join(ROOT, "public/assets/models")
os.makedirs(OUT, exist_ok=True)
random.seed(41)
scene = bpy.data.scenes.new("The Way - asset workshop")
bpy.context.window.scene = scene
scene.world = bpy.data.worlds.new("Galilee daylight")
scene.world.color = (0.65, 0.72, 0.78)

def mat(name, color):
    m = bpy.data.materials.new("way_" + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = 0.95
    return m

M = {
    "plaster": mat("warm_lime", (0.68, 0.57, 0.39)),
    "stone": mat("basalt", (0.26, 0.29, 0.26)),
    "sandstone": mat("sandstone", (0.56, 0.46, 0.30)),
    "roof": mat("earthen_roof", (0.45, 0.37, 0.24)),
    "wood": mat("olive_wood", (0.27, 0.17, 0.09)),
    "lightwood": mat("sun_bleached_wood", (0.52, 0.36, 0.19)),
    "dark": mat("shadow", (0.09, 0.12, 0.11)),
    "leaf": mat("olive_leaf", (0.29, 0.39, 0.18)),
    "leaflight": mat("olive_silver", (0.39, 0.46, 0.25)),
    "leafdark": mat("olive_shade", (0.20, 0.29, 0.15)),
    "terra": mat("terracotta", (0.60, 0.28, 0.14)),
    "rope": mat("flax", (0.62, 0.51, 0.31)),
    "cloth": mat("natural_linen", (0.86, 0.78, 0.57)),
    "teal": mat("dyed_teal", (0.17, 0.36, 0.34)),
    "red": mat("ochre_cloth", (0.57, 0.23, 0.12)),
    "skin": mat("warm_skin", (0.56, 0.34, 0.20)),
    "hair": mat("dark_hair", (0.12, 0.09, 0.06)),
    "bread": mat("baked_bread", (0.75, 0.49, 0.21)),
}
parts = []


def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(M[material])
    parts.append(obj)
    return obj

def box(name, pos, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("worn_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, material)

def cone(name, pos, r1, r2, depth, material, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=pos)
    return finish(bpy.context.object, name, material)

def ico(name, pos, size, material, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=pos)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material)

def beam(name, a, b, radius, material):
    delta = Vector(b) - Vector(a)
    o = cone(name, (Vector(a) + Vector(b)) / 2, radius, radius * .88, delta.length, material, 6)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return o

def export(name):
    if name in ["traveler", "simon", "miriam", "jesus", "villager", "james", "john"]:
        export_character(name, parts, scene, OUT, len(exports))
        exports.append(name)
        return
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    socket_nodes = []
    if name == "boat":
        for socket_name, position in [
            ("seat_front", (0, -1.15, .46)), ("seat_middle", (0, 0, .46)),
            ("seat_back", (0, 1.05, .46)), ("net_socket", (.8, .2, .5)),
            ("oar_left", (-.72, -.2, .66)), ("oar_right", (.72, -.2, .66)),
        ]:
            socket = bpy.data.objects.new(socket_name, None)
            scene.collection.objects.link(socket)
            socket.parent = o
            socket.location = position
            socket.select_set(True)
            socket_nodes.append(socket)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", use_selection=True, use_active_scene=True, export_cameras=False, export_lights=False, export_yup=True)
    o.location = ((len(exports) % 5) * 7, (len(exports) // 5) * 7, 0)
    exports.append(name)
    parts.clear()

exports = []

def house(w, d, h):
    box("plastered_walls", (0, 0, h/2), (w, d, h), "plaster", .07)
    box("stone_foundation", (0, 0, .23), (w+.06, d+.06, .46), "stone", .04)
    box("roof", (0, 0, h+.02), (w+.26, d+.26, .19), "roof", .04)
    for y in [-d/2, d/2]:
        box("parapet", (0, y, h+.29), (w+.2, .18, .48), "plaster", .035)
    for x in [-w/2, w/2]:
        box("parapet", (x, 0, h+.29), (.18, d, .48), "plaster", .035)
    box("door_recess", (0, -d/2-.013, .83), (.83, .055, 1.53), "dark")
    box("door_wood", (.12, -d/2-.05, .74), (.47, .04, 1.36), "wood")
    box("lintel", (0, -d/2-.06, 1.66), (1.13, .18, .18), "lightwood", .02)
    box("doorstep", (0, -d/2-.24, .08), (1.1, .6, .16), "sandstone", .02)
    for x in [-w*.32, w*.32]:
        box("window", (x, -d/2-.02, h*.67), (.48, .04, .56), "dark")
        for dx in [-.14, 0, .14]:
            box("window_slats", (x+dx, -d/2-.055, h*.67), (.035, .035, .56), "lightwood")
    for i in range(6):
        box("exposed_stone", (-w/2+.22+(i%2)*.22, -d/2-.025, .58+i*.25), (.42, .09, .17), "sandstone", .02)
    for x in [-w*.37, w*.37]:
        beam("roof_beam", (x, -d/2-.26, h-.06), (x, d/2+.2, h-.06), .09, "wood")

house(3.7, 3.2, 2.65)
export("house")
house(4.7, 4, 3.3)
box("upper_room", (.8, .55, 3.94), (2.3, 2.2, 1.1), "plaster", .05)
box("upper_roof", (.8, .55, 4.52), (2.6, 2.5, .15), "roof", .03)
export("house_large")

# A striped cloth market canopy, produce baskets, and a simple counter.
for x in [-1.5, 1.5]:
    for y in [-.9, .9]:
        beam("canopy_post", (x, y, 0), (x, y, 2.4), .065, "wood")
for i in range(8):
    box("woven_awning", (-1.53+i*.44, 0, 2.37), (.44, 2.2, .055), "cloth" if i%2 == 0 else "red")
    box("awning_valance", (-1.53+i*.44, -1.06, 2.23), (.44, .045, .28), "cloth" if i%2 == 0 else "red")
box("market_table", (0, 0, .85), (2.9, .9, .16), "lightwood", .025)
for x in [-1.1, 1.1]:
    box("table_legs", (x, 0, .4), (.14, .7, .8), "wood")
for i in range(7):
    ico("bread", (-1.13+i*.34, 0, 1.04), (.22, .27, .12), "bread")
export("market")

beam("olive_trunk", (0, 0, 0), (.13, .02, 1.75), .20, "wood")
for a in [0, 2.1, 4.3]:
    x, y = math.cos(a), math.sin(a)
    beam("olive_branch", (.05, 0, .85), (x*.84, y*.84, 2.18), .11, "wood")
    ico("olive_crown", (x*.7, y*.7, 2.48), (1.05, .95, .9), "leaf" if a == 0 else "leaflight", 2)
ico("olive_crown", (0, 0, 2.98), (.85, .82, .75), "leafdark", 1)
export("olive")

cone("cypress_trunk", (0, 0, .6), .15, .11, 1.2, "wood")
for z, r in [(1.2,.8), (2,.69), (2.8,.48), (3.45,.29)]:
    cone("cypress_foliage", (0, 0, z), r, .035, 1.65, "leafdark", 7)
export("cypress")

beam("palm_trunk", (0,0,0), (.3,0,3.9), .19, "lightwood")
for i in range(7):
    a = i*math.tau/7
    x,y = math.cos(a),math.sin(a)
    vertices = [(.3,0,4.1), (.3+x*.9-y*.32,y*.9+x*.32,4.45), (.3+x*2.1,y*2.1,3.65), (.3+x*.9+y*.32,y*.9-x*.32,4.45)]
    mesh = bpy.data.meshes.new("palm_leaf")
    mesh.from_pydata(vertices, [], [(0,1,2),(0,2,3)])
    o = bpy.data.objects.new("palm_frond", mesh)
    scene.collection.objects.link(o)
    finish(o, "palm_frond", "leaf" if i%2 else "leafdark")
export("palm")

# Open plank fishing boat, narrow pointed hull with interior benches.
outline = [(0,-2),(.64,-1.15),(.73,.9),(.40,1.65),(0,1.94),(-.40,1.65),(-.73,.9),(-.64,-1.15)]
verts = [(x*.68,y*.86,.10) for x,y in outline] + [(x,y,.65) for x,y in outline]
faces = [tuple(range(7,-1,-1))] + [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
mesh = bpy.data.meshes.new("boat_hull")
mesh.from_pydata(verts, [], faces)
o = bpy.data.objects.new("hull", mesh)
scene.collection.objects.link(o)
finish(o, "hull", "wood")
sol = o.modifiers.new("plank_thickness", "SOLIDIFY")
sol.thickness = .07
bpy.context.view_layer.objects.active = o
o.select_set(True)
bpy.ops.object.modifier_apply(modifier=sol.name)
for i,(x,y) in enumerate(outline):
    xx,yy = outline[(i+1)%8]
    beam("gunwale", (x,y,.66),(xx,yy,.66),.06,"lightwood")
for y in [-.8,.45,1.05]:
    box("seat", (0,y,.44), (1.15,.25,.08), "lightwood")
export("boat")

for x in [-1.05,1.05]:
    beam("net_post", (x,0,0),(x,0,1.7),.07,"wood")
beam("drying_rail", (-1.2,0,1.7),(1.2,0,1.7),.055,"wood")
for i in range(11):
    x=-1+i*.2
    beam("net_cord", (x,0,.45),(x,0,1.62),.012,"rope")
for i in range(7):
    beam("net_weft", (-1,0,.45+i*.185),(1,0,.45+i*.185),.012,"rope")
export("nets")

box("crate", (0,0,.36), (.72,.66,.72), "wood", .02)
for z in [.07,.35,.65]:
    box("crate_plank", (0,-.34,z), (.75,.06,.16), "lightwood")
    box("crate_plank", (.38,0,z), (.06,.69,.16), "lightwood")
export("crate")

cone("jar_foot", (0,0,.12), .18,.24,.24,"terra",10)
cone("jar_body", (0,0,.42), .24,.31,.42,"terra",10)
cone("jar_shoulder", (0,0,.72), .31,.13,.20,"terra",10)
cone("jar_neck", (0,0,.88), .13,.15,.18,"terra",10)
cone("jar_mouth", (0,0,.98), .15,.15,.04,"dark",10)
for x in [-.22,.22]:
    beam("jar_handle", (x,0,.64),(x*1.25,0,.85),.045,"terra")
    beam("jar_handle", (x*1.25,0,.85),(x*.55,0,.88),.04,"terra")
export("amphora")

for i in range(8):
    x,y=random.uniform(-.4,.4),random.uniform(-.4,.4)
    h=random.uniform(.5,1.25)
    beam("reed", (x,y,0),(x+.12,y,h),.018,"leaflight")
    cone("reed_head",(x+.12,y,h),.035,.025,.2,"rope",5)
export("reeds")

ico("shore_stone",(0,0,.25),(.65,.52,.46),"sandstone")
export("rock")

for i in range(10):
    a=i*math.tau/10
    o=box("well_stone",(math.cos(a)*.64,math.sin(a)*.64,.48),(.44,.31,.8),"sandstone",.03)
    o.rotation_euler.z=a+math.pi/2
cone("well_depth",(0,0,.12),.55,.55,.05,"dark",12)
for x in [-.85,.85]:
    beam("well_post",(x,0,0),(x,0,2),.08,"wood")
beam("well_crossbar",(-1,0,1.95),(1,0,1.95),.10,"wood")
beam("well_rope",(0,0,.4),(0,0,1.95),.02,"rope")
export("well")

def person(cloth, shawl, beard=False):
    for x in [-.13,.13]:
        box("sandals",(x,-.06,.075),(.20,.36,.13),"wood",.03)
        cone("lower_leg",(x,0,.28),.075,.075,.36,"skin",6)
    cone("robe",(0,0,.68),.36,.25,.91,cloth,8)
    box("tunic",(0,0,1.13),(.49,.31,.5),cloth,.045)
    box("belt",(0,0,.91),(.50,.34,.055),"wood")
    for x in [-.31,.31]:
        beam("sleeve",(x*.77,0,1.3),(x,0,.95),.10,cloth)
        beam("forearm",(x,0,.98),(x,-.045,.76),.065,"skin")
    cone("neck",(0,0,1.42),.08,.09,.18,"skin",6)
    ico("head",(0,-.015,1.62),(.19,.17,.24),"skin",2)
    ico("hair",(0,.025,1.74),(.198,.175,.16),"hair",1)
    box("nose",(0,-.19,1.62),(.065,.055,.07),"skin")
    if beard:
        ico("beard",(0,-.06,1.49),(.155,.14,.15),"hair")
    box("shoulder_wrap",(-.14,0,1.26),(.15,.37,.38),shawl,.02)
    box("draped_wrap",(-.18,-.19,.95),(.17,.04,.53),shawl)

person("teal","cloth")
box("satchel",(.24,.16,.86),(.29,.19,.32),"lightwood",.04)
export("traveler")
person("rope","teal",True)
export("simon")
person("red","cloth")
ico("head_cover",(0,.045,1.77),(.23,.21,.18),"cloth")
box("head_cover_back",(0,.15,1.53),(.40,.07,.37),"cloth",.03)
export("miriam")
person("cloth","rope",True)
box("hair_back",(0,.135,1.58),(.30,.06,.29),"hair",.03)
export("jesus")
person("rope","red",True)
export("villager")


person("teal","red",True)
export("james")
person("terra","cloth")
export("john")

# Portable props, kept separate so state and animation can change their placement.
beam("oar_shaft", (0,-1.3,0),(0,1.1,0),.035,"lightwood")
box("oar_blade",(0,-1.35,0),(.22,.56,.055),"lightwood",.015)
export("oar")

def basket(full=False):
    cone("basket_floor",(0,0,.05),.25,.25,.08,"wood",12)
    # Open basket with a visible woven rim, no opaque top.
    for i in range(12):
        a=i*math.tau/12
        beam("basket_stave",(math.cos(a)*.25,math.sin(a)*.25,.07),
             (math.cos(a)*.36,math.sin(a)*.36,.55),.032,"rope")
    for z, radius in [(.12,.267),(.25,.30),(.40,.33),(.54,.36)]:
        for i in range(12):
            a,b=i*math.tau/12,(i+1)*math.tau/12
            beam("basket_weave",(math.cos(a)*radius,math.sin(a)*radius,z),
                 (math.cos(b)*radius,math.sin(b)*radius,z),.025,"lightwood")
    if full:
        for i in range(9):
            x,y=math.sin(i*2.4)*.21,math.cos(i*2.4)*.21
            fish=ico("fish",(x,y,.42+(i%3)*.05),(.18,.07,.055),"leaflight")
            fish.rotation_euler.z=i*1.7
            ico("fish_tail",(x+.16,y,.43+(i%3)*.05),(.065,.085,.025),"leafdark")
basket()
export("basket_empty")
basket(True)
export("basket_fish")

for i in range(8):
    beam("folded_net",(-.33,-.22+i*.063,.04+(i%2)*.025),(.33,-.22+i*.063,.04+(i%2)*.025),.022,"rope")
for i in range(5):
    beam("net_fold",(-.3+i*.15,-.25,.06),(-.3+i*.15,.25,.06),.018,"rope")
export("net_folded")

# A flexible-looking curved net is staged as separate lowered/full meshes.
for full in [False, True]:
    radius=1.05 if not full else .70
    depth=.95 if not full else 1.15
    for i in range(16):
        a=i*math.tau/16
        beam("net_drop",(math.cos(a)*radius,math.sin(a)*radius,0),
             (math.cos(a)*radius*.24,math.sin(a)*radius*.24,-depth),.015,"rope")
    for j in range(5):
        t=j/4
        r=radius*(1-t*.76)
        for i in range(16):
            a,b=i*math.tau/16,(i+1)*math.tau/16
            beam("net_ring",(math.cos(a)*r,math.sin(a)*r,-t*depth),
                 (math.cos(b)*r,math.sin(b)*r,-t*depth),.014,"rope")
    if full:
        for i in range(20):
            a=i*2.4
            ico("net_fish",(math.cos(a)*.36,math.sin(a)*.36,-.45-(i%4)*.10),(.22,.075,.055),"leaflight")
    export("net_full" if full else "net_cast")

box("bread_cloth",(0,0,.05),(.60,.45,.10),"cloth",.02)
for i in range(3):
    ico("loaf",(-.18+i*.18,0,.17),(.14,.18,.10),"bread")
export("bread_bundle")

beam("mooring_post",(0,0,0),(0,0,.72),.095,"wood")
for j in range(3):
    for i in range(16):
        a,b=i*math.tau/16,(i+1)*math.tau/16
        r=.24+j*.045
        beam("rope_coil",(math.cos(a)*r,math.sin(a)*r,.045),
             (math.cos(b)*r,math.sin(b)*r,.045),.018,"rope")
export("mooring")

box("landing_mat",(0,0,.018),(1.45,1.05,.035),"rope")
for i in range(9):
    beam("mat_weave",(-.68,-.47+i*.115,.047),(.68,-.47+i*.115,.047),.014,"cloth")
export("landing_mat")

scene.render.engine = "BLENDER_EEVEE_NEXT" if bpy.app.version < (5, 0, 0) else "BLENDER_EEVEE"
os.makedirs(os.path.join(ROOT,"assets/source"),exist_ok=True)
# Save only the workshop and its dependencies, never unrelated open user scenes.
bpy.data.libraries.write(os.path.join(ROOT,"assets/source/galilee-kit.blend"), {scene}, fake_user=True, compress=True)
print("Exported " + str(len(exports)) + " assets: " + ", ".join(exports))
