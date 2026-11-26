"""
Antigravity Studio — Phase 1 Complete Cast Showcase:
  1. Full 5-Character Orthographic Family Scale Lineup (`CAST_V2_FAMILY_LINEUP.png`):
     Player v2.0 (1.260m) + Ah Lian v2.0 (1.280m) + Lao Zhou v2.0 (1.310m) + Hai Bo v2.0 (1.350m) + Dog!
     Front, Back & 52° Top-Down Gameplay Scale Check on one ground plane!
  2. Updated 4-Panel Painterly Joint Scene Render (`CAST_V2_SCENE_JOINT_RENDER.png`):
     Places ALL 4 v2.0 characters + Dog into our v2.1 colored coastal village:
     - Shot 1: Full Village Bay Establishing Overview
     - Shot 2: Waterfront Arrival (Player v2.0 + Lao Zhou by Artisan Workshop + Hai Bo at East Cliff)
     - Shot 3: Fish Market Handoff (Ah Lian v2.0 + Player v2.0 + Lao Zhou v2.0 background + Dog!)
     - Shot 4: Pier Fishing Hero Shot (Player v2.0 seated + Dog + distant Cliff Lighthouse w/ Hai Bo!)
"""

import math
import os
import sys
import bpy
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import clear_scene, setup_studio_render, aim_camera
import render_player_v2_with_scene as joint_mod

BASE = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
PLAYER_BLEND = os.path.join(BASE, "player_v2.blend")
MARKET_BLEND = os.path.join(BASE, "npc_market.blend")
ARTISAN_BLEND = os.path.join(BASE, "npc_artisan.blend")
LIGHTHOUSE_BLEND = os.path.join(BASE, "npc_lighthouse.blend")
DOG_BLEND = os.path.join(BASE, "dog.blend")
WHITEBOX_BLEND = os.path.join(BASE, "whitebox_v21", "stillwater_village_whitebox_v21.blend")
OUT_DIR = os.path.join(BASE, "joint_renders")
os.makedirs(OUT_DIR, exist_ok=True)


def render_family_lineup():
    clear_scene()
    p = joint_mod.append_character_root(PLAYER_BLEND, "Player_Protagonist_v2")
    m = joint_mod.append_character_root(MARKET_BLEND, "NPC_AhLian_Market_v2")
    a = joint_mod.append_character_root(ARTISAN_BLEND, "NPC_LaoZhou_Artisan_v2")
    h = joint_mod.append_character_root(LIGHTHOUSE_BLEND, "NPC_HaiBo_Lighthouse_v2")
    d = joint_mod.append_character_root(DOG_BLEND, "Companion_Dog")

    # Side-by-side ground-aligned lineup (Z=0.000, facing -Y!)
    d.location = (-1.62, -0.05, 0.0)
    d.rotation_euler = Euler((0, 0, math.radians(-18)), "XYZ")
    p.location = (-0.96, 0.0, 0.0)
    m.location = (-0.26, 0.0, 0.0)
    a.location = (0.48, 0.0, 0.0)
    h.location = (1.30, 0.0, 0.0)
    bpy.context.view_layer.update()

    scene = bpy.context.scene
    setup_studio_render(scene, res_x=1600, res_y=640, samples=36, is_house=False)
    # Widen studio pedestal cleanly for all 5 characters
    for o in bpy.data.objects:
        if "Pedestal" in o.name or "Floor" in o.name:
            o.scale = (3.6, 2.2, 1.0)
    bpy.context.view_layer.update()

    cam_d = bpy.data.cameras.new("LineupCam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = 3.85
    cam = bpy.data.objects.new("LineupCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    # 1. Orthographic Front Lineup (verifies exact 1.26 / 1.28 / 1.31 / 1.35m step-up!)
    aim_camera(cam, (-0.12, -5.2, 0.72), (-0.12, 0.0, 0.70))
    scene.render.filepath = os.path.join(OUT_DIR, "lineup_front_ortho.png")
    bpy.ops.render.render(write_still=True)

    # 2. Orthographic Back Lineup (verifies bows, X-straps, coat vent, hat knot & lantern!)
    aim_camera(cam, (-0.12, 5.2, 0.72), (-0.12, 0.0, 0.70))
    scene.render.filepath = os.path.join(OUT_DIR, "lineup_back_ortho.png")
    bpy.ops.render.render(write_still=True)

    # 3. 52-degree Top-Down Gameplay Silhouette Lineup!
    cam_d.type = "PERSP"
    cam_d.lens = 58
    aim_camera(cam, (-0.12, -3.55, 4.75), (-0.12, 0.0, 0.56))
    scene.render.filepath = os.path.join(OUT_DIR, "lineup_top52.png")
    bpy.ops.render.render(write_still=True)
    print("[Lineup] Rendered Front, Back & Top 52° cast lineup!")


def render_joint_scene():
    bpy.ops.wm.open_mainfile(filepath=WHITEBOX_BLEND)
    joint_mod.upgrade_scene_materials()

    for col in bpy.data.collections:
        if "Mannequin" in col.name:
            for o in col.objects:
                if o.name not in ("Story_FishParcel", "Story_FishingRod", "Story_FishingLine", "Story_Bobber", "Story_BobberRing"):
                    o.hide_render = True
                    o.hide_viewport = True

    player = joint_mod.append_character_root(PLAYER_BLEND, "Player_Protagonist_v2")
    ahlian = joint_mod.append_character_root(MARKET_BLEND, "NPC_AhLian_Market_v2")
    laozhou = joint_mod.append_character_root(ARTISAN_BLEND, "NPC_LaoZhou_Artisan_v2")
    haibo = joint_mod.append_character_root(LIGHTHOUSE_BLEND, "NPC_HaiBo_Lighthouse_v2")
    dog = joint_mod.append_character_root(DOG_BLEND, "Companion_Dog")

    scene = bpy.context.scene
    joint_mod.setup_sunny_coastal_lighting(scene)
    cam = bpy.data.objects["WhiteboxCam"]
    scene.camera = cam

    bow = bpy.data.objects["Shot2_ForegroundBoatBow"]
    def set_bow(vis):
        bow.hide_render = not vis
        for ch in bow.children:
            ch.hide_render = not vis

    parcel = bpy.data.objects["Story_FishParcel"]
    angler_ref = bpy.data.objects["Story_PierAngler"].location.copy()
    ah_ref = bpy.data.objects["Story_AhLian_Seller"].location.copy()
    kid_ref = bpy.data.objects["Story_Kid_Buyer"].location.copy()
    rod_objs = [bpy.data.objects.get(n) for n in ("Story_FishingRod", "Story_FishingLine", "Story_Bobber", "Story_BobberRing")]

    # Place Lao Zhou warmly welcoming beside the Teal Artisan Workshop & Hai Bo along the East Promenade w/ glowing lantern!
    laozhou.location = Vector((-4.85, 6.10, 1.14))
    laozhou.rotation_euler = Euler((0, 0, math.radians(-16.0)), "XYZ")
    haibo.location = Vector((11.2, 4.95, 1.14))
    haibo.rotation_euler = Euler((0, 0, math.radians(24.0)), "XYZ")
    hb_ar = joint_mod.find_rig_child(haibo, "Rig_ArmR")
    if hb_ar:
        hb_ar.rotation_euler = Euler((math.radians(-18.0), 0, 0), "XYZ")

    # SHOT 3: Fish Market Handoff (Ah Lian v2.0 + Player v2.0 + Lao Zhou v2.0 in background + Dog!)
    set_bow(False)
    for ro in rod_objs:
        if ro: ro.hide_render = True
    joint_mod.reset_player_pose(player)
    player.location = kid_ref
    player.rotation_euler = Euler((0, 0, math.pi + 0.14), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(-48), 0, math.radians(8)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(-48), 0, math.radians(-8)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_Head").rotation_euler = Euler((math.radians(-10), 0, math.radians(-6)), "XYZ")

    ahlian.location = ah_ref
    ahlian.rotation_euler = Euler((0, 0, 0.14), "XYZ")
    joint_mod.find_rig_child(ahlian, "Rig_ArmL").rotation_euler = Euler((math.radians(-45), 0, math.radians(-8)), "XYZ")
    joint_mod.find_rig_child(ahlian, "Rig_ArmR").rotation_euler = Euler((math.radians(-45), 0, math.radians(8)), "XYZ")
    joint_mod.find_rig_child(ahlian, "Rig_Torso").rotation_euler = Euler((math.radians(-10), 0, 0), "XYZ")

    dog.location = Vector((-7.1, 4.4, 1.14))
    dog.rotation_euler = Euler((0, 0, -1.2), "XYZ")
    bpy.context.view_layer.update()

    p_loc = parcel.location
    joint_mod.aim_camera(cam, p_loc + Vector((-2.15, -2.05, 0.30)), p_loc + Vector((1.85, 0.85, 0.14)), lens=30)
    scene.render.filepath = os.path.join(OUT_DIR, "cast_shot3_market_handoff.png")
    bpy.ops.render.render(write_still=True)

    # SHOT 2: Waterfront Promenade with ALL 4 Characters + Dog Visible!
    set_bow(True)
    joint_mod.reset_player_pose(player)
    joint_mod.reset_player_pose(ahlian)
    player.location = angler_ref + Vector((-0.35, 0.55, 0.0))
    player.rotation_euler = Euler((0, 0, math.radians(-22.0)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_LegL").rotation_euler = Euler((math.radians(-28), 0, 0), "XYZ")
    joint_mod.find_rig_child(player, "Rig_LegR").rotation_euler = Euler((math.radians(24), 0, 0), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(32), 0, 0), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(-34), 0, 0), "XYZ")
    dog.location = Vector((6.2, 5.2, 1.14))
    dog.rotation_euler = Euler((0, 0, math.radians(150)), "XYZ")
    bpy.context.view_layer.update()

    joint_mod.aim_camera(cam, (-0.6, -15.6, 1.18), (0.8, 5.5, 2.25), lens=28)
    scene.render.filepath = os.path.join(OUT_DIR, "cast_shot2_waterfront_all4.png")
    bpy.ops.render.render(write_still=True)

    # SHOT 4: Pier Fishing Hero Shot + Distant Lighthouse
    set_bow(False)
    for ro in rod_objs:
        if ro: ro.hide_render = False
    joint_mod.reset_player_pose(player)
    player.location = angler_ref + Vector((0.0, 0.0, -0.22))
    player.rotation_euler = Euler((0, 0, math.radians(48.0)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_LegL").rotation_euler = Euler((math.radians(-78), 0, math.radians(5)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_LegR").rotation_euler = Euler((math.radians(-74), 0, math.radians(-6)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_Torso").rotation_euler = Euler((math.radians(-10), 0, 0), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmR").rotation_euler = Euler((math.radians(-42), math.radians(-10), math.radians(14)), "XYZ")
    joint_mod.find_rig_child(player, "Rig_ArmL").rotation_euler = Euler((math.radians(-32), math.radians(8), math.radians(-12)), "XYZ")
    dog.location = angler_ref + Vector((0.68, -0.18, 0.0))
    dog.rotation_euler = Euler((0, 0, math.radians(32.0)), "XYZ")
    bpy.context.view_layer.update()

    lh_vec = Vector((52.0 - angler_ref.x, -25.0 - angler_ref.y, 0.0)).normalized()
    side_r = Vector((lh_vec.y, -lh_vec.x, 0.0))
    s4_loc = angler_ref - lh_vec * 3.15 + side_r * 2.25 + Vector((0.0, 0.0, 0.88))
    s4_tgt = angler_ref + lh_vec * 3.45 - side_r * 0.25 + Vector((0.0, 0.0, 0.46))
    joint_mod.aim_camera(cam, s4_loc, s4_tgt, lens=26)
    scene.render.filepath = os.path.join(OUT_DIR, "cast_shot4_pier_fishing.png")
    bpy.ops.render.render(write_still=True)

    # SHOT 1: Full Village Overview
    joint_mod.aim_camera(cam, (-27.0, -18.5, 14.2), (12.8, -1.2, 1.8), lens=23)
    scene.render.filepath = os.path.join(OUT_DIR, "cast_shot1_bay_overview.png")
    bpy.ops.render.render(write_still=True)
    print("[Joint Scene] Rendered all 4 cast scene shots!")


if __name__ == "__main__":
    render_family_lineup()
    render_joint_scene()
