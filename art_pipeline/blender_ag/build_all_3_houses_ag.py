"""
Antigravity Studio Edition - Complete 3 Walk-In Storybook Cottages + Cycles 2048px Gouache+AO Bake Pipeline
Inspired directly by our Codex Image 2.5 board: art_pipeline/concepts/storyboards/stillwater_aetheria_kitbash_concept.png
Strictly conforms to game engine node contract (src/core/glbLoader.js & src/town.js):
  - Exterior_Shell | Roof_Cutaway | Door_Hinge | Interior_Floor | Interior_Props
  - Anchor_Aquarium (floor base!) | Anchor_Bed | Anchor_Workbench

Builds all 3 enterable cottages:
  1. house_player        (我的临水红顶小屋 — Coral Shingle Roof + Dormer + Glass Aquarium + Gingham Bed)
  2. house_artisan       (老周渔具工坊 — Teal Slate Roof + Hanging Fish Sign + Workbench + 4-Rod Rack + Bobbers)
  3. house_neighbor_east (东岸海景木屋 — Amber Honey Roof + Olive Shutters + Flower Boxes + Round Tea Table + Bookcase + Conch Shelf)
"""
import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import (
    clear_scene,
    make_gouache_mat,
    add_box,
    add_cyl,
    add_sphere,
    create_curved_tube,
    bake_gouache_atlas,
    setup_studio_render,
    aim_camera,
    set_hierarchy_hidden,
    export_clean_glb,
)

BASE_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
TEX_DIR = os.path.join(BASE_OUT, "textures")
EXP_DIR = os.path.join(BASE_OUT, "exports", "environment")
PREV_DIR = os.path.join(BASE_OUT, "previews")
for d in (TEX_DIR, EXP_DIR, PREV_DIR):
    os.makedirs(d, exist_ok=True)


def make_house_palette(roof_hex, roof_dark, shutter_hex, shutter_dark, wainscot_hex, wainscot_dark):
    return {
        "stucco": make_gouache_mat("Mat_StuccoCream", "#f3e9d6", "#dcd0b9", rough=0.88, noise_scale=7.0, ao_dist=0.45),
        "roof": make_gouache_mat("Mat_RoofShingle", roof_hex, roof_dark, rough=0.80, noise_scale=11.0, ao_dist=0.45),
        "wood_honey": make_gouache_mat("Mat_WoodHoney", "#d49b54", "#9e6a32", rough=0.80, noise_scale=12.0, ao_dist=0.40),
        "wood_dark": make_gouache_mat("Mat_WoodWalnut", "#744b28", "#4d2f16", rough=0.82, noise_scale=14.0, ao_dist=0.40),
        "wood_floor": make_gouache_mat("Mat_FloorPlanks", "#cca064", "#9b6d38", rough=0.82, noise_scale=14.0, ao_dist=0.40),
        "wainscot": make_gouache_mat("Mat_Wainscot", wainscot_hex, wainscot_dark, rough=0.85, noise_scale=12.0, ao_dist=0.40),
        "stone": make_gouache_mat("Mat_StoneBase", "#9c9484", "#736c5f", rough=0.92, noise_scale=8.0, ao_dist=0.45),
        "shutter": make_gouache_mat("Mat_Shutter", shutter_hex, shutter_dark, rough=0.82, noise_scale=14.0, ao_dist=0.35),
        "quilt": make_gouache_mat("Mat_QuiltGingham", "#c84b34", "#9c301d", rough=0.88, ao_dist=0.30, pattern="gingham", pattern_hex2="#f7edd9", pattern_scale=9.0),
        "sheet": make_gouache_mat("Mat_CreamLinen", "#faf3e3", "#e2d6bc", rough=0.88, noise_scale=18.0, ao_dist=0.30),
        "rug_teal": make_gouache_mat("Mat_RugTeal", "#3d8f85", "#296961", rough=0.94, noise_scale=20.0, ao_dist=0.30),
        "rug_cream": make_gouache_mat("Mat_RugCream", "#f2e5cb", "#d6c5a5", rough=0.94, noise_scale=20.0, ao_dist=0.30),
        "rug_warm": make_gouache_mat("Mat_RugWarm", "#d98d59", "#b56938", rough=0.94, noise_scale=20.0, ao_dist=0.30),
        "rug_blue": make_gouache_mat("Mat_RugSkyBlue", "#5c8ba8", "#3d6680", rough=0.94, noise_scale=20.0, ao_dist=0.30),
        "rug_sage": make_gouache_mat("Mat_RugSage", "#6e9963", "#4c7043", rough=0.94, noise_scale=20.0, ao_dist=0.30),
        "sand": make_gouache_mat("Mat_TankSand", "#ead8ae", "#cfba88", rough=0.92, noise_scale=20.0, ao_dist=0.30),
        "kelp": make_gouache_mat("Mat_LeafGreen", "#589e52", "#3b7537", rough=0.82, noise_scale=16.0, ao_dist=0.30),
        "terra": make_gouache_mat("Mat_Terracotta", "#c96e46", "#964b2b", rough=0.84, noise_scale=18.0, ao_dist=0.30),
        "coral": make_gouache_mat("Mat_CoralAccent", "#e35a3b", "#ad3921", rough=0.78, noise_scale=18.0, ao_dist=0.25),
        "pink": make_gouache_mat("Mat_FlowerPink", "#eb8da1", "#c46277", rough=0.82, noise_scale=20.0, ao_dist=0.20),
        "ceramic": make_gouache_mat("Mat_CeramicTeal", "#4da3a8", "#317378", rough=0.72, noise_scale=18.0, ao_dist=0.25),
        "sign_fish": make_gouache_mat("Mat_SignSilverBlue", "#8ca4b3", "#5d7382", rough=0.80, noise_scale=16.0, ao_dist=0.30),
        # Special unbaked glTF-native materials (glossy brass, emissive windows/lamps, translucent aquarium glass!)
        "brass": make_gouache_mat("Mat_Brass", "#e3b859", "#a88032", rough=0.32, metal=0.70, ao_strength=0.0, bump_str=0.0),
        "lamp": make_gouache_mat("Mat_WarmLamp", "#ffebb5", "#ffd17a", rough=0.38, emit_hex="#ffc65c", emit_str=1.55, ao_strength=0.0, bump_str=0.0),
        "aqua_glass": make_gouache_mat("Mat_AquaGlass", "#5ed4c6", "#299990", rough=0.14, alpha=0.30, emit_hex="#3fb8ab", emit_str=0.30, ao_strength=0.0, bump_str=0.0),
    }


def build_cottage_shell(
    name, W, D, WH, door_x, porch_d, roof_h, mats,
    has_dormer=False, chimney_pos=(1.15, 0.55), has_right_railing=False, flower_pink=False
):
    """Shared modular storybook cottage shell conforming 100% to Exterior_Shell / Roof_Cutaway / Door_Hinge / Interior_Floor / Interior_Props."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)

    ext_shell = bpy.data.objects.new("Exterior_Shell", None)
    roof_cut = bpy.data.objects.new("Roof_Cutaway", None)
    int_floor = bpy.data.objects.new("Interior_Floor", None)
    int_props = bpy.data.objects.new("Interior_Props", None)
    for grp in (ext_shell, roof_cut, int_floor, int_props):
        grp.parent = root
        bpy.context.collection.objects.link(grp)

    floor_z = 0.14
    wall_t = 0.16
    door_w = 0.94
    door_h = 1.24
    wz = floor_z + WH * 0.5
    front_y = -D * 0.5 + wall_t * 0.5
    curb_h = 0.36
    upper_h = WH - curb_h
    dl = door_x - door_w * 0.5
    dr = door_x + door_w * 0.5

    # Foundation base
    add_box("Foundation_Base", (W + 0.24, D + 0.24, 0.44), (0, 0, -0.08), ext_shell, mats["stone"], bevel=0.024)

    # Individual beveled hardwood floor planks!
    plank_count = max(10, int(round(D * 4)))
    plank_d = (D - wall_t * 2) / plank_count
    for i in range(plank_count):
        py = -D * 0.5 + wall_t + (i + 0.5) * plank_d
        m = mats["wood_floor"] if i % 2 == 0 else mats["wood_honey"]
        add_box(f"FloorPlank_{i}", (W - wall_t * 1.9, plank_d - 0.008, 0.05), (0, py, floor_z - 0.015), int_floor, m, bevel=0.006)

    # Back, Left, Right exterior walls + cozy wainscoting dado inside!
    add_box("Wall_Back", (W, wall_t, WH), (0, D * 0.5 - wall_t * 0.5, wz), ext_shell, mats["stucco"], bevel=0.01)
    add_box("Wall_Left", (wall_t, D - wall_t * 2, WH), (-W * 0.5 + wall_t * 0.5, 0, wz), ext_shell, mats["stucco"], bevel=0.01)
    add_box("Wall_Right", (wall_t, D - wall_t * 2, WH), (W * 0.5 - wall_t * 0.5, 0, wz), ext_shell, mats["stucco"], bevel=0.01)

    dado_h = 0.66
    add_box("Dado_Back", (W - wall_t * 2, 0.03, dado_h), (0, D * 0.5 - wall_t - 0.015, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Back", (W - wall_t * 2, 0.055, 0.05), (0, D * 0.5 - wall_t - 0.02, floor_z + dado_h + 0.02), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Dado_Left", (0.03, D - wall_t * 2, dado_h), (-W * 0.5 + wall_t + 0.015, 0, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Left", (0.055, D - wall_t * 2, 0.05), (-W * 0.5 + wall_t + 0.02, 0, floor_z + dado_h + 0.02), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Dado_Right", (0.03, D - wall_t * 2, dado_h), (W * 0.5 - wall_t - 0.015, 0, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Right", (0.055, D - wall_t * 2, 0.05), (W * 0.5 - wall_t - 0.02, 0, floor_z + dado_h + 0.02), int_props, mats["wood_dark"], bevel=0.008)

    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(f"CornerPost_{sx}_{sy}", (0.14, 0.14, WH + 0.05), (sx * (W * 0.5 - 0.03), sy * (D * 0.5 - 0.03), wz), ext_shell, mats["wood_dark"], bevel=0.014)

    # Front wall split: 0.36m curb stays in Exterior_Shell, upper panels + lintel in Roof_Cutaway (ZERO Z-fighting!)
    lw = dl - (-W * 0.5)
    rw = W * 0.5 - dr
    add_box("Wall_FrontLeft_Curb", (lw, wall_t, curb_h), (-W * 0.5 + lw * 0.5, front_y, floor_z + curb_h * 0.5), ext_shell, mats["stucco"], bevel=0.006)
    add_box("Wall_FrontRight_Curb", (rw, wall_t, curb_h), (dr + rw * 0.5, front_y, floor_z + curb_h * 0.5), ext_shell, mats["stucco"], bevel=0.006)
    add_box("Wall_FrontLeft_Upper", (lw, wall_t, upper_h), (-W * 0.5 + lw * 0.5, front_y, floor_z + curb_h + upper_h * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Wall_FrontRight_Upper", (rw, wall_t, upper_h), (dr + rw * 0.5, front_y, floor_z + curb_h + upper_h * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Wall_DoorLintel", (door_w + 0.01, wall_t - 0.004, WH - door_h), (door_x, front_y, floor_z + door_h + (WH - door_h) * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Front_EaveBeam", (W + 0.08, 0.14, 0.10), (0, front_y - 0.04, floor_z + WH - 0.04), roof_cut, mats["wood_dark"], bevel=0.01)

    # Doorframe + Threshold + Hinged Carved Door (`Door_Hinge` at left jamb edge!)
    add_box("Jamb_L", (0.09, wall_t + 0.06, door_h + 0.06), (dl, front_y, floor_z + door_h * 0.5), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Jamb_R", (0.09, wall_t + 0.06, door_h + 0.06), (dr, front_y, floor_z + door_h * 0.5), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Jamb_Top", (door_w + 0.16, wall_t + 0.08, 0.09), (door_x, front_y, floor_z + door_h + 0.03), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Door_Sill", (door_w + 0.12, wall_t + 0.14, 0.05), (door_x, front_y, floor_z + 0.025), ext_shell, mats["wood_honey"], bevel=0.008)

    door_hinge = bpy.data.objects.new("Door_Hinge", None)
    door_hinge.location = (dl + 0.035, front_y, floor_z + 0.03)
    door_hinge.parent = root
    bpy.context.collection.objects.link(door_hinge)

    leaf_w = door_w - 0.07
    leaf_h = door_h - 0.04
    add_box("Door_Leaf_Core", (leaf_w, 0.07, leaf_h), (leaf_w * 0.5, 0, leaf_h * 0.5), door_hinge, mats["wood_honey"], bevel=0.012)
    add_box("Door_RailTop", (leaf_w - 0.08, 0.09, 0.11), (leaf_w * 0.5, 0, leaf_h - 0.11), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_RailMid", (leaf_w - 0.08, 0.09, 0.09), (leaf_w * 0.5, 0, leaf_h * 0.48), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_RailBot", (leaf_w - 0.08, 0.09, 0.11), (leaf_w * 0.5, 0, 0.11), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_WindowGlow", (0.32, 0.085, 0.28), (leaf_w * 0.5, 0, leaf_h * 0.72), door_hinge, mats["lamp"], bevel=0.005)
    add_sphere("Knob_Front", (0.040, 0.040, 0.040), (leaf_w - 0.12, -0.058, leaf_h * 0.46), door_hinge, mats["brass"])
    add_sphere("Knob_Back", (0.040, 0.040, 0.040), (leaf_w - 0.12, 0.058, leaf_h * 0.46), door_hinge, mats["brass"])

    # Front wooden porch deck + steps + clean posts terminating cleanly UNDER sloping porch awning!
    p_planks = max(4, int(round(porch_d / 0.20)))
    p_step = porch_d / p_planks
    for i in range(p_planks):
        py = -D * 0.5 - (i + 0.5) * p_step
        add_box(f"PorchPlank_{i}", (W + 0.18, p_step - 0.015, 0.08), (0, py, floor_z - 0.03), ext_shell, mats["wood_honey"], bevel=0.008)
    add_box("Porch_Skirt", (W + 0.08, porch_d - 0.08, 0.36), (0, -D * 0.5 - porch_d * 0.5, floor_z - 0.24), ext_shell, mats["stone"], bevel=0.015)

    post_h = 1.34
    post_xs = [-W * 0.46, W * 0.46]
    if has_right_railing:
        post_xs.insert(1, door_x + door_w * 0.5 + 0.28)
    for px in post_xs:
        add_cyl(f"PorchPost_{px:.2f}", 0.058, post_h, (px, -D * 0.5 - porch_d + 0.10, floor_z + post_h * 0.5), ext_shell, mats["wood_dark"], verts=12)

    if has_right_railing:
        r_start = door_x + door_w * 0.5 + 0.28
        r_end = W * 0.46
        r_len = r_end - r_start
        r_y = -D * 0.5 - porch_d + 0.10
        add_box("Porch_TopRail", (r_len, 0.08, 0.06), ((r_start + r_end) * 0.5, r_y, floor_z + 0.56), ext_shell, mats["wood_dark"], bevel=0.008)
        add_box("Porch_BotRail", (r_len, 0.07, 0.05), ((r_start + r_end) * 0.5, r_y, floor_z + 0.14), ext_shell, mats["wood_dark"], bevel=0.008)
        for b in range(7):
            bx = r_start + 0.18 + b * ((r_len - 0.36) / 6.0)
            add_box(f"Baluster_{b}", (0.04, 0.04, 0.40), (bx, r_y, floor_z + 0.35), ext_shell, mats["wood_honey"], bevel=0.005)

    for s in range(2):
        add_box(f"PorchStep_{s}", (door_w + 0.42, 0.30, 0.10), (door_x, -D * 0.5 - porch_d - 0.13 - s * 0.26, floor_z - 0.08 - s * 0.085), ext_shell, mats["wood_honey"], bevel=0.01)

    # ---- GABLE ROOF + LAYERED 3D SHINGLE ROWS + TIMBER BARGEBOARDS + DORMER + CHIMNEY + AWNING ----
    ov_x, ov_y = 0.28, 0.30
    hx, hy = W * 0.5 + ov_x, D * 0.5 + ov_y
    bm = bmesh.new()
    v0 = bm.verts.new((-hx, -hy, floor_z + WH - 0.04))
    v1 = bm.verts.new((-hx, 0, floor_z + WH + roof_h))
    v2 = bm.verts.new((-hx, hy, floor_z + WH - 0.04))
    v3 = bm.verts.new((hx, -hy, floor_z + WH - 0.04))
    v4 = bm.verts.new((hx, 0, floor_z + WH + roof_h))
    v5 = bm.verts.new((hx, hy, floor_z + WH - 0.04))
    bm.faces.new((v0, v1, v2))
    bm.faces.new((v5, v4, v3))
    bm.faces.new((v0, v3, v4, v1))
    bm.faces.new((v1, v4, v5, v2))
    bm.faces.new((v0, v2, v5, v3))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rm = bpy.data.meshes.new("Roof_Gable")
    bm.to_mesh(rm)
    bm.free()
    ro = bpy.data.objects.new("Roof_Gable", rm)
    bpy.context.collection.objects.link(ro)
    ro.parent = roof_cut
    ro.data.materials.append(mats["roof"])
    bev = ro.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.025
    bev.segments = 2

    add_box("Roof_RidgeBeam", (W + ov_x * 2 + 0.16, 0.16, 0.13), (0, 0, floor_z + WH + roof_h + 0.03), roof_cut, mats["wood_dark"], bevel=0.015)

    slope_len = math.hypot(hy, roof_h + 0.04)
    slope_ang = math.atan2(roof_h + 0.04, hy)
    for slope_sign in (-1, 1):
        for r_i in range(5):
            t_s = (r_i + 0.5) / 5.0
            ry_p = slope_sign * (1.0 - t_s) * hy
            rz_p = floor_z + WH - 0.02 + t_s * (roof_h + 0.02)
            add_box(f"ShingleRow_{slope_sign}_{r_i}", (W + ov_x * 2 + 0.04, slope_len / 4.5, 0.045), (0, ry_p, rz_p + 0.025), roof_cut, mats["roof"], bevel=0.01, rot=(slope_sign * (-slope_ang + 0.05), 0, 0))

    for gx in (-hx + 0.03, hx - 0.03):
        for sy in (-1, 1):
            add_box(f"Barge_{gx:.1f}_{sy}", (0.08, slope_len + 0.08, 0.10), (gx, sy * hy * 0.5, floor_z + WH + roof_h * 0.5), roof_cut, mats["wood_dark"], bevel=0.01, rot=(-sy * slope_ang, 0, 0))

    if has_dormer:
        dm_x, dm_y, dm_z = -0.25, -hy * 0.52, floor_z + WH + roof_h * 0.44
        add_box("Dormer_Body", (0.94, 0.84, 0.62), (dm_x, dm_y, dm_z), roof_cut, mats["stucco"], bevel=0.01)
        add_box("Dormer_RoofL", (0.62, 1.00, 0.08), (dm_x - 0.27, dm_y - 0.04, dm_z + 0.41), roof_cut, mats["roof"], bevel=0.01, rot=(0, -0.50, 0))
        add_box("Dormer_RoofR", (0.62, 1.00, 0.08), (dm_x + 0.27, dm_y - 0.04, dm_z + 0.41), roof_cut, mats["roof"], bevel=0.01, rot=(0, 0.50, 0))
        add_box("Dormer_Frame", (0.56, 0.08, 0.42), (dm_x, dm_y - 0.42, dm_z - 0.02), roof_cut, mats["wood_dark"], bevel=0.008)
        add_box("Dormer_Glass", (0.44, 0.09, 0.32), (dm_x, dm_y - 0.42, dm_z - 0.02), roof_cut, mats["lamp"], bevel=0.004)
        add_box("Dormer_MulV", (0.04, 0.11, 0.34), (dm_x, dm_y - 0.42, dm_z - 0.02), roof_cut, mats["wood_dark"], bevel=0.003)
        add_box("Dormer_MulH", (0.46, 0.11, 0.04), (dm_x, dm_y - 0.42, dm_z - 0.02), roof_cut, mats["wood_dark"], bevel=0.003)

    # Downward-sloping porch awning cleanly resting atop porch fascia & posts!
    add_box("Porch_Awning", (W + 0.34, porch_d + 0.30, 0.10), (0, -D * 0.5 - porch_d * 0.48, floor_z + 1.54), roof_cut, mats["roof"], bevel=0.015, rot=(0.20, 0, 0))
    add_box("Porch_Fascia", (W + 0.36, 0.07, 0.09), (0, -D * 0.5 - porch_d + 0.10, floor_z + 1.40), roof_cut, mats["wood_dark"], bevel=0.008)

    # Warm hanging brass porch lantern beside doorway!
    lan_x = door_x + door_w * 0.5 + 0.22
    add_box("Lantern_Arm", (0.04, 0.20, 0.04), (lan_x, front_y - 0.11, floor_z + 1.24), roof_cut, mats["wood_dark"], bevel=0.004)
    add_cyl("Lantern_Cap", 0.082, 0.045, (lan_x, front_y - 0.19, floor_z + 1.18), roof_cut, mats["brass"], verts=12)
    add_cyl("Lantern_Glow", 0.062, 0.14, (lan_x, front_y - 0.19, floor_z + 1.09), roof_cut, mats["lamp"], verts=12)
    add_cyl("Lantern_Base", 0.075, 0.036, (lan_x, front_y - 0.19, floor_z + 1.00), roof_cut, mats["brass"], verts=12)

    # Stone chimney
    cx, cy = chimney_pos
    add_box("Chimney_Shaft", (0.46, 0.46, 1.80), (cx, cy, floor_z + WH + 0.72), roof_cut, mats["stone"], bevel=0.022)
    add_box("Chimney_Collar", (0.54, 0.54, 0.11), (cx, cy, floor_z + WH + 1.50), roof_cut, mats["stone"], bevel=0.015)
    add_box("Chimney_Cap", (0.60, 0.60, 0.09), (cx, cy, floor_z + WH + 1.63), roof_cut, mats["stone"], bevel=0.014)

    # Cozy shuttered windows with flower boxes!
    def add_window(wname, loc, rot_z, parent_grp):
        wg = bpy.data.objects.new(wname, None)
        wg.location = loc
        wg.rotation_euler = (0, 0, rot_z)
        wg.parent = parent_grp
        bpy.context.collection.objects.link(wg)
        add_box(f"{wname}_Frame", (0.60, 0.09, 0.58), (0, 0, 0), wg, mats["wood_dark"], bevel=0.01)
        add_box(f"{wname}_Glass", (0.46, 0.095, 0.44), (0, 0, 0), wg, mats["lamp"], bevel=0.004)
        add_box(f"{wname}_MulV", (0.04, 0.11, 0.46), (0, 0, 0), wg, mats["wood_dark"], bevel=0.003)
        add_box(f"{wname}_MulH", (0.48, 0.11, 0.04), (0, 0, 0), wg, mats["wood_dark"], bevel=0.003)
        add_box(f"{wname}_ShutL", (0.19, 0.06, 0.56), (-0.40, -0.02, 0), wg, mats["shutter"], bevel=0.008)
        add_box(f"{wname}_ShutR", (0.19, 0.06, 0.56), (0.40, -0.02, 0), wg, mats["shutter"], bevel=0.008)
        add_box(f"{wname}_Box", (0.64, 0.19, 0.14), (0, -0.10, -0.34), wg, mats["wood_honey"], bevel=0.01)
        add_sphere(f"{wname}_Leaf", (0.26, 0.095, 0.075), (0, -0.10, -0.24), wg, mats["kelp"])
        fmat = mats["pink"] if flower_pink else mats["coral"]
        add_sphere(f"{wname}_Flw1", (0.052, 0.052, 0.052), (-0.13, -0.12, -0.19), wg, fmat)
        add_sphere(f"{wname}_Flw2", (0.052, 0.052, 0.052), (0.02, -0.13, -0.18), wg, mats["lamp"])
        add_sphere(f"{wname}_Flw3", (0.048, 0.048, 0.048), (0.14, -0.11, -0.19), wg, fmat)

    add_window("Win_Right", (W * 0.5 + 0.01, 0.05, floor_z + 1.04), math.pi * 0.5, ext_shell)
    add_window("Win_Left", (-W * 0.5 - 0.01, 0.05, floor_z + 1.04), -math.pi * 0.5, ext_shell)

    # Charming oak barrel sitting neatly on the porch corner (signature detail from our Codex board!)
    bx_p = -W * 0.5 + 0.34 if door_x >= -0.1 else W * 0.5 - 0.36
    by_p = -D * 0.5 - 0.38
    add_cyl("Porch_Barrel", 0.18, 0.38, (bx_p, by_p, floor_z + 0.20), ext_shell, mats["wood_honey"], verts=14)
    add_cyl("Porch_BarrelHoop1", 0.188, 0.032, (bx_p, by_p, floor_z + 0.10), ext_shell, mats["wood_dark"], verts=14)
    add_cyl("Porch_BarrelHoop2", 0.188, 0.032, (bx_p, by_p, floor_z + 0.30), ext_shell, mats["wood_dark"], verts=14)

    return root, ext_shell, roof_cut, door_hinge, int_props, floor_z, wall_t, add_window


# =============================================================================
# 1. HOUSE_PLAYER: 我的临水红顶小屋
# =============================================================================
def build_house_player():
    W, D, WH = 4.20, 3.40, 1.92
    mats = make_house_palette("#c84b34", "#8e2d1e", "#35787a", "#225355", "#8fa98d", "#6e886c")
    root, ext_shell, roof_cut, door_hinge, int_props, floor_z, wall_t, add_window = build_cottage_shell(
        "House_Player_Antigravity", W, D, WH, door_x=-0.68, porch_d=1.22, roof_h=1.32, mats=mats,
        has_dormer=True, chimney_pos=(1.28, 0.72), has_right_railing=True, flower_pink=False
    )
    add_window("Win_Front", (0.88, -D * 0.5 - 0.01, floor_z + 1.06), 0.0, roof_cut)

    # Braided tri-color rug
    for rname, rad, zoff, m in [("Rug_Outer", 0.96, 0.022, mats["rug_teal"]), ("Rug_Mid", 0.72, 0.024, mats["rug_cream"]), ("Rug_Inner", 0.44, 0.026, mats["rug_warm"])]:
        o = add_cyl(rname, rad, 0.022, (-0.08, -0.25, floor_z + zoff), int_props, m, verts=32)
        o.scale = (1.18, 0.85, 1.0)
        bpy.ops.object.transform_apply(scale=True)

    # Quilted gingham single bed (back-left) + Anchor_Bed!
    bx, by = -1.26, D * 0.5 - 0.98
    add_box("Bed_Base", (1.22, 1.52, 0.24), (bx, by, floor_z + 0.15), int_props, mats["wood_honey"], bevel=0.02)
    for lx in (-0.54, 0.54):
        for ly in (-0.68, 0.68):
            add_cyl(f"BedLeg_{lx}_{ly}", 0.05, 0.14, (bx + lx, by + ly, floor_z + 0.07), int_props, mats["wood_dark"], verts=10)
    add_box("Bed_Headboard", (1.26, 0.10, 0.66), (bx, by + 0.72, floor_z + 0.44), int_props, mats["wood_dark"], bevel=0.025)
    add_sphere("Bed_FinialL", (0.065, 0.065, 0.065), (bx - 0.58, by + 0.72, floor_z + 0.80), int_props, mats["wood_honey"])
    add_sphere("Bed_FinialR", (0.065, 0.065, 0.065), (bx + 0.58, by + 0.72, floor_z + 0.80), int_props, mats["wood_honey"])
    add_box("Bed_Mattress", (1.12, 1.40, 0.16), (bx, by, floor_z + 0.34), int_props, mats["sheet"], bevel=0.04)
    add_box("Bed_Quilt", (1.16, 0.98, 0.15), (bx, by - 0.21, floor_z + 0.38), int_props, mats["quilt"], bevel=0.055)
    add_box("Bed_SheetFold", (1.16, 0.18, 0.155), (bx, by + 0.24, floor_z + 0.385), int_props, mats["sheet"], bevel=0.045)
    add_sphere("Bed_PillowL", (0.30, 0.18, 0.095), (bx - 0.26, by + 0.50, floor_z + 0.48), int_props, mats["sheet"], rot=(0.12, 0.06, 0))
    add_sphere("Bed_PillowR", (0.28, 0.17, 0.085), (bx + 0.25, by + 0.48, floor_z + 0.47), int_props, mats["sheet"], rot=(0.10, -0.08, 0.08))

    anc_bed = bpy.data.objects.new("Anchor_Bed", None)
    anc_bed.location = (bx, by + 0.12, floor_z + 0.48)
    anc_bed.parent = root
    bpy.context.collection.objects.link(anc_bed)

    # Handcrafted Glass Home Aquarium Cabinet (back-right) + Anchor_Aquarium AT FLOOR BASE (matches town.js fish swim heights!)
    ax, ay = 0.68, D * 0.5 - 0.54
    tw, td, th, sh = 1.84, 0.58, 0.86, 0.56
    add_box("Aq_Cabinet", (tw + 0.14, td + 0.12, sh), (ax, ay, floor_z + sh * 0.5), int_props, mats["wood_honey"], bevel=0.02)
    add_box("Aq_CounterTop", (tw + 0.20, td + 0.16, 0.055), (ax, ay, floor_z + sh + 0.015), int_props, mats["wood_dark"], bevel=0.012)
    for sx in (-0.46, 0.46):
        add_box(f"Aq_Door_{sx}", (0.76, 0.035, 0.40), (ax + sx, ay - td * 0.5 - 0.06, floor_z + sh * 0.5), int_props, mats["wood_dark"], bevel=0.008)
        add_sphere(f"Aq_Knob_{sx}", (0.028, 0.028, 0.028), (ax + sx * 0.25, ay - td * 0.5 - 0.09, floor_z + sh * 0.54), int_props, mats["brass"])
    add_box("Aq_Sand", (tw - 0.06, td - 0.06, 0.09), (ax, ay, floor_z + sh + 0.08), int_props, mats["sand"], bevel=0.015)
    for rx, ry, rs in [(-0.56, 0.06, 0.12), (0.48, 0.08, 0.11), (0.04, 0.12, 0.09)]:
        add_sphere(f"Aq_Rock_{rx}", (rs * 1.3, rs, rs * 0.72), (ax + rx, ay + ry, floor_z + sh + 0.14), int_props, mats["stone"])
    for idx_k, (kx, ky, kh, yaw) in enumerate([(-0.68, 0.10, 0.44, 0.3), (-0.56, 0.02, 0.34, -0.5), (0.64, 0.10, 0.46, 0.8), (0.50, 0.04, 0.32, -0.4), (0.06, 0.12, 0.38, 0.1)]):
        for seg in range(3):
            t_s = (seg + 0.5) / 3.0
            sway = math.sin(seg * 1.1 + idx_k) * 0.032
            add_sphere(f"Aq_Kelp_{idx_k}_{seg}", (0.042 - seg * 0.006, 0.018, kh * 0.24), (ax + kx + sway, ay + ky, floor_z + sh + 0.14 + t_s * kh), int_props, mats["kelp"], rot=(0.15, sway * 3.5, yaw + seg * 0.4))
    add_box("Aq_WaterGlow", (tw - 0.04, td - 0.04, th - 0.08), (ax, ay, floor_z + sh + th * 0.52), int_props, mats["aqua_glass"], bevel=0.005)
    for cx in (-1, 1):
        for cy in (-1, 1):
            add_box(f"Aq_Post_{cx}_{cy}", (0.05, 0.05, th), (ax + cx * tw * 0.5, ay + cy * td * 0.5, floor_z + sh + th * 0.5 + 0.04), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Aq_Hood", (tw + 0.10, td + 0.10, 0.08), (ax, ay, floor_z + sh + th + 0.06), int_props, mats["wood_dark"], bevel=0.015)
    add_box("Aq_LightStrip", (tw - 0.26, 0.10, 0.03), (ax, ay, floor_z + sh + th + 0.015), int_props, mats["lamp"], bevel=0.005)

    # IMPORTANT: Anchor_Aquarium sits at floor base (floor_z) because createHomeAquarium swimmers add +standH!
    anc_aq = bpy.data.objects.new("Anchor_Aquarium", None)
    anc_aq.location = (ax, ay, floor_z)
    anc_aq.parent = root
    bpy.context.collection.objects.link(anc_aq)

    # Framed Koi painting + Left wall jar shelf + Nightstand w/ lamp + Plant + Wicker creel & rod!
    add_box("Art_Frame", (0.64, 0.045, 0.46), (bx, D * 0.5 - wall_t - 0.025, floor_z + 1.32), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Art_Canvas", (0.54, 0.05, 0.36), (bx, D * 0.5 - wall_t - 0.032, floor_z + 1.32), int_props, mats["sheet"], bevel=0.003)
    add_sphere("Art_KoiBody", (0.14, 0.025, 0.065), (bx - 0.02, D * 0.5 - wall_t - 0.052, floor_z + 1.32), int_props, mats["coral"])
    add_sphere("Art_KoiTail", (0.07, 0.02, 0.08), (bx + 0.12, D * 0.5 - wall_t - 0.052, floor_z + 1.32), int_props, mats["coral"])

    add_box("Shelf_Board", (0.24, 0.88, 0.045), (-W * 0.5 + wall_t + 0.13, -0.45, floor_z + 1.18), int_props, mats["wood_honey"], bevel=0.008)
    add_cyl("Shelf_Jar1", 0.06, 0.16, (-W * 0.5 + wall_t + 0.13, -0.68, floor_z + 1.28), int_props, mats["terra"], verts=12)
    add_cyl("Shelf_Jar2", 0.052, 0.13, (-W * 0.5 + wall_t + 0.13, -0.46, floor_z + 1.265), int_props, mats["shutter"], verts=12)
    add_cyl("Shelf_Cup", 0.048, 0.10, (-W * 0.5 + wall_t + 0.13, -0.24, floor_z + 1.25), int_props, mats["sheet"], verts=12)

    nx, ny = 1.64, -0.35
    add_box("Nightstand_Body", (0.50, 0.50, 0.48), (nx, ny, floor_z + 0.25), int_props, mats["wood_honey"], bevel=0.018)
    add_box("Nightstand_Top", (0.54, 0.54, 0.045), (nx, ny, floor_z + 0.50), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Nightstand_Drawer", (0.40, 0.03, 0.16), (nx - 0.25, ny, floor_z + 0.34), int_props, mats["wood_dark"], bevel=0.006, rot=(0, 0, math.pi * 0.5))
    add_cyl("Lamp_Base", 0.075, 0.16, (nx, ny, floor_z + 0.60), int_props, mats["terra"], verts=14)
    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.17, radius2=0.09, depth=0.22, location=(nx, ny, floor_z + 0.78))
    sh_o = bpy.context.active_object
    sh_o.name = "Lamp_Shade"
    for p in sh_o.data.polygons:
        p.use_smooth = True
    sh_o.parent = int_props
    sh_o.data.materials.append(mats["lamp"])

    px, py = 1.56, -1.16
    add_cyl("Pot_Terra", 0.15, 0.26, (px, py, floor_z + 0.14), int_props, mats["terra"], verts=14)
    add_cyl("Pot_Rim", 0.17, 0.05, (px, py, floor_z + 0.26), int_props, mats["terra"], verts=14)
    for la in range(6):
        ang = la * (math.tau / 6.0)
        add_sphere(f"PlantLeaf_{la}", (0.14, 0.075, 0.04), (px + math.cos(ang) * 0.12, py + math.sin(ang) * 0.12, floor_z + 0.35 + (la % 2) * 0.05), int_props, mats["kelp"], rot=(0.25, 0.35, ang))

    add_cyl("Wicker_Creel", 0.17, 0.30, (0.98, -1.24, floor_z + 0.16), int_props, mats["wood_honey"], verts=16)
    add_cyl("Wicker_Band", 0.176, 0.04, (0.98, -1.24, floor_z + 0.16), int_props, mats["wood_dark"], verts=16)
    add_cyl("Wicker_Rim", 0.18, 0.05, (0.98, -1.24, floor_z + 0.30), int_props, mats["wood_dark"], verts=16)
    add_cyl("Corner_BambooRod", 0.017, 1.38, (0.86, -1.36, floor_z + 0.70), int_props, mats["wood_honey"], verts=10, rot=(-0.10, 0.12, 0))
    add_cyl("Corner_RodGrip", 0.025, 0.24, (0.80, -1.30, floor_z + 0.18), int_props, mats["wood_dark"], verts=10, rot=(-0.10, 0.12, 0))
    add_cyl("Corner_RodReel", 0.042, 0.036, (0.85, -1.34, floor_z + 0.35), int_props, mats["brass"], verts=12, rot=(0, math.pi * 0.5, 0))

    return root, roof_cut, door_hinge


# =============================================================================
# 2. HOUSE_ARTISAN: 老周渔具工坊 (Teal-Slate Roof + Fish Sign + Workbench + 4-Rod Rack!)
# =============================================================================
def build_house_artisan():
    W, D, WH = 3.55, 2.90, 1.82
    mats = make_house_palette("#2f7b7a", "#1d5454", "#b87a3d", "#7d4f22", "#8e7b63", "#695945")
    root, ext_shell, roof_cut, door_hinge, int_props, floor_z, wall_t, _ = build_cottage_shell(
        "House_Artisan_Antigravity", W, D, WH, door_x=0.0, porch_d=0.92, roof_h=1.22, mats=mats,
        has_dormer=False, chimney_pos=(-0.95, 0.45), has_right_railing=False, flower_pink=False
    )

    # Signature Exterior Hanging Wooden Fish Signboard above front porch awning (inspired by Codex board!)
    sy_sign = -D * 0.5 - 0.84
    sz_sign = floor_z + 1.24
    add_sphere("Sign_FishBody", (0.34, 0.065, 0.125), (0.0, sy_sign, sz_sign), roof_cut, mats["sign_fish"])
    add_sphere("Sign_FishTail", (0.14, 0.045, 0.145), (0.34, sy_sign, sz_sign), roof_cut, mats["sign_fish"])
    add_sphere("Sign_FishEye", (0.025, 0.072, 0.025), (-0.18, sy_sign, sz_sign + 0.02), roof_cut, mats["wood_dark"])

    # Hanging red & cream fishing buoys on front-right porch wall!
    for idx_b, bx_b in enumerate((1.12, 1.32)):
        add_sphere(f"Buoy_Top_{idx_b}", (0.075, 0.075, 0.105), (bx_b, -D * 0.5 - 0.12, floor_z + 1.05 - idx_b * 0.08), roof_cut, mats["coral"])
        add_sphere(f"Buoy_Bot_{idx_b}", (0.076, 0.076, 0.065), (bx_b, -D * 0.5 - 0.12, floor_z + 0.99 - idx_b * 0.08), roof_cut, mats["sheet"])

    # ---- RICH TACKLE WORKSHOP INTERIOR ----
    # Center sage braided workshop mat
    for rname, rad, zoff, m in [("Mat_Out", 0.78, 0.020, mats["rug_sage"]), ("Mat_In", 0.52, 0.023, mats["rug_cream"])]:
        o = add_cyl(rname, rad, 0.020, (0.0, -0.18, floor_z + zoff), int_props, m, verts=28)
        o.scale = (1.22, 0.82, 1.0)
        bpy.ops.object.transform_apply(scale=True)

    # Back Wall Master Tackle Workbench (Full of spools, paint cans, bamboo rod blank, hand plane & glowing desk lantern!)
    wx, wy = 0.0, D * 0.5 - 0.48
    add_box("Bench_Top", (2.35, 0.62, 0.07), (wx, wy, floor_z + 0.72), int_props, mats["wood_honey"], bevel=0.014)
    add_box("Bench_Shelf", (2.15, 0.48, 0.05), (wx, wy, floor_z + 0.24), int_props, mats["wood_dark"], bevel=0.01)
    for lx in (-1.05, 1.05):
        for ly in (-0.24, 0.24):
            add_box(f"Bench_Leg_{lx}_{ly}", (0.09, 0.09, 0.70), (wx + lx, wy + ly, floor_z + 0.35), int_props, mats["wood_dark"], bevel=0.01)

    # Bench Props: Colorful line spools, lacquer paint pots, bamboo rod blank, wooden mallet & glowing desk lamp!
    for sx, smat in [(-0.88, mats["coral"]), (-0.70, mats["ceramic"]), (-0.54, mats["rug_sage"])]:
        add_cyl(f"Spool_{sx}", 0.058, 0.12, (sx, wy + 0.08, floor_z + 0.82), int_props, smat, verts=14)
        add_cyl(f"SpoolTop_{sx}", 0.068, 0.02, (sx, wy + 0.08, floor_z + 0.88), int_props, mats["wood_dark"], verts=14)
    # Half-finished bamboo fishing rod blank + brass reel resting on bench
    add_cyl("Bench_RodBlank", 0.016, 1.25, (0.05, wy - 0.10, floor_z + 0.775), int_props, mats["wood_honey"], verts=10, rot=(0, math.pi * 0.5, 0.06))
    add_cyl("Bench_BrassReel", 0.052, 0.042, (-0.25, wy - 0.14, floor_z + 0.78), int_props, mats["brass"], verts=14)
    # Paint cans & glowing brass workshop lantern on right end of bench
    add_cyl("PaintCan_1", 0.068, 0.15, (0.62, wy + 0.10, floor_z + 0.83), int_props, mats["terra"], verts=14)
    add_cyl("PaintCan_2", 0.058, 0.12, (0.78, wy + 0.12, floor_z + 0.815), int_props, mats["shutter"], verts=14)
    add_cyl("Bench_LampBase", 0.085, 0.05, (0.96, wy - 0.04, floor_z + 0.78), int_props, mats["brass"], verts=14)
    add_cyl("Bench_LampGlow", 0.065, 0.16, (0.96, wy - 0.04, floor_z + 0.88), int_props, mats["lamp"], verts=14)
    add_cyl("Bench_LampCap", 0.095, 0.04, (0.96, wy - 0.04, floor_z + 0.98), int_props, mats["brass"], verts=14)
    # Wall tool pegboard above bench
    add_box("Bench_Pegboard", (1.65, 0.04, 0.44), (0.0, D * 0.5 - wall_t - 0.025, floor_z + 1.28), int_props, mats["wood_dark"], bevel=0.008)
    for px_t in (-0.55, -0.22, 0.12, 0.48):
        add_box(f"WallTool_{px_t}", (0.07, 0.05, 0.28), (px_t, D * 0.5 - wall_t - 0.055, floor_z + 1.28), int_props, mats["wood_honey"], bevel=0.006)

    anc_wb = bpy.data.objects.new("Anchor_Workbench", None)
    anc_wb.location = (0.0, wy - 0.58, floor_z)
    anc_wb.parent = root
    bpy.context.collection.objects.link(anc_wb)

    # Left Wall: Standing 4-Rod Painted Fishing Rod Display Rack + Wooden Toolbox!
    rx_w = -W * 0.5 + wall_t + 0.22
    add_box("RodRack_Base", (0.28, 1.05, 0.10), (rx_w, -0.05, floor_z + 0.06), int_props, mats["wood_dark"], bevel=0.01)
    add_box("RodRack_TopRail", (0.16, 1.05, 0.07), (rx_w - 0.05, -0.05, floor_z + 0.96), int_props, mats["wood_dark"], bevel=0.008)
    rod_mats = [mats["wood_honey"], mats["ceramic"], mats["coral"], mats["brass"]]
    for ri in range(4):
        ry = -0.40 + ri * 0.24
        add_cyl(f"DisplayRod_{ri}", 0.017, 1.48, (rx_w, ry, floor_z + 0.80), int_props, rod_mats[ri], verts=10)
        add_cyl(f"DisplayReel_{ri}", 0.040, 0.036, (rx_w + 0.04, ry, floor_z + 0.42), int_props, mats["brass"], verts=12, rot=(0, math.pi * 0.5, 0))

    add_box("Toolbox_Body", (0.34, 0.52, 0.24), (rx_w + 0.04, -0.92, floor_z + 0.13), int_props, mats["terra"], bevel=0.012)
    add_box("Toolbox_Handle", (0.04, 0.34, 0.04), (rx_w + 0.04, -0.92, floor_z + 0.30), int_props, mats["wood_dark"], bevel=0.006)

    # Right Wall: Wall Bobber Display Shelf + Coiled Hemp Rope + Timber Stool!
    rx_r = W * 0.5 - wall_t - 0.16
    add_box("Bobber_Shelf", (0.22, 0.96, 0.045), (rx_r, -0.05, floor_z + 1.08), int_props, mats["wood_honey"], bevel=0.008)
    for bi in range(4):
        by_b = -0.38 + bi * 0.23
        add_sphere(f"BobberTop_{bi}", (0.052, 0.052, 0.052), (rx_r, by_b, floor_z + 1.16), int_props, mats["coral"] if bi % 2 == 0 else mats["ceramic"])
        add_sphere(f"BobberBot_{bi}", (0.048, 0.048, 0.035), (rx_r, by_b, floor_z + 1.13), int_props, mats["sheet"])
    add_cyl("Workshop_StoolSeat", 0.22, 0.06, (rx_r - 0.14, -0.78, floor_z + 0.36), int_props, mats["wood_dark"], verts=16)
    add_cyl("Workshop_StoolLeg", 0.13, 0.34, (rx_r - 0.14, -0.78, floor_z + 0.18), int_props, mats["wood_honey"], verts=14)

    return root, roof_cut, door_hinge


# =============================================================================
# 3. HOUSE_NEIGHBOR_EAST: 东岸海景木屋 (Amber Roof + Olive Shutters + Round Tea Table + Bookcase!)
# =============================================================================
def build_house_neighbor():
    W, D, WH = 3.25, 2.75, 1.76
    mats = make_house_palette("#d68a32", "#9e5e18", "#6d8f4b", "#49632e", "#87a3b3", "#5f7a8a")
    root, ext_shell, roof_cut, door_hinge, int_props, floor_z, wall_t, _ = build_cottage_shell(
        "House_Neighbor_Antigravity", W, D, WH, door_x=0.0, porch_d=0.86, roof_h=1.18, mats=mats,
        has_dormer=False, chimney_pos=(0.92, 0.42), has_right_railing=False, flower_pink=True
    )

    # Center blue-and-cream braided round rug!
    for rname, rad, zoff, m in [("NRug_Out", 0.78, 0.020, mats["rug_blue"]), ("NRug_Mid", 0.56, 0.023, mats["rug_cream"]), ("NRug_In", 0.32, 0.026, mats["rug_warm"])]:
        add_cyl(rname, rad, 0.020, (0.05, -0.05, floor_z + zoff), int_props, m, verts=32)

    # Round Honey-Wood Dining Table + 2 Wooden Stools + Ceramic Teapot & Twin Cups!
    tx, ty = 0.26, -0.05
    add_cyl("Dining_TableTop", 0.52, 0.065, (tx, ty, floor_z + 0.58), int_props, mats["wood_honey"], verts=26)
    add_cyl("Dining_TablePedestal", 0.11, 0.54, (tx, ty, floor_z + 0.29), int_props, mats["wood_dark"], verts=16)
    add_cyl("Dining_TableFoot", 0.28, 0.06, (tx, ty, floor_z + 0.04), int_props, mats["wood_dark"], verts=18)

    # Ceramic teapot & twin mugs on table!
    add_sphere("Tea_Pot", (0.105, 0.105, 0.095), (tx - 0.08, ty + 0.04, floor_z + 0.69), int_props, mats["ceramic"])
    add_sphere("Tea_PotLid", (0.045, 0.045, 0.032), (tx - 0.08, ty + 0.04, floor_z + 0.78), int_props, mats["sheet"])
    add_cyl("Tea_Cup1", 0.045, 0.075, (tx + 0.14, ty - 0.08, floor_z + 0.65), int_props, mats["sheet"], verts=12)
    add_cyl("Tea_Cup2", 0.045, 0.075, (tx + 0.06, ty + 0.18, floor_z + 0.65), int_props, mats["pink"], verts=12)

    for s_idx, (sx, sy) in enumerate([(tx - 0.68, ty - 0.18), (tx + 0.66, ty + 0.12)]):
        add_cyl(f"StoolSeat_{s_idx}", 0.20, 0.055, (sx, sy, floor_z + 0.36), int_props, mats["wood_honey"], verts=16)
        add_cyl(f"StoolBase_{s_idx}", 0.12, 0.34, (sx, sy, floor_z + 0.18), int_props, mats["wood_dark"], verts=14)

    # Back Wall: Open Handcrafted Wooden Bookcase displaying 18 colorful storybook volumes + Warm Reading Lamp!
    bx, by = -0.58, D * 0.5 - 0.38
    add_box("Bookcase_Back", (1.28, 0.06, 1.18), (bx, by + 0.16, floor_z + 0.60), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_SideL", (0.07, 0.38, 1.18), (bx - 0.61, by, floor_z + 0.60), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_SideR", (0.07, 0.38, 1.18), (bx + 0.61, by, floor_z + 0.60), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_Top", (1.32, 0.40, 0.06), (bx, by, floor_z + 1.18), int_props, mats["wood_dark"], bevel=0.012)
    add_box("Bookcase_Bot", (1.28, 0.38, 0.08), (bx, by, floor_z + 0.05), int_props, mats["wood_dark"], bevel=0.01)
    book_mats = [mats["coral"], mats["ceramic"], mats["rug_sage"], mats["wood_honey"], mats["pink"], mats["rug_blue"]]
    for shelf_i, sz in enumerate((floor_z + 0.28, floor_z + 0.64, floor_z + 0.98)):
        add_box(f"BookShelf_{shelf_i}", (1.16, 0.34, 0.04), (bx, by - 0.01, sz - 0.12), int_props, mats["wood_honey"], bevel=0.006)
        for bi in range(6):
            add_box(f"Book_{shelf_i}_{bi}", (0.14, 0.22, 0.21 + (bi % 2) * 0.03), (bx - 0.46 + bi * 0.18, by - 0.03, sz + 0.01), int_props, book_mats[(bi + shelf_i * 2) % len(book_mats)], bevel=0.006)
    # Cozy glowing lamp on top right of bookcase
    add_cyl("BookLamp_Base", 0.068, 0.13, (bx + 0.38, by - 0.02, floor_z + 1.26), int_props, mats["terra"], verts=14)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.15, radius2=0.08, depth=0.19, location=(bx + 0.38, by - 0.02, floor_z + 1.42))
    lsh = bpy.context.active_object
    lsh.name = "BookLamp_Shade"
    for p in lsh.data.polygons:
        p.use_smooth = True
    lsh.parent = int_props
    lsh.data.materials.append(mats["lamp"])

    # Back-Right Framed Sailboat Art + Potted Seaside Plant
    add_box("SeaArt_Frame", (0.58, 0.045, 0.44), (0.78, D * 0.5 - wall_t - 0.025, floor_z + 1.24), int_props, mats["wood_dark"], bevel=0.008)
    add_box("SeaArt_Canvas", (0.48, 0.05, 0.34), (0.78, D * 0.5 - wall_t - 0.032, floor_z + 1.24), int_props, mats["rug_blue"], bevel=0.003)
    add_sphere("SeaArt_Sail", (0.09, 0.02, 0.11), (0.78, D * 0.5 - wall_t - 0.052, floor_z + 1.26), int_props, mats["sheet"])

    px, py = 1.12, D * 0.5 - 0.52
    add_cyl("NPot_Terra", 0.16, 0.28, (px, py, floor_z + 0.15), int_props, mats["terra"], verts=14)
    for la in range(6):
        ang = la * (math.tau / 6.0)
        add_sphere(f"NLeaf_{la}", (0.14, 0.075, 0.042), (px + math.cos(ang) * 0.12, py + math.sin(ang) * 0.12, floor_z + 0.36 + (la % 2) * 0.05), int_props, mats["kelp"], rot=(0.25, 0.35, ang))

    # Left Wall: Coastal Seashell & Conch Display Shelf!
    lx_w = -W * 0.5 + wall_t + 0.14
    add_box("Shell_Shelf", (0.24, 0.88, 0.045), (lx_w, -0.15, floor_z + 1.06), int_props, mats["wood_honey"], bevel=0.008)
    add_sphere("Shell_Conch", (0.075, 0.105, 0.068), (lx_w, -0.40, floor_z + 1.15), int_props, mats["pink"], rot=(0.2, 0.3, 0.4))
    add_sphere("Shell_Scallop", (0.065, 0.075, 0.058), (lx_w, -0.14, floor_z + 1.14), int_props, mats["sheet"])
    add_cyl("Shell_Bottle", 0.048, 0.17, (lx_w, 0.12, floor_z + 1.17), int_props, mats["ceramic"], verts=12)

    return root, roof_cut, door_hinge


HOUSE_BUILDERS = {
    "house_player": build_house_player,
    "house_artisan": build_house_artisan,
    "house_neighbor_east": build_house_neighbor,
}


def run_house(hid):
    clear_scene()
    root, roof_cut, door_hinge = HOUSE_BUILDERS[hid]()

    # 1. Bake crisp 2048x2048 shadow-free Gouache + Crevice AO atlas for WebGL GLB!
    tex_png = os.path.join(TEX_DIR, f"{hid}_BaseColor.png")
    bake_gouache_atlas(root, tex_png, tex_size=2048)

    # 2. Save .blend and export WebGL-ready baked .glb BEFORE adding studio lights/cameras!
    blend_path = os.path.join(BASE_OUT, f"{hid}.blend")
    glb_path = os.path.join(EXP_DIR, f"{hid}.glb")
    export_clean_glb(blend_path, glb_path)

    # 3. Render Exterior + Cutaway 3/4 + 52° Top-Down Interior of the ACTUAL BAKED MESH!
    scene = bpy.context.scene
    setup_studio_render(scene, res_x=960, res_y=720, samples=36, is_house=True)
    cam_d = bpy.data.cameras.new("HouseCam")
    cam_d.lens = 50
    cam = bpy.data.objects.new("HouseCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    scale_k = 1.0 if hid == "house_player" else 0.86
    aim_camera(cam, (6.3 * scale_k, -8.6 * scale_k, 4.65 * scale_k), (0.0, -0.30, 1.25))
    scene.render.filepath = os.path.join(PREV_DIR, f"{hid}_ext.png")
    bpy.ops.render.render(write_still=True)

    set_hierarchy_hidden(roof_cut, True)
    door_hinge.rotation_euler = (0, 0, -math.radians(92))
    aim_camera(cam, (-3.6 * scale_k, -5.2 * scale_k, 4.2 * scale_k), (0.0, -0.05, 0.58))
    scene.render.filepath = os.path.join(PREV_DIR, f"{hid}_int34.png")
    bpy.ops.render.render(write_still=True)

    aim_camera(cam, (0.0, -4.9 * scale_k, 6.0 * scale_k), (0.0, -0.18, 0.45))
    scene.render.filepath = os.path.join(PREV_DIR, f"{hid}_top52.png")
    bpy.ops.render.render(write_still=True)
    print(f"[House Preview] Rendered all 3 baked views for {hid}")


def main():
    targets = []
    if "--" in sys.argv:
        targets = [a for a in sys.argv[sys.argv.index("--") + 1 :] if a in HOUSE_BUILDERS]
    if not targets:
        targets = list(HOUSE_BUILDERS.keys())
    for hid in targets:
        print(f"\n========== BUILDING HOUSE: {hid} ==========")
        run_house(hid)


if __name__ == "__main__":
    main()
