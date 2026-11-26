"""
Antigravity Studio — Unified Painterly Gouache Joint-Render:
Assembles our newly sculpted & baked Player v2.0 (`player_v2.blend`), Companion Dog (`dog.blend`),
and Ah Lian (`npc_market.blend`) directly into our approved v2.1 Coastal Village Scene
(`stillwater_village_whitebox_v21.blend`), upgrades all v2.1 environment clay shaders into
hand-painted Ghibli coastal gouache materials, and renders ALL 3 Astra Ultra Joint-Render Hero Shots:
  1. Shot 2 (Waterfront Boat Arrival — Player v2.0 walking briskly onto Hero Pier w/ opposite arm/leg swing!)
  2. Shot 3 (Fish Market Handoff — Player v2.0 receiving wrapped fish parcel from Ah Lian w/ puppy beside!)
  3. Shot 4 (Pier Fishing Hero Shot — Player v2.0 seated on pier w/ dog, bamboo rod, line, bobber & distant cliff Lighthouse!)
  4. Shot 1 (Full Colored Bay Establishing Overview of v2.1 Village + Player v2.0!)

Outputs:
  - art_pipeline/blender_ag/joint_renders/shot1..4_colored.png
  - art_pipeline/blender_ag/joint_renders/PLAYER_V2_SCENE_JOINT_RENDER.png (2x2 full painterly showcase!)
"""

import math
import os
import sys
import bpy
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import make_gouache_mat, srgb_to_linear

WHITEBOX_BLEND = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\whitebox_v21\stillwater_village_whitebox_v21.blend"
PLAYER_BLEND = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\player_v2.blend"
DOG_BLEND = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\dog.blend"
AHLIAN_BLEND = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\npc_market.blend"
OUT_DIR = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\joint_renders"
os.makedirs(OUT_DIR, exist_ok=True)


def make_lagoon_water_mat():
    mat = bpy.data.materials.new(name="Gouache_LagoonWater")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.14
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.65

    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 0.18
    n1.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])

    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.inputs["A"].default_value = srgb_to_linear("#1E7B8C")  # rich coastal teal lagoon
    m.inputs["B"].default_value = srgb_to_linear("#4DBAC0")  # sunlit turquoise shallows
    nt.links.new(n1.outputs["Fac"], m.inputs["Factor"])
    nt.links.new(m.outputs["Result"], bsdf.inputs["Base Color"])

    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 2.8
    n2.inputs["Detail"].default_value = 5.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    bump.inputs["Distance"].default_value = 0.08
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    nt.links.new(n2.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def upgrade_scene_materials():
    """Upgrades v2.1 clay maquette into warm sunlit Ghibli coastal gouache palette!"""
    g = {
        "wall": make_gouache_mat("G_StuccoCream", "#F3E8D2", "#D4C2A3", rough=0.88, noise_scale=3.0, ao_strength=0.25, ao_dist=0.9),
        "roof_red": make_gouache_mat("G_RoofCoralRed", "#C74C38", "#8F3122", rough=0.80, noise_scale=5.0, ao_strength=0.28, ao_dist=0.7),
        "roof_teal": make_gouache_mat("G_RoofTealSlate", "#2D7B82", "#1B5258", rough=0.80, noise_scale=5.0, ao_strength=0.28, ao_dist=0.7),
        "roof_honey": make_gouache_mat("G_RoofHoneyWood", "#C6863E", "#8E5A22", rough=0.80, noise_scale=5.0, ao_strength=0.28, ao_dist=0.7),
        "roof_blue": make_gouache_mat("G_RoofSlateBlue", "#4F6B88", "#344A61", rough=0.82, noise_scale=5.0, ao_strength=0.28, ao_dist=0.7),
        "timber": make_gouache_mat("G_TimberWarm", "#9A673D", "#664023", rough=0.80, noise_scale=6.0, ao_strength=0.30, ao_dist=0.6),
        "stone": make_gouache_mat("G_StoneQuay", "#C9C0AF", "#8C8373", rough=0.88, noise_scale=4.5, ao_strength=0.32, ao_dist=0.9),
        "cliff": make_gouache_mat("G_CliffRock", "#8C897E", "#5A574E", rough=0.90, noise_scale=3.0, ao_strength=0.34, ao_dist=1.2),
        "grass": make_gouache_mat("G_HillGrass", "#70A854", "#4A7D38", rough=0.92, noise_scale=0.35, ao_strength=0.26, ao_dist=1.6),
        "foliage": make_gouache_mat("G_TreeCanopy", "#5A9744", "#386B2B", rough=0.88, noise_scale=2.2, ao_strength=0.30, ao_dist=1.0),
        "iron": make_gouache_mat("G_LampIron", "#3B3936", "#22201E", rough=0.58, metal=0.45, noise_scale=8.0, ao_strength=0.2),
        "lamp_glow": make_gouache_mat("G_LampWarm", "#FFE596", "#F2BE5A", rough=0.30, ao_strength=0.0, emit_hex="#FFD578", emit_str=2.2),
        "stripe_red": make_gouache_mat("G_StripeRed", "#CE4A36", "#9A3020", rough=0.84, noise_scale=6.0, ao_strength=0.22),
        "stripe_cream": make_gouache_mat("G_StripeCream", "#F7EEDB", "#DDD0B6", rough=0.84, noise_scale=6.0, ao_strength=0.22),
        "parcel": make_gouache_mat("G_PaperParcel", "#F3E4C6", "#D2BE99", rough=0.86, noise_scale=8.0, ao_strength=0.18),
        "wicker": make_gouache_mat("G_WickerBasket", "#C99A57", "#8E632D", rough=0.84, noise_scale=18.0, ao_strength=0.28, pattern="straw", pattern_scale=20.0),
        "boat_red": make_gouache_mat("G_BoatRed", "#B84934", "#822F20", rough=0.78, noise_scale=5.0, ao_strength=0.26),
        "water": make_lagoon_water_mat(),
    }

    for obj in list(bpy.data.objects):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        nm = obj.name
        mname = obj.data.materials[0].name

        # Hide clay placeholder mannequins & rear debug reserve pads for clean painterly beauty render!
        if nm.startswith(("Story_AhLian", "Story_Kid", "Story_StreetDog", "Story_PierAngler", "Story_PierDog", "Story_EastWalker", "Story_LaoZhou", "Reserve_")):
            obj.hide_render = True
            obj.hide_viewport = True
            continue

        new_m = None
        if nm == "Lagoon_Water":
            new_m = g["water"]
        elif nm == "Village_Terrain_v21":
            new_m = g["grass"]
        elif nm.startswith(("H1_Roof", "H1_DormerRoof", "H1_PorchAwning", "LH_Band_1", "LH_Band_3", "LH_Cupola", "LH_ShedRoof")):
            new_m = g["roof_red"]
        elif nm.startswith(("H2_Roof", "H2_ShedRoof", "H2_Awning")):
            new_m = g["roof_teal"]
        elif nm.startswith(("H3_Roof", "H3_HoodRoof", "House_Back_02_T2_GableFront_Roof")):
            new_m = g["roof_honey"]
        elif nm.startswith(("House_04_WestBlueHut_Roof", "House_Back_03_T3_High_Roof")):
            new_m = g["roof_blue"]
        elif "_Roof" in nm or "Roof" in mname:
            new_m = g["roof_red"] if ("Back_01" in nm or "EastCove" in nm or "Back_04" in nm) else g["roof_honey"]
        elif nm.startswith(("Mkt_Awning_", "Mkt_Valance_")):
            idx = int(nm.split("_")[-1])
            new_m = g["stripe_red"] if idx % 2 == 0 else g["stripe_cream"]
        elif nm.startswith(("Bow_Rail",)):
            new_m = g["boat_red"]
        elif nm.startswith(("StreetLamp_Head", "LH_Lantern")) or "LampBox" in nm or "PorchLantern" in nm:
            new_m = g["lamp_glow"]
        elif "LampPost" in nm or "LampArm" in nm or "Gallery" in nm or "Finial" in nm:
            new_m = g["iron"]
        elif "Basket" in nm:
            new_m = g["wicker"]
        elif nm == "Story_FishParcel":
            new_m = g["parcel"]
        elif nm == "Story_Bobber":
            new_m = g["stripe_red"]
        elif mname == "Clay_Foliage_Matte":
            new_m = g["foliage"]
        elif mname == "Clay_Timber_Taupe":
            new_m = g["timber"]
        elif mname == "Clay_Cliff_Rock":
            new_m = g["cliff"]
        elif mname == "Clay_Stone_Quay":
            new_m = g["stone"]
        elif mname == "Clay_Wall_Ivory":
            new_m = g["wall"]
        elif mname == "Clay_Mannequin_Charcoal":
            new_m = g["iron"]

        if new_m is not None:
            obj.data.materials.clear()
            obj.data.materials.append(new_m)


def append_character_root(blend_path, root_name_prefix):
    """Appends ALL objects from a baked character .blend and returns its top root empty."""
    before = set(bpy.data.objects)
    with bpy.data.libraries.load(blend_path, link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)
    added = [o for o in data_to.objects if o is not None]
    col = bpy.context.scene.collection
    for o in added:
        if o.name not in col.objects:
            col.objects.link(o)
    # Find top root (object with no parent or matching prefix)
    root = next((o for o in added if o.parent is None and o.name.startswith(root_name_prefix)), None)
    if root is None:
        root = next((o for o in added if o.parent is None), added[0])
    # Delete any stray cameras/lights appended from character file
    for o in added:
        if o.type in ("CAMERA", "LIGHT"):
            bpy.data.objects.remove(o, do_unlink=True)
    return root


def find_rig_child(root, prefix):
    stack = [root]
    while stack:
        cur = stack.pop()
        if cur.name.startswith(prefix):
            return cur
        stack.extend(cur.children)
    return None


def reset_player_pose(root):
    for nm in ("Rig_Torso", "Rig_Head", "Rig_ArmL", "Rig_ArmR", "Rig_LegL", "Rig_LegR"):
        node = find_rig_child(root, nm)
        if node:
            node.rotation_euler = Euler((0, 0, 0), "XYZ")


def setup_sunny_coastal_lighting(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 576
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Punchy"
    except Exception:
        pass
    scene.view_settings.exposure = 0.05

    # Warm azure Ghibli coastal sky gradient (warm pale horizon -> cerulean zenith!)
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.02
    ramp.color_ramp.elements[0].color = srgb_to_linear("#D6EFEA")
    e_mid = ramp.color_ramp.elements.new(0.24)
    e_mid.color = srgb_to_linear("#89C7E0")
    ramp.color_ramp.elements[2].position = 0.72
    ramp.color_ramp.elements[2].color = srgb_to_linear("#4D9BC9")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.92
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Warm golden sunlight casting soft painterly shadows
    for obj in list(bpy.data.objects):
        if obj.type == "LIGHT":
            bpy.data.objects.remove(obj, do_unlink=True)
    sd = bpy.data.lights.new("CoastalSun", type="SUN")
    sd.energy = 3.8
    sd.color = (1.0, 0.94, 0.84)
    sd.angle = math.radians(2.2)
    sun = bpy.data.objects.new("CoastalSun", sd)
    sun.rotation_euler = Euler((math.radians(48), math.radians(14), math.radians(-42)), "XYZ")
    scene.collection.objects.link(sun)


def aim_camera(cam, loc, target, lens=28):
    cam.data.lens = lens
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def main():
    bpy.ops.wm.open_mainfile(filepath=WHITEBOX_BLEND)
    upgrade_scene_materials()

    # Hide clay mannequin collection cleanly
    for col in bpy.data.collections:
        if "Mannequin" in col.name:
            for o in col.objects:
                if o.name not in ("Story_FishParcel", "Story_FishingRod", "Story_FishingLine", "Story_Bobber", "Story_BobberRing"):
                    o.hide_render = True
                    o.hide_viewport = True

    # Append our ACTUAL BAKED Player v2.0, Companion Dog & Ah Lian!
    player = append_character_root(PLAYER_BLEND, "Player_Protagonist_v2")
    dog = append_character_root(DOG_BLEND, "Companion_Dog")
    ahlian = append_character_root(AHLIAN_BLEND, "NPC_Market_AhLian")

    scene = bpy.context.scene
    setup_sunny_coastal_lighting(scene)
    cam = bpy.data.objects["WhiteboxCam"]
    scene.camera = cam

    bow = bpy.data.objects["Shot2_ForegroundBoatBow"]
    def set_bow(vis):
        bow.hide_render = not vis
        for ch in bow.children:
            ch.hide_render = not vis

    parcel = bpy.data.objects["Story_FishParcel"]
    angler_ref = bpy.data.objects["Story_PierAngler"].location.copy()
    dog_ref = bpy.data.objects["Story_PierDog"].location.copy()
    ah_ref = bpy.data.objects["Story_AhLian_Seller"].location.copy()
    kid_ref = bpy.data.objects["Story_Kid_Buyer"].location.copy()
    rod_objs = [bpy.data.objects.get(n) for n in ("Story_FishingRod", "Story_FishingLine", "Story_Bobber", "Story_BobberRing")]

    # -------------------------------------------------------------------------
    # SHOT 4 (ASTRA ULTRA HERO BENCHMARK #1): Pier Fishing w/ Player v2.0, Dog, Rod, Bobber & Cliff Lighthouse!
    # -------------------------------------------------------------------------
    set_bow(False)
    for ro in rod_objs:
        if ro: ro.hide_render = False
    reset_player_pose(player)
    # Seat Player v2.0 solidly on pier plank edge facing southeast toward bobber & cliff lighthouse!
    player.location = angler_ref + Vector((0.0, 0.0, -0.22))
    player.rotation_euler = Euler((0, 0, math.radians(48.0)), "XYZ")
    # Natural relaxed seated fishing pose!
    find_rig_child(player, "Rig_LegL").rotation_euler = Euler((math.radians(78), 0, math.radians(5)), "XYZ")
    find_rig_child(player, "Rig_LegR").rotation_euler = Euler((math.radians(74), 0, math.radians(-6)), "XYZ")
    find_rig_child(player, "Rig_Torso").rotation_euler = Euler((math.radians(-10), 0, 0), "XYZ")
    find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(42), math.radians(-10), math.radians(14)), "XYZ")
    find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(32), math.radians(8), math.radians(-12)), "XYZ")
    find_rig_child(player, "Rig_Head").rotation_euler = Euler((math.radians(4), 0, math.radians(-8)), "XYZ")

    # Place Companion Dog clearly visible right beside Player v2.0 on the open pier corner looking at the bobber!
    dog.location = angler_ref + Vector((0.68, -0.18, 0.0))
    dog.rotation_euler = Euler((0, 0, math.radians(32.0)), "XYZ")
    ahlian.location = ah_ref
    ahlian.rotation_euler = Euler((0, 0, 0.14), "XYZ")
    bpy.context.view_layer.update()

    lh_vec = Vector((52.0 - angler_ref.x, -25.0 - angler_ref.y, 0.0)).normalized()
    side_r = Vector((lh_vec.y, -lh_vec.x, 0.0))
    s4_loc = angler_ref - lh_vec * 3.15 + side_r * 2.25 + Vector((0.0, 0.0, 0.88))
    s4_tgt = angler_ref + lh_vec * 3.45 - side_r * 0.25 + Vector((0.0, 0.0, 0.46))
    aim_camera(cam, s4_loc, s4_tgt, lens=26)
    scene.render.filepath = os.path.join(OUT_DIR, "joint_shot4_pier_fishing.png")
    bpy.ops.render.render(write_still=True)

    # -------------------------------------------------------------------------
    # SHOT 1 (Full Colored Bay Establishing Shot of v2.1 Village + Player v2.0 on Pier!)
    # -------------------------------------------------------------------------
    aim_camera(cam, (-27.0, -18.5, 14.2), (12.8, -1.2, 1.8), lens=23)
    scene.render.filepath = os.path.join(OUT_DIR, "joint_shot1_bay_overview.png")
    bpy.ops.render.render(write_still=True)

    # -------------------------------------------------------------------------
    # SHOT 2 (Boat Arrival POV — Player v2.0 Striding Briskly on Hero Pier w/ Puppy!)
    # -------------------------------------------------------------------------
    set_bow(True)
    for ro in rod_objs:
        if ro: ro.hide_render = True
    reset_player_pose(player)
    player.location = angler_ref + Vector((-0.35, 0.55, 0.0))
    player.rotation_euler = Euler((0, 0, math.radians(-22.0)), "XYZ")
    find_rig_child(player, "Rig_LegL").rotation_euler = Euler((math.radians(-30), 0, 0), "XYZ")
    find_rig_child(player, "Rig_LegR").rotation_euler = Euler((math.radians(26), 0, 0), "XYZ")
    find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(34), 0, math.radians(-8)), "XYZ")
    find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(-36), 0, math.radians(8)), "XYZ")
    bpy.context.view_layer.update()

    aim_camera(cam, (-0.6, -15.6, 1.18), (0.8, 5.5, 2.25), lens=28)
    scene.render.filepath = os.path.join(OUT_DIR, "joint_shot2_boat_waterfront.png")
    bpy.ops.render.render(write_still=True)

    # -------------------------------------------------------------------------
    # SHOT 3 (Fish Market Handoff — Player v2.0 + Ah Lian exchanging Fish Parcel + Puppy on Promenade!)
    # -------------------------------------------------------------------------
    set_bow(False)
    reset_player_pose(player)
    player.location = kid_ref
    player.rotation_euler = Euler((0, 0, math.pi + 0.14), "XYZ")
    find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(52), 0, math.radians(-10)), "XYZ")
    find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(52), 0, math.radians(10)), "XYZ")
    find_rig_child(player, "Rig_Head").rotation_euler = Euler((math.radians(10), 0, math.radians(-6)), "XYZ")

    # Pose Ah Lian smiling & handing parcel forward
    ahlian.location = ah_ref
    ahlian.rotation_euler = Euler((0, 0, 0.14), "XYZ")
    al_r = find_rig_child(ahlian, "Rig_ArmR")
    al_l = find_rig_child(ahlian, "Rig_ArmL")
    if al_r: al_r.rotation_euler = Euler((math.radians(48), 0, 0), "XYZ")
    if al_l: al_l.rotation_euler = Euler((math.radians(48), 0, 0), "XYZ")

    dog.location = Vector((-7.1, 4.4, 1.14))
    dog.rotation_euler = Euler((0, 0, -1.2), "XYZ")
    bpy.context.view_layer.update()

    p_loc = parcel.location
    aim_camera(cam, p_loc + Vector((-2.15, -2.05, 0.30)), p_loc + Vector((1.85, 0.85, 0.14)), lens=30)
    scene.render.filepath = os.path.join(OUT_DIR, "joint_shot3_market_handoff.png")
    bpy.ops.render.render(write_still=True)

    # Save joint .blend for archival inspection
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "stillwater_v21_joint_colored.blend"))
    print("[Joint Render] All 4 painterly joint renders completed!")


if __name__ == "__main__":
    main()
