"""
Antigravity Studio — 《钓鱼大冒险 · 静水》Phase 2 v2.1 Enlarged Differentiated Village Assets
Built strictly from:
  1. GPT-6.2-Astra Ultra Review: art_pipeline/brief/ASTRA_ULTRA_WHITEBOX_V2_REVIEW.md
  2. Approved v2.1 Clay Whitebox: build_village_whitebox_v21.py
  3. GPT-6.2-Sol Image 2.5 Storyboard & Architectural Detail Sheet:
     art_pipeline/concepts/storyboards/stillwater_v2_storyboard_4panel.jpg
     art_pipeline/concepts/village_v21/village_v21_cottages_detail_sheet.png

Exports 5 2048px Cycles Gouache+AO Baked WebGL GLBs conforming 100% to `src/core/glbLoader.js` & `src/town.js`:
  1. `house_player.glb`        (5.40 x 4.40m, 3.70m steep coral flared roof + offset dormer + 1.48m cutaway porch + enlarged glass aquarium & gingham bed)
  2. `house_artisan.glb`       (4.60 x 3.80m, 3.10m low teal roof + 1.35x2.10m side lean-to tool shed + junction chimney + cargo door + enlarged tackle interior)
  3. `house_neighbor_east.glb` (4.30 x 3.60m, 3.25m honey roof + offset cross-gable vestibule + stone cheek wall + ship's wheel + slender gable chimney + cozy tea/book interior)
  4. `market_stall_v2.glb`     (2.85m striped scalloped awning + open transaction counter + vintage scale + fish ice crates + west hanging dried-fish rack!)
  5. `lighthouse_v2.glb`       (7.80m coral-and-cream striped coastal lighthouse + iron gallery + glowing beacon room + grounded keeper shed!)

CLI Usage:
  blender --background --python build_village_v21_assets_ag.py -- --asset house_player
"""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import (
    clear_scene,
    make_gouache_mat,
    add_box,
    add_cyl,
    add_sphere,
    bake_gouache_atlas,
    setup_studio_render,
    aim_camera,
    set_hierarchy_hidden,
    export_clean_glb,
)

BASE_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
TEX_DIR = os.path.join(BASE_OUT, "textures")
EXP_DIR = os.path.join(BASE_OUT, "exports", "environment")
PREV_DIR = os.path.join(BASE_OUT, "previews", "village_v21_audit")
for d in (TEX_DIR, EXP_DIR, PREV_DIR):
    os.makedirs(d, exist_ok=True)


def make_palette(roof_hex, roof_dark, shutter_hex, shutter_dark, wainscot_hex, wainscot_dark):
    return {
        "stucco": make_gouache_mat("Mat_StuccoCream", "#f3e9d6", "#d8cab0", rough=0.88, noise_scale=6.5, ao_dist=0.55),
        "roof": make_gouache_mat("Mat_RoofShingle", roof_hex, roof_dark, rough=0.80, noise_scale=10.0, ao_dist=0.55),
        "roof_alt": make_gouache_mat("Mat_RoofAlt", "#d64d36", "#9a2e1d", rough=0.80, noise_scale=10.0, ao_dist=0.50),
        "wood_honey": make_gouache_mat("Mat_WoodHoney", "#d49b54", "#9e6a32", rough=0.80, noise_scale=11.0, ao_dist=0.45),
        "wood_dark": make_gouache_mat("Mat_WoodWalnut", "#744b28", "#4d2f16", rough=0.82, noise_scale=13.0, ao_dist=0.45),
        "wood_floor": make_gouache_mat("Mat_FloorPlanks", "#cca064", "#9b6d38", rough=0.82, noise_scale=13.0, ao_dist=0.42),
        "wainscot": make_gouache_mat("Mat_Wainscot", wainscot_hex, wainscot_dark, rough=0.85, noise_scale=12.0, ao_dist=0.42),
        "stone": make_gouache_mat("Mat_StoneBase", "#9e9788", "#706a5d", rough=0.92, noise_scale=7.5, ao_dist=0.55),
        "stone_light": make_gouache_mat("Mat_StoneLight", "#bbb4a5", "#8a8375", rough=0.90, noise_scale=8.0, ao_dist=0.50),
        "shutter": make_gouache_mat("Mat_Shutter", shutter_hex, shutter_dark, rough=0.82, noise_scale=14.0, ao_dist=0.38),
        "quilt": make_gouache_mat("Mat_QuiltGingham", "#c84b34", "#9c301d", rough=0.88, ao_dist=0.32, pattern="gingham", pattern_hex2="#f7edd9", pattern_scale=9.0),
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
        "ice": make_gouache_mat("Mat_MarketIce", "#e4f2f4", "#bdd6dc", rough=0.45, noise_scale=24.0, ao_dist=0.20),
        "iron": make_gouache_mat("Mat_DarkIron", "#36383b", "#202224", rough=0.55, metal=0.45, noise_scale=14.0, ao_dist=0.30),
        # Special unbaked PBR/Emissive/Glass shaders preserved cleanly in GLB!
        "brass": make_gouache_mat("Mat_Brass", "#e3b859", "#a88032", rough=0.34, metal=0.70, ao_strength=0.0, bump_str=0.0),
        "lamp": make_gouache_mat("Mat_WarmLamp", "#ffebb5", "#ffd17a", rough=0.36, emit_hex="#ffc65c", emit_str=1.65, ao_strength=0.0, bump_str=0.0),
        "aqua_glass": make_gouache_mat("Mat_AquaGlass", "#5ed4c6", "#299990", rough=0.14, alpha=0.30, emit_hex="#3fb8ab", emit_str=0.30, ao_strength=0.0, bump_str=0.0),
    }


def add_flared_gable_roof(name, W, D, ridge_h, ov_x, ov_y, thick, base_z, parent, mat, tip_flare=0.0):
    """Storybook sculpted gable roof with optional upturned eave tips (+0.10m on Player's Home!)."""
    bm = bmesh.new()
    hw = W * 0.5 + ov_x
    hd = D * 0.5 + ov_y
    nx = 12
    for side in (-1, 1):
        top_g, bot_g = [], []
        for ix in range(nx + 1):
            tx = -1.0 + 2.0 * (ix / nx)
            x = tx * hw
            dist = hw - abs(x)
            flare = 0.0
            if tip_flare > 0.0 and dist < 0.72:
                u = 1.0 - dist / 0.72
                flare = tip_flare * (u * u)
            tr, br = [], []
            for s in (0.0, 0.5, 1.0):
                y = side * hd * s
                zt = base_z + ridge_h * (1.0 - s) + thick + flare * (0.35 + 0.65 * s)
                zb = zt - thick
                tr.append(bm.verts.new((x, y, zt)))
                br.append(bm.verts.new((x, y, zb)))
            top_g.append(tr)
            bot_g.append(br)

        for ix in range(nx):
            for j in range(2):
                a, b, c, d = top_g[ix][j], top_g[ix + 1][j], top_g[ix + 1][j + 1], top_g[ix][j + 1]
                bm.faces.new((a, b, c, d) if side > 0 else (d, c, b, a))
                ba, bb, bc, bd = bot_g[ix][j], bot_g[ix + 1][j], bot_g[ix + 1][j + 1], bot_g[ix][j + 1]
                bm.faces.new((bd, bc, bb, ba) if side > 0 else (ba, bb, bc, bd))
            e0, e1, e2, e3 = bot_g[ix][2], bot_g[ix + 1][2], top_g[ix + 1][2], top_g[ix][2]
            bm.faces.new((e0, e1, e2, e3) if side > 0 else (e3, e2, e1, e0))
        for end_i, flip in ((0, True), (nx, False)):
            for j in range(2):
                v0, v1, v2, v3 = bot_g[end_i][j], bot_g[end_i][j + 1], top_g[end_i][j + 1], top_g[end_i][j]
                cond = (side > 0) ^ flip
                bm.faces.new((v0, v1, v2, v3) if cond else (v3, v2, v1, v0))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def add_gable_triangles(name, W, D, ridge_h, base_z, parent, mat):
    """Left & right solid triangular stucco gable end walls under the roof ridge."""
    bm = bmesh.new()
    hw, hd = W * 0.5 - 0.01, D * 0.5 - 0.01
    v_fl = bm.verts.new((-hw, -hd, base_z))
    v_bl = bm.verts.new((-hw, hd, base_z))
    v_tl = bm.verts.new((-hw, 0.0, base_z + ridge_h + 0.02))
    v_fr = bm.verts.new((hw, -hd, base_z))
    v_br = bm.verts.new((hw, hd, base_z))
    v_tr = bm.verts.new((hw, 0.0, base_z + ridge_h + 0.02))
    bm.faces.new((v_bl, v_fl, v_tl))
    bm.faces.new((v_fr, v_br, v_tr))
    bm.faces.new((v_fl, v_fr, v_tr, v_tl))
    bm.faces.new((v_br, v_bl, v_tl, v_tr))
    bm.faces.new((v_fl, v_bl, v_br, v_fr))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def add_window(wname, loc, rot_z, parent_grp, mats, w=0.76, h=0.72, has_shutters=True, has_flowerbox=True, flower_pink=False):
    wg = bpy.data.objects.new(wname, None)
    wg.location = loc
    wg.rotation_euler = (0, 0, rot_z)
    wg.parent = parent_grp
    bpy.context.collection.objects.link(wg)
    add_box(f"{wname}_Frame", (w, 0.10, h), (0, 0, 0), wg, mats["wood_dark"], bevel=0.012)
    add_box(f"{wname}_Glass", (w - 0.14, 0.108, h - 0.14), (0, 0, 0), wg, mats["lamp"], bevel=0.004)
    add_box(f"{wname}_MulV", (0.045, 0.12, h - 0.12), (0, 0, 0), wg, mats["wood_dark"], bevel=0.003)
    add_box(f"{wname}_MulH", (w - 0.12, 0.12, 0.045), (0, 0, 0), wg, mats["wood_dark"], bevel=0.003)
    if has_shutters:
        sw = 0.22
        add_box(f"{wname}_ShutL", (sw, 0.06, h - 0.02), (-(w * 0.5 + sw * 0.5 + 0.01), -0.02, 0), wg, mats["shutter"], bevel=0.008)
        add_box(f"{wname}_ShutR", (sw, 0.06, h - 0.02), (w * 0.5 + sw * 0.5 + 0.01, -0.02, 0), wg, mats["shutter"], bevel=0.008)
    if has_flowerbox:
        add_box(f"{wname}_Box", (w + 0.08, 0.22, 0.16), (0, -0.11, -h * 0.5 - 0.08), wg, mats["wood_honey"], bevel=0.012)
        add_sphere(f"{wname}_Leaf", (w * 0.42, 0.11, 0.085), (0, -0.11, -h * 0.5 + 0.03), wg, mats["kelp"])
        fmat = mats["pink"] if flower_pink else mats["coral"]
        add_sphere(f"{wname}_Flw1", (0.06, 0.06, 0.06), (-w * 0.22, -0.13, -h * 0.5 + 0.09), wg, fmat)
        add_sphere(f"{wname}_Flw2", (0.06, 0.06, 0.06), (0.02, -0.14, -h * 0.5 + 0.10), wg, mats["lamp"])
        add_sphere(f"{wname}_Flw3", (0.055, 0.055, 0.055), (w * 0.24, -0.12, -h * 0.5 + 0.09), wg, fmat)


def build_base_walkin_shell(name, W, D, floor_z, WH, door_x, door_w, door_h, mats):
    """Builds the grounded stone plinth, hardwood floor planks, 3 full walls + split cutaway front wall, wainscoting & hinged door."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)

    ext_shell = bpy.data.objects.new("Exterior_Shell", None)
    roof_cut = bpy.data.objects.new("Roof_Cutaway", None)
    int_floor = bpy.data.objects.new("Interior_Floor", None)
    int_props = bpy.data.objects.new("Interior_Props", None)
    for grp in (ext_shell, roof_cut, int_floor, int_props):
        grp.parent = root
        bpy.context.collection.objects.link(grp)

    wall_t = 0.16
    wz = floor_z + WH * 0.5
    front_y = -D * 0.5 + wall_t * 0.5
    curb_h = 0.36
    upper_h = WH - curb_h
    dl = door_x - door_w * 0.5
    dr = door_x + door_w * 0.5

    # Grounded stone foundation plinth extending deeply below Z=0 so terrain slopes never expose gaps
    add_box("Foundation_Base", (W + 0.28, D + 0.28, floor_z + 0.72), (0, 0, floor_z - (floor_z + 0.72) * 0.5), ext_shell, mats["stone"], bevel=0.024)

    # Individual beveled hardwood floor planks!
    plank_n = max(12, int(round(D * 3.8)))
    plank_d = (D - wall_t * 2) / plank_n
    for i in range(plank_n):
        py = -D * 0.5 + wall_t + (i + 0.5) * plank_d
        m = mats["wood_floor"] if i % 2 == 0 else mats["wood_honey"]
        add_box(f"FloorPlank_{i}", (W - wall_t * 1.9, plank_d - 0.008, 0.05), (0, py, floor_z - 0.015), int_floor, m, bevel=0.006)

    # Back, Left, Right exterior walls + cozy wainscoting dado inside!
    add_box("Wall_Back", (W, wall_t, WH), (0, D * 0.5 - wall_t * 0.5, wz), ext_shell, mats["stucco"], bevel=0.012)
    add_box("Wall_Left", (wall_t, D - wall_t * 2, WH), (-W * 0.5 + wall_t * 0.5, 0, wz), ext_shell, mats["stucco"], bevel=0.012)
    add_box("Wall_Right", (wall_t, D - wall_t * 2, WH), (W * 0.5 - wall_t * 0.5, 0, wz), ext_shell, mats["stucco"], bevel=0.012)

    dado_h = 0.72
    add_box("Dado_Back", (W - wall_t * 2, 0.032, dado_h), (0, D * 0.5 - wall_t - 0.016, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Back", (W - wall_t * 2, 0.06, 0.055), (0, D * 0.5 - wall_t - 0.022, floor_z + dado_h + 0.025), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Dado_Left", (0.032, D - wall_t * 2, dado_h), (-W * 0.5 + wall_t + 0.016, 0, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Left", (0.06, D - wall_t * 2, 0.055), (-W * 0.5 + wall_t + 0.022, 0, floor_z + dado_h + 0.025), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Dado_Right", (0.032, D - wall_t * 2, dado_h), (W * 0.5 - wall_t - 0.016, 0, floor_z + dado_h * 0.5), int_props, mats["wainscot"], bevel=0.005)
    add_box("DadoRail_Right", (0.06, D - wall_t * 2, 0.055), (W * 0.5 - wall_t - 0.022, 0, floor_z + dado_h + 0.025), int_props, mats["wood_dark"], bevel=0.008)

    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(f"CornerPost_{sx}_{sy}", (0.16, 0.16, WH + 0.05), (sx * (W * 0.5 - 0.03), sy * (D * 0.5 - 0.03), wz), ext_shell, mats["wood_dark"], bevel=0.014)

    # Split front wall (lower 0.36m curb stays visible, upper front & lintel dissolve cleanly with Roof_Cutaway!)
    lw = dl - (-W * 0.5)
    rw = W * 0.5 - dr
    add_box("Wall_FrontLeft_Curb", (lw, wall_t, curb_h), (-W * 0.5 + lw * 0.5, front_y, floor_z + curb_h * 0.5), ext_shell, mats["stucco"], bevel=0.006)
    add_box("Wall_FrontRight_Curb", (rw, wall_t, curb_h), (dr + rw * 0.5, front_y, floor_z + curb_h * 0.5), ext_shell, mats["stucco"], bevel=0.006)
    add_box("Wall_FrontLeft_Upper", (lw, wall_t, upper_h), (-W * 0.5 + lw * 0.5, front_y, floor_z + curb_h + upper_h * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Wall_FrontRight_Upper", (rw, wall_t, upper_h), (dr + rw * 0.5, front_y, floor_z + curb_h + upper_h * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Wall_DoorLintel", (door_w + 0.01, wall_t - 0.004, WH - door_h), (door_x, front_y, floor_z + door_h + (WH - door_h) * 0.5), roof_cut, mats["stucco"], bevel=0.0)
    add_box("Front_EaveBeam", (W + 0.10, 0.15, 0.11), (0, front_y - 0.04, floor_z + WH - 0.04), roof_cut, mats["wood_dark"], bevel=0.01)

    # Hat-safe doorway frame + threshold + Hinged Carved Wooden Door (`Door_Hinge`)!
    add_box("Jamb_L", (0.10, wall_t + 0.07, door_h + 0.06), (dl, front_y, floor_z + door_h * 0.5), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Jamb_R", (0.10, wall_t + 0.07, door_h + 0.06), (dr, front_y, floor_z + door_h * 0.5), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Jamb_Top", (door_w + 0.18, wall_t + 0.09, 0.10), (door_x, front_y, floor_z + door_h + 0.03), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Door_Sill", (door_w + 0.14, wall_t + 0.16, 0.055), (door_x, front_y, floor_z + 0.025), ext_shell, mats["wood_honey"], bevel=0.008)

    door_hinge = bpy.data.objects.new("Door_Hinge", None)
    door_hinge.location = (dl + 0.035, front_y, floor_z + 0.03)
    door_hinge.parent = root
    bpy.context.collection.objects.link(door_hinge)

    leaf_w = door_w - 0.07
    leaf_h = door_h - 0.04
    add_box("Door_Leaf_Core", (leaf_w, 0.075, leaf_h), (leaf_w * 0.5, 0, leaf_h * 0.5), door_hinge, mats["wood_honey"], bevel=0.012)
    add_box("Door_RailTop", (leaf_w - 0.08, 0.095, 0.12), (leaf_w * 0.5, 0, leaf_h - 0.12), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_RailMid", (leaf_w - 0.08, 0.095, 0.10), (leaf_w * 0.5, 0, leaf_h * 0.48), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_RailBot", (leaf_w - 0.08, 0.095, 0.12), (leaf_w * 0.5, 0, 0.12), door_hinge, mats["wood_dark"], bevel=0.008)
    add_box("Door_WindowGlow", (0.38, 0.09, 0.34), (leaf_w * 0.5, 0, leaf_h * 0.72), door_hinge, mats["lamp"], bevel=0.005)
    add_sphere("Knob_Front", (0.044, 0.044, 0.044), (leaf_w - 0.13, -0.062, leaf_h * 0.46), door_hinge, mats["brass"])
    add_sphere("Knob_Back", (0.044, 0.044, 0.044), (leaf_w - 0.13, 0.062, leaf_h * 0.46), door_hinge, mats["brass"])

    return root, ext_shell, roof_cut, door_hinge, int_props, wall_t


def add_shingle_rows_and_bargeboards(W, D, WH, floor_z, roof_h, ov_x, ov_y, roof_cut, mats):
    hy = D * 0.5 + ov_y
    hx = W * 0.5 + ov_x
    add_box("Roof_RidgeBeam", (W + ov_x * 2 + 0.18, 0.18, 0.15), (0, 0, floor_z + WH + roof_h + 0.15), roof_cut, mats["wood_dark"], bevel=0.016)
    slope_len = math.hypot(hy, roof_h)
    slope_ang = math.atan2(roof_h, hy)
    for slope_sign in (-1, 1):
        for r_i in range(6):
            t_s = (r_i + 0.5) / 6.0
            ry_p = slope_sign * (1.0 - t_s) * hy
            rz_p = floor_z + WH + 0.12 + t_s * roof_h
            add_box(f"ShingleRow_{slope_sign}_{r_i}", (W + ov_x * 2 - 0.04, slope_len / 5.4, 0.045), (0, ry_p, rz_p + 0.025), roof_cut, mats["roof"], bevel=0.01, rot=(slope_sign * (-slope_ang + 0.04), 0, 0))
    for gx in (-hx + 0.03, hx - 0.03):
        for sy in (-1, 1):
            add_box(f"Barge_{gx:.1f}_{sy}", (0.09, slope_len + 0.06, 0.11), (gx, sy * hy * 0.5, floor_z + WH + 0.08 + roof_h * 0.5), roof_cut, mats["wood_dark"], bevel=0.01, rot=(-sy * slope_ang, 0, 0))


# =============================================================================
# 1. HOUSE_PLAYER v2.1 (5.40 x 4.40m | Steep 38° Flared Coral Roof + Offset Dormer + 1.48m Porch)
# =============================================================================
def build_house_player():
    W, D, floor_z, WH, roof_h = 5.40, 4.40, 0.28, 2.08, 1.62
    door_x, door_w, door_h, porch_d = -0.95, 1.12, 1.75, 1.48
    mats = make_palette("#c84b34", "#8e2d1e", "#35787a", "#225355", "#8fa98d", "#6e886c")
    root, ext_shell, roof_cut, door_hinge, int_props, wall_t = build_base_walkin_shell(
        "House_Player_v21", W, D, floor_z, WH, door_x, door_w, door_h, mats
    )

    # Solid gable end triangles + steep flared Storybook gable roof (+0.10m eave tips!)
    add_gable_triangles("H1_Gables", W, D, roof_h, floor_z + WH, roof_cut, mats["stucco"])
    add_flared_gable_roof("H1_Roof", W, D, roof_h, 0.44, 0.42, 0.16, floor_z + WH - 0.04, roof_cut, mats["roof"], tip_flare=0.10)
    add_shingle_rows_and_bargeboards(W, D, WH, floor_z, roof_h, 0.42, 0.40, roof_cut, mats)

    # Offset 1.05m Hero Dormer (+0.45m right of center, with solid triangular gable peak!)
    dx, dy, dz = 0.45, -D * 0.27, floor_z + WH + roof_h * 0.46
    add_box("Dormer_Body", (1.05, 1.05, 0.84), (dx, dy, dz), roof_cut, mats["stucco"], bevel=0.018)
    d_pk = add_gable_triangles("Dormer_GablePeak", 1.04, 1.04, 0.36, dz + 0.40, roof_cut, mats["stucco"])
    d_pk.location = (dx, dy, 0.0)
    d_pk.rotation_euler = (0.0, 0.0, math.pi * 0.5)
    add_box("Dormer_RoofL", (0.82, 1.32, 0.10), (dx - 0.31, dy - 0.05, dz + 0.56), roof_cut, mats["roof"], bevel=0.012, rot=(0, -0.56, 0))
    add_box("Dormer_RoofR", (0.82, 1.32, 0.10), (dx + 0.31, dy - 0.05, dz + 0.56), roof_cut, mats["roof"], bevel=0.012, rot=(0, 0.56, 0))
    add_box("Dormer_Frame", (0.64, 0.09, 0.54), (dx, dy - 0.52, dz + 0.02), roof_cut, mats["wood_dark"], bevel=0.01)
    add_box("Dormer_Glass", (0.50, 0.10, 0.40), (dx, dy - 0.52, dz + 0.02), roof_cut, mats["lamp"], bevel=0.004)
    add_box("Dormer_MulV", (0.04, 0.12, 0.42), (dx, dy - 0.52, dz + 0.02), roof_cut, mats["wood_dark"], bevel=0.003)
    add_box("Dormer_MulH", (0.52, 0.12, 0.04), (dx, dy - 0.52, dz + 0.02), roof_cut, mats["wood_dark"], bevel=0.003)

    # Back-left stone chimney
    cx, cy = -W * 0.28, D * 0.24
    ch_top = floor_z + WH + roof_h + 0.88
    add_box("Chimney_Shaft", (0.64, 0.64, 2.05), (cx, cy, ch_top - 1.00), roof_cut, mats["stone"], bevel=0.022)
    add_box("Chimney_Cap", (0.78, 0.78, 0.14), (cx, cy, ch_top + 0.04), roof_cut, mats["stone_light"], bevel=0.015)

    # Modular 1.48m Deep Porch (Plank deck + stone plinth + right-side railing & bench + 2 crisp 0.14m steps!)
    p_planks = 7
    p_step = porch_d / p_planks
    for i in range(p_planks):
        py = -D * 0.5 - (i + 0.5) * p_step
        add_box(f"PorchPlank_{i}", (W + 0.18, p_step - 0.014, 0.10), (0, py, floor_z - 0.05), ext_shell, mats["wood_honey"], bevel=0.008)
    add_box("Porch_Plinth", (W + 0.04, porch_d - 0.10, floor_z + 0.55), (0, -D * 0.5 - porch_d * 0.5, floor_z - 0.105 - (floor_z + 0.55) * 0.5), ext_shell, mats["stone"], bevel=0.02)

    # Porch awning cleanly inside Roof_Cutaway so entering is unobstructed!
    add_box("Porch_Awning", (W + 0.40, porch_d + 0.42, 0.12), (0, -D * 0.5 - porch_d * 0.5 - 0.06, floor_z + WH - 0.08), roof_cut, mats["roof"], bevel=0.015, rot=(0.21, 0, 0))
    add_box("Porch_Fascia", (W + 0.42, 0.08, 0.10), (0, -D * 0.5 - porch_d + 0.12, floor_z + WH - 0.24), roof_cut, mats["wood_dark"], bevel=0.008)

    post_y = -D * 0.5 - porch_d + 0.12
    post_h = WH - 0.26
    for idx, px in enumerate([-W * 0.47, -0.05, W * 0.47]):
        add_cyl(f"PorchPost_{idx}", 0.068, post_h, (px, post_y, floor_z + post_h * 0.5), ext_shell, mats["wood_dark"], verts=12)

    # Right-side porch railing + cozy wooden bench (leaving left entry around door_x=-0.95 100% open!)
    add_box("Porch_TopRail", (2.54, 0.09, 0.08), (1.28, post_y, floor_z + 0.68), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Porch_BotRail", (2.54, 0.08, 0.06), (1.28, post_y, floor_z + 0.16), ext_shell, mats["wood_dark"], bevel=0.008)
    for bi in range(6):
        add_box(f"Porch_Bal_{bi}", (0.05, 0.05, 0.48), (0.20 + bi * 0.42, post_y, floor_z + 0.42), ext_shell, mats["wood_honey"], bevel=0.006)
    add_box("Porch_BenchSeat", (1.30, 0.44, 0.07), (1.38, -D * 0.5 - 0.42, floor_z + 0.38), ext_shell, mats["wood_honey"], bevel=0.012)
    add_box("Porch_BenchBack", (1.30, 0.07, 0.34), (1.38, -D * 0.5 - 0.22, floor_z + 0.56), ext_shell, mats["wood_dark"], bevel=0.01)
    for lx in (-0.54, 0.54):
        add_box(f"Porch_BenchLeg_{lx}", (0.08, 0.38, 0.36), (1.38 + lx, -D * 0.5 - 0.42, floor_z + 0.18), ext_shell, mats["wood_dark"], bevel=0.008)

    # 2 crisp 0.14m timber steps centered on door_x = -0.95!
    for st in range(2):
        add_box(f"PorchStep_{st}", (1.46, 0.32, 0.14), (door_x, -D * 0.5 - porch_d - 0.16 - st * 0.32, floor_z - 0.07 - st * 0.14), ext_shell, mats["wood_honey"], bevel=0.012)

    # Hanging Brass Porch Lantern
    add_box("Lantern_Arm", (0.05, 0.24, 0.05), (-0.05, post_y - 0.12, floor_z + post_h - 0.16), roof_cut, mats["wood_dark"], bevel=0.004)
    add_cyl("Lantern_Cap", 0.095, 0.05, (-0.05, post_y - 0.20, floor_z + post_h - 0.22), roof_cut, mats["brass"], verts=12)
    add_cyl("Lantern_Glow", 0.075, 0.16, (-0.05, post_y - 0.20, floor_z + post_h - 0.32), roof_cut, mats["lamp"], verts=12)
    add_cyl("Lantern_Base", 0.085, 0.04, (-0.05, post_y - 0.20, floor_z + post_h - 0.42), roof_cut, mats["brass"], verts=12)

    # Shuttered flower-box windows (front window raised cleanly above porch bench backrest!)
    add_window("Win_Front", (1.28, -D * 0.5 - 0.01, floor_z + 1.34), 0.0, roof_cut, mats, w=0.92, h=0.72)
    add_window("Win_Left", (-W * 0.5 - 0.01, 0.15, floor_z + 1.16), -math.pi * 0.5, ext_shell, mats, w=0.82, h=0.76)
    add_window("Win_Right", (W * 0.5 + 0.01, 0.15, floor_z + 1.16), math.pi * 0.5, ext_shell, mats, w=0.82, h=0.76)

    # ---- ENLARGED COZY INTERIOR (5.08 x 4.08m net space!) ----
    # Enlarged Tri-Color Braided Oval Rug
    for rname, rad, zoff, m in [("Rug_Outer", 1.18, 0.022, mats["rug_teal"]), ("Rug_Mid", 0.88, 0.025, mats["rug_cream"]), ("Rug_Inner", 0.54, 0.028, mats["rug_warm"])]:
        o = add_cyl(rname, rad, 0.022, (0.02, -0.32, floor_z + zoff), int_props, m, verts=32)
        o.scale = (1.22, 0.86, 1.0)
        bpy.ops.object.transform_apply(scale=True)

    # Cozy Quilted Gingham Bed (Back-Left: bx=-1.52, by=+1.16) + Anchor_Bed!
    bx, by = -1.52, D * 0.5 - 1.04
    add_box("Bed_Base", (1.28, 1.60, 0.24), (bx, by, floor_z + 0.16), int_props, mats["wood_honey"], bevel=0.02)
    for lx in (-0.56, 0.56):
        for ly in (-0.72, 0.72):
            add_cyl(f"BedLeg_{lx}_{ly}", 0.052, 0.15, (bx + lx, by + ly, floor_z + 0.075), int_props, mats["wood_dark"], verts=10)
    add_box("Bed_Headboard", (1.32, 0.11, 0.70), (bx, by + 0.76, floor_z + 0.46), int_props, mats["wood_dark"], bevel=0.025)
    add_sphere("Bed_FinialL", (0.07, 0.07, 0.07), (bx - 0.60, by + 0.76, floor_z + 0.84), int_props, mats["wood_honey"])
    add_sphere("Bed_FinialR", (0.07, 0.07, 0.07), (bx + 0.60, by + 0.76, floor_z + 0.84), int_props, mats["wood_honey"])
    add_box("Bed_Mattress", (1.18, 1.48, 0.16), (bx, by, floor_z + 0.35), int_props, mats["sheet"], bevel=0.04)
    add_box("Bed_Quilt", (1.22, 1.04, 0.15), (bx, by - 0.22, floor_z + 0.39), int_props, mats["quilt"], bevel=0.055)
    add_box("Bed_SheetFold", (1.22, 0.20, 0.155), (bx, by + 0.26, floor_z + 0.395), int_props, mats["sheet"], bevel=0.045)
    add_sphere("Bed_PillowL", (0.32, 0.19, 0.10), (bx - 0.28, by + 0.52, floor_z + 0.49), int_props, mats["sheet"], rot=(0.12, 0.06, 0))
    add_sphere("Bed_PillowR", (0.30, 0.18, 0.09), (bx + 0.27, by + 0.50, floor_z + 0.48), int_props, mats["sheet"], rot=(0.10, -0.08, 0.08))

    anc_bed = bpy.data.objects.new("Anchor_Bed", None)
    anc_bed.location = (bx, by + 0.12, floor_z + 0.48)
    anc_bed.parent = root
    bpy.context.collection.objects.link(anc_bed)

    # Enlarged Handcrafted Glass Aquarium Cabinet (Back-Right: ax=+0.92, ay=+D/2 - 0.56) + Anchor_Aquarium AT FLOOR BASE!
    ax, ay = 0.92, D * 0.5 - 0.56
    tw, td, th, sh = 2.08, 0.62, 0.88, 0.56
    add_box("Aq_Cabinet", (tw + 0.16, td + 0.14, sh), (ax, ay, floor_z + sh * 0.5), int_props, mats["wood_honey"], bevel=0.02)
    add_box("Aq_CounterTop", (tw + 0.22, td + 0.18, 0.06), (ax, ay, floor_z + sh + 0.015), int_props, mats["wood_dark"], bevel=0.012)
    for sx in (-0.52, 0.52):
        add_box(f"Aq_Door_{sx}", (0.88, 0.036, 0.42), (ax + sx, ay - td * 0.5 - 0.07, floor_z + sh * 0.5), int_props, mats["wood_dark"], bevel=0.008)
        add_sphere(f"Aq_Knob_{sx}", (0.03, 0.03, 0.03), (ax + sx * 0.22, ay - td * 0.5 - 0.10, floor_z + sh * 0.54), int_props, mats["brass"])
    add_box("Aq_Sand", (tw - 0.06, td - 0.06, 0.09), (ax, ay, floor_z + sh + 0.08), int_props, mats["sand"], bevel=0.015)
    for rx, ry, rs in [(-0.66, 0.06, 0.13), (0.58, 0.08, 0.12), (0.04, 0.12, 0.10)]:
        add_sphere(f"Aq_Rock_{rx}", (rs * 1.3, rs, rs * 0.72), (ax + rx, ay + ry, floor_z + sh + 0.14), int_props, mats["stone"])
    for idx_k, (kx, ky, kh, yaw) in enumerate([(-0.80, 0.10, 0.46, 0.3), (-0.64, 0.02, 0.36, -0.5), (0.74, 0.10, 0.48, 0.8), (0.56, 0.04, 0.34, -0.4), (0.06, 0.12, 0.40, 0.1)]):
        for seg in range(3):
            t_s = (seg + 0.5) / 3.0
            sway = math.sin(seg * 1.1 + idx_k) * 0.035
            add_sphere(f"Aq_Kelp_{idx_k}_{seg}", (0.044 - seg * 0.006, 0.018, kh * 0.24), (ax + kx + sway, ay + ky, floor_z + sh + 0.14 + t_s * kh), int_props, mats["kelp"], rot=(0.15, sway * 3.5, yaw + seg * 0.4))
    add_box("Aq_WaterGlow", (tw - 0.04, td - 0.04, th - 0.08), (ax, ay, floor_z + sh + th * 0.52), int_props, mats["aqua_glass"], bevel=0.005)
    for cx_a in (-1, 1):
        for cy_a in (-1, 1):
            add_box(f"Aq_Post_{cx_a}_{cy_a}", (0.055, 0.055, th), (ax + cx_a * tw * 0.5, ay + cy_a * td * 0.5, floor_z + sh + th * 0.5 + 0.04), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Aq_Hood", (tw + 0.12, td + 0.12, 0.085), (ax, ay, floor_z + sh + th + 0.06), int_props, mats["wood_dark"], bevel=0.015)
    add_box("Aq_LightStrip", (tw - 0.28, 0.11, 0.032), (ax, ay, floor_z + sh + th + 0.015), int_props, mats["lamp"], bevel=0.005)

    anc_aq = bpy.data.objects.new("Anchor_Aquarium", None)
    anc_aq.location = (ax, ay, floor_z)
    anc_aq.parent = root
    bpy.context.collection.objects.link(anc_aq)

    # Framed Koi Art + Wall Jar Shelf + Right Nightstand w/ Warm Lamp + Plant + Wicker Creel & Rod!
    add_box("Art_Frame", (0.72, 0.045, 0.52), (bx, D * 0.5 - wall_t - 0.025, floor_z + 1.42), int_props, mats["wood_dark"], bevel=0.008)
    add_box("Art_Canvas", (0.62, 0.05, 0.42), (bx, D * 0.5 - wall_t - 0.032, floor_z + 1.42), int_props, mats["sheet"], bevel=0.003)
    add_sphere("Art_KoiBody", (0.16, 0.025, 0.075), (bx - 0.02, D * 0.5 - wall_t - 0.052, floor_z + 1.42), int_props, mats["coral"])
    add_sphere("Art_KoiTail", (0.08, 0.02, 0.09), (bx + 0.14, D * 0.5 - wall_t - 0.052, floor_z + 1.42), int_props, mats["coral"])

    add_box("Shelf_Board", (0.26, 1.02, 0.05), (-W * 0.5 + wall_t + 0.14, -0.55, floor_z + 1.24), int_props, mats["wood_honey"], bevel=0.008)
    add_cyl("Shelf_Jar1", 0.065, 0.17, (-W * 0.5 + wall_t + 0.14, -0.82, floor_z + 1.35), int_props, mats["terra"], verts=12)
    add_cyl("Shelf_Jar2", 0.055, 0.14, (-W * 0.5 + wall_t + 0.14, -0.55, floor_z + 1.335), int_props, mats["shutter"], verts=12)
    add_cyl("Shelf_Cup", 0.050, 0.11, (-W * 0.5 + wall_t + 0.14, -0.28, floor_z + 1.32), int_props, mats["sheet"], verts=12)

    nx, ny = 2.12, -0.35
    add_box("Nightstand_Body", (0.54, 0.54, 0.50), (nx, ny, floor_z + 0.25), int_props, mats["wood_honey"], bevel=0.018)
    add_box("Nightstand_Top", (0.58, 0.58, 0.05), (nx, ny, floor_z + 0.52), int_props, mats["wood_dark"], bevel=0.01)
    add_cyl("Lamp_Base", 0.08, 0.18, (nx, ny, floor_z + 0.63), int_props, mats["terra"], verts=14)
    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.19, radius2=0.10, depth=0.24, location=(nx, ny, floor_z + 0.82))
    sh_o = bpy.context.active_object
    sh_o.name = "Lamp_Shade"
    for p in sh_o.data.polygons:
        p.use_smooth = True
    sh_o.parent = int_props
    sh_o.data.materials.append(mats["lamp"])

    px, py = 2.02, -1.48
    add_cyl("Pot_Terra", 0.17, 0.28, (px, py, floor_z + 0.15), int_props, mats["terra"], verts=14)
    for la in range(6):
        ang = la * (math.tau / 6.0)
        add_sphere(f"PlantLeaf_{la}", (0.16, 0.08, 0.045), (px + math.cos(ang) * 0.14, py + math.sin(ang) * 0.14, floor_z + 0.37 + (la % 2) * 0.05), int_props, mats["kelp"], rot=(0.25, 0.35, ang))

    add_cyl("Wicker_Creel", 0.19, 0.32, (1.28, -1.56, floor_z + 0.17), int_props, mats["wood_honey"], verts=16)
    add_cyl("Wicker_Rim", 0.20, 0.05, (1.28, -1.56, floor_z + 0.32), int_props, mats["wood_dark"], verts=16)
    add_cyl("Corner_BambooRod", 0.018, 1.52, (1.14, -1.66, floor_z + 0.78), int_props, mats["wood_honey"], verts=10, rot=(-0.10, 0.12, 0))
    add_cyl("Corner_RodReel", 0.044, 0.038, (1.13, -1.64, floor_z + 0.38), int_props, mats["brass"], verts=12, rot=(0, math.pi * 0.5, 0))

    return root, roof_cut, door_hinge


# =============================================================================
# 2. HOUSE_ARTISAN v2.1 (4.60 x 3.80m | Low 27° Teal Roof + Side Lean-To Tool Shed + Cargo Door)
# =============================================================================
def build_house_artisan():
    W, D, floor_z, WH, roof_h = 4.60, 3.80, 0.24, 2.02, 1.08
    door_x, door_w, door_h, ad = 0.68, 1.22, 1.78, 1.25
    mats = make_palette("#2d7b82", "#1b5258", "#b87a3d", "#7d4f22", "#8e7b63", "#695945")
    root, ext_shell, roof_cut, door_hinge, int_props, wall_t = build_base_walkin_shell(
        "House_Artisan_v21", W, D, floor_z, WH, door_x, door_w, door_h, mats
    )

    # Low broad 27° teal-slate gable roof
    add_gable_triangles("H2_Gables", W, D, roof_h, floor_z + WH, roof_cut, mats["stucco"])
    add_flared_gable_roof("H2_Roof", W, D, roof_h, 0.38, 0.38, 0.15, floor_z + WH - 0.04, roof_cut, mats["roof"], tip_flare=0.0)
    add_shingle_rows_and_bargeboards(W, D, WH, floor_z, roof_h, 0.36, 0.36, roof_cut, mats)

    # Signature 1.35 x 2.10m Side Lean-To Tool Shed projecting on East (+X) flank + upright bamboo poles leaning cleanly outside!
    sw, sd = 1.35, 2.10
    sx0, sy0 = W * 0.5 + sw * 0.5 - 0.04, 0.45
    add_box("Shed_Plinth", (sw + 0.42, sd + 0.22, floor_z + 0.72), (sx0 - 0.12, sy0, floor_z - (floor_z + 0.72) * 0.5), ext_shell, mats["stone"], bevel=0.02)
    add_box("Shed_Walls", (sw, sd, 1.62), (sx0, sy0, floor_z + 0.81), ext_shell, mats["stucco"], bevel=0.02)
    add_box("Shed_Roof", (sw + 0.48, sd + 0.42, 0.13), (sx0 + 0.10, sy0, floor_z + 1.76), roof_cut, mats["roof"], bevel=0.014, rot=(0.0, 0.28, 0.0))
    for ri in range(4):
        add_cyl(f"Shed_Bamboo_{ri}", 0.042, 1.65, (sx0 + sw * 0.5 + 0.13, sy0 - 0.55 + ri * 0.16, floor_z + 0.80), ext_shell, mats["wood_honey"], verts=10, rot=(0.0, -0.14, 0.0))

    # Square Workshop Chimney right at shed/main roof junction!
    cx, cy = W * 0.5 - 0.18, sy0 + 0.35
    ch_top = floor_z + WH + roof_h + 0.78
    add_box("Chimney_Shaft", (0.50, 0.56, 1.95), (cx, cy, ch_top - 0.92), roof_cut, mats["stone"], bevel=0.02)
    add_box("Chimney_Cap", (0.64, 0.70, 0.12), (cx, cy, ch_top + 0.04), roof_cut, mats["stone_light"], bevel=0.012)

    # Shallow Street Work Awning (1.25m) + Stone Work Slab + Left Outdoor Rod Workbench + Hanging Fish Sign (NO railings!)
    ay = -D * 0.5 - ad * 0.5
    add_box("Work_Slab", (W + 0.12, ad, 0.14), (0, ay, floor_z - 0.07), ext_shell, mats["stone_light"], bevel=0.015)
    add_box("Work_Plinth", (W + 0.04, ad - 0.08, floor_z + 0.55), (0, ay, floor_z - 0.14 - (floor_z + 0.55) * 0.5), ext_shell, mats["stone"], bevel=0.02)
    add_box("Work_Awning", (W + 0.34, ad + 0.36, 0.12), (0, ay - 0.05, floor_z + WH - 0.06), roof_cut, mats["roof"], bevel=0.014, rot=(0.24, 0, 0))
    for idx, px in enumerate([-W * 0.46, W * 0.46]):
        add_cyl(f"WorkPost_{idx}", 0.068, WH - 0.24, (px, -D * 0.5 - ad + 0.12, floor_z + (WH - 0.24) * 0.5), ext_shell, mats["wood_dark"], verts=12)

    # Single-side outdoor craft workbench on LEFT (-X), leaving right cargo lane (+0.68) wide open!
    add_box("OutdoorBench_Top", (1.46, 0.56, 0.07), (-1.15, -D * 0.5 - 0.52, floor_z + 0.72), ext_shell, mats["wood_honey"], bevel=0.012)
    for bx_l in (-1.75, -0.55):
        add_box(f"OutdoorBench_Leg_{bx_l}", (0.09, 0.48, 0.70), (bx_l, -D * 0.5 - 0.52, floor_z + 0.35), ext_shell, mats["wood_dark"], bevel=0.01)
    add_box("Cargo_Step", (1.66, 0.34, 0.14), (door_x, -D * 0.5 - ad - 0.16, floor_z - 0.10), ext_shell, mats["stone_light"], bevel=0.012)

    # Hanging Carved Fish Signboard & Fishing Buoys!
    sy_s = -D * 0.5 - ad + 0.10
    add_box("Sign_Bracket", (0.76, 0.06, 0.06), (W * 0.46 + 0.38, sy_s, floor_z + 1.72), roof_cut, mats["iron"], bevel=0.006)
    add_sphere("Sign_FishBody", (0.34, 0.065, 0.13), (W * 0.46 + 0.42, sy_s, floor_z + 1.48), roof_cut, mats["sign_fish"])
    add_sphere("Sign_FishTail", (0.14, 0.045, 0.14), (W * 0.46 + 0.74, sy_s, floor_z + 1.48), roof_cut, mats["sign_fish"])
    add_window("Win_Front", (-1.10, -D * 0.5 - 0.01, floor_z + 1.20), 0.0, roof_cut, mats, w=1.08, h=0.78, has_shutters=False, has_flowerbox=False)
    add_window("Win_Left", (-W * 0.5 - 0.01, 0.05, floor_z + 1.15), -math.pi * 0.5, ext_shell, mats, w=0.80, h=0.72)

    # ---- ENLARGED TACKLE WORKSHOP INTERIOR ----
    for rname, rad, zoff, m in [("Mat_Out", 0.96, 0.020, mats["rug_sage"]), ("Mat_In", 0.64, 0.023, mats["rug_cream"])]:
        o = add_cyl(rname, rad, 0.020, (0.05, -0.22, floor_z + zoff), int_props, m, verts=28)
        o.scale = (1.25, 0.85, 1.0)
        bpy.ops.object.transform_apply(scale=True)

    wx, wy = 0.0, D * 0.5 - 0.52
    add_box("Bench_Top", (2.68, 0.66, 0.08), (wx, wy, floor_z + 0.74), int_props, mats["wood_honey"], bevel=0.014)
    add_box("Bench_Shelf", (2.46, 0.52, 0.05), (wx, wy, floor_z + 0.26), int_props, mats["wood_dark"], bevel=0.01)
    for lx in (-1.20, 1.20):
        for ly in (-0.25, 0.25):
            add_box(f"Bench_Leg_{lx}_{ly}", (0.10, 0.10, 0.72), (wx + lx, wy + ly, floor_z + 0.36), int_props, mats["wood_dark"], bevel=0.01)
    for sx, smat in [(-1.00, mats["coral"]), (-0.80, mats["ceramic"]), (-0.60, mats["rug_sage"])]:
        add_cyl(f"Spool_{sx}", 0.062, 0.14, (sx, wy + 0.08, floor_z + 0.85), int_props, smat, verts=14)
        add_cyl(f"SpoolTop_{sx}", 0.072, 0.022, (sx, wy + 0.08, floor_z + 0.92), int_props, mats["wood_dark"], verts=14)
    add_cyl("Bench_RodBlank", 0.018, 1.45, (0.05, wy - 0.10, floor_z + 0.80), int_props, mats["wood_honey"], verts=10, rot=(0, math.pi * 0.5, 0.05))
    add_cyl("Bench_BrassReel", 0.055, 0.044, (-0.28, wy - 0.14, floor_z + 0.80), int_props, mats["brass"], verts=14)
    add_cyl("PaintCan_1", 0.072, 0.16, (0.76, wy + 0.10, floor_z + 0.86), int_props, mats["terra"], verts=14)
    add_cyl("Bench_LampBase", 0.09, 0.05, (1.10, wy - 0.04, floor_z + 0.80), int_props, mats["brass"], verts=14)
    add_cyl("Bench_LampGlow", 0.07, 0.17, (1.10, wy - 0.04, floor_z + 0.91), int_props, mats["lamp"], verts=14)
    add_cyl("Bench_LampCap", 0.10, 0.045, (1.10, wy - 0.04, floor_z + 1.02), int_props, mats["brass"], verts=14)
    add_box("Bench_Pegboard", (1.92, 0.045, 0.48), (0.0, D * 0.5 - wall_t - 0.025, floor_z + 1.38), int_props, mats["wood_dark"], bevel=0.008)
    for px_t in (-0.68, -0.26, 0.16, 0.58):
        add_box(f"WallTool_{px_t}", (0.08, 0.05, 0.30), (px_t, D * 0.5 - wall_t - 0.055, floor_z + 1.38), int_props, mats["wood_honey"], bevel=0.006)

    anc_wb = bpy.data.objects.new("Anchor_Workbench", None)
    anc_wb.location = (0.0, wy - 0.62, floor_z)
    anc_wb.parent = root
    bpy.context.collection.objects.link(anc_wb)

    # Left Wall Standing 5-Rod Display Rack + Toolbox; Right Wall Bobber Shelf + Stool
    rx_w = -W * 0.5 + wall_t + 0.24
    add_box("RodRack_Base", (0.30, 1.32, 0.11), (rx_w, -0.05, floor_z + 0.06), int_props, mats["wood_dark"], bevel=0.01)
    add_box("RodRack_TopRail", (0.18, 1.32, 0.07), (rx_w - 0.05, -0.05, floor_z + 1.02), int_props, mats["wood_dark"], bevel=0.008)
    rod_mats = [mats["wood_honey"], mats["ceramic"], mats["coral"], mats["brass"], mats["rug_sage"]]
    for ri in range(5):
        ry = -0.52 + ri * 0.26
        add_cyl(f"DisplayRod_{ri}", 0.018, 1.62, (rx_w, ry, floor_z + 0.86), int_props, rod_mats[ri], verts=10)
        add_cyl(f"DisplayReel_{ri}", 0.042, 0.038, (rx_w + 0.04, ry, floor_z + 0.44), int_props, mats["brass"], verts=12, rot=(0, math.pi * 0.5, 0))
    add_box("Toolbox_Body", (0.38, 0.58, 0.26), (rx_w + 0.04, -1.16, floor_z + 0.14), int_props, mats["terra"], bevel=0.012)

    rx_r = W * 0.5 - wall_t - 0.18
    add_box("Bobber_Shelf", (0.24, 1.12, 0.05), (rx_r, -0.05, floor_z + 1.16), int_props, mats["wood_honey"], bevel=0.008)
    for bi in range(4):
        by_b = -0.42 + bi * 0.28
        add_sphere(f"BobberTop_{bi}", (0.058, 0.058, 0.058), (rx_r, by_b, floor_z + 1.24), int_props, mats["coral"] if bi % 2 == 0 else mats["ceramic"])
        add_sphere(f"BobberBot_{bi}", (0.052, 0.052, 0.038), (rx_r, by_b, floor_z + 1.21), int_props, mats["sheet"])
    add_cyl("StoolSeat", 0.24, 0.065, (rx_r - 0.20, -0.96, floor_z + 0.38), int_props, mats["wood_dark"], verts=16)
    add_cyl("StoolLeg", 0.14, 0.36, (rx_r - 0.20, -0.96, floor_z + 0.19), int_props, mats["wood_honey"], verts=14)

    return root, roof_cut, door_hinge


# =============================================================================
# 3. HOUSE_NEIGHBOR_EAST v2.1 (4.30 x 3.60m | Honey Roof + Cross-Gable Vestibule + Ship's Wheel!)
# =============================================================================
def build_house_neighbor():
    W, D, floor_z, WH, roof_h = 4.30, 3.60, 0.28, 2.02, 1.23
    door_x, door_w, door_h = -0.78, 1.06, 1.70
    mats = make_palette("#d68a32", "#9e5e18", "#6d8f4b", "#49632e", "#87a3b3", "#5f7a8a")
    root, ext_shell, roof_cut, door_hinge, int_props, wall_t = build_base_walkin_shell(
        "House_Neighbor_East_v21", W, D, floor_z, WH, door_x, door_w, door_h, mats
    )

    add_gable_triangles("H3_Gables", W, D, roof_h, floor_z + WH, roof_cut, mats["stucco"])
    add_flared_gable_roof("H3_Roof", W, D, roof_h, 0.36, 0.38, 0.15, floor_z + WH - 0.04, roof_cut, mats["roof"], tip_flare=0.04)
    add_shingle_rows_and_bargeboards(W, D, WH, floor_z, roof_h, 0.34, 0.36, roof_cut, mats)

    # Slender Exterior Gable Stone Chimney grounded solidly into the stone foundation!
    ch_h = WH + roof_h + 1.18
    add_box("GableChimney", (0.38, 0.56, ch_h), (W * 0.5 + 0.15, 0.0, floor_z + ch_h * 0.5 - 0.36), roof_cut, mats["stone"], bevel=0.018)
    add_box("GableChimCap", (0.48, 0.66, 0.12), (W * 0.5 + 0.15, 0.0, floor_z + WH + roof_h + 0.78), roof_cut, mats["stone_light"], bevel=0.012)

    # Offset Cross-Gabled Entrance Vestibule (2.10 wide x 1.05 deep) shifted West (-0.78) + Stone Cheek Wall!
    vx, vw, vd = door_x, 2.10, 1.05
    vy = -D * 0.5 - vd * 0.5
    add_box("Vest_Deck", (vw, vd + 0.14, 0.14), (vx, vy + 0.07, floor_z - 0.07), ext_shell, mats["stone_light"], bevel=0.014)
    add_box("Vest_Plinth", (vw - 0.04, vd + 0.08, floor_z + 0.56), (vx, vy + 0.05, floor_z - 0.145 - (floor_z + 0.56) * 0.5), ext_shell, mats["stone"], bevel=0.018)
    v_pk = add_gable_triangles("Vest_HoodPeak", vd + 0.10, vw * 0.90, 0.38, floor_z + WH - 0.10, roof_cut, mats["stucco"])
    v_pk.location = (vx, vy, 0.0)
    v_pk.rotation_euler = (0.0, 0.0, math.pi * 0.5)
    for sx in (-1, 1):
        add_box(f"Vest_HoodRoof_{sx}", (vw * 0.58, vd + 0.42, 0.11), (vx + sx * (vw * 0.25), vy - 0.06, floor_z + WH + 0.08), roof_cut, mats["roof"], bevel=0.012, rot=(0.0, sx * 0.40, 0.0))
        add_cyl(f"Vest_Post_{sx}", 0.065, WH - 0.18, (vx + sx * (vw * 0.44), -D * 0.5 - vd + 0.10, floor_z + (WH - 0.18) * 0.5), ext_shell, mats["wood_dark"], verts=12)
    add_box("Vest_StoneCheek", (0.24, 0.72, 0.44), (vx + 0.85, -D * 0.5 - vd - 0.30, floor_z - 0.06), ext_shell, mats["stone"], bevel=0.018)
    for st in range(2):
        add_box(f"Vest_Step_{st}", (1.30, 0.32, 0.14), (vx - 0.10, -D * 0.5 - vd - 0.16 - st * 0.32, floor_z - 0.07 - st * 0.14), ext_shell, mats["stone_light"], bevel=0.012)

    # Exposed Sunlit Right Facade: Olive-Shuttered Flower Window & Sculpted Ship's Wheel with crisp spacing!
    add_window("Win_Front", (0.80, -D * 0.5 - 0.01, floor_z + 1.24), 0.0, roof_cut, mats, w=0.76, h=0.72, flower_pink=True)
    add_window("Win_Left", (-W * 0.5 - 0.01, 0.0, floor_z + 1.15), -math.pi * 0.5, ext_shell, mats, w=0.80, h=0.72, flower_pink=True)
    wx_wh, wy_wh, wz_wh = 1.68, -D * 0.5 - 0.07, floor_z + 0.96
    bpy.ops.mesh.primitive_torus_add(major_radius=0.26, minor_radius=0.036, major_segments=20, minor_segments=10, location=(wx_wh, wy_wh, wz_wh), rotation=(math.pi * 0.5, 0, 0))
    wrim = bpy.context.active_object
    wrim.name = "ShipWheel_Rim"
    wrim.parent = roof_cut
    wrim.data.materials.append(mats["wood_dark"])
    add_cyl("ShipWheel_Hub", 0.08, 0.09, (wx_wh, wy_wh - 0.01, wz_wh), roof_cut, mats["brass"], verts=12, rot=(math.pi * 0.5, 0, 0))
    for sp in range(8):
        ang = sp * (math.tau / 8.0)
        add_cyl(f"ShipWheel_Spoke_{sp}", 0.020, 0.64, (wx_wh, wy_wh, wz_wh), roof_cut, mats["wood_honey"], verts=8, rot=(0.0, ang, 0.0))

    # ---- ENLARGED SEASIDE COTTAGE INTERIOR ----
    for rname, rad, zoff, m in [("NRug_Out", 0.96, 0.020, mats["rug_blue"]), ("NRug_Mid", 0.68, 0.023, mats["rug_cream"]), ("NRug_In", 0.38, 0.026, mats["rug_warm"])]:
        add_cyl(rname, rad, 0.020, (0.15, -0.05, floor_z + zoff), int_props, m, verts=32)

    tx, ty = 0.42, -0.05
    add_cyl("Dining_TableTop", 0.58, 0.07, (tx, ty, floor_z + 0.60), int_props, mats["wood_honey"], verts=26)
    add_cyl("Dining_TablePedestal", 0.12, 0.56, (tx, ty, floor_z + 0.30), int_props, mats["wood_dark"], verts=16)
    add_cyl("Dining_TableFoot", 0.30, 0.06, (tx, ty, floor_z + 0.04), int_props, mats["wood_dark"], verts=18)
    add_sphere("Tea_Pot", (0.11, 0.11, 0.10), (tx - 0.08, ty + 0.04, floor_z + 0.71), int_props, mats["ceramic"])
    add_cyl("Tea_Cup1", 0.048, 0.08, (tx + 0.16, ty - 0.08, floor_z + 0.67), int_props, mats["sheet"], verts=12)
    add_cyl("Tea_Cup2", 0.048, 0.08, (tx + 0.06, ty + 0.20, floor_z + 0.67), int_props, mats["pink"], verts=12)
    for s_idx, (sx, sy) in enumerate([(tx - 0.74, ty - 0.18), (tx + 0.72, ty + 0.14)]):
        add_cyl(f"StoolSeat_{s_idx}", 0.22, 0.06, (sx, sy, floor_z + 0.38), int_props, mats["wood_honey"], verts=16)
        add_cyl(f"StoolBase_{s_idx}", 0.13, 0.36, (sx, sy, floor_z + 0.19), int_props, mats["wood_dark"], verts=14)

    # Full Wooden Coastal Bookcase + 18 Colorful Volumes + Warm Lamp!
    bx, by = -0.82, D * 0.5 - 0.42
    add_box("Bookcase_Back", (1.42, 0.06, 1.30), (bx, by + 0.18, floor_z + 0.65), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_SideL", (0.08, 0.42, 1.30), (bx - 0.67, by, floor_z + 0.65), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_SideR", (0.08, 0.42, 1.30), (bx + 0.67, by, floor_z + 0.65), int_props, mats["wood_dark"], bevel=0.01)
    add_box("Bookcase_Top", (1.46, 0.44, 0.06), (bx, by, floor_z + 1.30), int_props, mats["wood_dark"], bevel=0.012)
    book_mats = [mats["coral"], mats["ceramic"], mats["rug_sage"], mats["wood_honey"], mats["pink"], mats["rug_blue"]]
    for shelf_i, sz in enumerate((floor_z + 0.30, floor_z + 0.70, floor_z + 1.08)):
        add_box(f"BookShelf_{shelf_i}", (1.28, 0.38, 0.045), (bx, by - 0.01, sz - 0.13), int_props, mats["wood_honey"], bevel=0.006)
        for bi in range(6):
            add_box(f"Book_{shelf_i}_{bi}", (0.16, 0.24, 0.23 + (bi % 2) * 0.03), (bx - 0.50 + bi * 0.20, by - 0.03, sz + 0.01), int_props, book_mats[(bi + shelf_i * 2) % len(book_mats)], bevel=0.006)
    add_cyl("BookLamp_Base", 0.072, 0.14, (bx + 0.42, by - 0.02, floor_z + 1.40), int_props, mats["terra"], verts=14)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.16, radius2=0.085, depth=0.20, location=(bx + 0.42, by - 0.02, floor_z + 1.56))
    lsh = bpy.context.active_object
    lsh.name = "BookLamp_Shade"
    for p in lsh.data.polygons:
        p.use_smooth = True
    lsh.parent = int_props
    lsh.data.materials.append(mats["lamp"])

    add_box("SeaArt_Frame", (0.64, 0.045, 0.48), (0.98, D * 0.5 - wall_t - 0.025, floor_z + 1.36), int_props, mats["wood_dark"], bevel=0.008)
    add_box("SeaArt_Canvas", (0.54, 0.05, 0.38), (0.98, D * 0.5 - wall_t - 0.032, floor_z + 1.36), int_props, mats["rug_blue"], bevel=0.003)
    add_sphere("SeaArt_Sail", (0.10, 0.02, 0.12), (0.98, D * 0.5 - wall_t - 0.052, floor_z + 1.38), int_props, mats["sheet"])
    add_cyl("NPot_Terra", 0.18, 0.30, (1.42, D * 0.5 - 0.56, floor_z + 0.16), int_props, mats["terra"], verts=14)
    for la in range(6):
        ang = la * (math.tau / 6.0)
        add_sphere(f"NLeaf_{la}", (0.16, 0.08, 0.045), (1.42 + math.cos(ang) * 0.14, D * 0.5 - 0.56 + math.sin(ang) * 0.14, floor_z + 0.38 + (la % 2) * 0.05), int_props, mats["kelp"], rot=(0.25, 0.35, ang))

    lx_w = -W * 0.5 + wall_t + 0.15
    add_box("Shell_Shelf", (0.26, 0.96, 0.05), (lx_w, -0.15, floor_z + 1.16), int_props, mats["wood_honey"], bevel=0.008)
    add_sphere("Shell_Conch", (0.08, 0.11, 0.072), (lx_w, -0.44, floor_z + 1.26), int_props, mats["pink"], rot=(0.2, 0.3, 0.4))
    add_sphere("Shell_Scallop", (0.07, 0.08, 0.062), (lx_w, -0.14, floor_z + 1.25), int_props, mats["sheet"])
    add_cyl("Shell_Bottle", 0.052, 0.18, (lx_w, 0.16, floor_z + 1.28), int_props, mats["ceramic"], verts=12)

    return root, roof_cut, door_hinge


# =============================================================================
# 4. MARKET_STALL_V2 (2.85m Striped Awning + Open Transaction Nook + Hanging Dried-Fish Rack!)
# =============================================================================
def build_market_stall_v2():
    mats = make_palette("#d14a35", "#942e1e", "#35787a", "#225355", "#8fa98d", "#6e886c")
    root = bpy.data.objects.new("Hero_FishMarket_Stall_v2", None)
    bpy.context.collection.objects.link(root)

    # Main 2.05m counter (0.70m high) + 0.80m lower open east transaction nook (0.62m high -> Ah Lian & Player greet cleanly!)
    add_box("Mkt_CounterMain", (2.05, 0.72, 0.70), (-0.40, 0.0, 0.35), root, mats["wood_honey"], bevel=0.018)
    add_box("Mkt_CounterTop", (2.14, 0.80, 0.06), (-0.40, 0.0, 0.71), root, mats["wood_dark"], bevel=0.012)
    add_box("Mkt_TransNook", (0.80, 0.68, 0.62), (1.02, 0.0, 0.31), root, mats["wood_honey"], bevel=0.015)
    add_box("Mkt_TransTop", (0.84, 0.74, 0.05), (1.02, 0.0, 0.63), root, mats["wood_dark"], bevel=0.01)

    # Posts trimmed cleanly to sloped awning underside (front 2.04m, rear 2.22m -> ZERO poke-through!)
    for sx in (-1.46, 1.46):
        add_cyl(f"Mkt_PostF_{sx}", 0.058, 2.04, (sx, -0.38, 1.02), root, mats["wood_dark"], verts=10)
        add_cyl(f"Mkt_PostB_{sx}", 0.058, 2.22, (sx, 0.38, 1.11), root, mats["wood_dark"], verts=10)

    # Striped Coral-Red & Cream Canvas Canopy + Crisp Hanging Scalloped Valance Tabs below front fascia!
    for i in range(6):
        sx = -1.28 + i * 0.512
        m = mats["roof"] if i % 2 == 0 else mats["sheet"]
        add_box(f"Mkt_Awning_{i}", (0.495, 1.72, 0.085), (sx, -0.14, 2.16), root, m, bevel=0.012, rot=(0.22, 0, 0))
        add_box(f"Mkt_Valance_{i}", (0.47, 0.055, 0.18), (sx, -0.95, 1.88), root, m, bevel=0.020)

    # Vintage Countertop Dial Scale + 2 Ice-Filled Fish Crates!
    add_cyl("Scale_Base", 0.13, 0.22, (-1.12, -0.06, 0.85), root, mats["shutter"], verts=14)
    add_cyl("Scale_Dial", 0.13, 0.06, (-1.12, -0.15, 0.90), root, mats["sheet"], verts=16, rot=(math.pi * 0.5, 0, 0))
    add_cyl("Scale_Pan", 0.19, 0.05, (-1.12, -0.06, 1.01), root, mats["brass"], verts=16)

    for ci, cx in enumerate((-0.40, 0.28)):
        add_box(f"IceCrate_{ci}", (0.58, 0.48, 0.22), (cx, -0.02, 0.85), root, mats["wood_honey"], bevel=0.014, rot=(0.14, 0, 0))
        add_box(f"IceBed_{ci}", (0.50, 0.40, 0.08), (cx, -0.02, 0.94), root, mats["ice"], bevel=0.01, rot=(0.14, 0, 0))
        for fi in range(3):
            add_sphere(f"FreshFish_{ci}_{fi}", (0.048, 0.145, 0.036), (cx - 0.16 + fi * 0.16, -0.02, 1.00), root, mats["sign_fish"], rot=(0.14, 0, 0.12 * (fi - 1)))

    # Dedicated West Hanging Dried-Fish Rack (1.60m wide x 1.80m tall, Storyboard Panel 3!)
    rx = -2.35
    for dx in (-0.72, 0.72):
        add_cyl(f"Rack_Post_{dx}", 0.052, 1.84, (rx + dx, -0.12, 0.92), root, mats["wood_dark"], verts=10)
    add_cyl("Rack_Bar", 0.042, 1.64, (rx, -0.12, 1.74), root, mats["wood_honey"], verts=10, rot=(0, math.pi * 0.5, 0))
    for fi in range(5):
        fx = rx - 0.52 + fi * 0.26
        add_cyl(f"DryRope_{fi}", 0.008, 0.28, (fx, -0.12, 1.60), root, mats["sheet"], verts=6)
        add_sphere(f"DryFish_{fi}", (0.042, 0.032, 0.18), (fx, -0.12, 1.36), root, mats["sign_fish"])
        add_sphere(f"DryTail_{fi}", (0.055, 0.016, 0.055), (fx, -0.12, 1.52), root, mats["sign_fish"])

    # Warm hanging stall lantern + flanking oak barrels
    add_cyl("Stall_LampCap", 0.085, 0.04, (0.95, -0.58, 1.92), root, mats["brass"], verts=12)
    add_cyl("Stall_LampGlow", 0.068, 0.15, (0.95, -0.58, 1.82), root, mats["lamp"], verts=12)
    for b_idx, (bx, by) in enumerate(((-1.72, 0.42), (1.82, 0.28))):
        add_cyl(f"Mkt_Barrel_{b_idx}", 0.26, 0.66, (bx, by, 0.33), root, mats["wood_honey"], verts=14)
        add_cyl(f"Mkt_HoopA_{b_idx}", 0.27, 0.04, (bx, by, 0.18), root, mats["wood_dark"], verts=14)
        add_cyl(f"Mkt_HoopB_{b_idx}", 0.27, 0.04, (bx, by, 0.48), root, mats["wood_dark"], verts=14)

    return root, None, None


# =============================================================================
# 5. LIGHTHOUSE_V2 (7.80m Red & Cream Striped Coastal Lighthouse + Grounded Keeper Shed!)
# =============================================================================
def build_lighthouse_v2():
    mats = make_palette("#c94c36", "#8f2e1f", "#35787a", "#225355", "#8fa98d", "#6e886c")
    root = bpy.data.objects.new("Hero_Lighthouse_v2", None)
    bpy.context.collection.objects.link(root)

    # Deep stone base plinth rooting cleanly into the coastal cliff!
    add_cyl("LH_Plinth", 1.36, 1.80, (0, 0, -0.35), root, mats["stone"], verts=16)
    add_cyl("LH_PlinthRim", 1.24, 0.20, (0, 0, 0.56), root, mats["stone_light"], verts=16)

    # Alternating cream & coral-red tapered lighthouse tower bands up to Z=5.40m
    bands = [
        (1.16, 1.06, 1.26, 1.25, mats["stucco"]),
        (1.06, 0.96, 1.20, 2.46, mats["roof"]),
        (0.96, 0.86, 1.18, 3.63, mats["stucco"]),
        (0.86, 0.78, 1.12, 4.76, mats["roof"]),
    ]
    for i, (rb, rt, h, cz, m) in enumerate(bands):
        bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=1.0, depth=h, location=(0, 0, cz))
        o = bpy.context.active_object
        o.name = f"LH_Band_{i}"
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=rb, radius2=rt, depth=h)
        bm.to_mesh(o.data)
        bm.free()
        for p in o.data.polygons:
            p.use_smooth = True
        o.parent = root
        o.data.materials.append(m)

    # Lighthouse doorway + tiny round porthole windows
    add_box("LH_DoorFrame", (0.86, 0.16, 1.38), (0.0, -1.12, 1.28), root, mats["wood_dark"], bevel=0.015)
    add_box("LH_DoorLeaf", (0.72, 0.12, 1.28), (0.0, -1.15, 1.28), root, mats["wood_honey"], bevel=0.012)
    add_cyl("LH_Port1", 0.22, 0.16, (0.0, -0.92, 3.55), root, mats["wood_dark"], verts=14, rot=(math.pi * 0.5, 0, 0))
    add_cyl("LH_PortGlass1", 0.16, 0.18, (0.0, -0.92, 3.55), root, mats["lamp"], verts=14, rot=(math.pi * 0.5, 0, 0))

    # Iron Gallery Deck + Railing + Glowing Glass Beacon Room + Coral Cupola & Finial (Total 7.80m!)
    add_cyl("LH_Gallery", 1.06, 0.22, (0, 0, 5.44), root, mats["iron"], verts=18)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.02, minor_radius=0.032, major_segments=20, minor_segments=8, location=(0, 0, 5.96))
    gr = bpy.context.active_object
    gr.name = "LH_GalleryRail"
    gr.parent = root
    gr.data.materials.append(mats["iron"])
    for p_i in range(10):
        ang = p_i * (math.tau / 10.0)
        add_cyl(f"LH_RailPost_{p_i}", 0.025, 0.44, (math.cos(ang) * 1.02, math.sin(ang) * 1.02, 5.74), root, mats["iron"], verts=8)

    add_cyl("LH_LanternGlow", 0.66, 0.96, (0, 0, 6.02), root, mats["lamp"], verts=16)
    for m_i in range(6):
        ang = m_i * (math.tau / 6.0)
        add_cyl(f"LH_Mullion_{m_i}", 0.032, 0.98, (math.cos(ang) * 0.69, math.sin(ang) * 0.69, 6.02), root, mats["iron"], verts=8)

    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.92, radius2=0.06, depth=1.00, location=(0, 0, 7.00))
    cup = bpy.context.active_object
    cup.name = "LH_Cupola"
    for p in cup.data.polygons:
        p.use_smooth = True
    cup.parent = root
    cup.data.materials.append(mats["roof"])
    add_cyl("LH_Finial", 0.04, 0.44, (0, 0, 7.60), root, mats["brass"], verts=10)

    # Grounded Stone & Stucco Keeper Shed tucked cleanly beside Lighthouse base (with roof centered on shed!)
    sx, sy = -2.05, 0.62
    shed_grp = bpy.data.objects.new("LH_KeeperShed_Grp", None)
    shed_grp.location = (sx, sy, 0.0)
    shed_grp.parent = root
    bpy.context.collection.objects.link(shed_grp)
    add_box("Shed_Plinth", (2.05, 1.65, 2.20), (0, 0, -0.55), shed_grp, mats["stone"], bevel=0.024)
    add_box("Shed_Body", (1.88, 1.48, 1.38), (0, 0, 1.24), shed_grp, mats["stucco"], bevel=0.02)
    add_gable_triangles("Shed_Gables", 1.88, 1.48, 0.64, 1.92, shed_grp, mats["stucco"])
    add_flared_gable_roof("Shed_Roof", 1.88, 1.48, 0.64, 0.24, 0.24, 0.12, 1.90, shed_grp, mats["roof"])
    add_window("Shed_Win", (0, -0.75, 1.26), 0.0, shed_grp, mats, w=0.58, h=0.54, has_shutters=True, has_flowerbox=False)

    return root, None, None


BUILDERS = {
    "house_player": build_house_player,
    "house_artisan": build_house_artisan,
    "house_neighbor_east": build_house_neighbor,
    "market_stall_v2": build_market_stall_v2,
    "lighthouse_v2": build_lighthouse_v2,
}


def run_asset(asset_id):
    clear_scene()
    root, roof_cut, door_hinge = BUILDERS[asset_id]()

    # 1. Bake crisp 2048px shadow-free Gouache + Crevice AO atlas!
    tex_png = os.path.join(TEX_DIR, f"{asset_id}_v21_BaseColor.png")
    bake_gouache_atlas(root, tex_png, tex_size=2048)

    # 2. Save .blend & export clean WebGL .glb!
    blend_path = os.path.join(BASE_OUT, f"{asset_id}_v21.blend")
    glb_path = os.path.join(EXP_DIR, f"{asset_id}.glb")
    export_clean_glb(blend_path, glb_path)

    # 3. Render multi-angle audit shots (Exterior + Cutaway Interior for cottages; Front + 3/4 for stall/lighthouse!)
    scene = bpy.context.scene
    setup_studio_render(scene, res_x=800, res_y=600, samples=28, is_house=True)
    cam_d = bpy.data.cameras.new("AuditCam")
    cam_d.lens = 48
    cam = bpy.data.objects.new("AuditCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    if roof_cut is not None:
        sc = 1.15 if asset_id == "house_player" else 1.02
        aim_camera(cam, (6.8 * sc, -9.2 * sc, 4.8 * sc), (0.0, -0.25, 1.45))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_id}_ext.png")
        bpy.ops.render.render(write_still=True)

        set_hierarchy_hidden(roof_cut, True)
        if door_hinge:
            door_hinge.rotation_euler = (0, 0, -math.radians(92))
        aim_camera(cam, (-3.9 * sc, -5.8 * sc, 4.8 * sc), (0.0, 0.0, 0.72))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_id}_int34.png")
        bpy.ops.render.render(write_still=True)

        aim_camera(cam, (0.0, -5.4 * sc, 6.8 * sc), (0.0, -0.12, 0.55))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_id}_top52.png")
        bpy.ops.render.render(write_still=True)
    elif asset_id == "market_stall_v2":
        aim_camera(cam, (3.2, -5.6, 2.3), (-0.45, 0.0, 1.05))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_id}_ext.png")
        bpy.ops.render.render(write_still=True)
    else:
        aim_camera(cam, (6.8, -11.5, 5.4), (-0.4, 0.0, 3.6))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_id}_ext.png")
        bpy.ops.render.render(write_still=True)
    print(f"[v2.1 Asset] Completed bake, GLB & audit renders for {asset_id}")


def main():
    argv = sys.argv
    asset = "house_player"
    if "--" in argv:
        extra = argv[argv.index("--") + 1 :]
        if "--asset" in extra:
            asset = extra[extra.index("--asset") + 1]
    run_asset(asset)


if __name__ == "__main__":
    main()
