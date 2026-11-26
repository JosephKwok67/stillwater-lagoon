"""
Antigravity Studio — 《钓鱼大冒险 · 静水》All 3 Town NPCs v2.0 (Natural Organic Ghibli Redesign)
Built strictly from:
  1. GPT-6.2-Astra Ultra Blueprint: art_pipeline/brief/NPCS_V2_REDESIGN_FRAMEWORK.md
  2. GPT-6.2-Sol (medium) Image 2.5 Turnarounds & 2x2 Detail Sheets: art_pipeline/concepts/npcs_v2/*.png
  3. Approved Player v2.0 Benchmark: build_player_v2_natural.py

Characters built & baked (2048x2048 shadow-free Gouache + AO + Seamless Airbrushed Blush):
  - `market`     -> 阿莲 (`npc_market.glb`, 1.280m): Coral cotton headscarf w/ nape knot & unequal tails + dark low bun,
                    cream rolled-sleeve blouse, peacock-teal apron w/ brass buttons, front pocket & sculptural rear waist bow,
                    slate trouser cuffs, warm brown round-toe integrated-sole work shoes.
  - `artisan`    -> 老周 (`npc_artisan.glb`, 1.310m): Deep-sea-blue flat cap w/ crisp visor, compressed grey-brown hair,
                    upturned silver-grey moustache & neat short craftsman beard, warm ivory rolled-sleeve work shirt,
                    caramel leather apron w/ chest pocket + wood tool handle + brass rivets + X-crossed back straps,
                    anatomical LEFT-hip wooden mallet & RIGHT-hip cream line spool, dark khaki trousers, chunky integrated brown boots.
  - `lighthouse` -> 海伯 (`npc_lighthouse.glb`, 1.350m): Soft navy captain's cap w/ muted gold brim band, lifted white brows,
                    full fluffy silver-white beard, cream chunky knit turtleneck, anatomical-left coral sailor scarf knot,
                    wide-shouldered ocean-blue double-breasted wool coat w/ 2x3 brass buttons, parted front hem & rear vent,
                    tall blue-green waterproof sea boots, anatomical RIGHT-hand (`Rig_ArmR`) glowing brass-and-glass storm lantern
                    hanging cleanly clear (>=55mm gap) of the coat hem!

CLI Usage:
  blender --background --python build_all_3_npcs_v2_natural.py -- --npc market
  blender --background --python build_all_3_npcs_v2_natural.py -- --npc artisan
  blender --background --python build_all_3_npcs_v2_natural.py -- --npc lighthouse
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
    srgb_to_linear,
    make_gouache_mat,
    set_smooth,
    add_subsurf,
    create_curved_tube,
    collect_hierarchy_objects,
    convert_and_apply_modifiers,
    bake_gouache_atlas,
    export_clean_glb,
    setup_studio_render,
    aim_camera,
)

BASE_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
TEX_DIR = os.path.join(BASE_OUT, "textures")
EXP_DIR = os.path.join(BASE_OUT, "exports", "characters")
for d in (TEX_DIR, EXP_DIR):
    os.makedirs(d, exist_ok=True)


# =============================================================================
# SHARED ORGANIC SCULPT, BLENDED-BLUSH SHADER & RIG HELPERS (from Player v2.0)
# =============================================================================
def make_face_skin_mat(name, skin_hex, warm_hex, blush_hex, nose_hex, cheek_xy=(0.105, -0.145, -0.036), cheek_r=0.082, blush_str=0.40, nose_pos=(0.0, -0.186, -0.028), nose_r=0.044, nose_str=0.38):
    """Seamless painted gouache skin with airbrushed 3D-projected cheek blush & warm nose tip — ZERO floating blush discs!"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.name = "MatOutput"
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "PrincipledBSDF"
    bsdf.inputs["Roughness"].default_value = 0.78
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.18
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 5.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])

    skin_base = srgb_to_linear(skin_hex)
    skin_warm = srgb_to_linear(warm_hex)
    blush_col = srgb_to_linear(blush_hex)
    nose_col = srgb_to_linear(nose_hex)

    m_skin = nt.nodes.new("ShaderNodeMix")
    m_skin.data_type = "RGBA"
    m_skin.inputs["A"].default_value = skin_warm
    m_skin.inputs["B"].default_value = skin_base
    nt.links.new(noise.outputs["Fac"], m_skin.inputs["Factor"])

    m_skin2 = nt.nodes.new("ShaderNodeMix")
    m_skin2.data_type = "RGBA"
    m_skin2.inputs["Factor"].default_value = 0.34
    m_skin2.inputs["A"].default_value = skin_base
    nt.links.new(m_skin.outputs["Result"], m_skin2.inputs["B"])
    cur = m_skin2.outputs["Result"]

    def blend_spot(in_col, center, radius, strength, target_col):
        vd = nt.nodes.new("ShaderNodeVectorMath")
        vd.operation = "DISTANCE"
        vd.inputs[1].default_value = center
        nt.links.new(tc.outputs["Object"], vd.inputs[0])

        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.interpolation_type = "SMOOTHSTEP"
        mr.clamp = True
        mr.inputs["From Min"].default_value = radius * 0.18
        mr.inputs["From Max"].default_value = radius
        mr.inputs["To Min"].default_value = strength
        mr.inputs["To Max"].default_value = 0.0
        nt.links.new(vd.outputs["Value"], mr.inputs["Value"])

        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.inputs["B"].default_value = target_col
        nt.links.new(mr.outputs["Result"], mx.inputs["Factor"])
        nt.links.new(in_col, mx.inputs["A"])
        return mx.outputs["Result"]

    cx, cy, cz = cheek_xy
    cur = blend_spot(cur, (cx, cy, cz), cheek_r, blush_str, blush_col)
    cur = blend_spot(cur, (-cx, cy, cz), cheek_r, blush_str, blush_col)
    cur = blend_spot(cur, nose_pos, nose_r, nose_str, nose_col)

    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 0.08
    nt.links.new(cur, ao.inputs["Color"])

    mix_ao = nt.nodes.new("ShaderNodeMix")
    mix_ao.name = "BakeColorOut"
    mix_ao.data_type = "RGBA"
    mix_ao.blend_type = "MULTIPLY"
    mix_ao.inputs["Factor"].default_value = 0.14
    nt.links.new(cur, mix_ao.inputs["A"])
    nt.links.new(ao.outputs["AO"], mix_ao.inputs["B"])
    nt.links.new(mix_ao.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def link_mesh(name, bm, mat, parent, loc=(0, 0, 0), rot=(0, 0, 0), subsurf=1, extra_mats=None):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    if extra_mats:
        for em in extra_mats:
            obj.data.materials.append(em)
    set_smooth(obj)
    if subsurf > 0:
        add_subsurf(obj, subsurf)
    return obj


def build_organic_loft(name, rings_spec, mat, parent, segs=24, cap_start=True, cap_end=True, subsurf=1):
    bm = bmesh.new()
    rings = []
    for idx, spec in enumerate(rings_spec):
        ctr = Vector(spec[0])
        rx, ry = spec[1], spec[2]
        tx = spec[3] if len(spec) > 3 else 0.0
        ty = spec[4] if len(spec) > 4 else 0.0
        famp = spec[5] if len(spec) > 5 else 0.0
        rot_m = Euler((tx, ty, 0.0), "XYZ").to_matrix()
        ring = []
        for i in range(segs):
            ang = (i / segs) * math.tau
            fold = 1.0 + famp * math.sin(ang * 3.0 + idx * 0.9) * 0.6 + famp * math.cos(ang * 2.0 - idx * 0.5) * 0.4
            p_local = Vector((math.cos(ang) * rx * fold, math.sin(ang) * ry * fold, 0.0))
            ring.append(bm.verts.new(ctr + rot_m @ p_local))
        rings.append(ring)

    for k in range(len(rings) - 1):
        r0, r1 = rings[k], rings[k + 1]
        for i in range(segs):
            ni = (i + 1) % segs
            bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))

    if cap_start:
        c0 = bm.verts.new(Vector(rings_spec[0][0]))
        for i in range(segs):
            ni = (i + 1) % segs
            bm.faces.new((rings[0][ni], rings[0][i], c0))
    if cap_end:
        c1 = bm.verts.new(Vector(rings_spec[-1][0]))
        for i in range(segs):
            ni = (i + 1) % segs
            bm.faces.new((rings[-1][i], rings[-1][ni], c1))

    return link_mesh(name, bm, mat, parent, subsurf=subsurf)


def build_swept_tube_mesh(name, spine_pts, mat, parent, segs=20, cap_start=True, cap_end=True, subsurf=1):
    bm = bmesh.new()
    pts = [Vector((p[0], p[1], p[2])) for p in spine_pts]
    n = len(pts)

    tangents = []
    for i in range(n):
        if i == 0:
            t = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            t = (pts[-1] - pts[-2]).normalized()
        else:
            t = (pts[i + 1] - pts[i - 1]).normalized()
        tangents.append(t)

    up_ref = Vector((0, -1, 0)) if abs(tangents[0].y) < 0.9 else Vector((1, 0, 0))
    u_vec = tangents[0].cross(up_ref).normalized()
    v_vec = tangents[0].cross(u_vec).normalized()

    rings = []
    for i, sp in enumerate(spine_pts):
        if i > 0:
            q = tangents[i - 1].rotation_difference(tangents[i])
            u_vec = (q @ u_vec).normalized()
            v_vec = tangents[i].cross(u_vec).normalized()
        rx, ry = sp[3], sp[4]
        famp = sp[5] if len(sp) > 5 else 0.0
        ring = []
        for j in range(segs):
            ang = (j / segs) * math.tau
            fold = 1.0 + famp * math.sin(ang * 3.0 + i * 1.1)
            offset = u_vec * (math.cos(ang) * rx * fold) + v_vec * (math.sin(ang) * ry * fold)
            ring.append(bm.verts.new(pts[i] + offset))
        rings.append(ring)

    for k in range(n - 1):
        r0, r1 = rings[k], rings[k + 1]
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))

    if cap_start:
        c0 = bm.verts.new(pts[0])
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((rings[0][nj], rings[0][j], c0))
    if cap_end:
        c1 = bm.verts.new(pts[-1])
        for j in range(segs):
            nj = (j + 1) % segs
            bm.faces.new((rings[-1][j], rings[-1][nj], c1))

    return link_mesh(name, bm, mat, parent, subsurf=subsurf)


def build_sculpted_head_base(name, piv_head, head_ctr_w, sx, sy, sz, nose_bulge, cheek_bulge, mat_face):
    p_off = piv_head.location
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=36, v_segments=24, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        rx, ry, rz = sx, sy, sz
        cheek_band = math.exp(-((z + 0.16) / 0.36) ** 2)
        rx *= 1.0 + cheek_bulge * cheek_band
        if z < -0.35:
            t_chin = min(1.0, (-z - 0.35) / 0.65)
            rx *= 1.0 - 0.22 * (t_chin ** 1.35)
            ry *= 1.0 - 0.12 * (t_chin ** 1.3)
        if z > 0.32:
            t_top = min(1.0, (z - 0.32) / 0.68)
            rx *= 1.0 - 0.08 * t_top
        if y > 0.0:
            ry *= 1.0 + 0.05 * math.exp(-((z - 0.06) / 0.55) ** 2)

        px, py, pz = x * rx, y * ry, z * rz
        if y < -0.2:
            fw = (-y - 0.2) / 0.8
            cheek_lump = math.exp(-((abs(px) - sx * 0.56) / (sx * 0.34)) ** 2 - ((pz + sz * 0.18) / (sz * 0.28)) ** 2)
            py -= 0.015 * cheek_lump * fw
            nose_b = math.exp(-(px / (sx * 0.17)) ** 2 - ((pz + sz * 0.14) / (sz * 0.15)) ** 2)
            py -= nose_bulge * nose_b * fw
            bridge = math.exp(-(px / (sx * 0.12)) ** 2 - ((pz - sz * 0.01) / (sz * 0.16)) ** 2)
            py -= 0.007 * bridge * fw
            for ex_s in (-sx * 0.34, sx * 0.34):
                sock = math.exp(-((px - ex_s) / (sx * 0.17)) ** 2 - ((pz - sz * 0.08) / (sz * 0.14)) ** 2)
                py += 0.007 * sock * fw
            chin_c = math.exp(-(px / (sx * 0.30)) ** 2 - ((pz + sz * 0.72) / (sz * 0.22)) ** 2)
            py -= 0.008 * chin_c * fw
        v.co = Vector((px, py, pz))
    return link_mesh(name, bm, mat_face, piv_head, loc=head_ctr_w - p_off, subsurf=1)


def build_eyes_and_ears(piv_head, head_ctr_w, sx, sy, eye_z_off, ear_z_off, mat_skin, mat_eye_dark, mat_eye_catch, mat_brow, brow_z_off, brow_r=0.0075):
    p_off = piv_head.location
    for side, sname in ((1, "L"), (-1, "R")):
        # Ears
        ebm = bmesh.new()
        bmesh.ops.create_uvsphere(ebm, u_segments=16, v_segments=12, radius=1.0)
        for v in ebm.verts:
            v.co = Vector((v.co.x * 0.027, v.co.y * 0.036, v.co.z * 0.044))
        ear_w = head_ctr_w + Vector((side * (sx + 0.006), 0.004, ear_z_off))
        link_mesh(f"Ear_{sname}", ebm, mat_skin, piv_head, loc=ear_w - p_off, rot=(0.0, side * 0.14, side * 0.16), subsurf=1)

        # Inset Dark Oval Eyes
        eye_w = head_ctr_w + Vector((side * (sx * 0.345), -(sy - 0.011), eye_z_off))
        eybm = bmesh.new()
        bmesh.ops.create_uvsphere(eybm, u_segments=16, v_segments=12, radius=1.0)
        for v in eybm.verts:
            v.co = Vector((v.co.x * 0.0185, v.co.y * 0.012, v.co.z * 0.0245))
        link_mesh(f"Eye_Dark_{sname}", eybm, mat_eye_dark, piv_head, loc=eye_w - p_off, rot=(0.0, 0.0, -side * 0.22), subsurf=0)

        # Soft upper-left catchlight
        cbm = bmesh.new()
        bmesh.ops.create_uvsphere(cbm, u_segments=10, v_segments=8, radius=1.0)
        for v in cbm.verts:
            v.co = Vector((v.co.x * 0.0058, v.co.y * 0.0045, v.co.z * 0.0068))
        catch_w = eye_w + Vector((0.005 - side * 0.003, -0.010, 0.009))
        link_mesh(f"Eye_Catch_{sname}", cbm, mat_eye_catch, piv_head, loc=catch_w - p_off, subsurf=0)

        # Arched Expressive Brow
        asym = 0.002 if side > 0 else 0.0
        brow_pts = [
            (head_ctr_w.x + side * (sx * 0.21), head_ctr_w.y - (sy - 0.008), head_ctr_w.z + brow_z_off + asym, brow_r * 0.90),
            (head_ctr_w.x + side * (sx * 0.35), head_ctr_w.y - (sy - 0.012), head_ctr_w.z + brow_z_off + 0.010 + asym, brow_r),
            (head_ctr_w.x + side * (sx * 0.49), head_ctr_w.y - (sy - 0.028), head_ctr_w.z + brow_z_off - 0.002 + asym, brow_r * 0.78),
        ]
        b_local = [(x - p_off.x, y - p_off.y, z - p_off.z, r) for (x, y, z, r) in brow_pts]
        bo = create_curved_tube(f"Brow_{sname}", b_local, bevel_res=4)
        bo.parent = piv_head
        bo.data.materials.append(mat_brow)


def build_four_digit_hand(piv_arm, side, palm_w, mat_skin, scale=1.0, curled_grip=False):
    """Builds a sculpted cupped 4-digit Ghibli hand (palm + opposing thumb + 3 softly curved fingers)."""
    sname = "L" if side > 0 else "R"
    p_off = piv_arm.location

    def L(x, y, z):
        return (x - p_off.x, y - p_off.y, z - p_off.z)

    pbm = bmesh.new()
    bmesh.ops.create_uvsphere(pbm, u_segments=16, v_segments=12, radius=1.0)
    for v in pbm.verts:
        if curled_grip:
            # Horizontal dorsal hand holding lantern bail from above (matching Detail Sheet Lower-Left!)
            v.co = Vector((v.co.x * 0.036 * scale, v.co.y * 0.032 * scale, v.co.z * 0.025 * scale))
        else:
            v.co = Vector((v.co.x * 0.024 * scale, v.co.y * 0.034 * scale, v.co.z * 0.035 * scale))
    link_mesh(f"Hand_Palm_{sname}", pbm, mat_skin, piv_arm, loc=palm_w - p_off, rot=(0.12 if not curled_grip else 0.0, side * 0.10, 0.0), subsurf=1)

    if curled_grip:
        # Three fingers curling around lantern top handle + opposing thumb from inside!
        for fi, (fx_off, r_b) in enumerate(((-0.020, 0.0115), (0.000, 0.0120), (0.020, 0.0110))):
            f_pts = [
                (*L(palm_w.x + fx_off * scale, palm_w.y - 0.018 * scale, palm_w.z - 0.005 * scale), r_b * scale),
                (*L(palm_w.x + fx_off * scale, palm_w.y - 0.024 * scale, palm_w.z - 0.032 * scale), r_b * 0.92 * scale),
                (*L(palm_w.x + fx_off * scale, palm_w.y - 0.002 * scale, palm_w.z - 0.044 * scale), r_b * 0.80 * scale),
                (*L(palm_w.x + fx_off * scale, palm_w.y + 0.016 * scale, palm_w.z - 0.030 * scale), r_b * 0.72 * scale),
            ]
            fg = create_curved_tube(f"Hand_GripFinger_{sname}_{fi}", f_pts, bevel_res=3)
            fg.parent = piv_arm
            fg.data.materials.append(mat_skin)
        # Opposing thumb closing on rear-medial side of bail handle
        th_pts = [
            (*L(palm_w.x + 0.026 * scale, palm_w.y + 0.008 * scale, palm_w.z - 0.004 * scale), 0.013 * scale),
            (*L(palm_w.x + 0.024 * scale, palm_w.y + 0.022 * scale, palm_w.z - 0.024 * scale), 0.011 * scale),
            (*L(palm_w.x + 0.004 * scale, palm_w.y + 0.014 * scale, palm_w.z - 0.036 * scale), 0.009 * scale),
        ]
        th = create_curved_tube(f"Hand_GripThumb_{sname}", th_pts, bevel_res=3)
        th.parent = piv_arm
        th.data.materials.append(mat_skin)
    else:
        # Relaxed slightly cupped open hand (matching Player v2.0 & Detail Sheets!)
        thumb_pts = [
            (*L(palm_w.x - side * 0.008 * scale, palm_w.y - 0.018 * scale, palm_w.z + 0.007 * scale), 0.0135 * scale),
            (*L(palm_w.x - side * 0.018 * scale, palm_w.y - 0.040 * scale, palm_w.z - 0.010 * scale), 0.0115 * scale),
            (*L(palm_w.x - side * 0.025 * scale, palm_w.y - 0.048 * scale, palm_w.z - 0.026 * scale), 0.0088 * scale),
        ]
        th = create_curved_tube(f"Hand_Thumb_{sname}", thumb_pts, bevel_res=4)
        th.parent = piv_arm
        th.data.materials.append(mat_skin)

        finger_specs = [
            (-0.022, 0.045, 0.0108, 0.0078),
            (-0.002, 0.049, 0.0112, 0.0080),
            (0.017, 0.043, 0.0100, 0.0074),
        ]
        for fi, (fy_off, flen, rb, rt) in enumerate(finger_specs):
            f_pts = [
                (*L(palm_w.x, palm_w.y + fy_off * scale, palm_w.z - 0.022 * scale), rb * scale),
                (*L(palm_w.x - side * 0.008 * scale, palm_w.y + (fy_off - 0.004) * scale, palm_w.z - (0.022 + flen * 0.55) * scale), rb * 0.90 * scale),
                (*L(palm_w.x - side * 0.022 * scale, palm_w.y + (fy_off - 0.006) * scale, palm_w.z - (0.022 + flen) * scale), rt * scale),
            ]
            fg = create_curved_tube(f"Hand_Finger_{sname}_{fi}", f_pts, bevel_res=3)
            fg.parent = piv_arm
            fg.data.materials.append(mat_skin)


def build_integrated_shoe(name, piv_leg, side, loc_w, length_f, length_b, half_w, instep_h, sole_z, mat_upper, mat_sole, toe_out_deg=6.0):
    """Builds a sculpted broad-round-toe shoe/boot hull with continuous integrated outsole (mat slot 1)."""
    p_off = piv_leg.location
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        if y < 0.0:
            py = y * length_f
            toe_w = 1.0 + 0.16 * min(1.0, -y * 1.45)
            px = x * half_w * toe_w
        else:
            py = y * length_b
            px = x * (half_w * 0.92)
        if z < -0.35:
            rocker = 0.005 * max(0.0, (-py - length_f * 0.55) / (length_f * 0.45)) ** 1.6
            pz = 0.000 + rocker + max(0.0, (z + 1.0) * 0.004)
        else:
            ih = instep_h if y > -0.15 else (instep_h - (-y - 0.15) * (instep_h * 0.34))
            pz = sole_z + ((z + 0.35) / 1.35) * ih
        v.co = Vector((px, py, pz))

    for f in bm.faces:
        avg_z = sum(v.co.z for v in f.verts) / len(f.verts)
        f.material_index = 1 if avg_z < sole_z + 0.002 else 0

    return link_mesh(
        name,
        bm,
        mat_upper,
        piv_leg,
        loc=Vector(loc_w) - p_off,
        rot=(0.0, 0.0, side * math.radians(-toe_out_deg)),
        subsurf=1,
        extra_mats=[mat_sole],
    )


def create_rig_hierarchy(root_name, pivots):
    """Creates root + 6 exact Rig_* empties (Rig_Torso, Rig_Head, Rig_ArmL, Rig_ArmR, Rig_LegL, Rig_LegR)."""
    root = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(root)

    nodes = {}
    for k in ("Rig_Torso", "Rig_Head", "Rig_ArmL", "Rig_ArmR", "Rig_LegL", "Rig_LegR"):
        o = bpy.data.objects.new(k, None)
        o.location = pivots[k]
        bpy.context.collection.objects.link(o)
        if k in ("Rig_Torso", "Rig_LegL", "Rig_LegR"):
            o.parent = root
        nodes[k] = o
    return root, nodes


def finalize_rig_parenting_and_normalize(root, nodes, target_height):
    bpy.context.view_layer.update()
    piv_torso = nodes["Rig_Torso"]
    for k in ("Rig_Head", "Rig_ArmL", "Rig_ArmR"):
        ch = nodes[k]
        mw = ch.matrix_world.copy()
        ch.parent = piv_torso
        ch.matrix_world = mw

    convert_and_apply_modifiers(root)
    bpy.context.view_layer.update()

    min_z, max_z = 999.0, -999.0
    for obj in collect_hierarchy_objects(root):
        if obj.type != "MESH":
            continue
        for c in obj.bound_box:
            wc = obj.matrix_world @ Vector(c)
            min_z = min(min_z, wc.z)
            max_z = max(max_z, wc.z)
    cur_h = max_z - min_z
    sf = target_height / cur_h if cur_h > 0.1 else 1.0
    root.scale = (sf, sf, sf)
    root.location = (0.0, 0.0, -min_z * sf)
    bpy.context.view_layer.update()
    print(f"[Normalize] {root.name}: {cur_h:.4f}m -> {target_height:.4f}m (scale={sf:.4f})")


def render_npc_8_audit_shots(root, nodes, npc_key, target_h, audit_dir, detail_cam_pos, detail_cam_tgt, is_haibo=False):
    os.makedirs(audit_dir, exist_ok=True)
    scene = bpy.context.scene
    setup_studio_render(scene, res_x=640, res_y=640, samples=28, is_house=False)
    cam_d = bpy.data.cameras.new("AuditCam")
    cam_d.lens = 72
    cam = bpy.data.objects.new("AuditCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    mid_z = target_h * 0.49
    head_z = target_h * 0.80

    # Shots 1..6 + 8 (neutral pose)
    # Note: Hero 35° from character's anatomical RIGHT (-X, -Y) so Hai Bo's right-hand lantern & Lao Zhou's spool show crisply!
    static_views = [
        ("01_front.png", (0.0, -3.35, mid_z + 0.04), (0.0, 0.0, mid_z), 72),
        ("02_hero34.png", (-1.92, -2.72, mid_z + 0.08), (0.0, 0.0, mid_z), 72),
        ("03_side_l.png", (3.35, 0.0, mid_z + 0.04), (0.0, 0.0, mid_z), 72),
        ("04_back.png", (0.0, 3.35, mid_z + 0.04), (0.0, 0.0, mid_z), 72),
        ("05_closeup_head.png", (-0.62, -1.26, head_z + 0.03), (0.0, -0.02, head_z), 80),
        ("06_closeup_detail.png", detail_cam_pos, detail_cam_tgt, 76),
        ("08_top52.png", (0.0, -2.02, 2.58), (0.0, 0.0, mid_z - 0.04), 68),
    ]
    for fname, loc, tgt, lens in static_views:
        cam.data.lens = lens
        aim_camera(cam, loc, tgt)
        scene.render.filepath = os.path.join(audit_dir, fname)
        bpy.ops.render.render(write_still=True)
        print(f"[{npc_key} Audit] Rendered {fname}")

    # Shot 7: Live Animation Stress Test (90° Greeting Wave + Talking Nod + Walk Stride!)
    if is_haibo:
        # Hai Bo: Right arm pitches gently forward holding lantern (-0.35 rad in glTF = +20 deg in Blender +X? Wait: in Blender -Y is front,
        # rotating around +X by +deg swings -Z downward limb toward -Y front! Wait: Right-hand rule on +X: +90° rotates (0,0,-1) -> (0,+1,0) BACK!
        # So -90° around +X rotates (0,0,-1) -> (0,-1,0) FORWARD!! Same sign as glTF!)
        nodes["Rig_ArmR"].rotation_euler = Euler((math.radians(-22), 0.0, math.radians(-6)), "XYZ")
        nodes["Rig_ArmL"].rotation_euler = Euler((math.radians(-92), 0.0, math.radians(14)), "XYZ")  # 90° wave test!
    else:
        nodes["Rig_ArmR"].rotation_euler = Euler((math.radians(-92), 0.0, math.radians(-14)), "XYZ")  # 90° wave test!
        nodes["Rig_ArmL"].rotation_euler = Euler((math.radians(24), 0.0, math.radians(6)), "XYZ")
    nodes["Rig_LegL"].rotation_euler = Euler((math.radians(-26), 0.0, 0.0), "XYZ")
    nodes["Rig_LegR"].rotation_euler = Euler((math.radians(24), 0.0, 0.0), "XYZ")
    nodes["Rig_Torso"].rotation_euler = Euler((math.radians(-5), 0.0, math.radians(-6)), "XYZ")
    nodes["Rig_Head"].rotation_euler = Euler((math.radians(10), 0.0, math.radians(12)), "XYZ")
    bpy.context.view_layer.update()

    cam.data.lens = 72
    aim_camera(cam, (-1.95, -2.75, mid_z + 0.10), (0.0, 0.0, mid_z))
    scene.render.filepath = os.path.join(audit_dir, "07_pose_wave90_nod.png")
    bpy.ops.render.render(write_still=True)
    print(f"[{npc_key} Audit] Rendered 07_pose_wave90_nod.png")


# =============================================================================
# NPC 1: 阿莲 (`npc_market`, 1.280m) — Fish-Market Owner
# =============================================================================
def build_npc_market():
    clear_scene()
    pivots = {
        "Rig_Torso": (0.000, 0.008, 0.545),
        "Rig_Head": (0.000, 0.002, 0.865),
        "Rig_ArmL": (0.174, 0.002, 0.818),
        "Rig_ArmR": (-0.174, 0.002, 0.818),
        "Rig_LegL": (0.088, 0.006, 0.513),
        "Rig_LegR": (-0.088, 0.006, 0.513),
    }
    root, nodes = create_rig_hierarchy("NPC_AhLian_Market_v2", pivots)

    # Exact Astra Ultra sRGB palette
    mats = {
        "face_skin": make_face_skin_mat("AhLian_FaceSkin", "#EDBE98", "#DD9F79", "#DF816D", "#E3967E", cheek_xy=(0.105, -0.145, -0.036), cheek_r=0.084, blush_str=0.45, nose_pos=(0.0, -0.184, -0.026), nose_r=0.042, nose_str=0.35),
        "skin": make_gouache_mat("AhLian_Skin", "#EDBE98", "#D99F78", rough=0.78, noise_scale=16.0, ao_strength=0.18, ao_dist=0.12, bump_str=0.015),
        "hair": make_gouache_mat("AhLian_Hair", "#493329", "#2E1E17", rough=0.82, noise_scale=22.0, ao_strength=0.26, ao_dist=0.12, bump_str=0.035),
        "scarf": make_gouache_mat("AhLian_CoralScarf", "#CB5949", "#A7453B", rough=0.84, noise_scale=20.0, ao_strength=0.24, ao_dist=0.14, bump_str=0.035),
        "blouse": make_gouache_mat("AhLian_CreamBlouse", "#F2E6CA", "#D7C8A9", rough=0.86, noise_scale=20.0, ao_strength=0.22, ao_dist=0.15, bump_str=0.030),
        "apron": make_gouache_mat("AhLian_TealApron", "#287E75", "#205E59", rough=0.82, noise_scale=22.0, ao_strength=0.26, ao_dist=0.16, bump_str=0.035),
        "apron_hi": make_gouache_mat("AhLian_TealTrim", "#3A9186", "#256C65", rough=0.82, noise_scale=20.0, ao_strength=0.22, ao_dist=0.12, bump_str=0.030),
        "pants": make_gouache_mat("AhLian_SlatePants", "#3C5361", "#283944", rough=0.86, noise_scale=22.0, ao_strength=0.26, ao_dist=0.14, bump_str=0.032),
        "shoe": make_gouache_mat("AhLian_ShoeBrown", "#90603C", "#6C4428", rough=0.60, noise_scale=18.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.028),
        "sole": make_gouache_mat("AhLian_ShoeSole", "#64442F", "#462E1F", rough=0.78, noise_scale=18.0, ao_strength=0.22, ao_dist=0.10, bump_str=0.025),
        "brass": make_gouache_mat("AhLian_Brass", "#C89B3B", "#8F6A20", rough=0.36, metal=0.58, noise_scale=14.0, ao_strength=0.15, ao_dist=0.08, bump_str=0.01),
        "eye_dark": make_gouache_mat("AhLian_EyeDark", "#2A1F19", "#16100C", rough=0.16, noise_scale=8.0, ao_strength=0.0, bump_str=0.0),
        "eye_catch": make_gouache_mat("AhLian_EyeCatch", "#FFFDF8", "#F4EFE6", rough=0.10, noise_scale=6.0, ao_strength=0.0, bump_str=0.0),
        "smile": make_gouache_mat("AhLian_Smile", "#8E4A3E", "#622D25", rough=0.72, noise_scale=10.0, ao_strength=0.0, bump_str=0.0),
    }

    # --- 1. HEAD, WARM SMILE, LOW BUN & CORAL COTTON HEADSCARF ---
    piv_h = nodes["Rig_Head"]
    p_h = piv_h.location
    head_ctr = Vector((0.0, 0.002, 1.045))
    build_sculpted_head_base("Head_Sculpt", piv_h, head_ctr, sx=0.178, sy=0.170, sz=0.192, nose_bulge=0.028, cheek_bulge=0.095, mat_face=mats["face_skin"])
    build_eyes_and_ears(piv_h, head_ctr, 0.178, 0.170, eye_z_off=0.014, ear_z_off=-0.022, mat_skin=mats["skin"], mat_eye_dark=mats["eye_dark"], mat_eye_catch=mats["eye_catch"], mat_brow=mats["hair"], brow_z_off=0.060, brow_r=0.0072)

    # Warm lifted welcoming fish-market smile!
    smile_w = [
        (-0.056, -0.149, 0.986, 0.0040),
        (-0.028, -0.161, 0.970, 0.0048),
        (0.000, -0.165, 0.966, 0.0048),
        (0.028, -0.161, 0.971, 0.0048),
        (0.058, -0.147, 0.990, 0.0042),
    ]
    sm = create_curved_tube("Mouth_Smile", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in smile_w], bevel_res=4)
    sm.parent = piv_h
    sm.data.materials.append(mats["smile"])

    # Dark brown hair volume tucked neatly INSIDE scarf (top scaled down -> ZERO poke-through!) + parted bangs + plump low nape bun!
    hbm = bmesh.new()
    bmesh.ops.create_uvsphere(hbm, u_segments=26, v_segments=18, radius=1.0)
    for v in hbm.verts:
        px, py, pz = v.co.x * 0.188, v.co.y * 0.180, v.co.z * 0.188
        if py < -0.02 and pz < 0.06:
            py = max(py, -0.02)
        if pz > 0.02:
            # Shrink upper scalp cleanly inside coral headscarf!
            t = min(1.0, (pz - 0.02) / 0.16)
            px *= 1.0 - 0.16 * t
            py *= 1.0 - 0.16 * t
            pz *= 0.82
        v.co = Vector((px, py, pz))
    link_mesh("Hair_Base", hbm, mats["hair"], piv_h, loc=Vector((0.0, 0.012, 1.056)) - p_h, subsurf=1)

    # Cute parted front wave bangs & temple framing strands (matching Detail Sheet Upper-Left!)
    bang_locks = [
        [(0.010, -0.125, 1.178, 0.024), (0.045, -0.168, 1.158, 0.024), (0.018, -0.175, 1.132, 0.010)],
        [(-0.014, -0.125, 1.176, 0.024), (-0.052, -0.168, 1.154, 0.023), (-0.032, -0.175, 1.128, 0.010)],
        [(0.072, -0.105, 1.168, 0.025), (0.128, -0.125, 1.126, 0.025), (0.156, -0.090, 1.072, 0.014)],
        [(-0.072, -0.105, 1.168, 0.025), (-0.128, -0.125, 1.126, 0.025), (-0.156, -0.090, 1.072, 0.014)],
        [(0.155, -0.038, 1.118, 0.028), (0.178, -0.010, 1.055, 0.026), (0.166, 0.025, 0.992, 0.016)],
        [(-0.155, -0.038, 1.118, 0.028), (-0.178, -0.010, 1.055, 0.026), (-0.166, 0.025, 0.992, 0.016)],
    ]
    for i, pts in enumerate(bang_locks):
        lo = create_curved_tube(f"HairBang_{i}", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in pts], bevel_res=4)
        lo.parent = piv_h
        lo.data.materials.append(mats["hair"])

    # Plump low dark-brown bun sitting cleanly beneath the headscarf knot!
    bun_bm = bmesh.new()
    bmesh.ops.create_uvsphere(bun_bm, u_segments=22, v_segments=16, radius=1.0)
    for v in bun_bm.verts:
        v.co = Vector((v.co.x * 0.088, v.co.y * 0.078, v.co.z * 0.076))
    link_mesh("Hair_LowBun", bun_bm, mats["hair"], piv_h, loc=Vector((0.008, 0.178, 0.946)) - p_h, subsurf=1)

    # Coral Cotton Headscarf wrapping smoothly from hairline over crown to back nape knot + twin unequal tails!
    sbm = bmesh.new()
    bmesh.ops.create_uvsphere(sbm, u_segments=32, v_segments=22, radius=1.0)
    for v in sbm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        px, py, pz = x * 0.205, y * 0.206, z * 0.202
        # Front opens smoothly around face & brows; back sweeps down snugly above low bun!
        if y < 0.0:
            # Front arch framing bangs (higher at front center, curving down behind ears!)
            lift = max(0.0, -y) * 0.088
            pz = max(pz, -0.020 + lift - (abs(x) * 0.06))
        else:
            # Soft pleated drape gathering toward nape knot at (0, +0.205, -0.055)
            back_w = y
            pz -= back_w * 0.028
            py += back_w * 0.018 * math.exp(-((pz + 0.02) / 0.09) ** 2)
        # Subtle cotton wrap crease near front band
        band_crease = math.exp(-((y + 0.45) / 0.18) ** 2) * 0.007
        px *= 1.0 + band_crease
        pz += band_crease
        v.co = Vector((px, py, pz))
    link_mesh("Headscarf_Wrap", sbm, mats["scarf"], piv_h, loc=Vector((0.0, 0.024, 1.084)) - p_h, rot=(math.radians(-14), 0.0, 0.0), subsurf=1)

    # Scarf Nape Knot (slightly left-offset so bun reads beside & below it, matching Turnaround Back!)
    kn_bm = bmesh.new()
    bmesh.ops.create_uvsphere(kn_bm, u_segments=14, v_segments=10, radius=1.0)
    for v in kn_bm.verts:
        v.co = Vector((v.co.x * 0.044, v.co.y * 0.036, v.co.z * 0.034))
    link_mesh("Headscarf_Knot", kn_bm, mats["scarf"], piv_h, loc=Vector((-0.018, 0.205, 0.985)) - p_h, subsurf=1)

    # Twin unequal hanging coral scarf tails (one longer sweeping left-back, one shorter flaring right-back!)
    tail_l = [
        (-0.022, 0.206, 0.980, 0.022),
        (-0.048, 0.228, 0.922, 0.030),
        (-0.068, 0.232, 0.855, 0.024),
        (-0.072, 0.222, 0.818, 0.008),
    ]
    tail_r = [
        (-0.010, 0.208, 0.982, 0.020),
        (0.048, 0.224, 0.946, 0.026),
        (0.095, 0.226, 0.902, 0.020),
        (0.112, 0.218, 0.876, 0.008),
    ]
    for nm, pts in (("Headscarf_TailLong", tail_l), ("Headscarf_TailShort", tail_r)):
        tl = create_curved_tube(nm, [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in pts], bevel_res=4)
        tl.parent = piv_h
        tl.data.materials.append(mats["scarf"])

    # --- 2. TORSO: CREAM BLOUSE + PEACOCK-TEAL APRON + FRONT POCKET + SCULPTURAL REAR BOW ---
    piv_t = nodes["Rig_Torso"]
    p_t = piv_t.location
    def LT(x, y, z):
        return (x - p_t.x, y - p_t.y, z - p_t.z)

    # Organic neck
    build_organic_loft("Neck", [
        (LT(0.0, 0.005, 0.815), 0.064, 0.060, 0, 0, 0.0),
        (LT(0.0, 0.004, 0.855), 0.056, 0.054, 0, 0, 0.0),
        (LT(0.0, 0.002, 0.900), 0.062, 0.060, 0, 0, 0.0),
    ], mats["skin"], piv_t, segs=20)

    # Continuous sloping cream blouse torso (broader seamless deltoid blend so sleeves flow with ZERO cap hump!)
    build_organic_loft("Blouse_Torso", [
        (LT(0.0, 0.006, 0.540), 0.146, 0.128, 0, 0, 0.012),
        (LT(0.0, 0.002, 0.620), 0.148, 0.130, 0, 0, 0.014),
        (LT(0.0, 0.000, 0.715), 0.172, 0.134, 0, 0, 0.014),
        (LT(0.0, 0.002, 0.778), 0.180, 0.124, 0, 0, 0.010),
        (LT(0.0, 0.004, 0.818), 0.132, 0.098, 0, 0, 0.005),
        (LT(0.0, 0.005, 0.844), 0.074, 0.068, 0, 0, 0.000),
    ], mats["blouse"], piv_t, segs=28)

    # Blouse collar band + tiny button
    col_pts = [(math.cos(math.radians(d)) * 0.072 - p_t.x, math.sin(math.radians(d)) * 0.066 + 0.005 - p_t.y, 0.842 - p_t.z, 0.010) for d in range(0, 360, 20)]
    co = create_curved_tube("Blouse_Collar", col_pts, bevel_res=4, cyclic=True)
    co.parent = piv_t
    co.data.materials.append(mats["blouse"])

    # Peacock-teal A-line Apron Skirt (defined waist at Z=0.61 -> softly flaring fuller hips down to Z=0.285!)
    # Hollow/open bottom feel while enclosing hips smoothly so legs swing cleanly underneath!
    build_organic_loft("Apron_Skirt", [
        (LT(0.0, 0.004, 0.285), 0.216, 0.184, 0, 0, 0.022),  # gently flared skirt hem!
        (LT(0.0, 0.004, 0.380), 0.204, 0.174, 0, 0, 0.020),
        (LT(0.0, 0.004, 0.485), 0.186, 0.158, 0, 0, 0.016),
        (LT(0.0, 0.004, 0.575), 0.158, 0.138, 0, 0, 0.012),  # defined waist gather!
        (LT(0.0, 0.004, 0.620), 0.152, 0.132, 0, 0, 0.008),
    ], mats["apron"], piv_t, segs=32, cap_start=True, cap_end=True)

    # Waistband tie belt around Z = 0.605
    wb_pts = [(math.cos(math.radians(d)) * 0.156 - p_t.x, math.sin(math.radians(d)) * 0.137 + 0.004 - p_t.y, 0.605 - p_t.z, 0.014) for d in range(0, 360, 15)]
    wbo = create_curved_tube("Apron_Waistband", wb_pts, bevel_res=4, cyclic=True)
    wbo.parent = piv_t
    wbo.data.materials.append(mats["apron_hi"])

    # Contoured Front Apron Bib rising smoothly from waist Z=0.595 to chest Z=0.775
    def a_bib_y(tu, tv):
        return -0.136 + tv * 0.010 + (tu * tu) * 0.036 + 0.008 * ((1.0 - tv) ** 2.2)
    bbm = bmesh.new()
    rows = []
    for iv in range(8):
        tv = iv / 7.0
        z = 0.595 + tv * 0.180
        hw = 0.128 - tv * 0.028
        row = []
        for iu in range(11):
            tu = (iu / 10.0) * 2.0 - 1.0
            row.append(bbm.verts.new(Vector(LT(tu * hw, a_bib_y(tu, tv), z))))
        rows.append(row)
    for iv in range(7):
        for iu in range(10):
            bbm.faces.new((rows[iv][iu], rows[iv][iu + 1], rows[iv + 1][iu + 1], rows[iv + 1][iu]))
    bib_o = link_mesh("Apron_FrontBib", bbm, mats["apron"], piv_t, subsurf=1)
    sb = bib_o.modifiers.new("Solidify", "SOLIDIFY")
    sb.thickness = 0.011
    sb.offset = 1.0

    # Gently sagging rounded front apron pocket (Z = 0.395 .. 0.540) hugging the flaring skirt cleanly!
    pbm = bmesh.new()
    prows = []
    for iv in range(7):
        pv = iv / 6.0
        z = 0.395 + pv * 0.140
        # Skirt front Y interpolates from -0.174 (Z=0.38) to -0.145 (Z=0.54)
        t_sk = (z - 0.380) / (0.575 - 0.380)
        sk_ry = 0.174 * (1.0 - t_sk) + 0.138 * t_sk
        hw_p = 0.098 * (0.88 + 0.12 * math.sin(pv * math.pi * 0.85))
        row = []
        for iu in range(9):
            pu = (iu / 8.0) * 2.0 - 1.0
            px = pu * hw_p
            # Soft rounded lower corners + sagging center pocket lip
            sag = -0.008 * (1.0 - pu * pu) if pv == 1.0 else 0.0
            y = -(sk_ry + 0.014) + (pu * pu) * 0.026 - 0.006 * math.sin(pv * math.pi)
            row.append(pbm.verts.new(Vector(LT(px, y, z + sag))))
        prows.append(row)
    for iv in range(6):
        for iu in range(8):
            pbm.faces.new((prows[iv][iu], prows[iv][iu + 1], prows[iv + 1][iu + 1], prows[iv + 1][iu]))
    po = link_mesh("Apron_FrontPocket", pbm, mats["apron_hi"], piv_t, subsurf=1)
    spo = po.modifiers.new("Solidify", "SOLIDIFY")
    spo.thickness = 0.008
    spo.offset = 1.0

    # Apron shoulder straps (hugging cleanly OUTSIDE cream blouse all the way over shoulders & down to rear waist bow!)
    for side in (1, -1):
        st_pts = [
            (*LT(side * 0.094, -0.124, 0.768), 0.014),
            (*LT(side * 0.104, -0.052, 0.826), 0.014),
            (*LT(side * 0.102, 0.038, 0.828), 0.014),
            (*LT(side * 0.088, 0.122, 0.778), 0.014),
            (*LT(side * 0.070, 0.142, 0.708), 0.014),
            (*LT(side * 0.048, 0.144, 0.618), 0.014),
        ]
        sto = create_curved_tube(f"Apron_Strap_{side}", st_pts, bevel_res=4)
        sto.parent = piv_t
        sto.data.materials.append(mats["apron"])

        # Antique brass bib button
        btn_bm = bmesh.new()
        bmesh.ops.create_cone(btn_bm, cap_ends=True, segments=16, radius1=0.017, radius2=0.016, depth=0.008)
        link_mesh(f"Apron_BrassBtn_{side}", btn_bm, mats["brass"], piv_t, loc=LT(side * 0.094, -0.128, 0.766), rot=(math.radians(78), 0, side * math.radians(15)), subsurf=0)

    # Sculptural Rear Waist Bow (center knot + twin plump loops + twin unequal flared ribbon tails!)
    bk_bm = bmesh.new()
    bmesh.ops.create_cube(bk_bm, size=1.0)
    bmesh.ops.scale(bk_bm, vec=Vector((0.046, 0.034, 0.042)), verts=bk_bm.verts)
    bmesh.ops.bevel(bk_bm, geom=list(bk_bm.edges), offset=0.010, segments=2, affect="EDGES")
    link_mesh("Apron_BackBowKnot", bk_bm, mats["apron_hi"], piv_t, loc=LT(0.0, 0.152, 0.602), subsurf=1)

    for bside, tail_len in ((1, 0.155), (-1, 0.135)):
        # Flared bow loop
        lpts = [
            (*LT(0.0, 0.154, 0.606), 0.016),
            (*LT(bside * 0.058, 0.168, 0.630), 0.026),
            (*LT(bside * 0.104, 0.152, 0.608), 0.025),
            (*LT(bside * 0.062, 0.158, 0.580), 0.020),
            (*LT(0.0, 0.152, 0.594), 0.014),
        ]
        lpo = create_curved_tube(f"Apron_BowLoop_{bside}", lpts, bevel_res=4)
        lpo.parent = piv_t
        lpo.data.materials.append(mats["apron_hi"])
        # Hanging ribbon tail
        tpts = [
            (*LT(bside * 0.014, 0.158, 0.590), 0.018),
            (*LT(bside * 0.042, 0.180, 0.590 - tail_len * 0.52), 0.025),
            (*LT(bside * 0.062, 0.186, 0.590 - tail_len), 0.022),
        ]
        tlo = create_curved_tube(f"Apron_BowTail_{bside}", tpts, bevel_res=4)
        tlo.parent = piv_t
        tlo.data.materials.append(mats["apron_hi"])

    # --- 3. ORGANIC SLOPING ARMS (Cream Rolled Short Sleeves + Warm Forearms + 4-Digit Hands) ---
    for side, piv_k in ((1, "Rig_ArmL"), (-1, "Rig_ArmR")):
        sname = "L" if side > 0 else "R"
        piv_a = nodes[piv_k]
        p_a = piv_a.location
        def LA(x, y, z):
            return (x - p_a.x, y - p_a.y, z - p_a.z)

        # Short rolled cream blouse sleeve sweeping seamlessly from sloping shoulder to above elbow (ZERO hump!)
        slv = [
            (*LA(side * 0.136, 0.002, 0.776), 0.056, 0.054, 0.00),
            (*LA(side * 0.172, 0.002, 0.770), 0.056, 0.054, 0.01),
            (*LA(side * 0.200, -0.002, 0.720), 0.055, 0.053, 0.02),
            (*LA(side * 0.214, -0.010, 0.665), 0.054, 0.052, 0.02),
        ]
        build_swept_tube_mesh(f"Sleeve_{sname}", slv, mats["blouse"], piv_a, segs=22)

        # Soft thick rolled short-sleeve cuff
        cuff = [
            (*LA(side * 0.210, -0.008, 0.686), 0.062, 0.060, 0.03),
            (*LA(side * 0.216, -0.014, 0.662), 0.065, 0.062, 0.035),
            (*LA(side * 0.220, -0.020, 0.638), 0.058, 0.055, 0.02),
        ]
        build_swept_tube_mesh(f"SleeveCuff_{sname}", cuff, mats["blouse"], piv_a, segs=22)

        # Bare warm forearm emerging smoothly from hollow cuff -> slightly forward-bent wrist (~16 deg elbow bend!)
        fa = [
            (*LA(side * 0.214, -0.010, 0.678), 0.038, 0.036, 0.0),
            (*LA(side * 0.224, -0.024, 0.618), 0.036, 0.034, 0.0),
            (*LA(side * 0.232, -0.044, 0.556), 0.031, 0.029, 0.0),
            (*LA(side * 0.234, -0.058, 0.516), 0.028, 0.025, 0.0),
        ]
        build_swept_tube_mesh(f"Forearm_{sname}", fa, mats["skin"], piv_a, segs=18)
        build_four_digit_hand(piv_a, side, Vector((side * 0.235, -0.062, 0.496)), mats["skin"], scale=0.96, curled_grip=False)

    # --- 4. LEGS & WARM BROWN INTEGRATED-SOLE WORK SHOES ---
    for side, piv_k in ((1, "Rig_LegL"), (-1, "Rig_LegR")):
        sname = "L" if side > 0 else "R"
        piv_l = nodes[piv_k]
        p_l = piv_l.location
        def LL(x, y, z):
            return (x - p_l.x, y - p_l.y, z - p_l.z)

        build_organic_loft(f"Trouser_{sname}", [
            (LL(side * 0.088, 0.004, 0.105), 0.072, 0.074, 0, 0, 0.015),
            (LL(side * 0.088, 0.002, 0.215), 0.076, 0.078, 0, 0, 0.018),
            (LL(side * 0.090, 0.005, 0.365), 0.086, 0.088, 0, 0, 0.012),
            (LL(side * 0.088, 0.006, 0.513), 0.086, 0.086, 0, 0, 0.004),
            (LL(side * 0.082, 0.006, 0.555), 0.070, 0.070, 0, 0, 0.000),
        ], mats["pants"], piv_l, segs=22)

        build_integrated_shoe(f"Shoe_{sname}", piv_l, side, (side * 0.088, -0.012, 0.000), length_f=0.114, length_b=0.064, half_w=0.046, instep_h=0.084, sole_z=0.016, mat_upper=mats["shoe"], mat_sole=mats["sole"], toe_out_deg=6.0)
        build_organic_loft(f"ShoeAnkle_{sname}", [
            (LL(side * 0.088, 0.004, 0.050), 0.042, 0.048, 0, 0, 0.0),
            (LL(side * 0.088, 0.004, 0.120), 0.046, 0.050, 0, 0, 0.0),
        ], mats["shoe"], piv_l, segs=18)

    finalize_rig_parenting_and_normalize(root, nodes, target_height=1.280)
    bake_gouache_atlas(root, os.path.join(TEX_DIR, "npc_market_v2_BaseColor.png"), tex_size=2048, skip_mat_substrings=("Brass", "EyeDark", "EyeCatch"))
    export_clean_glb(os.path.join(BASE_OUT, "npc_market.blend"), os.path.join(EXP_DIR, "npc_market.glb"))
    render_npc_8_audit_shots(root, nodes, "npc_market", 1.280, os.path.join(BASE_OUT, "previews", "npc_market_v2_audit"), detail_cam_pos=(0.72, 1.22, 0.72), detail_cam_tgt=(0.0, 0.08, 0.62), is_haibo=False)


# =============================================================================
# NPC 2: 老周 (`npc_artisan`, 1.310m) — Fishing-Tackle Artisan
# =============================================================================
def build_npc_artisan():
    clear_scene()
    pivots = {
        "Rig_Torso": (0.000, 0.012, 0.558),
        "Rig_Head": (0.000, 0.002, 0.902),
        "Rig_ArmL": (0.193, 0.005, 0.848),
        "Rig_ArmR": (-0.193, 0.005, 0.848),
        "Rig_LegL": (0.095, 0.010, 0.526),
        "Rig_LegR": (-0.095, 0.010, 0.526),
    }
    root, nodes = create_rig_hierarchy("NPC_LaoZhou_Artisan_v2", pivots)

    mats = {
        "face_skin": make_face_skin_mat("LaoZhou_FaceSkin", "#DDB08B", "#C89570", "#CB856D", "#C97E67", cheek_xy=(0.106, -0.148, -0.018), cheek_r=0.078, blush_str=0.38, nose_pos=(0.0, -0.190, -0.022), nose_r=0.046, nose_str=0.45),
        "skin": make_gouache_mat("LaoZhou_Skin", "#DDB08B", "#C5936D", rough=0.78, noise_scale=16.0, ao_strength=0.20, ao_dist=0.12, bump_str=0.018),
        "cap": make_gouache_mat("LaoZhou_BlueCap", "#35536A", "#253B4C", rough=0.86, noise_scale=22.0, ao_strength=0.26, ao_dist=0.14, bump_str=0.036),
        "cap_bill": make_gouache_mat("LaoZhou_CapBill", "#293F50", "#1C2C38", rough=0.84, noise_scale=22.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.032),
        "hair": make_gouache_mat("LaoZhou_GreyHair", "#74685C", "#544A41", rough=0.86, noise_scale=22.0, ao_strength=0.26, ao_dist=0.12, bump_str=0.038),
        "beard": make_gouache_mat("LaoZhou_Beard", "#DDD9CF", "#B9B4A9", rough=0.88, noise_scale=24.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.040),
        "shirt": make_gouache_mat("LaoZhou_IvoryShirt", "#E9DEC3", "#CDBD9E", rough=0.88, noise_scale=20.0, ao_strength=0.24, ao_dist=0.15, bump_str=0.034),
        "leather": make_gouache_mat("LaoZhou_CaramelLeather", "#AB7042", "#795036", rough=0.62, noise_scale=18.0, ao_strength=0.26, ao_dist=0.16, bump_str=0.036),
        "leather_dark": make_gouache_mat("LaoZhou_StrapLeather", "#885632", "#5D391F", rough=0.64, noise_scale=18.0, ao_strength=0.26, ao_dist=0.12, bump_str=0.034),
        "wood": make_gouache_mat("LaoZhou_ToolWood", "#B88450", "#865A32", rough=0.72, noise_scale=20.0, ao_strength=0.24, ao_dist=0.10, bump_str=0.035),
        "line": make_gouache_mat("LaoZhou_SpoolLine", "#EFE6D0", "#CCC0A5", rough=0.86, noise_scale=28.0, ao_strength=0.20, ao_dist=0.08, bump_str=0.040, pattern="knit", pattern_scale=26.0),
        "pants": make_gouache_mat("LaoZhou_KhakiPants", "#68634A", "#4A4633", rough=0.90, noise_scale=22.0, ao_strength=0.28, ao_dist=0.14, bump_str=0.035),
        "boot": make_gouache_mat("LaoZhou_WorkBoot", "#715039", "#513726", rough=0.63, noise_scale=18.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.032),
        "sole": make_gouache_mat("LaoZhou_BootSole", "#4D392D", "#33241B", rough=0.78, noise_scale=18.0, ao_strength=0.22, ao_dist=0.10, bump_str=0.028),
        "brass": make_gouache_mat("LaoZhou_Brass", "#BD934E", "#846229", rough=0.38, metal=0.65, noise_scale=14.0, ao_strength=0.15, ao_dist=0.08, bump_str=0.01),
        "eye_dark": make_gouache_mat("LaoZhou_EyeDark", "#2E251F", "#17120F", rough=0.16, noise_scale=8.0, ao_strength=0.0, bump_str=0.0),
        "eye_catch": make_gouache_mat("LaoZhou_EyeCatch", "#FFFDF8", "#F4EFE6", rough=0.10, noise_scale=6.0, ao_strength=0.0, bump_str=0.0),
        "smile": make_gouache_mat("LaoZhou_Smile", "#8A473A", "#5A2920", rough=0.72, noise_scale=10.0, ao_strength=0.0, bump_str=0.0),
    }

    # --- 1. HEAD, FLAT CAP, COMPRESSED TEMPLE HAIR, UPTURNED MOUSTACHE & NEAT SHORT BEARD ---
    piv_h = nodes["Rig_Head"]
    p_h = piv_h.location
    head_ctr = Vector((0.0, 0.002, 1.072))
    build_sculpted_head_base("Head_Sculpt", piv_h, head_ctr, sx=0.180, sy=0.174, sz=0.188, nose_bulge=0.032, cheek_bulge=0.080, mat_face=mats["face_skin"])
    build_eyes_and_ears(piv_h, head_ctr, 0.180, 0.174, eye_z_off=0.016, ear_z_off=-0.018, mat_skin=mats["skin"], mat_eye_dark=mats["eye_dark"], mat_eye_catch=mats["eye_catch"], mat_brow=mats["beard"], brow_z_off=0.060, brow_r=0.0115)

    # Cheerful open smile clearly visible between upturned moustache and trimmed craftsman beard!
    sm_w = [
        (-0.046, -0.172, 1.000, 0.0055),
        (-0.022, -0.184, 0.986, 0.0095),
        (0.000, -0.187, 0.983, 0.0105),
        (0.022, -0.184, 0.986, 0.0095),
        (0.046, -0.172, 1.000, 0.0055),
    ]
    smo = create_curved_tube("Mouth_Smile", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in sm_w], bevel_res=4)
    smo.parent = piv_h
    smo.data.materials.append(mats["smile"])

    # Sculpted neat short craftsman beard hugging jaw (clean mouth notch exposing happy smile!)
    bbm = bmesh.new()
    bmesh.ops.create_uvsphere(bbm, u_segments=26, v_segments=18, radius=1.0)
    for v in bbm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        px, py, pz = x * 0.186, y * 0.168, z * 0.118
        if y < 0.0 and z > 0.05:
            pz = min(pz, 0.006 + (x * x) * 0.075)
        if y > 0.25:
            py *= 0.65
        v.co = Vector((px, py, pz))
    link_mesh("Beard_ShortTrim", bbm, mats["beard"], piv_h, loc=Vector((0.0, -0.022, 0.980)) - p_h, subsurf=1)

    # Upturned two-part artisan moustache (cleanly exposing smile beneath!)
    for side in (1, -1):
        m_pts = [
            (side * 0.008, -0.188, 1.024, 0.019),
            (side * 0.052, -0.186, 1.018, 0.023),
            (side * 0.098, -0.166, 1.024, 0.019),
            (side * 0.128, -0.142, 1.038, 0.010),
        ]
        mo = create_curved_tube(f"Moustache_{side}", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in m_pts], bevel_res=5)
        mo.parent = piv_h
        mo.data.materials.append(mats["beard"])

    # Full compressed grey-brown temple & rear hair reaching solidly UP INTO blue flat cap -> ZERO bald gap & ZERO crown poke!
    hbm = bmesh.new()
    bmesh.ops.create_uvsphere(hbm, u_segments=28, v_segments=20, radius=1.0)
    for v in hbm.verts:
        px, py, pz = v.co.x * 0.191, v.co.y * 0.188, v.co.z * 0.175
        if py < -0.045:
            py = max(py, -0.045)
        if pz > 0.04:
            t = min(1.0, (pz - 0.04) / 0.14)
            px *= 1.0 - 0.18 * t
            py *= 1.0 - 0.18 * t
            pz = 0.04 + (pz - 0.04) * 0.65
        v.co = Vector((px, py, pz))
    link_mesh("Hair_TempleBack", hbm, mats["hair"], piv_h, loc=Vector((0.0, 0.010, 1.095)) - p_h, subsurf=1)

    # Deep-Sea-Blue Flat Cap seated SNUGLY right above brows & temple hair (ZERO floating saucer gap!)
    cap_grp = bpy.data.objects.new("FlatCap_Assembly", None)
    cap_grp.location = Vector((0.0, 0.008, 1.158)) - p_h
    cap_grp.rotation_euler = Euler((math.radians(-8.5), 0.0, 0.0), "XYZ")
    bpy.context.collection.objects.link(cap_grp)
    cap_grp.parent = piv_h

    cbm = bmesh.new()
    bmesh.ops.create_uvsphere(cbm, u_segments=32, v_segments=20, radius=1.0)
    for v in cbm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        rx = 0.214 * (1.0 + 0.07 * math.exp(-((z - 0.15) / 0.45) ** 2))
        ry = 0.228 if y < 0 else 0.214
        rz = 0.122 if z > 0 else 0.056
        px, py, pz = x * rx, y * ry, z * rz
        if y < -0.15 and z > 0.0:
            pz *= 1.0 - 0.24 * min(1.0, (-y - 0.15) / 0.85)
        v.co = Vector((px, py, pz))
    link_mesh("FlatCap_Crown", cbm, mats["cap"], cap_grp, loc=(0.0, -0.004, 0.022), subsurf=1)

    # Short projecting flat-cap visor bill (#293F50)
    vbm = bmesh.new()
    bmesh.ops.create_uvsphere(vbm, u_segments=24, v_segments=12, radius=1.0)
    for v in vbm.verts:
        px, py, pz = v.co.x * 0.172, v.co.y * 0.114, v.co.z * 0.016
        pz -= (v.co.x ** 2) * 0.024
        v.co = Vector((px, py, pz))
    link_mesh("FlatCap_Visor", vbm, mats["cap_bill"], cap_grp, loc=(0.0, -0.170, -0.002), rot=(math.radians(9.0), 0.0, 0.0), subsurf=1)

    # --- 2. STURDY COMPACT TORSO + IVORY WORK SHIRT + CARAMEL LEATHER APRON + TOOLS ---
    piv_t = nodes["Rig_Torso"]
    p_t = piv_t.location
    def LT(x, y, z):
        return (x - p_t.x, y - p_t.y, z - p_t.z)

    build_organic_loft("Neck", [
        (LT(0.0, 0.008, 0.835), 0.076, 0.072, 0, 0, 0.0),
        (LT(0.0, 0.006, 0.880), 0.070, 0.068, 0, 0, 0.0),
        (LT(0.0, 0.004, 0.925), 0.074, 0.070, 0, 0, 0.0),
    ], mats["skin"], piv_t, segs=20)

    # Thick sturdy craftsman ivory work shirt torso (cleanly tucked behind leather apron -> ZERO chest poke-through!)
    build_organic_loft("Shirt_Torso", [
        (LT(0.0, 0.010, 0.440), 0.168, 0.148, 0, 0, 0.010),
        (LT(0.0, 0.008, 0.560), 0.174, 0.152, 0, 0, 0.012),
        (LT(0.0, 0.008, 0.695), 0.188, 0.150, 0, 0, 0.012),
        (LT(0.0, 0.006, 0.785), 0.200, 0.142, 0, 0, 0.010),
        (LT(0.0, 0.006, 0.842), 0.146, 0.114, 0, 0, 0.006),
        (LT(0.0, 0.006, 0.872), 0.088, 0.082, 0, 0, 0.000),
    ], mats["shirt"], piv_t, segs=28)

    # Open folded work-shirt collar flaps
    for side in (1, -1):
        fl_pts = [
            (*LT(side * 0.018, -0.084, 0.848), 0.014),
            (*LT(side * 0.066, -0.072, 0.864), 0.016),
            (*LT(side * 0.084, 0.018, 0.870), 0.015),
            (*LT(0.0, 0.082, 0.868), 0.014),
        ]
        fo = create_curved_tube(f"Shirt_CollarFlap_{side}", fl_pts, bevel_res=4)
        fo.parent = piv_t
        fo.data.materials.append(mats["shirt"])

    # Khaki upper pelvis/hips base under leather apron (visible cleanly in Back view!)
    build_organic_loft("Pants_Pelvis", [
        (LT(0.0, 0.010, 0.355), 0.168, 0.152, 0, 0, 0.012),
        (LT(0.0, 0.008, 0.455), 0.178, 0.160, 0, 0, 0.014),
        (LT(0.0, 0.008, 0.560), 0.178, 0.158, 0, 0, 0.010),
    ], mats["pants"], piv_t, segs=28)

    # Caramel Leather Artisan Apron (cleanly wraps OUTSIDE shirt chest & waist with +18mm clearance -> ZERO clipping!)
    abm = bmesh.new()
    arows = []
    for iv in range(11):
        tv = iv / 10.0
        z = 0.295 + tv * 0.515  # 0.295 -> 0.810
        if tv < 0.54:
            ang_span = math.radians(116.0 - tv * 8.0)
            rx = 0.208 - tv * 0.016
            ry = 0.184 - tv * 0.014
        else:
            t_bib = (tv - 0.54) / 0.46
            ang_span = math.radians(112.0 * (1.0 - t_bib * 0.56))
            rx = 0.200 - t_bib * 0.020
            ry = 0.178 - t_bib * 0.014
        row = []
        for iu in range(17):
            tu = (iu / 16.0) * 2.0 - 1.0
            ang = -math.pi * 0.5 + tu * ang_span
            px = math.cos(ang) * rx
            py = math.sin(ang) * ry + 0.004
            row.append(abm.verts.new(Vector(LT(px, py, z))))
        arows.append(row)
    for iv in range(10):
        for iu in range(16):
            abm.faces.new((arows[iv][iu], arows[iv][iu + 1], arows[iv + 1][iu + 1], arows[iv + 1][iu]))
    ap_o = link_mesh("Leather_Apron", abm, mats["leather"], piv_t, subsurf=1)
    sap = ap_o.modifiers.new("Solidify", "SOLIDIFY")
    sap.thickness = 0.013
    sap.offset = 1.0

    # Raised Stitched Chest Tool Pocket + Blunt Wooden Chisel Handle peeking out!
    pbm = bmesh.new()
    prows = []
    for iv in range(5):
        pv = iv / 4.0
        z = 0.618 + pv * 0.118
        row = []
        for iu in range(7):
            pu = (iu / 6.0) * 2.0 - 1.0
            ang = -math.pi * 0.5 + pu * math.radians(24.0)
            px = math.cos(ang) * 0.182
            py = math.sin(ang) * 0.182 + 0.004 - 0.010
            row.append(pbm.verts.new(Vector(LT(px, py, z))))
        prows.append(row)
    for iv in range(4):
        for iu in range(6):
            pbm.faces.new((prows[iv][iu], prows[iv][iu + 1], prows[iv + 1][iu + 1], prows[iv + 1][iu]))
    pko = link_mesh("Apron_ChestPocket", pbm, mats["leather"], piv_t, subsurf=1)
    spk = pko.modifiers.new("Solidify", "SOLIDIFY")
    spk.thickness = 0.008
    spk.offset = 1.0

    # Blunt wooden tool handle peeking out right side of chest pocket (matching Detail Sheet Upper-Right!)
    th_bm = bmesh.new()
    bmesh.ops.create_cone(th_bm, cap_ends=True, segments=14, radius1=0.012, radius2=0.015, depth=0.092)
    link_mesh("Pocket_WoodHandle", th_bm, mats["wood"], piv_t, loc=LT(-0.024, -0.184, 0.728), rot=(math.radians(-6), math.radians(-16), 0.0), subsurf=1)

    # Rear Leather Waist Belt + Crisp X-Crossed Leather Back Straps + Brass Stress Rivets!
    belt_pts = [
        (*LT(0.184, -0.020, 0.578), 0.015),
        (*LT(0.168, 0.092, 0.578), 0.015),
        (*LT(0.075, 0.166, 0.578), 0.015),
        (*LT(0.000, 0.178, 0.578), 0.015),
        (*LT(-0.075, 0.166, 0.578), 0.015),
        (*LT(-0.168, 0.092, 0.578), 0.015),
        (*LT(-0.184, -0.020, 0.578), 0.015),
    ]
    bo = create_curved_tube("Apron_RearBelt", belt_pts, bevel_res=4)
    bo.parent = piv_t
    bo.data.materials.append(mats["leather_dark"])

    for idx_s, (fside, b_ov) in enumerate(((1, 0.000), (-1, 0.007))):
        s_pts = [
            (*LT(fside * 0.104, -0.140, 0.802), 0.016),
            (*LT(fside * 0.114, -0.048, 0.864), 0.016),
            (*LT(fside * 0.108, 0.048, 0.862), 0.016),
            (*LT(fside * 0.072, 0.135, 0.798), 0.016),
            (*LT(0.000, 0.170 + b_ov, 0.710), 0.016),
            (*LT(-fside * 0.095, 0.168, 0.582), 0.016),
        ]
        so = create_curved_tube(f"Apron_XStrap_{idx_s}", s_pts, bevel_res=4)
        so.parent = piv_t
        so.data.materials.append(mats["leather_dark"])

        # Front & Back Brass Load-Bearing Rivets!
        for rname, rloc, rrot in (
            (f"Rivet_Front_{idx_s}", LT(fside * 0.104, -0.155, 0.794), (math.radians(82), 0, fside * math.radians(16))),
            (f"Rivet_Back_{idx_s}", LT(-fside * 0.095, 0.184, 0.582), (math.radians(90), 0, -fside * math.radians(20))),
        ):
            rbm = bmesh.new()
            bmesh.ops.create_cone(rbm, cap_ends=True, segments=14, radius1=0.015, radius2=0.014, depth=0.008)
            link_mesh(rname, rbm, mats["brass"], piv_t, loc=rloc, rot=rrot, subsurf=0)

    # Center X-junction brass rivet
    cr_bm = bmesh.new()
    bmesh.ops.create_cone(cr_bm, cap_ends=True, segments=14, radius1=0.015, radius2=0.014, depth=0.008)
    link_mesh("Rivet_BackCenterX", cr_bm, mats["brass"], piv_t, loc=LT(0.0, 0.188, 0.710), rot=(math.radians(90), 0, 0), subsurf=0)

    # ANATOMICAL LEFT HIP (+X): Wooden Mallet hanging cleanly in riveted leather loop!
    ml_loop = create_curved_tube("Tool_MalletLoop", [
        (*LT(0.182, -0.072, 0.578), 0.011),
        (*LT(0.205, -0.088, 0.535), 0.011),
        (*LT(0.194, -0.076, 0.495), 0.011),
    ], bevel_res=4)
    ml_loop.parent = piv_t
    ml_loop.data.materials.append(mats["leather_dark"])
    mr_bm = bmesh.new()
    bmesh.ops.create_cone(mr_bm, cap_ends=True, segments=12, radius1=0.013, radius2=0.012, depth=0.008)
    link_mesh("Tool_MalletRivet", mr_bm, mats["brass"], piv_t, loc=LT(0.192, -0.082, 0.578), rot=(math.radians(78), 0, math.radians(60)), subsurf=0)
    # Mallet head & handle (compact, hugs left hip cleanly clear of elbow & thigh!)
    mh_bm = bmesh.new()
    bmesh.ops.create_cone(mh_bm, cap_ends=True, segments=18, radius1=0.032, radius2=0.032, depth=0.095)
    link_mesh("Tool_MalletHead", mh_bm, mats["wood"], piv_t, loc=LT(0.214, -0.080, 0.498), rot=(math.radians(90), 0.0, math.radians(-18)), subsurf=1)
    ms_bm = bmesh.new()
    bmesh.ops.create_cone(ms_bm, cap_ends=True, segments=14, radius1=0.014, radius2=0.012, depth=0.145)
    link_mesh("Tool_MalletHandle", ms_bm, mats["wood"], piv_t, loc=LT(0.214, -0.080, 0.415), rot=(0.0, math.radians(4), 0.0), subsurf=1)

    # ANATOMICAL RIGHT HIP (-X): Wooden Line Spool wound with cream fishing line!
    sp_loop = create_curved_tube("Tool_SpoolLoop", [
        (*LT(-0.182, -0.072, 0.578), 0.011),
        (*LT(-0.205, -0.088, 0.535), 0.011),
        (*LT(-0.194, -0.076, 0.495), 0.011),
    ], bevel_res=4)
    sp_loop.parent = piv_t
    sp_loop.data.materials.append(mats["leather_dark"])
    sr_bm = bmesh.new()
    bmesh.ops.create_cone(sr_bm, cap_ends=True, segments=12, radius1=0.013, radius2=0.012, depth=0.008)
    link_mesh("Tool_SpoolRivet", sr_bm, mats["brass"], piv_t, loc=LT(-0.192, -0.082, 0.578), rot=(math.radians(78), 0, math.radians(-60)), subsurf=0)
    # Spool top/bottom flanges + cream line core!
    for fz, fname in ((0.506, "Top"), (0.418, "Bot")):
        fbm = bmesh.new()
        bmesh.ops.create_cone(fbm, cap_ends=True, segments=20, radius1=0.044, radius2=0.044, depth=0.016)
        link_mesh(f"Tool_SpoolFlange_{fname}", fbm, mats["wood"], piv_t, loc=LT(-0.218, -0.084, fz), rot=(math.radians(6), math.radians(-10), 0.0), subsurf=1)
    lbm = bmesh.new()
    bmesh.ops.create_cone(lbm, cap_ends=True, segments=20, radius1=0.036, radius2=0.036, depth=0.082)
    link_mesh("Tool_SpoolLineCore", lbm, mats["line"], piv_t, loc=LT(-0.216, -0.082, 0.462), rot=(math.radians(6), math.radians(-10), 0.0), subsurf=1)

    # --- 3. STRONG TAPERING ARTISAN ARMS (Rolled Ivory Sleeves + Sturdy Bare Forearms + 4-Digit Hands) ---
    for side, piv_k in ((1, "Rig_ArmL"), (-1, "Rig_ArmR")):
        sname = "L" if side > 0 else "R"
        piv_a = nodes[piv_k]
        p_a = piv_a.location
        def LA(x, y, z):
            return (x - p_a.x, y - p_a.y, z - p_a.z)

        # Continuous sloping shoulder -> rolled ivory work sleeve (smoothly blended into shirt shoulder!)
        slv = [
            (*LA(side * 0.150, 0.005, 0.800), 0.066, 0.064, 0.00),
            (*LA(side * 0.194, 0.005, 0.794), 0.068, 0.065, 0.01),
            (*LA(side * 0.242, 0.000, 0.736), 0.066, 0.063, 0.02),
            (*LA(side * 0.272, -0.010, 0.678), 0.064, 0.062, 0.02),
        ]
        build_swept_tube_mesh(f"Sleeve_{sname}", slv, mats["shirt"], piv_a, segs=22)

        cuff = [
            (*LA(side * 0.264, -0.006, 0.698), 0.072, 0.069, 0.03),
            (*LA(side * 0.276, -0.014, 0.672), 0.076, 0.072, 0.035),
            (*LA(side * 0.284, -0.022, 0.644), 0.068, 0.064, 0.02),
        ]
        build_swept_tube_mesh(f"SleeveCuff_{sname}", cuff, mats["shirt"], piv_a, segs=22)

        # Strong tapering artisan forearm angled cleanly CLEAR of hip spool & mallet!
        fa = [
            (*LA(side * 0.274, -0.010, 0.688), 0.050, 0.048, 0.0),
            (*LA(side * 0.296, -0.024, 0.622), 0.048, 0.045, 0.0),
            (*LA(side * 0.308, -0.046, 0.560), 0.040, 0.037, 0.0),
            (*LA(side * 0.312, -0.060, 0.518), 0.034, 0.030, 0.0),
        ]
        build_swept_tube_mesh(f"Forearm_{sname}", fa, mats["skin"], piv_a, segs=18)
        build_four_digit_hand(piv_a, side, Vector((side * 0.314, -0.066, 0.496)), mats["skin"], scale=1.08, curled_grip=False)

    # --- 4. WIDE-SET KHAKI TROUSERS & HEAVY CHUNKY INTEGRATED-SOLE BROWN WORK BOOTS ---
    for side, piv_k in ((1, "Rig_LegL"), (-1, "Rig_LegR")):
        sname = "L" if side > 0 else "R"
        piv_l = nodes[piv_k]
        p_l = piv_l.location
        def LL(x, y, z):
            return (x - p_l.x, y - p_l.y, z - p_l.z)

        build_organic_loft(f"Trouser_{sname}", [
            (LL(side * 0.098, 0.008, 0.145), 0.088, 0.090, 0, 0, 0.028),  # generous bunched fabric above boot!
            (LL(side * 0.098, 0.004, 0.245), 0.086, 0.088, 0, 0, 0.022),
            (LL(side * 0.098, 0.008, 0.385), 0.094, 0.096, 0, 0, 0.014),
            (LL(side * 0.095, 0.010, 0.526), 0.094, 0.094, 0, 0, 0.004),
            (LL(side * 0.088, 0.010, 0.568), 0.076, 0.076, 0, 0, 0.000),
        ], mats["pants"], piv_l, segs=24)

        build_integrated_shoe(f"Boot_{sname}", piv_l, side, (side * 0.100, -0.014, 0.000), length_f=0.128, length_b=0.072, half_w=0.056, instep_h=0.098, sole_z=0.022, mat_upper=mats["boot"], mat_sole=mats["sole"], toe_out_deg=7.0)
        build_organic_loft(f"BootShaft_{sname}", [
            (LL(side * 0.100, 0.006, 0.068), 0.054, 0.060, 0, 0, 0.0),
            (LL(side * 0.100, 0.006, 0.155), 0.058, 0.062, 0, 0, 0.0),
        ], mats["boot"], piv_l, segs=20)

    finalize_rig_parenting_and_normalize(root, nodes, target_height=1.310)
    bake_gouache_atlas(root, os.path.join(TEX_DIR, "npc_artisan_v2_BaseColor.png"), tex_size=2048, skip_mat_substrings=("Brass", "EyeDark", "EyeCatch"))
    export_clean_glb(os.path.join(BASE_OUT, "npc_artisan.blend"), os.path.join(EXP_DIR, "npc_artisan.glb"))
    render_npc_8_audit_shots(root, nodes, "npc_artisan", 1.310, os.path.join(BASE_OUT, "previews", "npc_artisan_v2_audit"), detail_cam_pos=(-0.72, -1.25, 0.68), detail_cam_tgt=(0.0, -0.04, 0.56), is_haibo=False)


# =============================================================================
# NPC 3: 海伯 (`npc_lighthouse`, 1.350m) — Elderly Lighthouse Keeper w/ Lantern
# =============================================================================
def build_storm_lantern(piv_arm_r, grip_w, mats):
    """
    Constructs Hai Bo's antique brass-and-glass storm lantern directly under `Rig_ArmR`!
    Top curved bail handle passes RIGHT THROUGH his right-hand grip (`grip_w`) with exposed side loops,
    hanging completely clear (>=60mm!) outside his right wool coat hem!
    Uses special unbaked PBR materials: `Lantern_Brass`, `Lantern_AquaGlass`, `Lantern_WarmLamp`!
    """
    p_a = piv_arm_r.location
    def L(x, y, z):
        return (x - p_a.x, y - p_a.y, z - p_a.z)

    gx, gy, gz = grip_w.x, grip_w.y, grip_w.z

    # 1. Curved Brass Bail Handle (arches right through curled palm at gz - 0.025 down to lantern cap ears at gz - 0.105!)
    bail_pts = [
        (*L(gx - 0.044, gy, gz - 0.102), 0.0055),
        (*L(gx - 0.052, gy, gz - 0.050), 0.0058),
        (*L(gx - 0.036, gy, gz - 0.018), 0.0062),
        (*L(gx, gy, gz - 0.014), 0.0062),
        (*L(gx + 0.036, gy, gz - 0.018), 0.0062),
        (*L(gx + 0.052, gy, gz - 0.050), 0.0058),
        (*L(gx + 0.044, gy, gz - 0.102), 0.0055),
    ]
    bo = create_curved_tube("Lantern_BailHandle", bail_pts, bevel_res=4)
    bo.parent = piv_arm_r
    bo.data.materials.append(mats["lantern_brass"])

    # Side Protective Brass Wire Guard Tubes framing glass globe
    for gside in (-1, 1):
        wg_pts = [
            (*L(gx + gside * 0.044, gy, gz - 0.102), 0.0052),
            (*L(gx + gside * 0.058, gy, gz - 0.145), 0.0050),
            (*L(gx + gside * 0.058, gy, gz - 0.205), 0.0050),
            (*L(gx + gside * 0.044, gy, gz - 0.238), 0.0052),
        ]
        wg = create_curved_tube(f"Lantern_WireGuard_{gside}", wg_pts, bevel_res=4)
        wg.parent = piv_arm_r
        wg.data.materials.append(mats["lantern_brass"])

    # 2. Stepped Antique Brass Top Cap / Chimney Hood
    build_organic_loft("Lantern_BrassCap", [
        (L(gx, gy, gz - 0.118), 0.046, 0.046, 0, 0, 0.0),
        (L(gx, gy, gz - 0.104), 0.050, 0.050, 0, 0, 0.0),
        (L(gx, gy, gz - 0.092), 0.032, 0.032, 0, 0, 0.0),
        (L(gx, gy, gz - 0.072), 0.026, 0.026, 0, 0, 0.0),
        (L(gx, gy, gz - 0.058), 0.014, 0.014, 0, 0, 0.0),
    ], mats["lantern_brass"], piv_arm_r, segs=22, subsurf=0)

    # 3. Footed Antique Brass Base Reservoir
    build_organic_loft("Lantern_BrassBase", [
        (L(gx, gy, gz - 0.262), 0.052, 0.052, 0, 0, 0.0),
        (L(gx, gy, gz - 0.246), 0.054, 0.054, 0, 0, 0.0),
        (L(gx, gy, gz - 0.232), 0.046, 0.046, 0, 0, 0.0),
        (L(gx, gy, gz - 0.218), 0.036, 0.036, 0, 0, 0.0),
    ], mats["lantern_brass"], piv_arm_r, segs=22, subsurf=0)

    # 4. Bulging Translucent Storm Glass Globe (`Lantern_AquaGlass` — unbaked transparent shader!)
    build_organic_loft("Lantern_GlassGlobe", [
        (L(gx, gy, gz - 0.222), 0.034, 0.034, 0, 0, 0.0),
        (L(gx, gy, gz - 0.194), 0.048, 0.048, 0, 0, 0.0),
        (L(gx, gy, gz - 0.156), 0.046, 0.046, 0, 0, 0.0),
        (L(gx, gy, gz - 0.118), 0.034, 0.034, 0, 0, 0.0),
    ], mats["lantern_glass"], piv_arm_r, segs=22, cap_start=False, cap_end=False, subsurf=1)

    # 5. Crisp Glowing Amber Teardrop Flame & Wick Inside Globe (`Lantern_WarmLamp` — unbaked emissive!)
    build_organic_loft("Lantern_WarmFlame", [
        (L(gx, gy, gz - 0.216), 0.008, 0.008, 0, 0, 0.0),
        (L(gx, gy, gz - 0.196), 0.017, 0.017, 0, 0, 0.0),
        (L(gx, gy, gz - 0.172), 0.013, 0.013, 0, 0, 0.0),
        (L(gx, gy, gz - 0.148), 0.003, 0.003, 0, 0, 0.0),
    ], mats["lantern_flame"], piv_arm_r, segs=16, subsurf=1)


def build_npc_lighthouse():
    clear_scene()
    pivots = {
        "Rig_Torso": (0.000, 0.015, 0.578),
        "Rig_Head": (0.000, -0.004, 0.938),
        "Rig_ArmL": (0.210, 0.007, 0.875),
        "Rig_ArmR": (-0.210, 0.007, 0.875),
        "Rig_LegL": (0.102, 0.012, 0.546),
        "Rig_LegR": (-0.102, 0.012, 0.546),
    }
    root, nodes = create_rig_hierarchy("NPC_HaiBo_Lighthouse_v2", pivots)

    mats = {
        "face_skin": make_face_skin_mat("HaiBo_FaceSkin", "#E1B398", "#CA967B", "#CF8876", "#CF8472", cheek_xy=(0.104, -0.146, -0.016), cheek_r=0.075, blush_str=0.35, nose_pos=(0.0, -0.190, -0.022), nose_r=0.048, nose_str=0.52),
        "skin": make_gouache_mat("HaiBo_Skin", "#E1B398", "#C8967B", rough=0.78, noise_scale=16.0, ao_strength=0.18, ao_dist=0.12, bump_str=0.016),
        "cap": make_gouache_mat("HaiBo_NavyCap", "#293E53", "#1C2B3B", rough=0.86, noise_scale=22.0, ao_strength=0.26, ao_dist=0.14, bump_str=0.036),
        "cap_bill": make_gouache_mat("HaiBo_CapBill", "#22303E", "#16202A", rough=0.82, noise_scale=22.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.030),
        "gold_trim": make_gouache_mat("HaiBo_GoldTrim", "#B39459", "#856B38", rough=0.50, noise_scale=18.0, ao_strength=0.18, ao_dist=0.08, bump_str=0.020),
        "beard": make_gouache_mat("HaiBo_SilverBeard", "#E3E0D4", "#B8B8AE", rough=0.88, noise_scale=24.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.042),
        "brow": make_gouache_mat("HaiBo_WhiteBrow", "#EEE8D8", "#C9C5B8", rough=0.86, noise_scale=20.0, ao_strength=0.16, ao_dist=0.08, bump_str=0.030),
        "sweater": make_gouache_mat("HaiBo_CreamKnit", "#EEE3C9", "#CFC4AB", rough=0.92, noise_scale=22.0, ao_strength=0.24, ao_dist=0.14, bump_str=0.045, pattern="knit", pattern_scale=28.0),
        "scarf": make_gouache_mat("HaiBo_CoralScarf", "#C75E4D", "#9A493F", rough=0.84, noise_scale=20.0, ao_strength=0.24, ao_dist=0.12, bump_str=0.035),
        "coat": make_gouache_mat("HaiBo_OceanCoat", "#30566A", "#223D4E", rough=0.90, noise_scale=20.0, ao_strength=0.28, ao_dist=0.18, bump_str=0.040),
        "coat_lapel": make_gouache_mat("HaiBo_CoatLapel", "#3D657A", "#284556", rough=0.90, noise_scale=20.0, ao_strength=0.24, ao_dist=0.14, bump_str=0.038),
        "pants": make_gouache_mat("HaiBo_DarkPants", "#414B50", "#2C3337", rough=0.88, noise_scale=22.0, ao_strength=0.26, ao_dist=0.14, bump_str=0.032),
        "boot": make_gouache_mat("HaiBo_SeaBoot", "#365052", "#25393B", rough=0.48, noise_scale=16.0, ao_strength=0.22, ao_dist=0.12, bump_str=0.022),
        "sole": make_gouache_mat("HaiBo_SeaBootSole", "#263435", "#192223", rough=0.72, noise_scale=18.0, ao_strength=0.20, ao_dist=0.10, bump_str=0.024),
        # Unbaked PBR Metallic / Glass / Emissive materials (matched by skip_mat_substrings!)
        "brass": make_gouache_mat("HaiBo_BrassBtn", "#C8A152", "#8E6D2E", rough=0.38, metal=0.74, noise_scale=14.0, ao_strength=0.12, ao_dist=0.08, bump_str=0.01),
        "lantern_brass": make_gouache_mat("Lantern_Brass", "#BD9048", "#7E5B24", rough=0.40, metal=0.82, noise_scale=16.0, ao_strength=0.16, ao_dist=0.08, bump_str=0.015),
        "lantern_glass": make_gouache_mat("Lantern_AquaGlass", "#E4ECE4", "#C8D5CA", rough=0.12, metal=0.0, noise_scale=10.0, ao_strength=0.0, bump_str=0.0, alpha=0.34),
        "lantern_flame": make_gouache_mat("Lantern_WarmLamp", "#FFE5A3", "#E9A34F", rough=0.20, noise_scale=8.0, ao_strength=0.0, bump_str=0.0, emit_hex="#FFCF6E", emit_str=3.4),
        "eye_dark": make_gouache_mat("HaiBo_EyeDark", "#2A2421", "#161210", rough=0.16, noise_scale=8.0, ao_strength=0.0, bump_str=0.0),
        "eye_catch": make_gouache_mat("HaiBo_EyeCatch", "#FFFDF8", "#F4EFE6", rough=0.10, noise_scale=6.0, ao_strength=0.0, bump_str=0.0),
        "smile": make_gouache_mat("HaiBo_Smile", "#8A4A3E", "#5A2A22", rough=0.72, noise_scale=10.0, ao_strength=0.0, bump_str=0.0),
    }

    # --- 1. HEAD, SOFT NAVY CAPTAIN'S CAP, LIFTED WHITE BROWS & FULL SILVER-WHITE BEARD ---
    piv_h = nodes["Rig_Head"]
    p_h = piv_h.location
    head_ctr = Vector((0.0, -0.004, 1.106))
    build_sculpted_head_base("Head_Sculpt", piv_h, head_ctr, sx=0.180, sy=0.174, sz=0.188, nose_bulge=0.034, cheek_bulge=0.075, mat_face=mats["face_skin"])
    build_eyes_and_ears(piv_h, head_ctr, 0.180, 0.174, eye_z_off=0.014, ear_z_off=-0.016, mat_skin=mats["skin"], mat_eye_dark=mats["eye_dark"], mat_eye_catch=mats["eye_catch"], mat_brow=mats["brow"], brow_z_off=0.062, brow_r=0.0135)

    # Warm gentle smile cleanly visible beneath silver moustache!
    sm_w = [
        (-0.046, -0.180, 1.032, 0.0055),
        (-0.020, -0.190, 1.022, 0.0075),
        (0.000, -0.192, 1.020, 0.0080),
        (0.020, -0.190, 1.022, 0.0075),
        (0.046, -0.180, 1.032, 0.0055),
    ]
    smo = create_curved_tube("Mouth_Smile", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in sm_w], bevel_res=4)
    smo.parent = piv_h
    smo.data.materials.append(mats["smile"])

    # Full Fluffy Silver-White Sea-Captain Beard sculpted in broad soft tapered locks (leaves turtleneck & coral scarf clear!)
    bbm = bmesh.new()
    bmesh.ops.create_uvsphere(bbm, u_segments=30, v_segments=20, radius=1.0)
    for v in bbm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        px, py, pz = x * 0.194, y * 0.176, z * 0.140
        if y < 0.0 and z > 0.06:
            pz = min(pz, 0.010 + (x * x) * 0.075)
        if z < -0.25:
            t_b = min(1.0, (-z - 0.25) / 0.75)
            px *= 1.0 - 0.22 * (t_b ** 1.2)
            pz -= 0.012 * math.cos(x * 7.5) * t_b
        if y > 0.22:
            py *= 0.62
        v.co = Vector((px, py, pz))
    link_mesh("Beard_FullSilver", bbm, mats["beard"], piv_h, loc=Vector((0.0, -0.028, 1.008)) - p_h, subsurf=1)

    # Full upturned silver-white moustache
    for side in (1, -1):
        m_pts = [
            (side * 0.008, -0.194, 1.054, 0.021),
            (side * 0.056, -0.192, 1.047, 0.025),
            (side * 0.106, -0.172, 1.050, 0.021),
            (side * 0.136, -0.146, 1.064, 0.011),
        ]
        mo = create_curved_tube(f"Moustache_{side}", [(x - p_h.x, y - p_h.y, z - p_h.z, r) for (x, y, z, r) in m_pts], bevel_res=5)
        mo.parent = piv_h
        mo.data.materials.append(mats["beard"])

    # Full Fluffy Silver-White Temple & Rear Hair reaching solidly UP INTO captain's cap band -> ZERO bald gap & ZERO crown poke!
    hbm = bmesh.new()
    bmesh.ops.create_uvsphere(hbm, u_segments=28, v_segments=20, radius=1.0)
    for v in hbm.verts:
        px, py, pz = v.co.x * 0.196, v.co.y * 0.192, v.co.z * 0.178
        if py < -0.042:
            py = max(py, -0.042)
        if pz > 0.04:
            t = min(1.0, (pz - 0.04) / 0.14)
            px *= 1.0 - 0.20 * t
            py *= 1.0 - 0.20 * t
            pz = 0.04 + (pz - 0.04) * 0.62
        v.co = Vector((px, py, pz))
    link_mesh("Hair_SilverBack", hbm, mats["beard"], piv_h, loc=Vector((0.0, 0.008, 1.126)) - p_h, subsurf=1)

    # Soft Navy Captain's Cap seated SNUGLY right above white brows & silver temple hair!
    cap_grp = bpy.data.objects.new("CaptainCap_Assembly", None)
    cap_grp.location = Vector((0.0, 0.004, 1.190)) - p_h
    cap_grp.rotation_euler = Euler((math.radians(-8.5), 0.0, 0.0), "XYZ")
    bpy.context.collection.objects.link(cap_grp)
    cap_grp.parent = piv_h

    # Cap headband base
    build_organic_loft("CaptainCap_Band", [
        ((0, 0, -0.020), 0.196, 0.194, 0, 0, 0.0),
        ((0, 0, 0.030), 0.202, 0.200, 0, 0, 0.0),
    ], mats["cap"], cap_grp, segs=30, cap_start=False, cap_end=False)

    # Wide soft domed captain's top crown (full & soft, clears skull cleanly by >=3.5cm!)
    build_organic_loft("CaptainCap_Crown", [
        ((0, 0, 0.020), 0.204, 0.202, 0, 0, 0.0),
        ((0, 0, 0.064), 0.238, 0.234, 0, 0, 0.008),
        ((0, 0, 0.114), 0.218, 0.214, 0, 0, 0.006),
        ((0, 0, 0.144), 0.148, 0.144, 0, 0, 0.0),
        ((0, 0, 0.154), 0.044, 0.042, 0, 0, 0.0),
    ], mats["cap"], cap_grp, segs=32, cap_start=False, cap_end=True)

    # Muted Gold Brim Decoration Line around front cap band + twin tiny brass studs
    gold_pts = [(math.cos(math.radians(d)) * 0.204, math.sin(math.radians(d)) * 0.202, 0.010, 0.010) for d in range(-188, 12, 16)]
    go = create_curved_tube("CaptainCap_GoldCord", gold_pts, bevel_res=4)
    go.parent = cap_grp
    go.data.materials.append(mats["gold_trim"])
    for side in (-1, 1):
        sbm = bmesh.new()
        bmesh.ops.create_uvsphere(sbm, u_segments=10, v_segments=8, radius=0.011)
        link_mesh(f"CaptainCap_Stud_{side}", sbm, mats["brass"], cap_grp, loc=(side * 0.202, -0.015, 0.006), subsurf=0)

    # Dark Navy Curved Visor Bill
    vbm = bmesh.new()
    bmesh.ops.create_uvsphere(vbm, u_segments=24, v_segments=12, radius=1.0)
    for v in vbm.verts:
        px, py, pz = v.co.x * 0.184, v.co.y * 0.114, v.co.z * 0.015
        pz -= (v.co.x ** 2) * 0.025
        v.co = Vector((px, py, pz))
    link_mesh("CaptainCap_Visor", vbm, mats["cap_bill"], cap_grp, loc=(0.0, -0.172, -0.012), rot=(math.radians(10.0), 0.0, 0.0), subsurf=1)

    # --- 2. BROAD-SHOULDERED TORSO: CHUNKY CREAM TURTLENECK + CORAL SCARF + DOUBLE-BREASTED OCEAN COAT ---
    piv_t = nodes["Rig_Torso"]
    p_t = piv_t.location
    def LT(x, y, z):
        return (x - p_t.x, y - p_t.y, z - p_t.z)

    # Cream chunky ribbed turtleneck sweater (neck collar + full inner chest & lower sweater hem!)
    build_organic_loft("Sweater_Turtleneck", [
        (LT(0.0, 0.008, 0.415), 0.176, 0.156, 0, 0, 0.010),  # lower hem peeking inside parted coat!
        (LT(0.0, 0.004, 0.580), 0.184, 0.162, 0, 0, 0.012),
        (LT(0.0, 0.002, 0.760), 0.194, 0.164, 0, 0, 0.010),
        (LT(0.0, 0.002, 0.875), 0.125, 0.115, 0, 0, 0.008),
        (LT(0.0, 0.000, 0.916), 0.106, 0.102, 0, 0, 0.008),  # thick rolled knit turtleneck collar!
        (LT(0.0, 0.000, 0.946), 0.098, 0.094, 0, 0, 0.006),
    ], mats["sweater"], piv_t, segs=28)

    # Coral-red sailor scarf band circling neck + crisp knot & twin tails on ANATOMICAL LEFT (+X)!
    sc_pts = [(math.cos(math.radians(d)) * 0.122 - p_t.x, math.sin(math.radians(d)) * 0.118 + 0.002 - p_t.y, 0.892 - p_t.z, 0.022) for d in range(0, 360, 18)]
    sco = create_curved_tube("Scarf_NeckBand", sc_pts, bevel_res=4, cyclic=True)
    sco.parent = piv_t
    sco.data.materials.append(mats["scarf"])

    sk_bm = bmesh.new()
    bmesh.ops.create_uvsphere(sk_bm, u_segments=14, v_segments=10, radius=1.0)
    for v in sk_bm.verts:
        v.co = Vector((v.co.x * 0.036, v.co.y * 0.032, v.co.z * 0.034))
    link_mesh("Scarf_KnotLeft", sk_bm, mats["scarf"], piv_t, loc=LT(0.116, -0.112, 0.876), subsurf=1)

    for idx_t, t_pts in enumerate((
        [(*LT(0.116, -0.116, 0.870), 0.020), (*LT(0.146, -0.156, 0.808), 0.024), (*LT(0.162, -0.165, 0.768), 0.008)],
        [(*LT(0.108, -0.122, 0.866), 0.018), (*LT(0.088, -0.166, 0.808), 0.022), (*LT(0.076, -0.175, 0.775), 0.008)],
    )):
        to = create_curved_tube(f"Scarf_Tail_{idx_t}", t_pts, bevel_res=4)
        to.parent = piv_t
        to.data.materials.append(mats["scarf"])

    # Dark charcoal upper pelvis beneath parted wool coat
    build_organic_loft("Pants_Pelvis", [
        (LT(0.0, 0.012, 0.345), 0.170, 0.152, 0, 0, 0.010),
        (LT(0.0, 0.010, 0.450), 0.178, 0.158, 0, 0, 0.010),
    ], mats["pants"], piv_t, segs=24)

    # Wide-Shouldered Deep Ocean-Blue Wool Coat (SHAPED WAIST + PARTED FRONT OPENING + SHORT REAR VENT — ZERO BARREL TUBE!)
    cbm = bmesh.new()
    crows = []
    # Wrap continuously around back from front-left opening (+18 deg from -Y) all the way around back to front-right opening (-18 deg from -Y)!
    n_u = 25
    n_v = 11
    for iv in range(n_v):
        tv = iv / (n_v - 1)
        z = 0.375 + tv * 0.515  # coat hem Z=0.375 -> broad shoulders Z=0.890!
        # Silhouette profile: flared hem (tv=0) -> shaped waist (tv=0.45) -> broad shoulders (tv=0.88) -> neckline (tv=1.0)
        if tv < 0.45:
            t_w = tv / 0.45
            rx = 0.226 * (1.0 - t_w) + 0.208 * t_w
            ry = 0.194 * (1.0 - t_w) + 0.180 * t_w
        elif tv < 0.86:
            t_s = (tv - 0.45) / 0.41
            rx = 0.208 * (1.0 - t_s) + 0.224 * t_s
            ry = 0.180 * (1.0 - t_s) + 0.176 * t_s
        else:
            t_n = (tv - 0.86) / 0.14
            rx = 0.224 * (1.0 - t_n) + 0.146 * t_n
            ry = 0.176 * (1.0 - t_n) + 0.132 * t_n

        # Front opening wider at neckline & subtly parted at hem so cream knit turtleneck shows crisply!
        open_half = math.radians(17.0 + 18.0 * (tv ** 2.2) + 4.5 * ((1.0 - tv) ** 2.0))
        # Angles run from (-pi/2 + open_half) through +pi/2 (back) to (3*pi/2 - open_half)
        ang_start = -math.pi * 0.5 + open_half
        ang_end = 1.5 * math.pi - open_half
        row = []
        for iu in range(n_u):
            tu = iu / (n_u - 1)
            ang = ang_start + tu * (ang_end - ang_start)
            # Subtle short rear vent notch at back center (tu=0.5) near bottom hem (tv < 0.16)
            vent_lift = 0.048 * max(0.0, 1.0 - abs(tu - 0.5) * 14.0) * max(0.0, 1.0 - tv / 0.18)
            px = math.cos(ang) * rx
            py = math.sin(ang) * ry + 0.008
            row.append(cbm.verts.new(Vector(LT(px, py, z + vent_lift))))
        crows.append(row)
    for iv in range(n_v - 1):
        for iu in range(n_u - 1):
            cbm.faces.new((crows[iv][iu], crows[iv][iu + 1], crows[iv + 1][iu + 1], crows[iv + 1][iu]))
    coat_o = link_mesh("WoolCoat_Body", cbm, mats["coat"], piv_t, subsurf=1)
    sco_m = coat_o.modifiers.new("Solidify", "SOLIDIFY")
    sco_m.thickness = 0.020
    sco_m.offset = 1.0

    # Folded Notched Wool Lapels (matching Detail Sheet Upper-Right!)
    for side in (1, -1):
        lap_pts = [
            (*LT(side * 0.068, -0.174, 0.728), 0.018),
            (*LT(side * 0.118, -0.158, 0.798), 0.026),
            (*LT(side * 0.132, -0.125, 0.858), 0.024),
            (*LT(side * 0.112, -0.055, 0.892), 0.020),
            (*LT(side * 0.060, 0.068, 0.896), 0.018),
        ]
        lo = create_curved_tube(f"WoolCoat_Lapel_{side}", lap_pts, bevel_res=4)
        lo.parent = piv_t
        lo.data.materials.append(mats["coat_lapel"])

    # Two Curved Vertical Rows of 3 Antique Brass Coat Buttons (`HaiBo_BrassBtn` — unbaked shiny brass!)
    for side in (1, -1):
        for bi, (bz, bx, by) in enumerate(((0.695, 0.098, -0.182), (0.605, 0.102, -0.184), (0.515, 0.108, -0.188))):
            bbm = bmesh.new()
            bmesh.ops.create_cone(bbm, cap_ends=True, segments=16, radius1=0.021, radius2=0.019, depth=0.012)
            link_mesh(f"Coat_BrassBtn_{side}_{bi}", bbm, mats["brass"], piv_t, loc=LT(side * bx, by, bz), rot=(math.radians(84), 0.0, side * math.radians(22)), subsurf=0)

    # --- 3. WIDE WOOL COAT SLEEVES + ROLLED CUFFS + RIGHT-HAND STORM LANTERN! ---
    # Anatomical LEFT arm (+1): Relaxed natural hang for friendly wave!
    piv_al = nodes["Rig_ArmL"]
    p_al = piv_al.location
    def LAL(x, y, z):
        return (x - p_al.x, y - p_al.y, z - p_al.z)

    build_swept_tube_mesh("Sleeve_L", [
        (*LAL(0.165, 0.008, 0.848), 0.072, 0.070, 0.00),
        (*LAL(0.214, 0.006, 0.842), 0.074, 0.072, 0.01),
        (*LAL(0.258, 0.000, 0.764), 0.070, 0.068, 0.02),
        (*LAL(0.280, -0.016, 0.678), 0.068, 0.065, 0.02),
        (*LAL(0.292, -0.044, 0.592), 0.064, 0.062, 0.02),
    ], mats["coat"], piv_al, segs=22)
    build_swept_tube_mesh("SleeveCuff_L", [
        (*LAL(0.285, -0.032, 0.630), 0.074, 0.072, 0.025),
        (*LAL(0.295, -0.048, 0.580), 0.076, 0.074, 0.025),
        (*LAL(0.298, -0.056, 0.556), 0.068, 0.065, 0.015),
    ], mats["coat_lapel"], piv_al, segs=22)
    build_swept_tube_mesh("Wrist_L", [
        (*LAL(0.292, -0.044, 0.596), 0.038, 0.036, 0.0),
        (*LAL(0.300, -0.062, 0.542), 0.035, 0.033, 0.0),
    ], mats["skin"], piv_al, segs=16)
    build_four_digit_hand(piv_al, +1, Vector((0.302, -0.068, 0.520)), mats["skin"], scale=1.08, curled_grip=False)

    # Anatomical RIGHT arm (-1): Soft ~22° bend holding Antique Brass Storm Lantern cleanly outside right coat hem!
    # Coat right edge is at X = -0.226; lantern center is at X = -0.348 (radius 0.054 -> inner edge -0.294 => 68mm CLEARANCE!)
    piv_ar = nodes["Rig_ArmR"]
    p_ar = piv_ar.location
    def LAR(x, y, z):
        return (x - p_ar.x, y - p_ar.y, z - p_ar.z)

    build_swept_tube_mesh("Sleeve_R", [
        (*LAR(-0.165, 0.008, 0.848), 0.072, 0.070, 0.00),
        (*LAR(-0.214, 0.006, 0.842), 0.074, 0.072, 0.01),
        (*LAR(-0.278, -0.010, 0.772), 0.070, 0.068, 0.02),
        (*LAR(-0.324, -0.046, 0.706), 0.068, 0.066, 0.02),
        (*LAR(-0.344, -0.082, 0.648), 0.064, 0.062, 0.02),
    ], mats["coat"], piv_ar, segs=22)
    build_swept_tube_mesh("SleeveCuff_R", [
        (*LAR(-0.334, -0.064, 0.680), 0.074, 0.072, 0.025),
        (*LAR(-0.346, -0.084, 0.638), 0.076, 0.074, 0.025),
        (*LAR(-0.350, -0.094, 0.616), 0.068, 0.065, 0.015),
    ], mats["coat_lapel"], piv_ar, segs=22)
    build_swept_tube_mesh("Wrist_R", [
        (*LAR(-0.344, -0.080, 0.654), 0.038, 0.036, 0.0),
        (*LAR(-0.348, -0.094, 0.608), 0.036, 0.034, 0.0),
    ], mats["skin"], piv_ar, segs=16)

    lantern_grip_w = Vector((-0.348, -0.098, 0.592))
    build_four_digit_hand(piv_ar, -1, lantern_grip_w, mats["skin"], scale=1.10, curled_grip=True)
    build_storm_lantern(piv_ar, lantern_grip_w, mats)

    # --- 4. DARK TROUSERS & TALL WATERPROOF BLUE-GREEN SEA BOOTS ---
    for side, piv_k in ((1, "Rig_LegL"), (-1, "Rig_LegR")):
        sname = "L" if side > 0 else "R"
        piv_l = nodes[piv_k]
        p_l = piv_l.location
        def LL(x, y, z):
            return (x - p_l.x, y - p_l.y, z - p_l.z)

        build_organic_loft(f"Trouser_{sname}", [
            (LL(side * 0.104, 0.008, 0.245), 0.088, 0.090, 0, 0, 0.022),  # tucked smoothly into tall sea boot!
            (LL(side * 0.104, 0.006, 0.360), 0.094, 0.096, 0, 0, 0.016),
            (LL(side * 0.102, 0.012, 0.546), 0.096, 0.096, 0, 0, 0.004),
            (LL(side * 0.094, 0.012, 0.590), 0.078, 0.078, 0, 0, 0.000),
        ], mats["pants"], piv_l, segs=24)

        build_integrated_shoe(f"SeaBoot_{sname}", piv_l, side, (side * 0.106, -0.016, 0.000), length_f=0.132, length_b=0.074, half_w=0.056, instep_h=0.096, sole_z=0.022, mat_upper=mats["boot"], mat_sole=mats["sole"], toe_out_deg=7.0)
        # Tall waterproof rubber sea-boot shaft + gently flared rolled top lip!
        build_organic_loft(f"SeaBootShaft_{sname}", [
            (LL(side * 0.106, 0.006, 0.068), 0.058, 0.064, 0, 0, 0.0),
            (LL(side * 0.106, 0.006, 0.165), 0.066, 0.068, 0, 0, 0.0),
            (LL(side * 0.106, 0.006, 0.242), 0.076, 0.078, 0, 0, 0.0),
            (LL(side * 0.106, 0.006, 0.264), 0.080, 0.082, 0, 0, 0.005),
            (LL(side * 0.106, 0.006, 0.272), 0.074, 0.076, 0, 0, 0.0),
        ], mats["boot"], piv_l, segs=24)

    finalize_rig_parenting_and_normalize(root, nodes, target_height=1.350)
    bake_gouache_atlas(root, os.path.join(TEX_DIR, "npc_lighthouse_v2_BaseColor.png"), tex_size=2048, skip_mat_substrings=("Brass", "EyeDark", "EyeCatch", "AquaGlass", "WarmLamp"))
    export_clean_glb(os.path.join(BASE_OUT, "npc_lighthouse.blend"), os.path.join(EXP_DIR, "npc_lighthouse.glb"))
    render_npc_8_audit_shots(root, nodes, "npc_lighthouse", 1.350, os.path.join(BASE_OUT, "previews", "npc_lighthouse_v2_audit"), detail_cam_pos=(-0.78, -1.05, 0.56), detail_cam_tgt=(-0.22, -0.06, 0.48), is_haibo=True)


def main():
    argv = sys.argv
    npc = "market"
    if "--" in argv:
        extra = argv[argv.index("--") + 1 :]
        if "--npc" in extra:
            npc = extra[extra.index("--npc") + 1]
    if npc == "market":
        build_npc_market()
    elif npc == "artisan":
        build_npc_artisan()
    elif npc == "lighthouse":
        build_npc_lighthouse()
    else:
        raise ValueError(f"Unknown --npc {npc}")


if __name__ == "__main__":
    main()
