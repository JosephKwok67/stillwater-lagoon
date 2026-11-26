"""
Antigravity Studio Edition - Complete 5-Character Blender 5.3 Sculpt + Cycles Gouache+AO Bake Pipeline
Builds all 5 game characters strictly matching art_pipeline/concepts/*_turnaround.png:
  1. npc_market     (渔市老板娘 · 阿莲)
  2. player         (草帽垂钓者 · 主角)
  3. dog            (伴游小狗)
  4. npc_artisan    (渔具工匠 · 老周)
  5. npc_lighthouse (灯塔守望者 · 海伯)

Outputs:
  - .blend + 1024x1024 baked BaseColor PNGs -> art_pipeline/blender_ag/
  - Clean baked glTF 2.0 .glb               -> art_pipeline/blender_ag/exports/characters/<id>.glb
  - Multi-angle (Front + 3/4 + 52° TopDown) -> art_pipeline/blender_ag/previews/<id>_*.png
"""
import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import (
    clear_scene,
    make_gouache_mat,
    set_smooth,
    add_subsurf,
    create_lathe_mesh,
    create_curved_tube,
    add_box,
    add_cyl,
    add_sphere,
    collect_hierarchy_objects,
    convert_and_apply_modifiers,
    normalize_character_root,
    bake_gouache_atlas,
    setup_studio_render,
    aim_camera,
    export_clean_glb,
)

BASE_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
TEX_DIR = os.path.join(BASE_OUT, "textures")
EXP_DIR = os.path.join(BASE_OUT, "exports", "characters")
PREV_DIR = os.path.join(BASE_OUT, "previews")
for d in (TEX_DIR, EXP_DIR, PREV_DIR):
    os.makedirs(d, exist_ok=True)


def make_common_human_mats():
    mat_eye = make_gouache_mat("Mat_EyeDark", "#1d130f", "#0a0604", rough=0.16, ao_strength=0.0, bump_str=0.0)
    mat_white = make_gouache_mat("Mat_EyeCatchlight", "#fffef9", "#f4eee0", rough=0.10, ao_strength=0.0, bump_str=0.0)
    return mat_eye, mat_white


def build_human_base_legs_and_shoes(root, attach, mat_shoe, mat_sole, mat_pants, mat_cuff=None, cuff_h=0.135):
    """Sculpted rounded leather boots/loafers + curved matching sole + cuffed trousers (ZERO boxy slabs!)."""
    for side in (-1, 1):
        sx = side * 0.132
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0, location=(sx, -0.025, 0.058))
        shoe = bpy.context.active_object
        shoe.name = f"Shoe_{'L' if side < 0 else 'R'}"
        shoe.scale = (0.088, 0.128, 0.056)
        bpy.ops.object.transform_apply(scale=True)
        for v in shoe.data.vertices:
            if v.co.z < -0.032:
                v.co.z = -0.044
            if v.co.y < -0.03:
                v.co.z *= 0.88
                v.co.x *= 0.94
        add_subsurf(shoe, 1)
        attach(shoe, mat_shoe)

        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1.0, depth=0.022, location=(sx, -0.025, 0.011))
        sole = bpy.context.active_object
        sole.name = f"Sole_{'L' if side < 0 else 'R'}"
        sole.scale = (0.090, 0.130, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        add_subsurf(sole, 1)
        attach(sole, mat_sole)

        # Ankle boot collar
        boot_top = create_lathe_mesh(f"BootShaft_{'L' if side < 0 else 'R'}", [(0.072, 0.06), (0.075, 0.12)], segments=18)
        boot_top.location = (sx, -0.004, 0.0)
        attach(boot_top, mat_shoe)

        # Rolled trouser cuff ring (optional distinct lighter denim/fabric color!)
        if mat_cuff:
            cuff = create_lathe_mesh(
                f"TrouserCuff_{'L' if side < 0 else 'R'}",
                [(0.076, 0.095), (0.096, 0.105), (0.097, cuff_h), (0.082, cuff_h + 0.01)],
                segments=22,
            )
            cuff.location = (sx, 0.0, 0.0)
            add_subsurf(cuff, 1)
            attach(cuff, mat_cuff)

        leg_prof = [
            (0.070, 0.080),
            (0.092, 0.105),
            (0.094, cuff_h),
            (0.084, cuff_h + 0.012),
            (0.098, 0.245),
            (0.118, 0.375),
        ]
        leg = create_lathe_mesh(f"Trouser_{'L' if side < 0 else 'R'}", leg_prof, segments=22)
        leg.location = (sx, 0.0, 0.0)
        add_subsurf(leg, 1)
        attach(leg, mat_pants)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0, location=(0, 0.005, 0.37))
    pelvis = bpy.context.active_object
    pelvis.name = "Pelvis"
    pelvis.scale = (0.222, 0.165, 0.115)
    bpy.ops.object.transform_apply(scale=True)
    attach(pelvis, mat_pants)


def build_human_arms(root, attach, mat_sleeve, mat_skin, mat_cuff=None, cuff_pos=0.52, long_sleeve=False, mat_inner_cuff=None):
    """Seamless puffed shoulders + axis-aligned rolled cuffs + smooth wrists & cozy chibi hands!"""
    if mat_cuff is None:
        mat_cuff = mat_sleeve
    hand_positions = {}
    for side in (-1, 1):
        p_sh = Vector((side * 0.186, 0.0, 0.742))
        p_wrist = Vector((side * 0.370, -0.018, 0.468))
        p_cuff = p_sh.lerp(p_wrist, 0.78 if long_sleeve else cuff_pos)
        p_mid = p_sh.lerp(p_cuff, 0.5)
        arm_vec = (p_cuff - p_sh).normalized()
        fore_vec = (p_wrist - p_sh).normalized()

        # Rounded seamless shoulder puff
        add_sphere(f"Shoulder_{'L' if side < 0 else 'R'}", (0.086, 0.084, 0.080), p_sh, root, mat_sleeve, segs=18, rings=12)
        attach(bpy.context.active_object, mat_sleeve)

        sleeve = create_curved_tube(
            f"Sleeve_{'L' if side < 0 else 'R'}",
            [
                (p_sh.x, p_sh.y, p_sh.z, 0.074),
                (p_mid.x, p_mid.y, p_mid.z, 0.080 if not long_sleeve else 0.074),
                (p_cuff.x, p_cuff.y, p_cuff.z, 0.068 if not long_sleeve else 0.062),
            ],
            bevel_res=8,
        )
        attach(sleeve, mat_sleeve)

        # Exact perpendicular rolled cuff torus
        cuff_rot = arm_vec.to_track_quat("Z", "Y").to_euler()
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.058 if long_sleeve else 0.064,
            minor_radius=0.023 if long_sleeve else 0.025,
            major_segments=22,
            minor_segments=12,
            location=p_cuff,
            rotation=cuff_rot,
        )
        cuff = bpy.context.active_object
        cuff.name = f"SleeveCuff_{'L' if side < 0 else 'R'}"
        set_smooth(cuff)
        attach(cuff, mat_cuff)

        if mat_inner_cuff:
            p_ic = p_cuff + fore_vec * 0.032
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.048,
                minor_radius=0.017,
                major_segments=20,
                minor_segments=10,
                location=p_ic,
                rotation=cuff_rot,
            )
            ic = bpy.context.active_object
            set_smooth(ic)
            attach(ic, mat_inner_cuff)

        # Forearm flowing deeply into BOTH sleeve AND palm center -> ZERO gaps!
        p_arm_in = p_sh.lerp(p_cuff, 0.76)
        p_palm = p_wrist + fore_vec * 0.022
        hand_positions[side] = p_palm
        if long_sleeve:
            arm_pts = [
                (p_cuff.x, p_cuff.y, p_cuff.z, 0.048),
                (p_wrist.x, p_wrist.y, p_wrist.z, 0.040),
                (p_palm.x, p_palm.y, p_palm.z, 0.032),
            ]
        else:
            p_arm_mid = p_cuff.lerp(p_wrist, 0.5)
            arm_pts = [
                (p_arm_in.x, p_arm_in.y, p_arm_in.z, 0.056),
                (p_cuff.x, p_cuff.y, p_cuff.z, 0.055),
                (p_arm_mid.x, p_arm_mid.y, p_arm_mid.z, 0.048),
                (p_wrist.x, p_wrist.y, p_wrist.z, 0.041),
                (p_palm.x, p_palm.y, p_palm.z, 0.032),
            ]
        attach(create_curved_tube(f"Forearm_{'L' if side < 0 else 'R'}", arm_pts, bevel_res=8), mat_skin)

        # Plump chibi hand
        palm_rot = fore_vec.to_track_quat("-Z", "Y").to_euler()
        add_sphere(f"Palm_{'L' if side < 0 else 'R'}", (0.043, 0.036, 0.046), p_palm, root, mat_skin, rot=palm_rot, segs=16, rings=12)
        attach(bpy.context.active_object, mat_skin)

        p_th0 = p_palm + Vector((-side * 0.022, -0.018, 0.004))
        p_th1 = p_palm + Vector((-side * 0.038, -0.032, -0.022))
        attach(create_curved_tube(f"Thumb_{'L' if side < 0 else 'R'}", [(p_th0.x, p_th0.y, p_th0.z, 0.016), (p_th1.x, p_th1.y, p_th1.z, 0.013)], bevel_res=6), mat_skin)

        for fi, (fy, fz_len) in enumerate([(-0.020, 0.032), (-0.007, 0.036), (0.007, 0.035), (0.020, 0.029)]):
            f_start = p_palm + Vector((side * 0.008, fy, -0.022))
            f_mid = f_start + Vector((side * 0.004, fy * 0.08, -fz_len * 0.55))
            f_tip = f_start + Vector((-side * 0.006, fy * 0.05, -fz_len))
            attach(create_curved_tube(f"Finger_{side}_{fi}", [(f_start.x, f_start.y, f_start.z, 0.0125), (f_mid.x, f_mid.y, f_mid.z, 0.0115), (f_tip.x, f_tip.y, f_tip.z, 0.010)], bevel_res=5), mat_skin)

    return hand_positions


def build_human_head(root, attach, mat_skin, mat_blush, mat_eye, mat_white, mat_brow, nose_scale=(0.034, 0.030, 0.024), eye_style="warm", cheek_plump=0.12, mat_mouth=None):
    """Warm sculpted Ghibli chibi head + ears + eyes + brows + blush + nose + smile."""
    attach(create_lathe_mesh("Neck", [(0.086, 0.81), (0.076, 0.87), (0.080, 0.90)], segments=18), mat_skin)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0, location=(0, -0.008, 1.032))
    head = bpy.context.active_object
    head.name = "Head_Sculpt"
    head.scale = (0.196, 0.192, 0.186)
    bpy.ops.object.transform_apply(scale=True)
    for v in head.data.vertices:
        if v.co.z < 0.02 and v.co.y < 0.04:
            cw = math.exp(-((v.co.z + 0.05) / 0.085) ** 2) * (1.0 - math.exp(-(v.co.x / 0.065) ** 2))
            v.co.x *= 1.0 + cheek_plump * cw
            v.co.y -= 0.016 * cw
        if v.co.z < -0.11:
            chin_w = math.exp(-(v.co.x / 0.09) ** 2)
            v.co.y -= 0.012 * chin_w
            v.co.z -= 0.008 * chin_w
    add_subsurf(head, 1)
    attach(head, mat_skin)

    for side in (-1, 1):
        add_sphere(f"Ear_{'L' if side < 0 else 'R'}", (0.032, 0.044, 0.056), (side * 0.205, 0.004, 1.012), root, mat_skin, rot=(0.0, side * 0.14, -side * 0.18), segs=14, rings=10)
        attach(bpy.context.active_object, mat_skin)

        add_sphere(f"Blush_{'L' if side < 0 else 'R'}", (0.042, 0.016, 0.028), (side * 0.105, -0.178, 0.985), root, mat_blush, rot=(0.12, 0.0, side * 0.42), segs=14, rings=8)
        attach(bpy.context.active_object, mat_blush)

        if eye_style == "young":
            # Big bright curious eyes for Player!
            add_sphere(f"EyeIris_{'L' if side < 0 else 'R'}", (0.023, 0.014, 0.027), (side * 0.072, -0.185, 1.036), root, mat_eye, rot=(0.05, 0.0, side * 0.20), segs=16, rings=10)
            attach(bpy.context.active_object, mat_eye)
            add_sphere(f"EyeCatch_{'L' if side < 0 else 'R'}", (0.0068, 0.0068, 0.0068), (side * 0.065, -0.199, 1.048), root, mat_white, segs=10, rings=8)
            attach(bpy.context.active_object, mat_white)
            attach(create_curved_tube(f"Brow_{'L' if side < 0 else 'R'}", [(side * 0.042, -0.182, 1.084, 0.0065), (side * 0.074, -0.178, 1.094, 0.0078), (side * 0.104, -0.164, 1.082, 0.0060)], bevel_res=4), mat_brow)
        else:
            # Warm crinkly happy elder eyes + catchlight + laugh lines!
            add_sphere(f"EyeIris_{'L' if side < 0 else 'R'}", (0.022, 0.013, 0.019), (side * 0.076, -0.184, 1.036), root, mat_eye, rot=(0.06, 0.0, side * 0.22), segs=16, rings=10)
            attach(bpy.context.active_object, mat_eye)
            add_sphere(f"EyeCatch_{'L' if side < 0 else 'R'}", (0.0055, 0.0055, 0.0055), (side * 0.069, -0.196, 1.044), root, mat_white, segs=10, rings=8)
            attach(bpy.context.active_object, mat_white)
            attach(create_curved_tube(f"EyeArch_{'L' if side < 0 else 'R'}", [(side * 0.044, -0.186, 1.036, 0.0068), (side * 0.074, -0.189, 1.052, 0.0092), (side * 0.106, -0.172, 1.038, 0.0065)], bevel_res=5), mat_eye)
            attach(create_curved_tube(f"Laugh_{'L' if side < 0 else 'R'}", [(side * 0.112, -0.165, 1.033, 0.0038), (side * 0.128, -0.153, 1.028, 0.0028)], bevel_res=3), mat_brow)
            brow_r = 0.0115 if eye_style == "thick_brow" else 0.0092
            attach(create_curved_tube(f"Brow_{'L' if side < 0 else 'R'}", [(side * 0.036, -0.184, 1.080, brow_r * 0.8), (side * 0.076, -0.179, 1.093, brow_r), (side * 0.114, -0.162, 1.078, brow_r * 0.72)], bevel_res=4), mat_brow)

    # Cute nose
    nose_mat = mat_blush if eye_style != "young" else mat_skin
    add_sphere("Nose", nose_scale, (0, -0.205, 1.002), root, nose_mat, segs=16, rings=10)
    attach(bpy.context.active_object, nose_mat)

    # Warm smile
    sw = 0.056 if eye_style == "young" else 0.072
    attach(
        create_curved_tube(
            "Smile_Curve",
            [
                (-sw, -0.182, 0.962, 0.0052),
                (-sw * 0.5, -0.197, 0.946, 0.0068),
                (0.0, -0.202, 0.941, 0.0074),
                (sw * 0.5, -0.197, 0.946, 0.0068),
                (sw, -0.182, 0.962, 0.0052),
            ],
            bevel_res=5,
        ),
        mat_mouth or mat_brow,
    )


# =============================================================================
# 1. NPC_MARKET: 渔市老板娘 · 阿莲
# =============================================================================
def build_npc_market():
    root = bpy.data.objects.new("NPC_Market_AhLian", None)
    bpy.context.collection.objects.link(root)

    mat_eye, mat_white = make_common_human_mats()
    mat_skin = make_gouache_mat("Mat_Skin", "#f3bc8c", "#d99262", rough=0.78)
    mat_blush = make_gouache_mat("Mat_Blush", "#e67c63", "#c95d47", rough=0.80, ao_strength=0.10)
    mat_scarf = make_gouache_mat("Mat_ScarfCoral", "#d94d2f", "#9e2d19", rough=0.84, ao_strength=0.30)
    mat_hair = make_gouache_mat("Mat_HairBrown", "#5c4334", "#3b291f", rough=0.86)
    mat_silver = make_gouache_mat("Mat_HairSilver", "#dad6cc", "#aba69c", rough=0.82, ao_strength=0.18)
    mat_shirt = make_gouache_mat("Mat_BlouseCream", "#f5e6c8", "#d6be96", rough=0.86)
    mat_apron = make_gouache_mat("Mat_ApronTeal", "#288479", "#195c55", rough=0.85, ao_strength=0.30)
    mat_apron_dark = make_gouache_mat("Mat_ApronTrim", "#1e6a61", "#134742", rough=0.86)
    mat_button = make_gouache_mat("Mat_WoodButton", "#d49b54", "#8a5a28", rough=0.72)
    mat_pants = make_gouache_mat("Mat_PantsIndigo", "#2d4c6b", "#1d334a", rough=0.88)
    mat_shoe = make_gouache_mat("Mat_ShoeLeather", "#804e28", "#4f2d14", rough=0.78)
    mat_sole = make_gouache_mat("Mat_ShoeSole", "#4c2c16", "#2e1a0c", rough=0.90)

    def attach(obj, mat):
        obj.parent = root
        if obj.data and hasattr(obj.data, "materials"):
            obj.data.materials.clear()
            obj.data.materials.append(mat)
        return obj

    build_human_base_legs_and_shoes(root, attach, mat_shoe, mat_sole, mat_pants)

    torso = create_lathe_mesh("Blouse_Torso", [(0.185, 0.34), (0.198, 0.48), (0.194, 0.62), (0.182, 0.74), (0.138, 0.81), (0.092, 0.835)], segments=28)
    torso.scale = (1.04, 0.86, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    add_subsurf(torso, 1)
    attach(torso, mat_shirt)

    for side in (-1, 1):
        attach(create_curved_tube(f"Collar_{side}", [(side * 0.012, -0.102, 0.778, 0.017), (side * 0.068, -0.090, 0.814, 0.020), (side * 0.090, 0.0, 0.824, 0.019), (side * 0.055, 0.082, 0.826, 0.017), (0.0, 0.092, 0.825, 0.015)], bevel_res=6), mat_shirt)

    build_human_arms(root, attach, mat_shirt, mat_skin, mat_shirt, cuff_pos=0.48)

    # Draped A-line teal apron skirt + bib + curved pocket + buttons + waistband + cross-back bow
    bm = bmesh.new()
    grid = []
    for iv in range(13):
        tv = iv / 12.0
        z = 0.225 + tv * 0.370
        rx, ry = 0.266 - tv * 0.052, 0.236 - tv * 0.042
        row = []
        for iu in range(33):
            tu = iu / 32.0
            ang = -math.pi * 0.5 + (tu - 0.5) * math.radians(276)
            rip = math.sin(tu * math.pi * 6.0) * 0.007 * (1.0 - tv)
            row.append(bm.verts.new((math.cos(ang) * (rx + rip), math.sin(ang) * (ry + rip), z)))
        grid.append(row)
    for iv in range(12):
        for iu in range(32):
            bm.faces.new((grid[iv][iu], grid[iv][iu + 1], grid[iv + 1][iu + 1], grid[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sm = bpy.data.meshes.new("Apron_Skirt")
    bm.to_mesh(sm)
    bm.free()
    sk = bpy.data.objects.new("Apron_Skirt", sm)
    bpy.context.collection.objects.link(sk)
    sk.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.016
    add_subsurf(sk, 1)
    attach(sk, mat_apron)

    bm = bmesh.new()
    b_rows = []
    for iv in range(8):
        tv = iv / 7.0
        z = 0.555 + tv * 0.220
        hw = 0.180 - tv * 0.046
        row = []
        for iu in range(11):
            tu = (iu / 10.0) * 2.0 - 1.0
            y = -0.197 + tv * 0.016 + (tu * tu) * (0.044 - tv * 0.012) - math.sin(tv * math.pi) * 0.008
            row.append(bm.verts.new((tu * hw, y, z)))
        b_rows.append(row)
    for iv in range(7):
        for iu in range(10):
            bm.faces.new((b_rows[iv][iu], b_rows[iv][iu + 1], b_rows[iv + 1][iu + 1], b_rows[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm_m = bpy.data.meshes.new("Apron_Bib")
    bm.to_mesh(bm_m)
    bm.free()
    bib = bpy.data.objects.new("Apron_Bib", bm_m)
    bpy.context.collection.objects.link(bib)
    bib.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.015
    add_subsurf(bib, 1)
    attach(bib, mat_apron)

    for side in (-1, 1):
        add_cyl(f"Apron_Btn_{side}", 0.016, 0.012, (side * 0.114, -0.175, 0.758), root, mat_button, verts=16, rot=(math.radians(82), 0, side * math.radians(18)))

    bm = bmesh.new()
    p_rows = []
    for iv in range(6):
        tv = iv / 5.0
        z = 0.345 + tv * 0.162
        hw = 0.128 - (1.0 - math.sin(min(1.0, tv * 1.4) * math.pi * 0.5)) * 0.016
        row = []
        for iu in range(9):
            tu = (iu / 8.0) * 2.0 - 1.0
            y = -0.240 + tv * 0.018 + (tu * tu) * 0.048 - 0.008 * math.sin(tv * math.pi)
            row.append(bm.verts.new((tu * hw, y, z)))
        p_rows.append(row)
    for iv in range(5):
        for iu in range(8):
            bm.faces.new((p_rows[iv][iu], p_rows[iv][iu + 1], p_rows[iv + 1][iu + 1], p_rows[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pm = bpy.data.meshes.new("Apron_Pocket")
    bm.to_mesh(pm)
    bm.free()
    pock = bpy.data.objects.new("Apron_Pocket", pm)
    bpy.context.collection.objects.link(pock)
    pock.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.014
    add_subsurf(pock, 1)
    attach(pock, mat_apron_dark)

    attach(create_curved_tube("Apron_Waistband", [(math.cos(math.radians(d)) * 0.219, math.sin(math.radians(d)) * 0.199, 0.586, 0.018) for d in range(90, 450, 20)], bevel_res=6, cyclic=True), mat_apron_dark)

    for side in (-1, 1):
        attach(create_curved_tube(f"Strap_{side}", [(side * 0.116, -0.172, 0.764, 0.016), (side * 0.122, -0.04, 0.822, 0.017), (side * 0.108, 0.132, 0.775, 0.017), (0.0, 0.188, 0.688, 0.016), (-side * 0.088, 0.205, 0.588, 0.016)], bevel_res=5), mat_apron_dark)
        attach(create_curved_tube(f"BowL_{side}", [(0.0, 0.222, 0.584, 0.014), (side * 0.082, 0.258, 0.612, 0.022), (side * 0.105, 0.252, 0.562, 0.020), (0.0, 0.222, 0.576, 0.014)], bevel_res=5), mat_apron_dark)
        attach(create_curved_tube(f"BowT_{side}", [(side * 0.012, 0.225, 0.574, 0.014), (side * 0.052, 0.252, 0.482, 0.019), (side * 0.072, 0.262, 0.392, 0.022)], bevel_res=4), mat_apron_dark)
    add_sphere("BowKnot", (0.028, 0.028, 0.028), (0, 0.228, 0.582), root, mat_apron_dark, segs=12, rings=8)

    build_human_head(root, attach, mat_skin, mat_blush, mat_eye, mat_white, mat_hair)

    # Sweeping bangs + iconic silver temple streaks + low bun
    for idx, (pts, m) in enumerate([
        ([(-0.008, -0.162, 1.162, 0.028), (-0.088, -0.156, 1.136, 0.034), (-0.168, -0.095, 1.078, 0.030), (-0.196, -0.015, 1.032, 0.020)], mat_hair),
        ([(0.008, -0.162, 1.162, 0.028), (0.088, -0.156, 1.136, 0.034), (0.168, -0.095, 1.078, 0.030), (0.196, -0.015, 1.032, 0.020)], mat_hair),
        ([(-0.155, -0.118, 1.092, 0.022), (-0.192, -0.052, 1.045, 0.020), (-0.195, 0.015, 0.992, 0.016)], mat_hair),
        ([(0.155, -0.118, 1.092, 0.022), (0.192, -0.052, 1.045, 0.020), (0.195, 0.015, 0.992, 0.016)], mat_hair),
        ([(0.024, -0.172, 1.148, 0.016), (0.098, -0.162, 1.118, 0.020), (0.168, -0.104, 1.066, 0.017), (0.198, -0.045, 1.034, 0.010)], mat_silver),
        ([(-0.045, -0.170, 1.142, 0.015), (-0.125, -0.140, 1.098, 0.018), (-0.186, -0.072, 1.050, 0.012)], mat_silver),
        ([(-0.185, 0.045, 0.985, 0.034), (-0.135, 0.145, 0.962, 0.042), (-0.045, 0.195, 0.945, 0.042)], mat_hair),
        ([(0.185, 0.045, 0.985, 0.034), (0.135, 0.145, 0.962, 0.042), (0.045, 0.195, 0.945, 0.042)], mat_hair),
    ]):
        attach(create_curved_tube(f"HairLock_{idx}", pts, bevel_res=6), m)
    add_sphere("HairBun", (0.103, 0.085, 0.088), (0, 0.218, 0.952), root, mat_hair, segs=20, rings=14)

    # Back-tilted coral headscarf hood (-32 deg around X -> cleanly reveals face & bangs!)
    bm = bmesh.new()
    sc = Vector((0.0, 0.004, 1.042))
    rot_m = Euler((math.radians(-32.0), 0.0, 0.0), "XYZ").to_matrix()
    pole_v = bm.verts.new(sc + rot_m @ Vector((0, 0, 0.212)))
    s_rings, rim_pts = [], []
    for ir in range(1, 15):
        tr = ir / 14.0
        alpha = tr * math.radians(86.0)
        ring = []
        for iseg in range(32):
            th = (iseg / 32.0) * math.tau
            fold = math.sin(th * 5.0) * 0.0045 * tr + math.sin(th * 9.0 + tr * 3.0) * 0.002 * tr
            wp = sc + rot_m @ Vector((math.sin(alpha) * math.cos(th) * (0.216 + fold), math.sin(alpha) * math.sin(th) * (0.214 + fold), math.cos(alpha) * (0.208 + fold)))
            ring.append(bm.verts.new(wp))
            if ir == 14:
                rim_pts.append(wp)
        s_rings.append(ring)
    for iseg in range(32):
        ns = (iseg + 1) % 32
        bm.faces.new((pole_v, s_rings[0][iseg], s_rings[0][ns]))
    for ir in range(len(s_rings) - 1):
        for iseg in range(32):
            ns = (iseg + 1) % 32
            bm.faces.new((s_rings[ir][iseg], s_rings[ir + 1][iseg], s_rings[ir + 1][ns], s_rings[ir][ns]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    scm = bpy.data.meshes.new("Headscarf_Draped")
    bm.to_mesh(scm)
    bm.free()
    scarf = bpy.data.objects.new("Headscarf_Draped", scm)
    bpy.context.collection.objects.link(scarf)
    sol_s = scarf.modifiers.new("Solidify", "SOLIDIFY")
    sol_s.thickness = 0.015
    sol_s.offset = 0.2
    add_subsurf(scarf, 1)
    attach(scarf, mat_scarf)

    attach(create_curved_tube("Headscarf_Rim", [(p.x, p.y, p.z, 0.020) for p in rim_pts], bevel_res=6, cyclic=True), mat_scarf)
    add_sphere("ScarfKnot", (0.046, 0.046, 0.046), (0, 0.228, 1.015), root, mat_scarf, segs=14, rings=10)
    for side in (-1, 1):
        attach(create_curved_tube(f"ScarfTail_{side}", [(side * 0.02, 0.228, 1.012, 0.022), (side * 0.095, 0.242, 0.968, 0.034), (side * 0.165, 0.215, 0.915, 0.026), (side * 0.195, 0.185, 0.892, 0.010)], bevel_res=6), mat_scarf)
        attach(create_curved_tube(f"ScarfPeek_{side}", [(side * 0.125, 0.095, 0.945, 0.018), (side * 0.175, 0.035, 0.895, 0.024), (side * 0.198, -0.015, 0.862, 0.008)], bevel_res=5), mat_scarf)

    return root, 1.26, False


# =============================================================================
# 2. PLAYER: 草帽垂钓者 · 主角 (Matching player_turnaround.png!)
# =============================================================================
def build_player():
    root = bpy.data.objects.new("Player_Angler", None)
    bpy.context.collection.objects.link(root)

    mat_eye, mat_white = make_common_human_mats()
    mat_skin = make_gouache_mat("Mat_Skin", "#f5c294", "#d99768", rough=0.76)
    mat_blush = make_gouache_mat("Mat_Blush", "#ea8a72", "#cf6b53", rough=0.80, ao_strength=0.08)
    mat_hair = make_gouache_mat("Mat_HairChestnut", "#6d4528", "#472a16", rough=0.84)
    mat_straw = make_gouache_mat("Mat_StrawHat", "#ebd06e", "#c29c3a", rough=0.86, ao_strength=0.28, pattern="straw", pattern_scale=18.0)
    mat_band = make_gouache_mat("Mat_HatBand", "#5b3b24", "#382112", rough=0.82)
    mat_shirt = make_gouache_mat("Mat_ShirtCream", "#f5ebd5", "#d8c5a0", rough=0.86)
    mat_denim = make_gouache_mat("Mat_OverallsDenim", "#3c618a", "#264263", rough=0.88, ao_strength=0.30)
    mat_cuff = make_gouache_mat("Mat_DenimCuff", "#6685a6", "#466382", rough=0.88)
    mat_btn = make_gouache_mat("Mat_YellowButton", "#f0b738", "#c2861c", rough=0.68)
    mat_shoe = make_gouache_mat("Mat_BootBrown", "#754728", "#4c2b14", rough=0.78)
    mat_sole = make_gouache_mat("Mat_BootSole", "#472916", "#2a170b", rough=0.90)

    def attach(obj, mat):
        obj.parent = root
        if obj.data and hasattr(obj.data, "materials"):
            obj.data.materials.clear()
            obj.data.materials.append(mat)
        return obj

    build_human_base_legs_and_shoes(root, attach, mat_shoe, mat_sole, mat_denim, mat_cuff=mat_cuff, cuff_h=0.145)

    # Cream shirt core (slim inside denim overalls!)
    torso = create_lathe_mesh("Shirt_Torso", [(0.172, 0.36), (0.186, 0.50), (0.184, 0.64), (0.175, 0.74), (0.132, 0.81), (0.088, 0.835)], segments=28)
    torso.scale = (1.03, 0.86, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    add_subsurf(torso, 1)
    attach(torso, mat_shirt)

    # Cozy cream crewneck trim
    attach(create_curved_tube("Shirt_NeckTrim", [(math.cos(math.radians(d)) * 0.095, math.sin(math.radians(d)) * 0.088, 0.822, 0.014) for d in range(0, 360, 20)], bevel_res=5, cyclic=True), mat_shirt)

    # Long rolled-cuff cream sleeves
    build_human_arms(root, attach, mat_shirt, mat_skin, mat_shirt, long_sleeve=True)

    # Tailored Indigo Denim Overalls (waist wrap + front bib + pocket + back yoke + straps + twin yellow buttons!)
    ov_waist = create_lathe_mesh("Overalls_Lower", [(0.228, 0.34), (0.236, 0.44), (0.222, 0.55), (0.214, 0.595)], segments=28)
    ov_waist.scale = (1.03, 0.89, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    add_subsurf(ov_waist, 1)
    attach(ov_waist, mat_denim)

    # Front overalls bib curving cleanly outside cream shirt
    bm = bmesh.new()
    rows = []
    for iv in range(8):
        tv = iv / 7.0
        z = 0.565 + tv * 0.195
        hw = 0.158 - tv * 0.022
        row = []
        for iu in range(11):
            tu = (iu / 10.0) * 2.0 - 1.0
            y = -0.192 + tv * 0.018 + (tu * tu) * 0.036
            row.append(bm.verts.new((tu * hw, y, z)))
        rows.append(row)
    for iv in range(7):
        for iu in range(10):
            bm.faces.new((rows[iv][iu], rows[iv][iu + 1], rows[iv + 1][iu + 1], rows[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm_m = bpy.data.meshes.new("Overalls_FrontBib")
    bm.to_mesh(bm_m)
    bm.free()
    fbib = bpy.data.objects.new("Overalls_FrontBib", bm_m)
    bpy.context.collection.objects.link(fbib)
    fbib.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.015
    add_subsurf(fbib, 1)
    attach(fbib, mat_denim)

    # Back denim panel
    bm = bmesh.new()
    rows = []
    for iv in range(7):
        tv = iv / 6.0
        z = 0.565 + tv * 0.180
        hw = 0.162 - tv * 0.030
        row = []
        for iu in range(9):
            tu = (iu / 8.0) * 2.0 - 1.0
            y = 0.190 - tv * 0.015 - (tu * tu) * 0.035
            row.append(bm.verts.new((tu * hw, y, z)))
        rows.append(row)
    for iv in range(6):
        for iu in range(8):
            bm.faces.new((rows[iv][iu + 1], rows[iv][iu], rows[iv + 1][iu], rows[iv + 1][iu + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bbm = bpy.data.meshes.new("Overalls_BackBib")
    bm.to_mesh(bbm)
    bm.free()
    bbib = bpy.data.objects.new("Overalls_BackBib", bbm)
    bpy.context.collection.objects.link(bbib)
    bbib.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.015
    add_subsurf(bbib, 1)
    attach(bbib, mat_denim)

    # Cute square denim chest pocket + iconic twin golden-yellow buttons + straps!
    add_box("Overalls_ChestPocket", (0.145, 0.022, 0.115), (0.0, -0.196, 0.655), root, mat_denim, bevel=0.008)
    for side in (-1, 1):
        add_cyl(f"Overalls_Btn_{side}", 0.022, 0.015, (side * 0.112, -0.172, 0.742), root, mat_btn, verts=16, rot=(math.radians(82), 0, side * math.radians(15)))
        attach(
            create_curved_tube(
                f"Overalls_Strap_{side}",
                [
                    (side * 0.112, -0.165, 0.752, 0.019),
                    (side * 0.118, -0.02, 0.822, 0.019),
                    (side * 0.112, 0.145, 0.750, 0.019),
                ],
                bevel_res=5,
            ),
            mat_denim,
        )

    # Young cheerful Ghibli face
    build_human_head(root, attach, mat_skin, mat_blush, mat_eye, mat_white, mat_hair, nose_scale=(0.022, 0.022, 0.018), eye_style="young", cheek_plump=0.10)

    # Lush shaggy chestnut hair tufts framing forehead, temples, and back under straw hat!
    hair_tufts = [
        [(0.0, -0.145, 1.168, 0.028), (-0.042, -0.188, 1.120, 0.024), (-0.022, -0.195, 1.078, 0.010)],
        [(0.012, -0.148, 1.165, 0.028), (0.058, -0.185, 1.116, 0.024), (0.045, -0.190, 1.076, 0.010)],
        [(-0.065, -0.138, 1.155, 0.028), (-0.132, -0.148, 1.095, 0.026), (-0.175, -0.105, 1.045, 0.012)],
        [(0.065, -0.138, 1.155, 0.028), (0.132, -0.148, 1.095, 0.026), (0.175, -0.105, 1.045, 0.012)],
        [(-0.145, -0.065, 1.125, 0.030), (-0.205, -0.025, 1.055, 0.024), (-0.205, 0.025, 0.995, 0.012)],
        [(0.145, -0.065, 1.125, 0.030), (0.205, -0.025, 1.055, 0.024), (0.205, 0.025, 0.995, 0.012)],
        # Back hair tufts peeking cleanly under hat brim
        [(-0.12, 0.14, 1.08, 0.034), (-0.13, 0.19, 0.99, 0.026), (-0.10, 0.19, 0.935, 0.012)],
        [(0.0, 0.16, 1.08, 0.038), (0.0, 0.21, 0.985, 0.028), (0.0, 0.20, 0.925, 0.013)],
        [(0.12, 0.14, 1.08, 0.034), (0.13, 0.19, 0.99, 0.026), (0.10, 0.19, 0.935, 0.012)],
    ]
    for idx, pts in enumerate(hair_tufts):
        attach(create_curved_tube(f"BoyHair_{idx}", pts, bevel_res=5), mat_hair)

    # ICONIC WIDE WAVY WOVEN STRAW SUNHAT (Tilted gently -10 deg BACKWARD around +X so face shines!)
    hat_root = bpy.data.objects.new("StrawHat_Group", None)
    hat_root.parent = root
    hat_root.location = (0.0, 0.010, 1.148)
    hat_root.rotation_euler = (math.radians(-10.0), 0.0, 0.0)
    bpy.context.collection.objects.link(hat_root)

    # Soft rounded crown dome
    crown_prof = [
        (0.215, 0.0),
        (0.205, 0.055),
        (0.185, 0.115),
        (0.142, 0.162),
        (0.075, 0.186),
        (0.012, 0.192),
    ]
    crown = create_lathe_mesh("Hat_Crown", crown_prof, segments=32, cap_bottom=False)
    crown.parent = hat_root
    crown.data.materials.append(mat_straw)
    add_subsurf(crown, 1)

    # Dark walnut leather hatband hugging crown cleanly
    band = create_lathe_mesh("Hat_Band", [(0.214, 0.004), (0.210, 0.048)], segments=32, cap_top=False, cap_bottom=False)
    band.parent = hat_root
    band.data.materials.append(mat_band)
    band.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.010

    # Wide organic wavy straw hat brim (classic hand-woven storybook sunhat silhouette!)
    bm = bmesh.new()
    r_rings = 7
    segs = 44
    b_rings = []
    for ir in range(r_rings):
        tr = ir / (r_rings - 1.0)
        rad = 0.208 + tr * 0.218
        ring = []
        for iseg in range(segs):
            th = (iseg / segs) * math.tau
            # Gentle downward droop + charming organic brim waves (slightly lifted in front -Y!)
            droop = -0.072 * (tr ** 1.35)
            front_lift = 0.022 * tr * max(0.0, -math.sin(th))
            wave = math.sin(th * 5.0 + 0.4) * 0.018 * (tr ** 1.2) + math.cos(th * 3.0) * 0.010 * tr
            ring.append(bm.verts.new((math.cos(th) * rad, math.sin(th) * rad, droop + front_lift + wave)))
        b_rings.append(ring)
    for ir in range(r_rings - 1):
        for iseg in range(segs):
            ns = (iseg + 1) % segs
            bm.faces.new((b_rings[ir][iseg], b_rings[ir + 1][iseg], b_rings[ir + 1][ns], b_rings[ir][ns]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    brim_m = bpy.data.meshes.new("Hat_Brim")
    bm.to_mesh(brim_m)
    bm.free()
    brim = bpy.data.objects.new("Hat_Brim", brim_m)
    bpy.context.collection.objects.link(brim)
    brim.parent = hat_root
    brim.data.materials.append(mat_straw)
    sol_br = brim.modifiers.new("Solidify", "SOLIDIFY")
    sol_br.thickness = 0.018
    add_subsurf(brim, 1)

    return root, 1.24, False


# =============================================================================
# 3. DOG: 伴游小狗 (Matching dog_turnaround.png — soft droopy ears & bandana!)
# =============================================================================
def build_dog():
    """
    Blender space: facing -Y (front), +Z up, total nose-to-tail length 0.65m!
    """
    root = bpy.data.objects.new("Companion_Dog", None)
    bpy.context.collection.objects.link(root)

    mat_eye, mat_white = make_common_human_mats()
    mat_fur = make_gouache_mat("Mat_DogFur", "#c47438", "#8f4a1c", rough=0.86, ao_strength=0.28)
    mat_ear = make_gouache_mat("Mat_DogEar", "#8e4d23", "#5c2e11", rough=0.88, ao_strength=0.30)
    mat_cream = make_gouache_mat("Mat_DogCream", "#f3dfb8", "#d4b885", rough=0.86, ao_strength=0.20)
    mat_nose = make_gouache_mat("Mat_DogNose", "#462819", "#26140b", rough=0.35, ao_strength=0.10)
    mat_bandana = make_gouache_mat("Mat_BandanaCoral", "#d94d2f", "#9e2d19", rough=0.84, ao_strength=0.28)

    def attach(obj, mat):
        obj.parent = root
        if obj.data and hasattr(obj.data, "materials"):
            obj.data.materials.clear()
            obj.data.materials.append(mat)
        return obj

    # Plump cozy quadruped torso (slightly fuller chest at -Y, soft rounded rump at +Y)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1.0, location=(0.0, 0.04, 0.215))
    body = bpy.context.active_object
    body.name = "Dog_Body"
    body.scale = (0.145, 0.228, 0.128)
    bpy.ops.object.transform_apply(scale=True)
    for v in body.data.vertices:
        # Gently flatten lower belly & tuck waist slightly before hind haunches
        if v.co.z < -0.06:
            v.co.z *= 0.88
        if 0.0 < v.co.y < 0.14 and v.co.z < 0:
            v.co.z += 0.015 * math.sin((v.co.y / 0.14) * math.pi)
    add_subsurf(body, 1)
    attach(body, mat_fur)

    # Fluffy cream chest ruff & warm cream underbelly
    add_sphere("Dog_ChestCream", (0.112, 0.095, 0.108), (0.0, -0.125, 0.195), root, mat_cream, segs=18, rings=12)
    add_sphere("Dog_BellyCream", (0.102, 0.155, 0.055), (0.0, 0.03, 0.125), root, mat_cream, segs=16, rings=10)

    # 4 Sturdy short legs + rounded cream paws with 3 cute toe nubs each (feet at Z = 0.0!)
    leg_coords = [
        (-0.088, -0.105, "FL"),
        (0.088, -0.105, "FR"),
        (-0.092, 0.155, "BL"),
        (0.092, 0.155, "BR"),
    ]
    for lx, ly, tag in leg_coords:
        # Upper thigh haunch for back legs
        if tag.startswith("B"):
            add_sphere(f"Haunch_{tag}", (0.068, 0.086, 0.088), (lx, ly - 0.01, 0.185), root, mat_fur, segs=14, rings=10)
        leg = create_lathe_mesh(f"Leg_{tag}", [(0.042, 0.035), (0.046, 0.09), (0.054, 0.175)], segments=16)
        leg.location = (lx, ly, 0.0)
        add_subsurf(leg, 1)
        attach(leg, mat_fur)

        # Rounded cream paw pad resting cleanly at Z = 0
        add_sphere(f"Paw_{tag}", (0.046, 0.056, 0.032), (lx, ly - 0.016, 0.028), root, mat_cream, segs=14, rings=10)
        for tx in (-0.022, 0.0, 0.022):
            add_sphere(f"Toe_{tag}_{tx:.2f}", (0.015, 0.018, 0.015), (lx + tx, ly - 0.058, 0.016), root, mat_cream, segs=10, rings=8)

    # Happy curved wagging tail at +Y
    attach(
        create_curved_tube(
            "Dog_Tail",
            [
                (0.0, 0.245, 0.248, 0.036),
                (0.0, 0.318, 0.242, 0.032),
                (0.0, 0.378, 0.262, 0.022),
                (0.0, 0.412, 0.285, 0.011),
            ],
            bevel_res=6,
        ),
        mat_fur,
    )

    # Plump puppy head at front-top (-Y)
    hx, hy, hz = 0.0, -0.178, 0.335
    add_sphere("Dog_Head", (0.145, 0.142, 0.132), (hx, hy, hz), root, mat_fur, segs=24, rings=16)
    # Cute cream forehead blaze stripe!
    add_sphere("Dog_ForeheadBlaze", (0.024, 0.045, 0.058), (hx, hy - 0.112, hz + 0.068), root, mat_cream, rot=(0.45, 0, 0), segs=12, rings=8)

    # Plump cream muzzle & rosy cheek puffs!
    add_sphere("Dog_Muzzle", (0.088, 0.072, 0.064), (hx, hy - 0.128, hz - 0.036), root, mat_cream, segs=18, rings=12)
    add_sphere("Dog_Nose", (0.032, 0.024, 0.022), (hx, hy - 0.194, hz - 0.012), root, mat_nose, segs=16, rings=10)

    # Sweet curved puppy 'W' smile clearly visible right below chocolate nose!
    attach(
        create_curved_tube(
            "Dog_Smile",
            [
                (-0.044, hy - 0.184, hz - 0.044, 0.0048),
                (-0.022, hy - 0.198, hz - 0.056, 0.0055),
                (0.0, hy - 0.203, hz - 0.042, 0.0052),
                (0.022, hy - 0.198, hz - 0.056, 0.0055),
                (0.044, hy - 0.184, hz - 0.044, 0.0048),
            ],
            bevel_res=4,
        ),
        mat_nose,
    )

    # Big soulful puppy eyes + bright white catchlights + cute cream eyebrow dots!
    for side in (-1, 1):
        add_sphere(f"Dog_Eye_{side}", (0.022, 0.016, 0.024), (side * 0.064, hy - 0.126, hz + 0.016), root, mat_eye, rot=(0.05, 0, side * 0.25), segs=14, rings=10)
        add_sphere(f"Dog_Catch_{side}", (0.0065, 0.0065, 0.0065), (side * 0.058, hy - 0.141, hz + 0.025), root, mat_white, segs=10, rings=8)
        add_sphere(f"Dog_BrowDot_{side}", (0.015, 0.010, 0.011), (side * 0.062, hy - 0.124, hz + 0.052), root, mat_cream, segs=10, rings=8)

        # TRUE VELVETY-SOFT ROUNDED DROOPY FLOPPY EARS (Sculpted Subsurf almond ear draping warmly alongside cheek!)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=1.0, location=(side * 0.155, hy + 0.010, hz - 0.015))
        ear_obj = bpy.context.active_object
        ear_obj.name = f"Dog_FloppyEar_{side}"
        ear_obj.scale = (0.040, 0.072, 0.112)
        ear_obj.rotation_euler = (math.radians(8.0), side * math.radians(-14.0), side * math.radians(10.0))
        bpy.ops.object.transform_apply(scale=True)
        for v in ear_obj.data.vertices:
            # Slightly fuller soft rounded bottom lobe, gently tapered top attachment!
            if v.co.z > 0.02:
                v.co.y *= 0.80
                v.co.x *= 0.85
        add_subsurf(ear_obj, 1)
        attach(ear_obj, mat_ear)

    # ICONIC DRAPED CORAL-RED TRIANGULAR BANDANA (Cleanly OUTSIDE cream chest ruff -> ZERO clipping!)
    attach(
        create_curved_tube(
            "Dog_BandanaCollar",
            [
                (math.cos(math.radians(d)) * 0.144, hy + 0.020 + math.sin(math.radians(d)) * 0.138, hz - 0.095 - math.sin(math.radians(d)) * 0.018, 0.024)
                for d in range(0, 360, 20)
            ],
            bevel_res=6,
            cyclic=True,
        ),
        mat_bandana,
    )
    bm = bmesh.new()
    rows = []
    for iv in range(7):
        tv = iv / 6.0  # 0 = bottom V-tip, 1 = neck rim
        z = 0.124 + tv * 0.116
        hw = 0.012 + tv * 0.118
        row = []
        for iu in range(9):
            tu = (iu / 8.0) * 2.0 - 1.0
            x = tu * hw
            y = -0.248 + (1.0 - tv) * 0.014 + (tu * tu) * (0.052 * tv)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for iv in range(6):
        for iu in range(8):
            bm.faces.new((rows[iv][iu], rows[iv][iu + 1], rows[iv + 1][iu + 1], rows[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm_bd = bpy.data.meshes.new("Dog_BandanaFront")
    bm.to_mesh(bm_bd)
    bm.free()
    bd = bpy.data.objects.new("Dog_BandanaFront", bm_bd)
    bpy.context.collection.objects.link(bd)
    bd.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.014
    add_subsurf(bd, 1)
    attach(bd, mat_bandana)

    # Back-of-neck knot + fluttering twin coral ribbon ears!
    add_sphere("Dog_BandanaKnot", (0.028, 0.026, 0.026), (0.0, hy + 0.155, hz - 0.068), root, mat_bandana, segs=12, rings=8)
    for side in (-1, 1):
        attach(
            create_curved_tube(
                f"Dog_BandanaTail_{side}",
                [
                    (side * 0.012, hy + 0.158, hz - 0.066, 0.014),
                    (side * 0.052, hy + 0.195, hz - 0.048, 0.022),
                    (side * 0.078, hy + 0.215, hz - 0.058, 0.010),
                ],
                bevel_res=5,
            ),
            mat_bandana,
        )

    return root, 0.65, True


# =============================================================================
# 4. NPC_ARTISAN: 渔具工匠 · 老周 (Matching npc_artisan_turnaround.png!)
# =============================================================================
def build_npc_artisan():
    root = bpy.data.objects.new("NPC_Artisan_LaoZhou", None)
    bpy.context.collection.objects.link(root)

    mat_eye, mat_white = make_common_human_mats()
    mat_skin = make_gouache_mat("Mat_SkinWarm", "#eba977", "#c97d4b", rough=0.78)
    mat_blush = make_gouache_mat("Mat_BlushRosy", "#e07052", "#ba5038", rough=0.80, ao_strength=0.08)
    mat_cap = make_gouache_mat("Mat_CapLilyGreen", "#91ad48", "#657d29", rough=0.86, ao_strength=0.28)
    mat_hair = make_gouache_mat("Mat_HairDark", "#473b32", "#2b221c", rough=0.88)
    mat_silver = make_gouache_mat("Mat_HairGrey", "#cfcbc2", "#9e9990", rough=0.84, ao_strength=0.18)
    mat_shirt = make_gouache_mat("Mat_WorkShirtIndigo", "#31537a", "#1e3754", rough=0.88)
    mat_under = make_gouache_mat("Mat_UnderTee", "#f2e1be", "#d4be94", rough=0.86)
    mat_apron = make_gouache_mat("Mat_LeatherApron", "#cf8334", "#99581a", rough=0.80, ao_strength=0.30)
    mat_strap = make_gouache_mat("Mat_LeatherStrap", "#9e5c24", "#6b3b12", rough=0.82)
    mat_brass = make_gouache_mat("Mat_BrassRivet", "#e6bc5c", "#a8802e", rough=0.30, metal=0.68, ao_strength=0.10)
    mat_pants = make_gouache_mat("Mat_WorkPants", "#2c4461", "#1b2c40", rough=0.88)
    mat_shoe = make_gouache_mat("Mat_BootCraft", "#7c4f2b", "#4e2e16", rough=0.78)
    mat_sole = make_gouache_mat("Mat_SoleCraft", "#4a2c16", "#2c190b", rough=0.90)

    def attach(obj, mat):
        obj.parent = root
        if obj.data and hasattr(obj.data, "materials"):
            obj.data.materials.clear()
            obj.data.materials.append(mat)
        return obj

    build_human_base_legs_and_shoes(root, attach, mat_shoe, mat_sole, mat_pants)

    # Sturdy craftsman indigo workshirt torso
    torso = create_lathe_mesh("WorkShirt_Torso", [(0.195, 0.34), (0.208, 0.48), (0.204, 0.62), (0.192, 0.74), (0.145, 0.81), (0.095, 0.835)], segments=28)
    torso.scale = (1.06, 0.88, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    add_subsurf(torso, 1)
    attach(torso, mat_shirt)

    # Cream undershirt V-glimpse + folded indigo shirt collar
    add_sphere("UnderTee_V", (0.055, 0.032, 0.048), (0, -0.102, 0.798), root, mat_under, segs=12, rings=8)
    for side in (-1, 1):
        attach(create_curved_tube(f"Collar_{side}", [(side * 0.018, -0.112, 0.775, 0.018), (side * 0.078, -0.095, 0.816, 0.022), (side * 0.096, 0.0, 0.826, 0.020), (side * 0.058, 0.088, 0.828, 0.018), (0.0, 0.098, 0.828, 0.016)], bevel_res=6), mat_shirt)

    build_human_arms(root, attach, mat_shirt, mat_skin, mat_shirt, cuff_pos=0.46)

    # Sculpted Honey-Tan Leather Craftsman Apron (one-piece flared leather front + brass rivets + back straps & bow!)
    bm = bmesh.new()
    rows = []
    for iv in range(14):
        tv = iv / 13.0
        z = 0.235 + tv * 0.535
        hw = 0.255 - tv * 0.112
        row = []
        for iu in range(15):
            tu = (iu / 14.0) * 2.0 - 1.0
            ang = -math.pi * 0.5 + tu * math.radians(78 - tv * 24)
            rx = (0.280 - tv * 0.055)
            ry = (0.242 - tv * 0.042)
            row.append(bm.verts.new((math.cos(ang) * rx, math.sin(ang) * ry, z)))
        rows.append(row)
    for iv in range(13):
        for iu in range(14):
            bm.faces.new((rows[iv][iu], rows[iv][iu + 1], rows[iv + 1][iu + 1], rows[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    am = bpy.data.meshes.new("Leather_Apron")
    bm.to_mesh(am)
    bm.free()
    apron = bpy.data.objects.new("Leather_Apron", am)
    bpy.context.collection.objects.link(apron)
    apron.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.017
    add_subsurf(apron, 1)
    attach(apron, mat_apron)

    # Brass rivets + shoulder leather straps + back waist tie & bow!
    for side in (-1, 1):
        add_cyl(f"Rivet_{side}", 0.014, 0.012, (side * 0.118, -0.186, 0.750), root, mat_brass, verts=14, rot=(math.radians(82), 0, side * math.radians(18)))
        attach(create_curved_tube(f"LStrap_{side}", [(side * 0.118, -0.180, 0.758, 0.017), (side * 0.128, -0.02, 0.824, 0.018), (side * 0.105, 0.155, 0.768, 0.018), (side * 0.072, 0.212, 0.585, 0.017)], bevel_res=5), mat_strap)
        attach(create_curved_tube(f"LBowLoop_{side}", [(0.0, 0.228, 0.578, 0.015), (side * 0.088, 0.268, 0.608, 0.022), (side * 0.108, 0.258, 0.556, 0.020), (0.0, 0.228, 0.570, 0.015)], bevel_res=5), mat_strap)
        attach(create_curved_tube(f"LBowTail_{side}", [(side * 0.012, 0.232, 0.568, 0.015), (side * 0.056, 0.260, 0.470, 0.020), (side * 0.076, 0.270, 0.375, 0.022)], bevel_res=4), mat_strap)
    attach(create_curved_tube("Leather_WaistTie", [(math.cos(math.radians(d)) * 0.232, math.sin(math.radians(d)) * 0.212, 0.578, 0.016) for d in range(15, 166, 15)], bevel_res=5), mat_strap)
    add_sphere("LBowKnot", (0.030, 0.030, 0.030), (0.0, 0.232, 0.576), root, mat_strap, segs=12, rings=8)

    # ICONIC SIDE TOOL POUCH on left hip holding wooden thread spool & wood mallet handle!
    px, py, pz = 0.205, -0.142, 0.462
    add_box("ToolPouch", (0.072, 0.085, 0.118), (px, py, pz), root, mat_strap, bevel=0.018, rot=(0, 0, -0.45))
    add_cyl("Pouch_Spool", 0.020, 0.058, (px - 0.008, py - 0.015, pz + 0.072), root, mat_under, verts=12)
    add_cyl("Pouch_ToolShaft", 0.014, 0.088, (px + 0.012, py + 0.012, pz + 0.085), root, mat_apron, verts=10)
    add_sphere("Pouch_ToolKnob", (0.022, 0.022, 0.022), (px + 0.012, py + 0.012, pz + 0.132), root, mat_apron, segs=10, rings=8)

    # Kindly Master Craftsman Face (prominent rosy nose + thick silver brows + warm dark smile!)
    build_human_head(root, attach, mat_skin, mat_blush, mat_eye, mat_white, mat_silver, nose_scale=(0.044, 0.038, 0.030), eye_style="thick_brow", cheek_plump=0.14, mat_mouth=mat_hair)

    # Silver temple curls + neat dark hair at nape under flat cap
    for side in (-1, 1):
        attach(create_curved_tube(f"TempleSilver_{side}", [(side * 0.155, -0.112, 1.112, 0.020), (side * 0.204, -0.048, 1.078, 0.022), (side * 0.212, 0.018, 1.048, 0.016)], bevel_res=5), mat_silver)
    add_sphere("BackHair_Zhou", (0.188, 0.152, 0.112), (0.0, 0.068, 1.015), root, mat_hair, segs=18, rings=12)

    # ICONIC WATERLILY-GREEN NEWSBOY FLAT CAP (Cleanly above forehead & brows!)
    cap_root = bpy.data.objects.new("Cap_Group", None)
    cap_root.parent = root
    cap_root.location = (0.0, 0.016, 1.148)
    cap_root.rotation_euler = (math.radians(-16.0), 0.0, 0.0)
    bpy.context.collection.objects.link(cap_root)

    add_sphere("Cap_Crown", (0.232, 0.242, 0.125), (0.0, 0.018, 0.048), cap_root, mat_cap, segs=24, rings=14)
    add_sphere("Cap_TopButton", (0.028, 0.028, 0.018), (0.0, 0.015, 0.172), cap_root, mat_cap, segs=12, rings=8)
    # Curved forward flat-cap visor brim (-Y)
    bm = bmesh.new()
    v_rings = []
    for ir in range(5):
        tr = ir / 4.0
        r_y = 0.175 + tr * 0.115
        r_x = 0.195 + math.sin(tr * math.pi) * 0.018
        z_v = -0.015 - tr * 0.028
        row = []
        for iu in range(15):
            tu = (iu / 14.0) * 2.0 - 1.0
            ang = -math.pi * 0.5 + tu * math.radians(68)
            row.append(bm.verts.new((math.cos(ang) * r_x, math.sin(ang) * r_y, z_v)))
        v_rings.append(row)
    for ir in range(4):
        for iu in range(14):
            bm.faces.new((v_rings[ir][iu], v_rings[ir + 1][iu], v_rings[ir + 1][iu + 1], v_rings[ir][iu + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    vm = bpy.data.meshes.new("Cap_Visor")
    bm.to_mesh(vm)
    bm.free()
    vis = bpy.data.objects.new("Cap_Visor", vm)
    bpy.context.collection.objects.link(vis)
    vis.parent = cap_root
    vis.data.materials.append(mat_cap)
    vis.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.018
    add_subsurf(vis, 1)

    return root, 1.26, False


# =============================================================================
# 5. NPC_LIGHTHOUSE: 灯塔守望者 · 海伯 (Matching npc_lighthouse_turnaround.png!)
# =============================================================================
def build_npc_lighthouse():
    root = bpy.data.objects.new("NPC_Lighthouse_HaiBo", None)
    bpy.context.collection.objects.link(root)

    mat_eye, mat_white = make_common_human_mats()
    mat_skin = make_gouache_mat("Mat_SkinCaptain", "#ebb082", "#c98555", rough=0.78)
    mat_blush = make_gouache_mat("Mat_BlushSea", "#e3745a", "#bd523b", rough=0.80, ao_strength=0.08)
    mat_beard = make_gouache_mat("Mat_BeardSilver", "#e2dfd7", "#b5b0a6", rough=0.86, ao_strength=0.22)
    mat_cap = make_gouache_mat("Mat_CaptainCap", "#3a5678", "#233750", rough=0.86, ao_strength=0.28)
    mat_visor = make_gouache_mat("Mat_CapVisorDark", "#253952", "#162436", rough=0.74)
    mat_sweater = make_gouache_mat("Mat_KnitSweater", "#f2e5cb", "#cfc0a3", rough=0.88, pattern="knit", pattern_scale=22.0)
    mat_coat = make_gouache_mat("Mat_PeacockCoat", "#267185", "#174b59", rough=0.86, ao_strength=0.30)
    mat_coat_dark = make_gouache_mat("Mat_CoatTrim", "#1b5869", "#103945", rough=0.86)
    mat_scarf = make_gouache_mat("Mat_Neckerchief", "#d64e31", "#9c2e19", rough=0.84)
    mat_pants = make_gouache_mat("Mat_PantsCharcoal", "#4a4f57", "#2e3238", rough=0.88)
    mat_shoe = make_gouache_mat("Mat_BootTan", "#96612f", "#633c18", rough=0.78)
    mat_sole = make_gouache_mat("Mat_SoleTan", "#523217", "#331e0d", rough=0.90)
    mat_brass = make_gouache_mat("Mat_BrassLantern", "#d9a94c", "#8f6922", rough=0.34, metal=0.68, ao_strength=0.10)
    mat_lamp = make_gouache_mat("Mat_WarmLamp", "#ffebb5", "#ffd17a", rough=0.35, emit_hex="#ffc65c", emit_str=2.2, ao_strength=0.0, bump_str=0.0)

    def attach(obj, mat):
        obj.parent = root
        if obj.data and hasattr(obj.data, "materials"):
            obj.data.materials.clear()
            obj.data.materials.append(mat)
        return obj

    build_human_base_legs_and_shoes(root, attach, mat_shoe, mat_sole, mat_pants)

    # Cream ribbed knit fisherman sweater core (clearly visible down center front!)
    sweater = create_lathe_mesh("Knit_Sweater", [(0.195, 0.35), (0.208, 0.48), (0.204, 0.62), (0.192, 0.74), (0.142, 0.81), (0.095, 0.835)], segments=28)
    sweater.scale = (1.04, 0.88, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    add_subsurf(sweater, 1)
    attach(sweater, mat_sweater)

    # Open Peacock-Teal Wool Skipper Coat wrapping sides & back, leaving clean vertical front gap for knit sweater!
    bm = bmesh.new()
    grid = []
    for iv in range(13):
        tv = iv / 12.0
        z = 0.345 + tv * 0.445
        rx, ry = 0.258 - tv * 0.032, 0.228 - tv * 0.028
        row = []
        for iu in range(31):
            tu = iu / 30.0
            # Sweep 312 deg centered on BACK (+pi/2) -> leaves crisp 48 deg open front showing cream sweater!
            ang = math.pi * 0.5 + (tu - 0.5) * math.radians(312)
            row.append(bm.verts.new((math.cos(ang) * rx, math.sin(ang) * ry, z)))
        grid.append(row)
    for iv in range(12):
        for iu in range(30):
            bm.faces.new((grid[iv][iu], grid[iv][iu + 1], grid[iv + 1][iu + 1], grid[iv + 1][iu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cm = bpy.data.meshes.new("Skipper_Coat")
    bm.to_mesh(cm)
    bm.free()
    coat = bpy.data.objects.new("Skipper_Coat", cm)
    bpy.context.collection.objects.link(coat)
    coat.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.020
    add_subsurf(coat, 1)
    attach(coat, mat_coat)

    # Coat lapels, collar & twin flush hip pockets!
    for side in (-1, 1):
        attach(create_curved_tube(f"CoatLapel_{side}", [(side * 0.072, -0.192, 0.725, 0.022), (side * 0.115, -0.165, 0.785, 0.024), (side * 0.118, 0.01, 0.818, 0.022), (0.0, 0.125, 0.820, 0.020)], bevel_res=5), mat_coat_dark)
        add_box(f"CoatPocket_{side}", (0.098, 0.024, 0.112), (side * 0.146, -0.172, 0.465), root, mat_coat_dark, bevel=0.012, rot=(0, 0, -side * 0.48))

    # Coral-red sailor neckerchief + knot at throat!
    attach(create_curved_tube("Sailor_ScarfRing", [(math.cos(math.radians(d)) * 0.108, math.sin(math.radians(d)) * 0.104, 0.835, 0.024) for d in range(0, 360, 20)], bevel_res=6, cyclic=True), mat_scarf)
    add_sphere("Sailor_ScarfKnot", (0.032, 0.028, 0.028), (0.028, -0.128, 0.808), root, mat_scarf, segs=12, rings=8)
    attach(create_curved_tube("Sailor_ScarfTail", [(0.028, -0.132, 0.802, 0.020), (0.048, -0.168, 0.742, 0.024), (0.032, -0.185, 0.692, 0.012)], bevel_res=5), mat_scarf)

    # Peacock coat sleeves with rolled cuffs + cream knit inner sweater cuffs!
    hands = build_human_arms(root, attach, mat_coat, mat_skin, mat_coat_dark, long_sleeve=True, mat_inner_cuff=mat_sweater)

    # ANTIQUE GLOWING BRASS STORM LANTERN held cleanly in Captain Hai Bo's right hand (side = -1)!
    rh = hands[-1]
    lx, ly, lz = rh.x - 0.01, rh.y - 0.055, rh.z - 0.125
    # Curved brass handle hooking cleanly into palm!
    attach(create_curved_tube("Lantern_Bail", [(lx - 0.045, ly, lz + 0.075, 0.007), (lx, ly + 0.02, lz + 0.132, 0.007), (lx + 0.045, ly, lz + 0.075, 0.007)], bevel_res=4), mat_brass)
    add_cyl("Lantern_Cap", 0.058, 0.035, (lx, ly, lz + 0.068), root, mat_brass, verts=14)
    add_cyl("Lantern_GlowCore", 0.044, 0.095, (lx, ly, lz + 0.005), root, mat_lamp, verts=14)
    add_cyl("Lantern_Base", 0.062, 0.032, (lx, ly, lz - 0.055), root, mat_brass, verts=14)
    for k in range(4):
        ang = k * math.pi * 0.5 + math.pi * 0.25
        add_cyl(f"Lantern_Bar_{k}", 0.006, 0.105, (lx + math.cos(ang) * 0.050, ly + math.sin(ang) * 0.050, lz + 0.005), root, mat_brass, verts=6)

    # Sea Captain Face + Full Cozy Silver-White Beard & Mustache!
    mat_mouth_dark = make_gouache_mat("Mat_MouthDark", "#6e4230", "#452619", rough=0.82)
    build_human_head(root, attach, mat_skin, mat_blush, mat_eye, mat_white, mat_beard, nose_scale=(0.042, 0.036, 0.028), eye_style="thick_brow", cheek_plump=0.14, mat_mouth=mat_mouth_dark)

    # Sculpted full silver captain beard wrapping cleanly along lower jawline (below smile so warm smile shines!)
    attach(
        create_curved_tube(
            "Captain_BeardMain",
            [
                (-0.185, -0.025, 0.995, 0.036),
                (-0.145, -0.132, 0.915, 0.048),
                (-0.065, -0.178, 0.872, 0.056),
                (0.0, -0.188, 0.862, 0.058),
                (0.065, -0.178, 0.872, 0.056),
                (0.145, -0.132, 0.915, 0.048),
                (0.185, -0.025, 0.995, 0.036),
            ],
            bevel_res=6,
        ),
        mat_beard,
    )
    # Fluffy silver mustache framing his big cheerful grin!
    for side in (-1, 1):
        attach(
            create_curved_tube(
                f"Captain_Stache_{side}",
                [
                    (side * 0.008, -0.204, 0.974, 0.016),
                    (side * 0.052, -0.198, 0.968, 0.019),
                    (side * 0.095, -0.176, 0.948, 0.015),
                ],
                bevel_res=5,
            ),
            mat_beard,
        )
        # Wavy silver hair peeking around ears & back under skipper cap
        attach(create_curved_tube(f"Captain_HairSide_{side}", [(side * 0.155, -0.105, 1.115, 0.024), (side * 0.212, -0.035, 1.072, 0.026), (side * 0.205, 0.055, 1.015, 0.024)], bevel_res=5), mat_beard)
    add_sphere("Captain_HairBack", (0.195, 0.162, 0.125), (0.0, 0.068, 1.022), root, mat_beard, segs=18, rings=12)

    # ICONIC DEEP NAVY SKIPPER CAP (Tilted cleanly -14 deg backward above forehead!)
    cap_root = bpy.data.objects.new("CaptainCap_Group", None)
    cap_root.parent = root
    cap_root.location = (0.0, 0.015, 1.150)
    cap_root.rotation_euler = (math.radians(-14.0), 0.0, 0.0)
    bpy.context.collection.objects.link(cap_root)

    add_cyl("Cap_Band", 0.210, 0.068, (0.0, 0.005, 0.025), cap_root, mat_visor, verts=28)
    add_sphere("Cap_SlouchTop", (0.244, 0.248, 0.118), (0.0, 0.018, 0.088), cap_root, mat_cap, segs=24, rings=14)
    # Glossy curved navy captain visor brim (-Y)
    bm = bmesh.new()
    v_rings = []
    for ir in range(5):
        tr = ir / 4.0
        r_y = 0.185 + tr * 0.118
        r_x = 0.205 + math.sin(tr * math.pi) * 0.016
        z_v = -0.008 - tr * 0.032
        row = []
        for iu in range(15):
            tu = (iu / 14.0) * 2.0 - 1.0
            ang = -math.pi * 0.5 + tu * math.radians(68)
            row.append(bm.verts.new((math.cos(ang) * r_x, math.sin(ang) * r_y, z_v)))
        v_rings.append(row)
    for ir in range(4):
        for iu in range(14):
            bm.faces.new((v_rings[ir][iu], v_rings[ir + 1][iu], v_rings[ir + 1][iu + 1], v_rings[ir][iu + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cvm = bpy.data.meshes.new("CaptainCap_Visor")
    bm.to_mesh(cvm)
    bm.free()
    cvis = bpy.data.objects.new("CaptainCap_Visor", cvm)
    bpy.context.collection.objects.link(cvis)
    cvis.parent = cap_root
    cvis.data.materials.append(mat_visor)
    cvis.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.020
    add_subsurf(cvis, 1)

    return root, 1.26, False


BUILDERS = {
    "npc_market": build_npc_market,
    "player": build_player,
    "dog": build_dog,
    "npc_artisan": build_npc_artisan,
    "npc_lighthouse": build_npc_lighthouse,
}


def _reparent_preserve_world(obj, new_parent):
    """Reparents `obj` under `new_parent` with exact local transform so zero drift occurs in glTF export."""
    bpy.context.view_layer.update()
    world_mat = obj.matrix_world.copy()
    obj.parent = new_parent
    obj.matrix_parent_inverse.identity()
    obj.matrix_local = new_parent.matrix_world.inverted() @ world_mat


def _mesh_center_world(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(pts, Vector((0, 0, 0))) / max(1, len(pts))


def rig_humanoid_pivots(root):
    """
    Organizes all humanoid meshes into clean anatomical Empty joint pivots BEFORE normalization/baking:
      - Rig_Torso (hip/pelvis pivot) -> Rig_Head (neck pivot), Rig_ArmL (+X left shoulder), Rig_ArmR (-X right shoulder)
      - Rig_LegL (+X left hip), Rig_LegR (-X right hip)
    Matches Three.js +Z Front convention (+X = character Left, -X = character Right)!
    """
    bpy.context.view_layer.update()
    # Collect all mesh objects first (flattening sub-empties like StrawHat_Group/Cap_Group into Rig_Head cleanly!)
    meshes = [o for o in collect_hierarchy_objects(root) if o.type == "MESH"]
    old_empties = [o for o in collect_hierarchy_objects(root) if o.type == "EMPTY" and o != root]

    piv_torso = bpy.data.objects.new("Rig_Torso", None)
    piv_torso.location = (0.0, 0.0, 0.37)
    piv_torso.parent = root
    bpy.context.collection.objects.link(piv_torso)

    piv_head = bpy.data.objects.new("Rig_Head", None)
    piv_head.location = (0.0, 0.0, 0.85)
    bpy.context.collection.objects.link(piv_head)
    _reparent_preserve_world(piv_head, piv_torso)

    piv_arm_l = bpy.data.objects.new("Rig_ArmL", None)
    piv_arm_l.location = (0.186, 0.0, 0.742)
    bpy.context.collection.objects.link(piv_arm_l)
    _reparent_preserve_world(piv_arm_l, piv_torso)

    piv_arm_r = bpy.data.objects.new("Rig_ArmR", None)
    piv_arm_r.location = (-0.186, 0.0, 0.742)
    bpy.context.collection.objects.link(piv_arm_r)
    _reparent_preserve_world(piv_arm_r, piv_torso)

    piv_leg_l = bpy.data.objects.new("Rig_LegL", None)
    piv_leg_l.location = (0.132, 0.0, 0.37)
    piv_leg_l.parent = root
    bpy.context.collection.objects.link(piv_leg_l)

    piv_leg_r = bpy.data.objects.new("Rig_LegR", None)
    piv_leg_r.location = (-0.132, 0.0, 0.37)
    piv_leg_r.parent = root
    bpy.context.collection.objects.link(piv_leg_r)

    bpy.context.view_layer.update()

    HEAD_KEYS = (
        "head", "ear", "blush", "eye", "brow", "nose", "smile", "laugh",
        "hair", "boyhair", "scarf", "hat_", "cap_", "captain", "temple", "backhair",
    )
    ARM_KEYS = ("shoulder", "sleeve", "forearm", "palm", "thumb", "finger", "lantern_", "torus")
    LEG_KEYS = ("shoe", "sole", "bootshaft", "trouser")

    for obj in meshes:
        nl = obj.name.lower()
        ctr = _mesh_center_world(obj)
        # Note: Sailor_Scarf* sits on torso neck, NOT head!
        is_neck_scarf = "sailor_scarf" in nl
        if any(k in nl for k in LEG_KEYS):
            target = piv_leg_l if ctr.x >= 0.0 else piv_leg_r
        elif any(k in nl for k in ARM_KEYS) and "apron" not in nl and "waist" not in nl:
            target = piv_arm_l if ctr.x >= 0.0 else piv_arm_r
        elif (not is_neck_scarf) and (any(k in nl for k in HEAD_KEYS) or ctr.z > 0.865):
            target = piv_head
        else:
            target = piv_torso
        _reparent_preserve_world(obj, target)

    # Remove superseded static sub-empties (StrawHat_Group, Cap_Group, etc.) now that their meshes live in Rig_Head
    for emp in old_empties:
        if not emp.children:
            bpy.data.objects.remove(emp, do_unlink=True)


def rig_dog_pivots(root):
    """Organizes Companion Dog meshes into Rig_Body -> Rig_Head, Rig_Tail, and 4 paw pivots (Rig_PawFL/FR/BL/BR)!"""
    bpy.context.view_layer.update()
    meshes = [o for o in collect_hierarchy_objects(root) if o.type == "MESH"]

    piv_body = bpy.data.objects.new("Rig_Body", None)
    piv_body.location = (0.0, 0.0, 0.215)
    piv_body.parent = root
    bpy.context.collection.objects.link(piv_body)

    piv_head = bpy.data.objects.new("Rig_Head", None)
    piv_head.location = (0.0, -0.115, 0.285)
    bpy.context.collection.objects.link(piv_head)
    _reparent_preserve_world(piv_head, piv_body)

    piv_tail = bpy.data.objects.new("Rig_Tail", None)
    piv_tail.location = (0.0, 0.245, 0.248)
    bpy.context.collection.objects.link(piv_tail)
    _reparent_preserve_world(piv_tail, piv_body)

    paw_pivs = {}
    for pname, loc in [
        ("Rig_PawFR", (-0.088, -0.105, 0.175)),
        ("Rig_PawFL", (0.088, -0.105, 0.175)),
        ("Rig_PawBR", (-0.092, 0.155, 0.175)),
        ("Rig_PawBL", (0.092, 0.155, 0.175)),
    ]:
        p = bpy.data.objects.new(pname, None)
        p.location = loc
        bpy.context.collection.objects.link(p)
        _reparent_preserve_world(p, piv_body)
        paw_pivs[pname] = p

    bpy.context.view_layer.update()

    HEAD_KEYS = ("head", "blaze", "muzzle", "nose", "smile", "eye", "catch", "brow", "ear")
    PAW_KEYS = ("leg_", "paw_", "toe_", "haunch_")

    for obj in meshes:
        nl = obj.name.lower()
        ctr = _mesh_center_world(obj)
        if "tail" in nl and "bandana" not in nl:
            target = piv_tail
        elif any(k in nl for k in PAW_KEYS):
            is_front = ctr.y < 0.02
            is_left = ctr.x >= 0.0
            key = ("Rig_PawFL" if is_left else "Rig_PawFR") if is_front else ("Rig_PawBL" if is_left else "Rig_PawBR")
            target = paw_pivs[key]
        elif any(k in nl for k in HEAD_KEYS):
            target = piv_head
        else:
            target = piv_body
        _reparent_preserve_world(obj, target)


def run_one(char_id):
    clear_scene()
    root, target_dim, is_quad = BUILDERS[char_id]()
    # Convert curves/modifiers BEFORE re-parenting into clean anatomical Rig_* joint pivots!
    convert_and_apply_modifiers(root)
    if is_quad:
        rig_dog_pivots(root)
    else:
        rig_humanoid_pivots(root)
    normalize_character_root(root, target_height=target_dim, is_quadruped=is_quad)

    # 1. Bake crisp 1024x1024 shadow-free Gouache + Crevice AO texture atlas for WebGL GLB!
    tex_png = os.path.join(TEX_DIR, f"{char_id}_BaseColor.png")
    bake_gouache_atlas(root, tex_png, tex_size=1024)

    # 2. Save .blend and export WebGL-ready baked .glb BEFORE adding studio lights/pedestal!
    blend_path = os.path.join(BASE_OUT, f"{char_id}.blend")
    glb_path = os.path.join(EXP_DIR, f"{char_id}.glb")
    export_clean_glb(blend_path, glb_path)

    if "--no-preview" in sys.argv:
        return

    # 3. Render Front + 3/4 + 52° Top-Down inspection shots of the ACTUAL BAKED MESH!
    scene = bpy.context.scene
    setup_studio_render(scene, res_x=768, res_y=768, samples=32, is_house=False)
    cam_d = bpy.data.cameras.new("CharCam")
    cam_d.lens = 68
    cam = bpy.data.objects.new("CharCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    if is_quad:
        views = [
            (f"{char_id}_front.png", (0.0, -1.65, 0.36), (0.0, 0.0, 0.24)),
            (f"{char_id}_34.png", (1.15, -1.25, 0.56), (0.0, 0.0, 0.22)),
            (f"{char_id}_top52.png", (0.0, -1.05, 1.38), (0.0, 0.0, 0.20)),
        ]
    else:
        views = [
            (f"{char_id}_front.png", (0.0, -3.05, 0.72), (0.0, 0.0, 0.64)),
            (f"{char_id}_34.png", (1.78, -2.48, 1.02), (0.0, 0.0, 0.63)),
            (f"{char_id}_top52.png", (0.0, -1.92, 2.48), (0.0, 0.0, 0.56)),
        ]

    for fname, loc, tgt in views:
        aim_camera(cam, loc, tgt)
        scene.render.filepath = os.path.join(PREV_DIR, fname)
        bpy.ops.render.render(write_still=True)
        print(f"[Preview] Rendered {fname}")


def main():
    # Optional CLI filter: blender --background --python build_all_5_characters_ag.py -- player dog
    targets = []
    if "--" in sys.argv:
        targets = [a for a in sys.argv[sys.argv.index("--") + 1 :] if a in BUILDERS]
    if not targets:
        targets = list(BUILDERS.keys())
    for cid in targets:
        print(f"\n========== BUILDING CHARACTER: {cid} ==========")
        run_one(cid)


if __name__ == "__main__":
    main()
