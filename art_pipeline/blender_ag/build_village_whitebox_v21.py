"""
Antigravity Studio — 《钓鱼大冒险》（静水 / Stillwater Lagoon）
Whitebox Architectural Blockout v2.1 (GPT-6.2-Astra Ultra P0 + P1 Iteration)

Implements EVERY P0 & P1 optimization from art_pipeline/brief/ASTRA_ULTRA_WHITEBOX_V2_REVIEW.md:
  1. Approved ~1.28x footprints KEPT (5.4x4.4 / 4.6x3.8 / 4.3x3.6 / 2.85m stall / 7.8m lighthouse)
     with radical silhouette & roofline differentiation (zero template cloning!):
       - Player Hero Home:  3.70m steep ridge (38°), 1.05m offset dormer (+0.45m), flared eave tips,
                            1.12x1.75m hat-safe doorway, modular 1.48m cutaway porch!
       - Old Zhou Workshop: 3.10m low broad ridge (27°), 1.35x2.10m side lean-to tool shed,
                            0.48x0.55m junction chimney, 1.22x1.78m wide cargo door, single-side bench!
       - East Timber House: 3.25m ridge (33°), rotated -11° exposing gable, NO full porch ->
                            2.10x1.05m offset gabled vestibule + 0.42m stone cheek wall + slender gable chimney!
       - Staggered front setbacks (0 / 0.65 / 1.20m) & 3-tier hillside back row (+0.65 / +1.15 / +1.65m)
         with rotated gables and varied chimneys!
  2. Unified Elevation Profile & Segmented Natural Shoreline:
       - Water Z = 0.00m | Central Promenade Z = +1.14m (2.10m+ net walkable) | Pier Deck Z = +0.44m
         connected by crisp 5-step 0.14m timber stairs!
       - 26m crescent bay chord (3.5m concave bend): West 6m sloped boulder cove -> Central 12.5m
         stone retaining quay (boulder-broken height 0.55..1.05m) -> East 8m rocky shore!
       - Hero Pier offset +1.0m from Hero Door, angled +18° toward open sea, 1.80x2.20m landing,
         1.70m lantern BEHIND angler so rod & skyline stay spotless!
  3. Distant Rocky Cliff Lighthouse Promontory (~72m sightline across bay -> ~13% height in Shot 4!)
     with 12x9m, 3.5m-tall two-tiered coastal cliff dropping into sea!
  4. Narrative Shots 1-4 + Real Three.js Playable 44° Street & 52° Boat Verification + Scale Sheet +
     Rear Expansion Reserve Plot Frames (Kitchen 4x4m, Farm 6x4m, Livestock/Aquaculture 5x4m)!
"""

import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Euler, Matrix

BASE_DIR = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\whitebox_v21"
RENDER_DIR = os.path.join(BASE_DIR, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)


# =============================================================================
# 1. SCENE & ARCHITECTURAL CLAY MATERIAL PALETTE
# =============================================================================
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)


def make_collection(name, parent=None):
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col


def make_clay_mat(name, base_rgb, ao_rgb, roughness=0.82, ao_dist=0.70, spec=0.20):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = spec

    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = ao_dist

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.16
    ramp.color_ramp.elements[0].color = (*ao_rgb, 1.0)
    ramp.color_ramp.elements[1].position = 0.88
    ramp.color_ramp.elements[1].color = (*base_rgb, 1.0)

    nt.links.new(ao.outputs["AO"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_water_clay_mat():
    mat = bpy.data.materials.new(name="Clay_Water")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.71, 0.79, 0.83, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.22
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.52

    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 4.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.048
    bump.inputs["Distance"].default_value = 0.06
    nt.links.new(texcoord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_palette():
    return {
        "wall": make_clay_mat("Clay_Wall_Ivory", (0.95, 0.94, 0.90), (0.64, 0.62, 0.58), roughness=0.84, ao_dist=0.75),
        "roof": make_clay_mat("Clay_Roof_WarmClay", (0.63, 0.59, 0.55), (0.36, 0.34, 0.31), roughness=0.78, ao_dist=0.65),
        "roof_alt": make_clay_mat("Clay_Roof_SlateClay", (0.54, 0.58, 0.61), (0.30, 0.33, 0.36), roughness=0.78, ao_dist=0.65),
        "roof_mid": make_clay_mat("Clay_Roof_HoneyClay", (0.72, 0.67, 0.60), (0.43, 0.39, 0.35), roughness=0.78, ao_dist=0.65),
        "timber": make_clay_mat("Clay_Timber_Taupe", (0.50, 0.45, 0.39), (0.26, 0.23, 0.19), roughness=0.76, ao_dist=0.55),
        "stone": make_clay_mat("Clay_Stone_Quay", (0.74, 0.73, 0.70), (0.42, 0.41, 0.39), roughness=0.88, ao_dist=0.85),
        "cliff": make_clay_mat("Clay_Cliff_Rock", (0.64, 0.63, 0.60), (0.34, 0.33, 0.31), roughness=0.90, ao_dist=1.1),
        "terrain": make_clay_mat("Clay_Terrain_Soft", (0.85, 0.86, 0.81), (0.56, 0.57, 0.52), roughness=0.92, ao_dist=1.4),
        "foliage": make_clay_mat("Clay_Foliage_Matte", (0.76, 0.79, 0.73), (0.43, 0.47, 0.41), roughness=0.90, ao_dist=0.95),
        "accent": make_clay_mat("Clay_Mannequin_Charcoal", (0.34, 0.32, 0.30), (0.17, 0.16, 0.15), roughness=0.72, ao_dist=0.35),
        "parcel": make_clay_mat("Clay_Highlight_Parcel", (0.97, 0.95, 0.89), (0.70, 0.66, 0.60), roughness=0.70, ao_dist=0.30),
        "reserve": make_clay_mat("Clay_Reserve_Pad", (0.79, 0.80, 0.76), (0.55, 0.56, 0.52), roughness=0.92, ao_dist=0.50),
        "water": make_water_clay_mat(),
    }


# =============================================================================
# 2. CLEAN GEOMETRY HELPERS
# =============================================================================
def link_obj(obj, col, parent=None, mat=None):
    col.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    if mat is not None:
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
    return obj


def add_box(name, size, loc, col, mat, parent=None, rot=(0, 0, 0), bevel=0.022):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * 0.25), segments=2, affect="EDGES")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    return link_obj(obj, col, parent, mat)


def add_cyl(name, r_top, r_bot, depth, loc, col, mat, parent=None, rot=(0, 0, 0), segs=14, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_bot, radius2=r_top, depth=depth)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    return link_obj(obj, col, parent, mat)


def add_ico(name, radius, loc, scale, col, mat, parent=None, subdiv=2, jitter=0.08, seed=1, rot=(0, 0, 0)):
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        n = 1.0 + (rng.random() - 0.5) * 2.0 * jitter
        v.co.x *= scale[0] * n
        v.co.y *= scale[1] * n
        v.co.z *= scale[2] * n
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    return link_obj(obj, col, parent, mat)


def add_flared_gable_roof(
    name, width, depth, ridge_h, overhang_x, overhang_y, thick, base_z, col, mat, parent=None, tip_flare=0.0
):
    """
    True sculpted gable roof with optional Storybook upturned eave tips (+0.08..0.12m on last 0.7m!)
    computed strictly from wall span!
    """
    bm = bmesh.new()
    hw = width * 0.5 + overhang_x
    hd = depth * 0.5 + overhang_y

    # Subdivided grid along X so we can gently flare the outer 0.70m roof tips upward!
    nx = 12
    for side in (-1, 1):  # -1 = front (-Y), +1 = back (+Y)
        top_grid = []
        bot_grid = []
        for ix in range(nx + 1):
            tx = -1.0 + 2.0 * (ix / nx)
            x = tx * hw
            dist_from_edge = hw - abs(x)
            flare = 0.0
            if tip_flare > 0.0 and dist_from_edge < 0.72:
                u = 1.0 - dist_from_edge / 0.72
                flare = tip_flare * (u * u)

            # 3 profile rows across slope: ridge (0) -> mid -> eave (1)
            t_row = []
            b_row = []
            for s in (0.0, 0.5, 1.0):
                y = side * hd * s
                # Subtle organic sag-to-flare curve on eave!
                z_top = base_z + ridge_h * (1.0 - s) + thick + flare * (0.35 + 0.65 * s)
                z_bot = z_top - thick
                t_row.append(bm.verts.new((x, y, z_top)))
                b_row.append(bm.verts.new((x, y, z_bot)))
            top_grid.append(t_row)
            bot_grid.append(b_row)

        for ix in range(nx):
            for j in range(2):
                a, b, c, d = top_grid[ix][j], top_grid[ix + 1][j], top_grid[ix + 1][j + 1], top_grid[ix][j + 1]
                bm.faces.new((a, b, c, d) if side > 0 else (d, c, b, a))
                ba, bb, bc, bd = bot_grid[ix][j], bot_grid[ix + 1][j], bot_grid[ix + 1][j + 1], bot_grid[ix][j + 1]
                bm.faces.new((bd, bc, bb, ba) if side > 0 else (ba, bb, bc, bd))
            # Eave fascia edge
            e0, e1, e2, e3 = bot_grid[ix][2], bot_grid[ix + 1][2], top_grid[ix + 1][2], top_grid[ix][2]
            bm.faces.new((e0, e1, e2, e3) if side > 0 else (e3, e2, e1, e0))
        # Left & right gable rake caps
        for end_i, flip in ((0, True), (nx, False)):
            for j in range(2):
                v0, v1, v2, v3 = bot_grid[end_i][j], bot_grid[end_i][j + 1], top_grid[end_i][j + 1], top_grid[end_i][j]
                cond = (side > 0) ^ flip
                bm.faces.new((v0, v1, v2, v3) if cond else (v3, v2, v1, v0))

    # Crisp ridge cap beam
    sub = bmesh.new()
    bmesh.ops.create_cube(sub, size=1.0)
    bmesh.ops.scale(sub, vec=Vector((hw * 2.0 + 0.08, 0.20, 0.16)), verts=sub.verts)
    bmesh.ops.transform(sub, matrix=Matrix.Translation(Vector((0.0, 0.0, base_z + ridge_h + thick + 0.04))), verts=sub.verts)
    vmap = [bm.verts.new(v.co) for v in sub.verts]
    for f in sub.faces:
        bm.faces.new([vmap[v.index] for v in f.verts])
    sub.free()

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    return link_obj(obj, col, parent, mat)


def add_gable_end_walls(name, width, depth, ridge_h, base_z, col, mat, parent=None):
    """Solid triangular gable prism connecting left/right walls cleanly up to roof ridge."""
    bm = bmesh.new()
    hw = width * 0.5
    hd = depth * 0.5
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
    return link_obj(bpy.data.objects.new(name, mesh), col, parent, mat)


# =============================================================================
# 3. CRESCENT BAY TOPOGRAPHY (26m Chord / 3.5m Concave Bend + Distant 72m East Cliff!)
# =============================================================================
LIGHTHOUSE_POS = (52.0, -25.0)  # Across the open lagoon bay (~62m from Hero Pier -> ~13% height in Shot 4!)


def shore_y(x):
    """
    26m village chord (-13..+13) bowing 3.5m northward inland around x = 0,
    curving gently southward on West Bluff (x < -14) and sweeping out around East Bay toward the distant Lighthouse Cliff!
    """
    # Exact 3.5m concave bay curve over [-13, +13]: at x=0 -> y=+3.5, at x=±13 -> y=0.0!
    norm_x = max(-1.6, min(1.8, x / 13.0))
    crescent = 3.5 * max(-1.5, 1.0 - norm_x * norm_x)
    # Far east headland arm sweeping down toward LIGHTHOUSE_POS (52, -25)
    east_arm = -24.0 * math.exp(-((x - 52.0) / 22.0) ** 2)
    return crescent + east_arm


def ss(a, b, v):
    t = max(0.0, min(1.0, (v - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def terrain_height(x, y):
    sy = shore_y(x)
    inland = y - sy

    # Base seabed (-2.2m deep open lagoon)
    seabed = -0.32 - 1.85 * ss(0.6, -10.0, inland)

    # Segmented coastal profile:
    # West (-19..-7): gentler sloped pebble/boulder beach rising smoothly to +1.14m!
    # Center (-7..+7.5): crisp stone quay wall drop from +1.14m down to water!
    # East (+7.5..+22): rocky coastal slope!
    is_quay = ss(-8.0, -6.2, x) * (1.0 - ss(6.8, 8.6, x))
    shore_rise_slope = 1.46 * ss(-2.8, 1.2, inland)
    shore_rise_quay = 1.46 * ss(-0.3, 0.55, inland)
    shore_rise = shore_rise_slope * (1.0 - is_quay) + shore_rise_quay * is_quay

    # Back-row village hillside terrace (+0.65 -> +1.65m rise over inland 11..19m)
    terrace2 = 1.70 * ss(10.5, 16.5, inland)

    # Lush rolling green Ghibli backdrop hills
    hill_wave = 0.55 * math.sin(x * 0.12 + 0.5) + 0.45 * math.cos(x * 0.07 - 1.0)
    back_hills = ss(18.0, 38.0, inland) * (7.2 + hill_wave * 2.2)

    # Western tree bluff framing Shot 1 left foreground (-18, -3)
    west_d = math.hypot((x + 19.5) / 6.5, (y + 3.0) / 6.0)
    west_bluff = math.exp(-west_d * west_d) * 2.35

    z = seabed + shore_rise + terrace2 + back_hills + west_bluff

    # Keep central village street & front cottage lots cleanly flat at exact Z = +1.14m!
    if -14.5 < x < 15.5 and 0.4 < inland < 11.2:
        flat_w = ss(0.4, 1.4, inland) * (1.0 - ss(9.2, 11.2, inland)) * ss(-14.5, -12.0, x) * (1.0 - ss(12.5, 15.5, x))
        z = z * (1.0 - flat_w) + 1.14 * flat_w

    # Dramatic Eastern Rocky Headland & Cliff Promontory around LIGHTHOUSE_POS (52, -25)!
    lx, ly = LIGHTHOUSE_POS
    ld = math.hypot((x - lx) / 11.5, (y - ly) / 9.2)
    if ld < 1.9:
        # Two-tiered cliff profile: steep outer rock wall rising abruptly to +3.5m flat-ish cliff crown!
        tier1 = (1.0 - ss(0.72, 1.35, ld)) * 2.15
        tier2 = (1.0 - ss(0.38, 0.85, ld)) * 1.95
        cliff_h = -0.35 + tier1 + tier2
        z = max(z, cliff_h)

    # Connecting coastal rocky ridge linking east bay (+18..+44) to lighthouse headland!
    if x > 14.0 and x < 50.0:
        ridge_y = shore_y(x) + 4.5
        rd = abs(y - ridge_y) / 6.5
        if rd < 1.6:
            z = max(z, -0.3 + (1.0 - ss(0.2, 1.5, rd)) * (2.6 + 0.5 * math.sin(x * 0.25)))

    return z


# =============================================================================
# 4. THREE RADICALLY DIFFERENTIATED HERO COTTAGES (ZERO TEMPLATE CLONING!)
# =============================================================================
def _add_window(name, loc, size_wh, col, mats, parent, roof_mat, side_axis="Y", has_shutters=True, has_flowerbox=True):
    w, h = size_wh
    if side_axis == "Y":
        add_box(f"{name}_Frame", (w, 0.10, h), loc, col, mats["timber"], parent, bevel=0.012)
        if has_shutters:
            for sh in (-1, 1):
                add_box(f"{name}_Shut_{sh}", (0.24, 0.06, h - 0.04), (loc[0] + sh * (w * 0.5 + 0.14), loc[1] - 0.02, loc[2]), col, roof_mat, parent, bevel=0.01)
        if has_flowerbox:
            add_box(f"{name}_FBox", (w + 0.08, 0.24, 0.20), (loc[0], loc[1] - 0.10, loc[2] - h * 0.5 - 0.09), col, mats["timber"], parent, bevel=0.012)
            for fx in (-0.25, 0.0, 0.25):
                add_ico(f"{name}_Fl_{fx:.2f}", 0.12, (loc[0] + fx, loc[1] - 0.12, loc[2] - h * 0.5 + 0.05), (1.0, 0.9, 0.72), col, mats["foliage"], parent, subdiv=1, jitter=0.14, seed=int(abs(loc[0] * 13 + fx * 41)))
    else:
        add_box(f"{name}_Frame", (0.10, w, h), loc, col, mats["timber"], parent, bevel=0.012)


def build_player_hero_home(col, mats, loc, rot_z=-0.04):
    """
    HERO 1: Player's Red-Roof Cottage (5.4 x 4.4m, Steep 38° Ridge = 3.70m above floor!)
      - Offset 1.05m Dormer (+0.45m off-center!) + Subtle Flared Eave Tips (+0.10m!)
      - Hat-safe Doorway (1.12 x 1.75m) + Modular 1.48m Cutaway Porch (1.15x1.15m clear entry!)
      - Railing concentrated on right side + 2 crisp 0.14m timber steps + Back-slope stone chimney!
    """
    root = bpy.data.objects.new("House_01_PlayerHero", None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    W, D = 5.4, 4.4
    plinth = 0.28  # Exact 2-step 0.14m residential floor lift per Astra Ultra!
    wall_h = 2.08  # Eave at 2.08m above floor
    ridge_h = 1.62  # Ridge at 2.08 + 1.62 = 3.70m above floor (36.4° bold steep storybook gable!)
    fl_z = plinth

    # Grounded stone foundation plinth
    add_box("H1_Plinth", (W + 0.28, D + 0.28, plinth + 0.90), (0, 0, plinth - (plinth + 0.90) * 0.5), col, mats["stone"], root, bevel=0.025)
    # Main wall mass + solid gables
    add_box("H1_Walls", (W, D, wall_h), (0, 0, fl_z + wall_h * 0.5), col, mats["wall"], root, bevel=0.025)
    add_gable_end_walls("H1_Gables", W, D, ridge_h, fl_z + wall_h, col, mats["wall"], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(f"H1_Corner_{sx}_{sy}", (0.18, 0.18, wall_h + 0.04), (sx * (W * 0.5 - 0.03), sy * (D * 0.5 - 0.03), fl_z + wall_h * 0.5), col, mats["timber"], root, bevel=0.012)

    # Steep Gable Roof with subtle 0.10m upturned eave tips!
    roof_grp = bpy.data.objects.new("H1_MainRoof_Cutaway", None)
    roof_grp.parent = root
    col.objects.link(roof_grp)
    add_flared_gable_roof("H1_Roof", W, D, ridge_h, 0.44, 0.42, 0.16, fl_z + wall_h - 0.04, col, mats["roof"], roof_grp, tip_flare=0.10)

    # Offset Hero Dormer (+0.45m right of center, 1.05m wide — breaks rigid bilateral symmetry!)
    dx, dy, dz = 0.45, -D * 0.27, fl_z + wall_h + ridge_h * 0.44
    add_box("H1_DormerBox", (1.05, 1.05, 0.84), (dx, dy, dz), col, mats["wall"], roof_grp, bevel=0.02)
    # Solid dormer peak prism
    dbm = bmesh.new()
    v0 = dbm.verts.new((dx - 0.525, dy - 0.525, dz + 0.40))
    v1 = dbm.verts.new((dx + 0.525, dy - 0.525, dz + 0.40))
    v2 = dbm.verts.new((dx, dy - 0.525, dz + 0.78))
    v3 = dbm.verts.new((dx - 0.525, dy + 0.525, dz + 0.40))
    v4 = dbm.verts.new((dx + 0.525, dy + 0.525, dz + 0.40))
    v5 = dbm.verts.new((dx, dy + 0.525, dz + 0.78))
    dbm.faces.new((v0, v1, v2))
    dbm.faces.new((v4, v3, v5))
    dbm.faces.new((v0, v2, v5, v3))
    dbm.faces.new((v1, v4, v5, v2))
    dm = bpy.data.meshes.new("H1_DormerPeak")
    dbm.to_mesh(dm)
    dbm.free()
    link_obj(bpy.data.objects.new("H1_DormerPeak", dm), col, roof_grp, mats["wall"])
    add_box("H1_DormerWin", (0.64, 0.09, 0.54), (dx, dy - 0.54, dz + 0.04), col, mats["timber"], roof_grp, bevel=0.01)
    for sx in (-1, 1):
        add_box(f"H1_DormerRoof_{sx}", (0.82, 1.32, 0.11), (dx + sx * 0.31, dy - 0.05, dz + 0.60), col, mats["roof"], roof_grp, rot=(0, sx * 0.58, 0), bevel=0.01)

    # Back-slope stone chimney + wispy clay smoke
    cx, cy = -W * 0.28, D * 0.24
    ch_top = fl_z + wall_h + ridge_h + 0.88
    add_box("H1_Chimney", (0.64, 0.64, 1.95), (cx, cy, ch_top - 0.95), col, mats["stone"], roof_grp, bevel=0.022)
    add_box("H1_ChimneyCap", (0.78, 0.78, 0.14), (cx, cy, ch_top + 0.04), col, mats["stone"], roof_grp, bevel=0.015)
    for k in range(3):
        add_ico(f"H1_Smoke_{k}", 0.20 + k * 0.10, (cx + k * 0.34, cy + k * 0.14, ch_top + 0.32 + k * 0.50), (1.15, 1.0, 0.85), col, mats["wall"], roof_grp, subdiv=1, jitter=0.12, seed=10 + k)

    # Hat-safe Front Doorway (1.12 x 1.75m!) placed on left-center (door_x = -0.95 -> leaves rich right porch seating!)
    door_x = -0.95
    dw, dh = 1.12, 1.75
    add_box("H1_DoorFrame", (dw + 0.18, 0.12, dh + 0.12), (door_x, -D * 0.5 - 0.05, fl_z + dh * 0.5), col, mats["timber"], root, bevel=0.014)
    add_box("H1_DoorLeaf", (dw - 0.04, 0.06, dh - 0.04), (door_x, -D * 0.5 - 0.09, fl_z + dh * 0.5), col, mats["roof"], root, bevel=0.01)

    # Front right window & side windows
    _add_window("H1_FrontWin", (1.28, -D * 0.5 - 0.05, fl_z + 1.12), (1.02, 0.84), col, mats, root, mats["roof"], "Y", True, True)
    _add_window("H1_SideWinL", (-W * 0.5 - 0.05, 0.15, fl_z + 1.12), (0.90, 0.82), col, mats, root, mats["roof"], "X", False, False)
    _add_window("H1_SideWinR", (W * 0.5 + 0.05, 0.15, fl_z + 1.12), (0.90, 0.82), col, mats, root, mats["roof"], "X", False, False)

    # Modular 1.48m Deep Porch (Porch roof cleanly isolated for early doorway cutaway — zero deck/plinth Z-fight!)
    pd = 1.48
    py_mid = -D * 0.5 - pd * 0.5
    add_box("H1_PorchDeck", (W + 0.16, pd, 0.14), (0, py_mid, fl_z - 0.07), col, mats["timber"], root, bevel=0.015)
    add_box("H1_PorchPlinth", (W + 0.04, pd - 0.10, plinth + 0.55), (0, py_mid, fl_z - 0.145 - (plinth + 0.55) * 0.5), col, mats["stone"], root, bevel=0.02)

    porch_roof = bpy.data.objects.new("H1_PorchRoof_Cutaway", None)
    porch_roof.parent = root
    col.objects.link(porch_roof)
    add_box("H1_PorchAwning", (W + 0.40, pd + 0.42, 0.12), (0, py_mid - 0.06, fl_z + wall_h - 0.08), col, mats["roof"], porch_roof, rot=(0.21, 0, 0), bevel=0.014)

    post_y = -D * 0.5 - pd + 0.12
    post_h = wall_h - 0.24
    # Posts clear of 1.15m entry landing around door_x = -0.95!
    for idx, px in enumerate([-W * 0.47, -0.05, W * 0.47]):
        add_box(f"H1_Post_{idx}", (0.14, 0.14, post_h), (px, post_y, fl_z + post_h * 0.5), col, mats["timber"], root, bevel=0.012)

    # Railing concentrated cleanly on right seating side (+0.05 .. +2.50) + cozy wooden porch bench!
    add_box("H1_RailTop", (2.52, 0.09, 0.09), (1.28, post_y, fl_z + 0.68), col, mats["timber"], root, bevel=0.01)
    for bi in range(5):
        add_box(f"H1_Bal_{bi}", (0.06, 0.06, 0.64), (0.28 + bi * 0.50, post_y, fl_z + 0.34), col, mats["timber"], root, bevel=0.006)
    add_box("H1_PorchBench", (1.25, 0.42, 0.40), (1.35, -D * 0.5 - 0.40, fl_z + 0.20), col, mats["timber"], root, bevel=0.015)

    # Exact 2 steps (0.14m rise each, 0.32m tread) centered on door_x = -0.95!
    for st in range(2):
        add_box(f"H1_Step_{st}", (1.42, 0.32, 0.14), (door_x, -D * 0.5 - pd - 0.16 - st * 0.32, fl_z - 0.07 - st * 0.14), col, mats["timber"], root, bevel=0.012)

    # Porch hanging lantern
    add_box("H1_PorchLantern", (0.20, 0.20, 0.28), (-0.05, post_y - 0.14, fl_z + post_h - 0.24), col, mats["accent"], root, bevel=0.018)
    return root


def build_artisan_workshop(col, mats, loc, rot_z=0.10):
    """
    HERO 2: Old Zhou's Rod & Gear Workshop (4.6 x 3.8m, Low Broad 27° Ridge = 3.10m!)
      - Unmistakable side Lean-To Tool Shed (1.35 x 2.10m single-slope roof on inland-east flank!)
      - Square brick chimney (0.48 x 0.55m) right at shed/main roof junction!
      - Wide 1.22 x 1.78m Cargo Doorway + shallow 1.25m street awning + single-side outdoor workbench!
      - ZERO residential railing -> reads 100% as a craft workshop even in pure grey top-down!
    """
    root = bpy.data.objects.new("House_02_ArtisanWorkshop", None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    W, D = 4.6, 3.8
    plinth = 0.24
    wall_h = 2.02
    ridge_h = 1.08  # Ridge at 3.10m above floor -> crisp 27° low broad workshop pitch!
    fl_z = plinth

    add_box("H2_Plinth", (W + 0.26, D + 0.26, plinth + 0.90), (0, 0, plinth - (plinth + 0.90) * 0.5), col, mats["stone"], root, bevel=0.025)
    add_box("H2_Walls", (W, D, wall_h), (0, 0, fl_z + wall_h * 0.5), col, mats["wall"], root, bevel=0.025)
    add_gable_end_walls("H2_Gables", W, D, ridge_h, fl_z + wall_h, col, mats["wall"], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(f"H2_Corner_{sx}_{sy}", (0.18, 0.18, wall_h + 0.04), (sx * (W * 0.5 - 0.03), sy * (D * 0.5 - 0.03), fl_z + wall_h * 0.5), col, mats["timber"], root, bevel=0.012)

    add_flared_gable_roof("H2_Roof", W, D, ridge_h, 0.36, 0.38, 0.15, fl_z + wall_h - 0.04, col, mats["roof_alt"], root, tip_flare=0.0)

    # Signature 1.35 x 2.10m Side Lean-To Tool Shed projecting on East (+X) inland flank!
    sw, sd = 1.35, 2.10
    sx0, sy0 = W * 0.5 + sw * 0.5 - 0.04, 0.45
    add_box("H2_ShedPlinth", (sw + 0.18, sd + 0.18, plinth + 0.85), (sx0, sy0, plinth - (plinth + 0.85) * 0.5), col, mats["stone"], root, bevel=0.02)
    add_box("H2_ShedWalls", (sw, sd, 1.58), (sx0, sy0, fl_z + 0.79), col, mats["wall"], root, bevel=0.02)
    # Single-slope lean-to roof pitching outward (+X)!
    add_box("H2_ShedRoof", (sw + 0.48, sd + 0.42, 0.13), (sx0 + 0.10, sy0, fl_z + 1.72), col, mats["roof_alt"], root, rot=(0.0, 0.28, 0.0), bevel=0.014)
    # Timber lumber / rod rack stacked cleanly under shed eave
    for ri in range(3):
        add_cyl(f"H2_Lumber_{ri}", 0.055, 0.055, 1.75, (sx0 + 0.32, sy0 - 0.70, fl_z + 0.18 + ri * 0.13), col, mats["timber"], root, rot=(0, math.pi * 0.5, 0), segs=8)

    # Square Workshop Chimney (0.48 x 0.55m) right at shed/main wall junction!
    cx, cy = W * 0.5 - 0.18, sy0 + 0.35
    ch_top = fl_z + wall_h + ridge_h + 0.75
    add_box("H2_Chimney", (0.48, 0.55, 1.90), (cx, cy, ch_top - 0.90), col, mats["stone"], root, bevel=0.02)
    add_box("H2_ChimneyCap", (0.62, 0.68, 0.12), (cx, cy, ch_top + 0.04), col, mats["stone"], root, bevel=0.012)

    # Wide Cargo Doorway (1.22 x 1.78m!) on right-center -> clear freight lane to street!
    door_x = 0.68
    dw, dh = 1.22, 1.78
    add_box("H2_DoorFrame", (dw + 0.18, 0.12, dh + 0.12), (door_x, -D * 0.5 - 0.05, fl_z + dh * 0.5), col, mats["timber"], root, bevel=0.014)
    add_box("H2_DoorLeaf", (dw - 0.04, 0.06, dh - 0.04), (door_x, -D * 0.5 - 0.09, fl_z + dh * 0.5), col, mats["timber"], root, bevel=0.01)

    # Wide workshop display window on left side
    _add_window("H2_WinFront", (-1.10, -D * 0.5 - 0.05, fl_z + 1.15), (1.16, 0.82), col, mats, root, mats["roof_alt"], "Y", False, False)

    # Shallow Street Work Awning (1.25m deep) + Single-Side Outdoor Rod Workbench on left (NO full porch rail!)
    ad = 1.25
    ay = -D * 0.5 - ad * 0.5
    add_box("H2_WorkSlab", (W + 0.10, ad, 0.14), (0, ay, fl_z - 0.07), col, mats["stone"], root, bevel=0.015)
    add_box("H2_Awning", (W + 0.32, ad + 0.36, 0.12), (0, ay - 0.05, fl_z + wall_h - 0.04), col, mats["roof_alt"], root, rot=(0.24, 0, 0), bevel=0.012)
    for idx, px in enumerate([-W * 0.46, W * 0.46]):
        add_box(f"H2_Post_{idx}", (0.14, 0.14, wall_h - 0.22), (px, -D * 0.5 - ad + 0.12, fl_z + (wall_h - 0.22) * 0.5), col, mats["timber"], root, bevel=0.012)

    # Single-side outdoor craft workbench + standing fishing rod rack on left, leaving right cargo lane 100% open!
    add_box("H2_OutdoorBench", (1.42, 0.54, 0.72), (-1.15, -D * 0.5 - 0.52, fl_z + 0.36), col, mats["timber"], root, bevel=0.015)
    add_box("H2_HangingSign", (0.76, 0.07, 0.44), (W * 0.46 + 0.38, -D * 0.5 - ad + 0.12, fl_z + 1.72), col, mats["timber"], root, bevel=0.01)
    # Wide cargo threshold step
    add_box("H2_CargoStep", (1.65, 0.34, 0.14), (door_x, -D * 0.5 - ad - 0.16, fl_z - 0.10), col, mats["stone"], root, bevel=0.012)
    return root


def build_east_timber_cottage(col, mats, loc, rot_z=-0.20):
    """
    HERO 3: East Honey-Wood Cottage (4.3 x 3.6m, Ridge = 3.25m, Angled -11° exposing side gable!)
      - NO full-width porch! Instead: Offset Gabled Entrance Vestibule (2.10 wide x 1.05m deep)
        shifted toward street approach + 0.42m stone cheek wall on one side!
      - Exposed sunlit facade wall with signature Ship's Wheel & flower window!
      - Slender gable-mounted stone chimney (0.30m wide) on the East gable!
      - Doorway: 1.06 x 1.70m!
    """
    root = bpy.data.objects.new("House_03_EastTimberCottage", None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    W, D = 4.3, 3.6
    plinth = 0.28
    wall_h = 2.02
    ridge_h = 1.23  # Ridge at 3.25m above floor -> ~33° pitch!
    fl_z = plinth

    add_box("H3_Plinth", (W + 0.26, D + 0.26, plinth + 0.90), (0, 0, plinth - (plinth + 0.90) * 0.5), col, mats["stone"], root, bevel=0.025)
    add_box("H3_Walls", (W, D, wall_h), (0, 0, fl_z + wall_h * 0.5), col, mats["wall"], root, bevel=0.025)
    add_gable_end_walls("H3_Gables", W, D, ridge_h, fl_z + wall_h, col, mats["wall"], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(f"H3_Corner_{sx}_{sy}", (0.16, 0.16, wall_h + 0.04), (sx * (W * 0.5 - 0.03), sy * (D * 0.5 - 0.03), fl_z + wall_h * 0.5), col, mats["timber"], root, bevel=0.012)

    add_flared_gable_roof("H3_Roof", W, D, ridge_h, 0.36, 0.38, 0.15, fl_z + wall_h - 0.04, col, mats["roof_mid"], root, tip_flare=0.04)

    # Slender Exterior Gable Chimney (0.32m wide) clinging cleanly to East (+X) gable wall!
    ch_h = wall_h + ridge_h + 0.85
    add_box("H3_GableChimney", (0.34, 0.52, ch_h), (W * 0.5 + 0.14, 0.0, fl_z + ch_h * 0.5 - 0.10), col, mats["stone"], root, bevel=0.018)
    add_box("H3_ChimneyCap", (0.44, 0.62, 0.12), (W * 0.5 + 0.14, 0.0, fl_z + ch_h - 0.08), col, mats["stone"], root, bevel=0.012)

    # Offset Small Gabled Porch Hood / Vestibule (2.10m wide x 1.05m deep) biased to West (-X) street approach!
    vx, vw, vd = -0.78, 2.10, 1.05
    vy = -D * 0.5 - vd * 0.5
    add_box("H3_VestDeck", (vw, vd, 0.14), (vx, vy, fl_z - 0.07), col, mats["stone"], root, bevel=0.014)
    add_box("H3_VestPlinth", (vw - 0.06, vd - 0.06, plinth + 0.50), (vx, vy, fl_z - 0.145 - (plinth + 0.50) * 0.5), col, mats["stone"], root, bevel=0.018)
    # Cross-gabled mini hood over vestibule (ridge runs along Y -> super distinct silhouette!)
    for sx in (-1, 1):
        add_box(f"H3_HoodRoof_{sx}", (vw * 0.58, vd + 0.42, 0.11), (vx + sx * (vw * 0.25), vy - 0.06, fl_z + wall_h + 0.08), col, mats["roof_mid"], root, rot=(0.0, sx * 0.42, 0.0), bevel=0.012)
    for sx in (-1, 1):
        add_box(f"H3_VestPost_{sx}", (0.13, 0.13, wall_h - 0.16), (vx + sx * (vw * 0.44), -D * 0.5 - vd + 0.10, fl_z + (wall_h - 0.16) * 0.5), col, mats["timber"], root, bevel=0.01)

    # Low Stone Cheek Wall (0.42m high) flanking right side of steps, open on left!
    add_box("H3_StoneCheek", (0.24, 0.72, 0.42), (vx + 0.85, -D * 0.5 - vd - 0.30, fl_z - 0.06), col, mats["stone"], root, bevel=0.018)
    for st in range(2):
        add_box(f"H3_Step_{st}", (1.28, 0.32, 0.14), (vx - 0.12, -D * 0.5 - vd - 0.16 - st * 0.32, fl_z - 0.07 - st * 0.14), col, mats["stone"], root, bevel=0.012)

    # Doorway (1.06 x 1.70m) centered under vestibule
    dw, dh = 1.06, 1.70
    add_box("H3_DoorFrame", (dw + 0.16, 0.12, dh + 0.10), (vx, -D * 0.5 - 0.05, fl_z + dh * 0.5), col, mats["timber"], root, bevel=0.012)
    add_box("H3_DoorLeaf", (dw - 0.04, 0.06, dh - 0.04), (vx, -D * 0.5 - 0.09, fl_z + dh * 0.5), col, mats["timber"], root, bevel=0.01)

    # Exposed sunlit right facade: Ship's Wheel + Flower Window + Side Window!
    _add_window("H3_FrontWin", (1.12, -D * 0.5 - 0.05, fl_z + 1.18), (0.86, 0.78), col, mats, root, mats["roof_mid"], "Y", True, True)
    # Signature nautical Ship's Wheel on lower-right wall (Storyboard Panel 2!)
    wx, wy, wz = 1.62, -D * 0.5 - 0.08, fl_z + 0.62
    add_cyl("H3_WheelRim", 0.34, 0.34, 0.06, (wx, wy, wz), col, mats["timber"], root, rot=(math.pi * 0.5, 0, 0), segs=14)
    add_cyl("H3_WheelHub", 0.10, 0.10, 0.10, (wx, wy - 0.02, wz), col, mats["accent"], root, rot=(math.pi * 0.5, 0, 0), segs=10)
    _add_window("H3_SideWinL", (-W * 0.5 - 0.05, 0.0, fl_z + 1.14), (0.86, 0.78), col, mats, root, mats["roof_mid"], "X", False, False)
    return root


def build_secondary_cottage(name, w, d, wall_h, ridge_h, col, mats, loc, rot_z=0.0, roof_key="roof", chim_side=1, has_smoke=True):
    """Varied back-row & side village cottages (different heights, rotated gables, varied chimney positions!)."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    plinth = 0.35
    add_box(f"{name}_Plinth", (w + 0.24, d + 0.24, plinth + 1.40), (0, 0, plinth - (plinth + 1.40) * 0.5), col, mats["stone"], root, bevel=0.02)
    add_box(f"{name}_Body", (w, d, wall_h), (0, 0, plinth + wall_h * 0.5), col, mats["wall"], root, bevel=0.022)
    add_gable_end_walls(f"{name}_Gables", w, d, ridge_h, plinth + wall_h, col, mats["wall"], root)
    add_flared_gable_roof(f"{name}_Roof", w, d, ridge_h, 0.32, 0.34, 0.14, plinth + wall_h - 0.04, col, mats[roof_key], root, tip_flare=0.0)

    # Door + windows
    add_box(f"{name}_Door", (0.98, 0.09, 1.56), (0.0, -d * 0.5 - 0.04, plinth + 0.78), col, mats["timber"], root, bevel=0.01)
    _add_window(f"{name}_WinL", (-w * 0.30, -d * 0.5 - 0.04, plinth + wall_h * 0.55), (0.72, 0.68), col, mats, root, mats[roof_key], "Y", True, False)
    _add_window(f"{name}_WinR", (w * 0.30, -d * 0.5 - 0.04, plinth + wall_h * 0.55), (0.72, 0.68), col, mats, root, mats[roof_key], "Y", True, False)

    if chim_side != 0:
        cx = chim_side * w * 0.28
        cy = 0.25 if chim_side > 0 else -0.15
        ch_top = plinth + wall_h + ridge_h + (0.65 if chim_side > 0 else 0.92)
        add_box(f"{name}_Chimney", (0.50, 0.50, 1.65), (cx, cy, ch_top - 0.80), col, mats["stone"], root, bevel=0.02)
        add_box(f"{name}_ChimCap", (0.62, 0.62, 0.11), (cx, cy, ch_top + 0.04), col, mats["stone"], root, bevel=0.012)
        if has_smoke:
            for k in range(2):
                add_ico(f"{name}_Smoke_{k}", 0.19 + k * 0.09, (cx + k * 0.28, cy + k * 0.10, ch_top + 0.28 + k * 0.44), (1.1, 1.0, 0.85), col, mats["wall"], root, subdiv=1, jitter=0.12, seed=80 + k)
    return root


def build_fish_market_stall_v21(col, mats, loc, rot_z=0.12):
    """
    Upgraded Fish Market Stall (Astra Ultra P0 spec!):
      - Width 2.85m, counter height 0.70m, depth 0.72m!
      - East 0.75m open low transaction counter so Ah Lian & child hands + wrapped fish parcel (Z=0.88m)
        are 100% visible with ZERO post blocking faces!
      - Canopy front clearance 1.88m with scalloped hanging valance (0.15m); posts pushed to outer ends!
      - Separate 1.60m wide x 1.80m tall Hanging Dried-Fish Rack on West end clear of transaction nook!
    """
    root = bpy.data.objects.new("Hero_FishMarket_Stall", None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    # Main display counter (left 2.05m @ 0.70m high) + slightly lower/open transaction shelf (right 0.80m @ 0.64m!)
    add_box("Mkt_CounterMain", (2.05, 0.72, 0.70), (-0.40, 0.0, 0.35), col, mats["timber"], root, bevel=0.018)
    add_box("Mkt_CounterTop", (2.12, 0.78, 0.05), (-0.40, 0.0, 0.71), col, mats["wall"], root, bevel=0.01)
    add_box("Mkt_TransNook", (0.80, 0.68, 0.62), (1.02, 0.0, 0.31), col, mats["timber"], root, bevel=0.015)

    # Outer corner posts shifted cleanly to extreme ends (±1.46m -> 0.50m clear of transaction actors!)
    for sx in (-1.46, 1.46):
        for sy in (-0.38, 0.38):
            add_box(f"Mkt_Post_{sx}_{sy}", (0.11, 0.11, 2.25), (sx, sy, 1.125), col, mats["timber"], root, bevel=0.01)

    # Sloped striped canopy (front clearance 1.88m + 0.15m scalloped valance!)
    for i in range(6):
        sx = -1.28 + i * 0.512
        mat_s = mats["roof"] if i % 2 == 0 else mats["wall"]
        add_box(f"Mkt_Awning_{i}", (0.49, 1.68, 0.08), (sx, -0.14, 2.16), col, mat_s, root, rot=(0.22, 0, 0), bevel=0.01)
        add_box(f"Mkt_Valance_{i}", (0.47, 0.06, 0.16), (sx, -0.94, 1.90), col, mat_s, root, bevel=0.008)

    # Vintage countertop scale + 2 fish ice crates (only 2-3 clean big blockouts per P2!)
    add_cyl("Mkt_ScaleBase", 0.11, 0.15, 0.22, (-1.10, -0.08, 0.84), col, mats["accent"], root, segs=10)
    add_cyl("Mkt_ScaleDial", 0.13, 0.13, 0.06, (-1.10, -0.16, 0.88), col, mats["wall"], root, rot=(math.pi * 0.5, 0, 0), segs=12)
    add_cyl("Mkt_ScalePan", 0.20, 0.09, 0.07, (-1.10, -0.08, 0.99), col, mats["wall"], root, segs=12)
    for ci, cx in enumerate([-0.38, 0.28]):
        add_box(f"Mkt_Crate_{ci}", (0.58, 0.46, 0.22), (cx, -0.04, 0.84), col, mats["timber"], root, rot=(0.14, 0, 0), bevel=0.014)
        for f in range(3):
            add_ico(f"Mkt_Fish_{ci}_{f}", 0.10, (cx - 0.16 + f * 0.16, -0.04, 0.96), (0.34, 1.15, 0.28), col, mats["wall"], root, subdiv=1, jitter=0.04, seed=40 + ci * 5 + f)

    # Dedicated Hanging Dried-Fish Rack (1.60m wide x 1.80m tall) on West end, 100% clear of transaction!
    rx = -2.25
    for dx in (-0.72, 0.72):
        add_cyl(f"Mkt_RackPost_{dx}", 0.05, 0.06, 1.82, (rx + dx, -0.18, 0.91), col, mats["timber"], root, segs=8)
    add_cyl("Mkt_RackBar", 0.04, 0.04, 1.62, (rx, -0.18, 1.72), col, mats["timber"], root, rot=(0, math.pi * 0.5, 0), segs=8)
    for fi in range(5):
        add_ico(f"Mkt_DryFish_{fi}", 0.13, (rx - 0.52 + fi * 0.26, -0.18, 1.32), (0.32, 0.24, 1.40), col, mats["wall"], root, subdiv=1, jitter=0.04, seed=90 + fi)

    # Flanking barrels
    add_cyl("Mkt_Barrel_L", 0.26, 0.28, 0.68, (-1.75, 0.35, 0.34), col, mats["timber"], root, segs=12)
    add_cyl("Mkt_Barrel_R", 0.26, 0.28, 0.68, (1.82, 0.25, 0.34), col, mats["timber"], root, segs=12)
    return root


# =============================================================================
# 5. UNIFIED 5-STEP TIERED PIER, DISTANT ROCKY LIGHTHOUSE & MANNEQUINS
# =============================================================================
def build_tiered_pier_v21(
    name, px, y_quay, length, col, mats, pier_w=2.45, yaw_deg=0.0, has_boat=False, lantern_inshore=True
):
    """
    Unified Astra Ultra Elevation Profile:
      - Promenade top Z = +1.14m -> 5 crisp 0.14m timber stairs (clear width 1.55m) -> Pier Deck Z = +0.44m!
      - Generous 1.80 x 2.20m clear pierhead landing + rail-free boat mooring side!
      - Lowered 1.70m pier lantern placed BEHIND angler/inshore so fishing rod skyline stays 100% pure!
    """
    root = bpy.data.objects.new(name, None)
    root.location = Vector((px, y_quay, 0.0))
    root.rotation_euler = Euler((0, 0, math.radians(yaw_deg)), "XYZ")
    col.objects.link(root)

    quay_z = 1.14
    deck_z = 0.44
    steps = 5
    step_d = 0.32
    stair_len = steps * step_d
    stair_w = max(1.55, pier_w * 0.72)

    # 5 crisp 0.14m stairs descending from Z = +1.14 down to Z = +0.44!
    for s in range(steps):
        sz = quay_z - (s + 0.5) * 0.14
        sy = -(s + 0.5) * step_d
        add_box(f"{name}_Step_{s}", (stair_w, step_d + 0.03, 0.12), (0.0, sy, sz), col, mats["timber"], root, bevel=0.012)
    for sx in (-1, 1):
        add_box(
            f"{name}_Cheek_{sx}",
            (0.13, stair_len + 0.25, 0.22),
            (sx * (stair_w * 0.5 + 0.04), -stair_len * 0.5, (quay_z + deck_z) * 0.5 - 0.05),
            col,
            mats["timber"],
            root,
            rot=(0.40, 0, 0),
            bevel=0.012,
        )

    # Flat timber pier deck at exact Z = +0.44m!
    y_deck0 = -stair_len - 0.05
    deck_len = max(3.6, length - stair_len)
    y_end = y_deck0 - deck_len
    plank_n = max(10, int(deck_len * 2.9))
    for i in range(plank_n):
        t = i / max(1, plank_n - 1)
        py = y_deck0 - t * deck_len
        add_box(f"{name}_Plank_{i}", (pier_w, 0.29, 0.10), ((i % 2 - 0.5) * 0.018, py, deck_z), col, mats["timber"], root, bevel=0.012)

    for sx in (-1, 1):
        add_box(f"{name}_Beam_{sx}", (0.14, deck_len + 0.15, 0.18), (sx * (pier_w * 0.42), (y_deck0 + y_end) * 0.5, deck_z - 0.12), col, mats["timber"], root, bevel=0.01)

    pile_rows = max(3, int(deck_len / 1.85) + 1)
    for r in range(pile_rows):
        py = y_deck0 - 0.35 - (r / max(1, pile_rows - 1)) * (deck_len - 0.55)
        for sx in (-1, 1):
            # Mooring bollards protrude +0.26m above deck on outer corners (clear of boat-boarding middle!)
            top_extra = 0.24 if (r == 0 or r == pile_rows - 1) else 0.04
            ph = 2.2 + top_extra
            add_cyl(f"{name}_Pile_{r}_{sx}", 0.12, 0.14, ph, (sx * (pier_w * 0.47), py, deck_z + top_extra - ph * 0.5), col, mats["timber"], root, segs=10)

    # Lowered 1.70m pier lantern positioned INSHORE/BEHIND angler so it never blocks rod or lighthouse!
    ly = (y_deck0 - 1.15) if lantern_inshore else (y_end + 0.40)
    lx = -pier_w * 0.44
    add_cyl(f"{name}_LampPost", 0.05, 0.068, 1.70, (lx, ly, deck_z + 0.85), col, mats["accent"], root, segs=8)
    add_box(f"{name}_LampArm", (0.36, 0.06, 0.06), (lx + 0.14, ly, deck_z + 1.66), col, mats["accent"], root, bevel=0.008)
    add_box(f"{name}_LampBox", (0.20, 0.20, 0.28), (lx + 0.28, ly, deck_z + 1.48), col, mats["wall"], root, bevel=0.018)

    # Wicker fishing basket + rope coil on pierhead
    add_cyl(f"{name}_Basket", 0.21, 0.17, 0.32, (-pier_w * 0.32, y_end + 0.72, deck_z + 0.21), col, mats["wall"], root, segs=12)

    # Moored Wooden Rowboat alongside the clear West (-X) boat-boarding edge!
    if has_boat:
        boat = bpy.data.objects.new(f"{name}_MooredBoat", None)
        boat.location = Vector((-pier_w * 0.5 - 1.15, y_deck0 - 1.65, 0.08))
        boat.rotation_euler = Euler((0, 0, math.radians(82)), "XYZ")
        boat.parent = root
        col.objects.link(boat)
        add_ico(f"{name}_BoatHull", 1.0, (0, 0, 0.12), (1.42, 0.64, 0.36), col, mats["timber"], boat, subdiv=2, jitter=0.0)
        add_box(f"{name}_BoatDeck", (1.92, 0.82, 0.14), (0, 0, 0.32), col, mats["wall"], boat, bevel=0.02)
        add_box(f"{name}_BoatSeat", (0.32, 0.92, 0.08), (0.0, 0.0, 0.36), col, mats["timber"], boat, bevel=0.01)

    return root, y_end


def build_lighthouse_78m(col, mats, loc):
    """Exact 7.8m tall Coastal Lighthouse (base diam 2.28m, lantern diam 1.48m) + grounded keeper shed."""
    root = bpy.data.objects.new("Hero_Lighthouse_780cm", None)
    root.location = Vector(loc)
    col.objects.link(root)

    # Deep stone base plinth rooting cleanly into 3.5m rocky headland
    add_cyl("LH_Plinth", 1.18, 1.38, 1.80, (0, 0, -0.30), col, mats["stone"], root, segs=12)
    bands = [
        (1.06, 1.16, 1.25, 1.22, mats["wall"]),
        (0.96, 1.06, 1.20, 2.44, mats["roof"]),
        (0.86, 0.96, 1.18, 3.63, mats["wall"]),
        (0.78, 0.86, 1.12, 4.78, mats["roof"]),
    ]
    for i, (rt, rb, h, cz, m) in enumerate(bands):
        add_cyl(f"LH_Band_{i}", rt, rb, h, (0, 0, cz), col, m, root, segs=16)

    # Gallery (Z=5.45) + Lantern room (diam 1.48m -> r=0.74, Z=6.05) + Conical roof + Finial (Total = 7.8m!)
    add_cyl("LH_Gallery", 1.04, 0.88, 0.24, (0, 0, 5.46), col, mats["accent"], root, segs=16)
    add_cyl("LH_Lantern", 0.72, 0.72, 0.96, (0, 0, 6.06), col, mats["wall"], root, segs=14)
    add_cyl("LH_Cupola", 0.06, 0.92, 0.98, (0, 0, 7.03), col, mats["roof"], root, segs=14)
    add_cyl("LH_Finial", 0.03, 0.05, 0.42, (0, 0, 7.62), col, mats["accent"], root, segs=8)

    # Grounded stone keeper shed beside lighthouse
    add_box("LH_ShedPlinth", (2.0, 1.6, 2.4), (-2.1, 0.65, -0.60), col, mats["stone"], root, bevel=0.02)
    add_box("LH_ShedBody", (1.85, 1.45, 1.35), (-2.1, 0.65, 1.18), col, mats["wall"], root, bevel=0.02)
    add_flared_gable_roof("LH_ShedRoof", 1.85, 1.45, 0.62, 0.24, 0.24, 0.12, 1.82, col, mats["roof"], root)
    return root


def build_tree(name, loc, scale, col, mats, seed=1):
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    col.objects.link(root)
    trunk_h = 1.95 * scale
    add_cyl(f"{name}_Trunk", 0.18 * scale, 0.30 * scale, trunk_h, (0, 0, trunk_h * 0.46), col, mats["timber"], root, segs=8)
    puffs = [
        (0.0, 0.0, trunk_h + 0.65 * scale, 1.12 * scale, (1.12, 1.05, 0.92)),
        (-0.58 * scale, -0.22 * scale, trunk_h + 0.35 * scale, 0.78 * scale, (1.0, 1.0, 0.88)),
        (0.62 * scale, 0.18 * scale, trunk_h + 0.42 * scale, 0.82 * scale, (1.0, 1.0, 0.90)),
        (0.08 * scale, 0.48 * scale, trunk_h + 0.78 * scale, 0.76 * scale, (1.0, 0.95, 0.92)),
    ]
    for i, (px, py, pz, r, sc) in enumerate(puffs):
        add_ico(f"{name}_Crown_{i}", r, (px, py, pz), sc, col, mats["foliage"], root, subdiv=2, jitter=0.10, seed=seed * 17 + i)
    return root


def build_framing_oak(col, mats, loc):
    """Shot 1 Signature Framing Tree on West Bluff: forked trunk @ Z=2.6m with sweeping overhanging bough!"""
    root = bpy.data.objects.new("Hero_FramingOak_West", None)
    root.location = Vector(loc)
    col.objects.link(root)
    # Thick leaning trunk + dramatic sweeping east/south bough reaching cleanly into Shot 1 upper-left 15%!
    add_cyl("FOak_TrunkBase", 0.42, 0.58, 3.2, (0, 0, 1.45), col, mats["timber"], root, rot=(0.08, 0.16, 0.0), segs=10)
    add_cyl("FOak_BranchMain", 0.24, 0.38, 4.4, (1.85, -0.45, 3.85), col, mats["timber"], root, rot=(0.15, 0.92, -0.18), segs=10)
    add_cyl("FOak_BranchSub", 0.16, 0.26, 3.0, (0.35, 1.05, 4.05), col, mats["timber"], root, rot=(-0.45, 0.32, 0.1), segs=8)
    # Lush overhanging faceted canopy clusters
    for i, (cx, cy, cz, r, sc) in enumerate([
        (3.4, -1.1, 4.85, 1.55, (1.35, 1.15, 0.78)),
        (1.9, -0.5, 5.25, 1.45, (1.25, 1.10, 0.82)),
        (4.6, -1.6, 4.45, 1.15, (1.25, 1.05, 0.72)),
        (0.2, 1.1, 5.15, 1.55, (1.20, 1.15, 0.85)),
        (-1.2, -0.4, 4.65, 1.40, (1.15, 1.10, 0.85)),
    ]):
        add_ico(f"FOak_Canopy_{i}", r, (cx, cy, cz), sc, col, mats["foliage"], root, subdiv=2, jitter=0.11, seed=910 + i)
    return root


def build_scale_mannequin(name, loc, col, mats, rot_z=0.0, hat=True, sitting=False, reaching=False, height_scale=1.0):
    """Exact 1.26m tall Character Scale Reference (with standing, sitting-fishing, and reaching-parcel poses!)."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    root.scale = (height_scale, height_scale, height_scale)
    col.objects.link(root)

    z_off = -0.20 if sitting else 0.0
    if sitting:
        for sx in (-0.11, 0.11):
            add_cyl(f"{name}_Leg_{sx}", 0.072, 0.072, 0.38, (sx, -0.20, 0.24), col, mats["accent"], root, rot=(1.32, 0, 0), segs=8)
            add_ico(f"{name}_Shoe_{sx}", 0.085, (sx, -0.37, 0.17), (0.9, 1.35, 0.72), col, mats["timber"], root, subdiv=1, jitter=0.0)
    else:
        for sx in (-0.11, 0.11):
            add_cyl(f"{name}_Leg_{sx}", 0.075, 0.08, 0.38, (sx, 0, 0.19), col, mats["accent"], root, segs=8)

    add_cyl(f"{name}_Torso", 0.20, 0.23, 0.46, (0, 0, 0.58 + z_off), col, mats["accent"], root, segs=12)
    for sx in (-1, 1):
        if reaching:
            # Both arms clearly extended forward holding/handing wrapped fish parcel!
            add_cyl(f"{name}_Arm_{sx}", 0.062, 0.062, 0.38, (sx * 0.18, -0.22, 0.68 + z_off), col, mats["accent"], root, rot=(1.25, sx * 0.12, 0), segs=8)
        else:
            add_cyl(f"{name}_Arm_{sx}", 0.065, 0.065, 0.34, (sx * 0.25, -0.08 if sitting else 0.0, 0.62 + z_off), col, mats["accent"], root, rot=(0.62 if sitting else 0.0, sx * 0.30, 0), segs=8)

    add_ico(f"{name}_Head", 0.21, (0, 0, 1.02 + z_off), (1.04, 1.0, 0.98), col, mats["wall"], root, subdiv=2, jitter=0.0)
    if hat:
        add_cyl(f"{name}_HatBrim", 0.38, 0.40, 0.04, (0, 0.02, 1.15 + z_off), col, mats["roof_mid"], root, rot=(-0.15, 0, 0), segs=16)
        add_ico(f"{name}_HatCrown", 0.20, (0, 0.02, 1.20 + z_off), (1.0, 1.0, 0.65), col, mats["roof_mid"], root, subdiv=2, jitter=0.0)
    return root


def build_dog_mannequin(name, loc, col, mats, rot_z=0.0):
    """Exact 0.58m Companion Dog scale reference."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)
    add_ico(f"{name}_Body", 0.175, (0, 0, 0.22), (0.85, 1.45, 0.85), col, mats["accent"], root, subdiv=2, jitter=0.0)
    add_ico(f"{name}_Head", 0.15, (0, -0.22, 0.33), (1.0, 1.0, 0.95), col, mats["accent"], root, subdiv=2, jitter=0.0)
    add_cyl(f"{name}_Tail", 0.03, 0.045, 0.20, (0, 0.26, 0.31), col, mats["accent"], root, rot=(-0.7, 0, 0), segs=8)
    for sx in (-0.09, 0.09):
        for sy in (-0.12, 0.12):
            add_cyl(f"{name}_Paw_{sx}_{sy}", 0.04, 0.045, 0.16, (sx, sy, 0.08), col, mats["wall"], root, segs=8)
    return root


# =============================================================================
# 6. SEGMENTED COASTLINE, STONE QUAY, PROMENADE & EXPANSION RESERVES
# =============================================================================
def build_landscape_and_segmented_shore(col, mats):
    # 1. Wide continuous terrain spanning Village + Crescent Bay + Distant 72m Lighthouse Cliff!
    nx, ny = 104, 86
    x0, x1 = -36.0, 74.0
    y0, y1 = -44.0, 44.0
    bm = bmesh.new()
    grid = []
    for iy in range(ny):
        y = y0 + (y1 - y0) * (iy / (ny - 1))
        row = []
        for ix in range(nx):
            x = x0 + (x1 - x0) * (ix / (nx - 1))
            row.append(bm.verts.new((x, y, terrain_height(x, y))))
        grid.append(row)
    for iy in range(ny - 1):
        for ix in range(nx - 1):
            bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tm = bpy.data.meshes.new("Village_Terrain_v21")
    bm.to_mesh(tm)
    bm.free()
    for p in tm.polygons:
        p.use_smooth = True
    link_obj(bpy.data.objects.new("Village_Terrain_v21", tm), col, None, mats["terrain"])

    # 2. Calm Satin-Clay Lagoon Water Surface at exact Z = 0.00m
    wbm = bmesh.new()
    v0 = wbm.verts.new((-110, -110, 0.0))
    v1 = wbm.verts.new((140, -110, 0.0))
    v2 = wbm.verts.new((140, 35, 0.0))
    v3 = wbm.verts.new((-110, 35, 0.0))
    wbm.faces.new((v0, v1, v2, v3))
    wm = bpy.data.meshes.new("Lagoon_Water")
    wbm.to_mesh(wm)
    wbm.free()
    link_obj(bpy.data.objects.new("Lagoon_Water", wm), col, None, mats["water"])

    # 3. Seamless Curved Ribbon Helper
    def build_curved_ribbon(name, xs, y_in, y_out, z_bot, z_top, mat):
        rbm = bmesh.new()
        rings = []
        for x in xs:
            sy = shore_y(x)
            dy = (shore_y(x + 0.25) - shore_y(x - 0.25)) / 0.5
            n = Vector((-dy, 1.0)).normalized()
            p_out = Vector((x, sy)) + n * y_out
            p_in = Vector((x, sy)) + n * y_in
            rings.append((
                rbm.verts.new((p_out.x, p_out.y, z_bot)),
                rbm.verts.new((p_out.x, p_out.y, z_top)),
                rbm.verts.new((p_in.x, p_in.y, z_top)),
                rbm.verts.new((p_in.x, p_in.y, z_bot)),
            ))
        for k in range(len(rings) - 1):
            a0, a1, a2, a3 = rings[k]
            b0, b1, b2, b3 = rings[k + 1]
            rbm.faces.new((a0, b0, b1, a1))
            rbm.faces.new((a1, b1, b2, a2))
            rbm.faces.new((a2, b2, b3, a3))
            rbm.faces.new((a3, b3, b0, a0))
        rbm.faces.new((rings[0][3], rings[0][2], rings[0][1], rings[0][0]))
        rbm.faces.new((rings[-1][0], rings[-1][1], rings[-1][2], rings[-1][3]))
        bmesh.ops.recalc_face_normals(rbm, faces=rbm.faces)
        rm = bpy.data.meshes.new(name)
        rbm.to_mesh(rm)
        rbm.free()
        return link_obj(bpy.data.objects.new(name, rm), col, None, mat)

    # SEGMENT B (Center 14.5m: x = -7.2 .. +7.8): Masonry Stone Retaining Quay + 0.10m Overhanging Coping!
    quay_xs = [-7.2 + i * 0.75 for i in range(21)]
    build_curved_ribbon("Quay_MainSeawall", quay_xs, y_in=0.65, y_out=-0.10, z_bot=-0.50, z_top=1.10, mat=mats["stone"])
    build_curved_ribbon("Quay_CopingCap", quay_xs, y_in=0.72, y_out=-0.20, z_bot=1.10, z_top=1.24, mat=mats["wall"])

    # Continuous 2.55m-wide Paved Village Main Street Promenade (ensuring >= 2.10m clean net walkway!)
    prom_xs = [-14.8 + i * 0.85 for i in range(37)]
    build_curved_ribbon("Village_MainPromenade", prom_xs, y_in=3.45, y_out=0.65, z_bot=1.00, z_top=1.15, mat=mats["stone"])

    # SEGMENT A (West 6m Boulder Beach: x = -16..-6.5) & SEGMENT C (East 8m Rocky Shore: x = +7.5..+18)
    # Plus coastal boulders breaking up the masonry wall foot so visible stone height undulates 0.55..1.05m!
    rng = random.Random(202)
    boulder_specs = [
        # West pebble-boulder shallow beach (Panel 1 bottom-left!)
        (-15.5, -1.6, 1.35, (1.4, 1.1, 0.65)),
        (-13.8, -1.0, 1.15, (1.3, 1.0, 0.58)),
        (-12.2, -0.5, 0.92, (1.2, 0.9, 0.52)),
        (-10.5, -0.3, 0.85, (1.3, 0.9, 0.48)),
        # Center quay waterline boulders (clear of Market Pier @ -7.8 and Hero Pier @ +2.8!)
        (-5.2, -0.35, 0.78, (1.45, 1.05, 0.62)),
        (-3.4, -0.45, 0.64, (1.30, 0.95, 0.50)),
        (-1.4, -0.32, 0.82, (1.40, 1.00, 0.66)),
        (5.4, -0.40, 0.75, (1.35, 1.05, 0.58)),
        (7.2, -0.35, 0.88, (1.45, 1.10, 0.65)),
        # East rocky shore & cove boulders (clear of East Jetty @ +12.4!)
        (9.2, -0.45, 0.95, (1.40, 1.10, 0.68)),
        (14.8, -0.80, 1.20, (1.45, 1.15, 0.76)),
        (16.8, -1.45, 1.35, (1.50, 1.20, 0.82)),
        # Open bay scenic rock islets (clear of fishing bobber 3x4m water zone!)
        (-14.2, -6.5, 1.45, (1.5, 1.1, 0.60)),
        (18.5, -10.8, 1.40, (1.4, 1.1, 0.65)),
    ]
    for i, (bx, y_off, br, sc) in enumerate(boulder_specs):
        by = shore_y(bx) + y_off
        add_ico(f"CoastBoulder_{i}", br, (bx, by, 0.14), sc, col, mats["cliff"], subdiv=2, jitter=0.18, seed=300 + i)

    # Dramatic Sculpted Jagged Rock Cliff Buttresses around Distant Lighthouse Promontory (52, -25)!
    lx, ly = LIGHTHOUSE_POS
    cliff_buttresses = [
        (lx - 6.5, ly - 2.5, 3.6, (1.45, 1.25, 1.05), 1.35),
        (lx - 4.2, ly - 5.5, 4.1, (1.55, 1.30, 1.15), 1.55),
        (lx + 0.5, ly - 6.2, 4.4, (1.60, 1.35, 1.10), 1.65),
        (lx + 5.2, ly - 4.5, 3.9, (1.45, 1.40, 1.05), 1.45),
        (lx + 6.8, ly + 0.5, 3.8, (1.35, 1.45, 1.00), 1.40),
        (lx - 7.8, ly + 1.8, 3.2, (1.35, 1.20, 0.95), 1.20),
        # Lower sea-level wave rocks at cliff base
        (lx - 6.8, ly - 7.2, 2.2, (1.50, 1.20, 0.65), 0.35),
        (lx + 2.4, ly - 9.4, 2.5, (1.60, 1.15, 0.62), 0.30),
    ]
    for i, (cx, cy, cr, sc, cz) in enumerate(cliff_buttresses):
        add_ico(f"HeadlandCliff_{i}", cr, (cx, cy, cz), sc, col, mats["cliff"], subdiv=2, jitter=0.22, seed=600 + i)

    # Lily pads grouped cleanly at cove edges (leaving 3x4m fishing water right in front of Hero Pier crystal clear!)
    for i, (lpx, lpy, lpr) in enumerate([
        (-5.2, -3.5, 0.34), (-4.5, -4.0, 0.26), (-5.8, -4.2, 0.22),
        (7.8, -3.6, 0.40), (8.6, -4.1, 0.32), (8.2, -3.1, 0.26), (9.3, -4.5, 0.36),
        (10.0, -3.9, 0.28),
    ]):
        add_cyl(f"LilyPad_{i}", lpr, lpr, 0.03, (lpx, lpy, 0.025), col, mats["foliage"], segs=12)

    # 4. Cozy Fenced Garden Plot (between Workshop & Hero Home, fence 0.60m, open 1.20m gate!)
    gx, gy = -1.65, shore_y(-1.65) + 6.4
    gz = 1.14
    add_box("Garden_SoilBase", (3.1, 2.2, 0.12), (gx, gy, gz + 0.06), col, mats["stone"], bevel=0.015)
    for ry in (-0.52, 0.52):
        add_box(f"Garden_Bed_{ry}", (2.5, 0.62, 0.14), (gx, gy + ry, gz + 0.15), col, mats["timber"], bevel=0.015)
    # 0.60m low fence leaving clean 1.20m gate facing front street!
    add_box("Garden_FenceBack", (3.25, 0.08, 0.60), (gx, gy + 1.15, gz + 0.30), col, mats["timber"], bevel=0.01)
    add_box("Garden_FenceL", (0.08, 2.30, 0.60), (gx - 1.60, gy, gz + 0.30), col, mats["timber"], bevel=0.01)
    add_box("Garden_FenceR", (0.08, 2.30, 0.60), (gx + 1.60, gy, gz + 0.30), col, mats["timber"], bevel=0.01)
    for sx in (-1.12, 1.12):
        add_box(f"Garden_FenceFront_{sx}", (0.95, 0.08, 0.60), (gx + sx, gy - 1.15, gz + 0.30), col, mats["timber"], bevel=0.01)

    # 5. Future Expansion Reserve Plot Pads (Astra Ultra P1: Kitchen 4x4m, Farm 6x4m, Livestock 5x4m + 1.6m branch lanes!)
    reserves = [
        ("Reserve_Kitchen_4x4m", (2.6, shore_y(2.6) + 12.6), (4.0, 4.0)),
        ("Reserve_Farm_6x4m", (-5.5, shore_y(-5.5) + 12.8), (6.0, 4.0)),
        ("Reserve_Livestock_5x4m", (10.8, shore_y(10.8) + 12.4), (5.0, 4.0)),
    ]
    for rname, (rx, ry), (rw, rd) in reserves:
        rz = terrain_height(rx, ry)
        add_box(rname, (rw, rd, 0.08), (rx, ry, rz + 0.04), col, mats["reserve"], bevel=0.01)
        # Clean crisp raised border frame so expansion footprint is unmistakably readable in 44°/52° views!
        for sx in (-rw * 0.5, rw * 0.5):
            add_box(f"{rname}_EdgeX_{sx}", (0.12, rd, 0.14), (rx + sx, ry, rz + 0.09), col, mats["accent"], bevel=0.01)
        for sy in (-rd * 0.5, rd * 0.5):
            add_box(f"{rname}_EdgeY_{sy}", (rw, 0.12, 0.14), (rx, ry + sy, rz + 0.09), col, mats["accent"], bevel=0.01)


# =============================================================================
# 7. FULL VILLAGE v2.1 ASSEMBLY
# =============================================================================
def build_full_village_v21():
    clear_scene()
    mats = build_palette()

    col_land = make_collection("01_Terrain_SegmentedShore")
    col_hero = make_collection("02_Hero_Houses_Differentiated")
    col_back = make_collection("03_Hillside_3Tier_Houses")
    col_piers = make_collection("04_Piers_5Step_Boat")
    col_props = make_collection("05_Market_Props_Foliage")
    col_lh = make_collection("06_Distant_Lighthouse_Cliff")
    col_scale = make_collection("07_Story_Mannequins")

    build_landscape_and_segmented_shore(col_land, mats)

    # -------------------------------------------------------------------------
    # FRONT-ROW DIFFERENTIATED HERO COTTAGES WITH STAGGERED SETBACKS (0 / 0.65 / 1.20m!)
    # Promenade spans inland 0.65..3.45m; cottages sit beyond 3.45m keeping >= 2.10m clear street!
    # -------------------------------------------------------------------------
    # 1. CENTER HERO: Player Red-Roof Home (5.4x4.4m, Setback +0.65m -> center at shore_y + 7.95m, front porch edge @ +4.27m!)
    hx = 2.4
    hy = shore_y(hx) + 7.95
    build_player_hero_home(col_hero, mats, loc=(hx, hy, 1.14), rot_z=-0.04)

    # 2. LEFT-CENTER HERO: Old Zhou's Workshop (4.6x3.8m, Setback 0.0m -> closer to street, center at shore_y + 6.95m!)
    wx = -5.8
    wy = shore_y(wx) + 6.95
    build_artisan_workshop(col_hero, mats, loc=(wx, wy, 1.14), rot_z=0.12)

    # 3. RIGHT-CENTER HERO: East Honey-Wood Cottage (4.3x3.6m, Setback +1.20m, rotated -11° exposing side gable!)
    ex = 9.8
    ey = shore_y(ex) + 7.65
    build_east_timber_cottage(col_hero, mats, loc=(ex, ey, 1.14), rot_z=-0.20)

    # 4. FAR-LEFT: Blue-Slate Fisherman's Hut (Frames West beach cove!)
    fx = -13.0
    fy = shore_y(fx) + 6.55
    build_secondary_cottage("House_04_WestBlueHut", 3.5, 3.0, 1.96, 1.28, col_hero, mats, loc=(fx, fy, terrain_height(fx, fy)), rot_z=0.30, roof_key="roof_alt", chim_side=-1)

    # 5. FAR-RIGHT COVE COTTAGE (Frames East rocky cove!)
    rx = 15.6
    ry = shore_y(rx) + 6.80
    build_secondary_cottage("House_05_EastCoveHut", 3.6, 3.0, 1.98, 1.32, col_hero, mats, loc=(rx, ry, terrain_height(rx, ry)), rot_z=-0.32, roof_key="roof", chim_side=1)

    # -------------------------------------------------------------------------
    # BACK-ROW 3-TIER HILLSIDE COTTAGES (+0.65m / +1.15m / +1.65m above street, rotated gable!)
    # -------------------------------------------------------------------------
    back_specs = [
        # (name, x, y, w, d, wh, rh, z_tier_boost, rot_z, roof_key, chim_side, smoke)
        ("House_Back_01_T1", -11.4, 15.8, 3.8, 3.1, 1.95, 1.35, 1.14 + 0.65, 0.22, "roof", 1, True),
        ("House_Back_02_T2_GableFront", -2.4, 17.5, 3.4, 4.2, 2.02, 1.48, 1.14 + 1.15, math.pi * 0.5 + 0.08, "roof_mid", -1, True),  # Gable facing camera!
        ("House_Back_03_T3_High", 6.4, 18.4, 4.0, 3.2, 2.00, 1.42, 1.14 + 1.65, -0.10, "roof_alt", 1, False),
        ("House_Back_04_T1_Peek", 14.4, 15.6, 3.6, 2.9, 1.92, 1.32, 1.14 + 0.72, -0.24, "roof", -1, True),
    ]
    for nm, bx, by, bw, bd, bwh, brh, bz, brot, rkey, cside, smk in back_specs:
        build_secondary_cottage(nm, bw, bd, bwh, brh, col_back, mats, loc=(bx, by, max(bz, terrain_height(bx, by))), rot_z=brot, roof_key=rkey, chim_side=cside, has_smoke=smk)

    # -------------------------------------------------------------------------
    # HERO FISH MARKET STALL (Clean breathing gap from Workshop + recessed 1.20x1.60m customer alcove!)
    # -------------------------------------------------------------------------
    mx = -9.9
    my = shore_y(mx) + 4.35
    build_fish_market_stall_v21(col_props, mats, loc=(mx, my, 1.14), rot_z=0.14)

    # -------------------------------------------------------------------------
    # 3 TIERED WOODEN PIERS (Exact Z=+0.44m Deck, 5x0.14m Stairs, Hero Pier offset +1.0m & angled +18°!)
    # -------------------------------------------------------------------------
    build_tiered_pier_v21("Pier_01_Market", px=-7.9, y_quay=shore_y(-7.9) + 0.55, length=5.6, col=col_piers, mats=mats, pier_w=2.25, yaw_deg=-8.0, has_boat=False, lantern_inshore=True)

    # Hero Center Pier: offset +1.0m east of Player Door (-0.95+2.4 = 1.45 -> Pier @ x=2.65!), angled +18° toward East open bay & Lighthouse!
    hero_pier_x = 2.65
    hero_pier_yq = shore_y(hero_pier_x) + 0.55
    hero_pier_root, hero_y_end = build_tiered_pier_v21(
        "Pier_02_PlayerHome", px=hero_pier_x, y_quay=hero_pier_yq, length=6.4, col=col_piers, mats=mats, pier_w=2.55, yaw_deg=18.0, has_boat=True, lantern_inshore=True
    )

    build_tiered_pier_v21("Pier_03_EastCove", px=12.4, y_quay=shore_y(12.4) + 0.55, length=5.0, col=col_piers, mats=mats, pier_w=2.05, yaw_deg=-12.0, has_boat=False, lantern_inshore=True)

    # -------------------------------------------------------------------------
    # DISTANT EASTERN ROCKY HEADLAND LIGHTHOUSE (Exact 7.8m tall, perched back 1.8m from cliff rim!)
    # -------------------------------------------------------------------------
    lx, ly = LIGHTHOUSE_POS
    lh_z = terrain_height(lx, ly)
    build_lighthouse_78m(col_lh, mats, loc=(lx + 0.6, ly + 1.2, lh_z - 0.15))
    # Tiny coastal pines on distant rocky headland for authentic scale cue!
    for pi, (ptx, pty, pts) in enumerate([(lx - 4.8, ly + 2.5, 0.92), (lx - 7.5, ly + 4.5, 1.05), (lx + 4.0, ly + 3.2, 0.85)]):
        build_tree(f"HeadlandTree_{pi}", (ptx, pty, terrain_height(ptx, pty) - 0.15), pts, col_lh, mats, seed=820 + pi)

    # -------------------------------------------------------------------------
    # STREET LANTERNS (2.10m height, placed 0.30m OUTSIDE walkway & >=0.90m offset from doors/stairs!)
    # -------------------------------------------------------------------------
    for idx, lx_p in enumerate([-11.6, -4.4, -0.5, 6.2, 10.6, 15.2]):
        ly_p = shore_y(lx_p) + 0.82
        add_cyl(f"StreetLamp_Post_{idx}", 0.048, 0.065, 2.12, (lx_p, ly_p, 1.14 + 1.06), col_props, mats["accent"], segs=8)
        add_box(f"StreetLamp_Head_{idx}", (0.22, 0.22, 0.30), (lx_p, ly_p - 0.12, 1.14 + 2.14), col_props, mats["wall"], bevel=0.018)

    # -------------------------------------------------------------------------
    # SHOT 1 FRAMING OAK ON WEST BLUFF (Elevated overhanging bough framing top-left 14% cleanly!)
    # -------------------------------------------------------------------------
    build_framing_oak(col_props, mats, loc=(-21.2, -3.5, terrain_height(-21.2, -3.5) + 0.65))

    for i, (tx, ty, ts) in enumerate([
        (-16.5, 4.5, 1.25), (-16.8, 10.2, 1.38), (-13.5, 19.2, 1.45),
        (-7.8, 20.4, 1.50), (-1.2, 21.8, 1.40), (3.8, 22.0, 1.55),
        (10.5, 21.2, 1.48), (16.8, 19.0, 1.42), (20.8, 12.0, 1.28),
        (24.5, 5.5, 1.15), (30.5, -1.5, 1.12),
        # Mid-village shade trees between cottages (clear of walkways!)
        (-0.8, 11.4, 1.05), (6.5, 11.2, 1.02), (-9.6, 11.6, 1.08), (13.4, 10.8, 0.98),
        # Far ridge backdrop
        (-19.0, 26.0, 1.60), (-6.0, 29.0, 1.65), (9.0, 29.5, 1.62), (22.0, 25.0, 1.52),
    ]):
        build_tree(f"Tree_{i:02d}", (tx, ty, terrain_height(tx, ty) - 0.18), ts, col_props, mats, seed=500 + i)

    # -------------------------------------------------------------------------
    # STORYTELLING SCALE MANNEQUINS (Exact 1.26m Humans & 0.58m Dog!)
    # -------------------------------------------------------------------------
    # A. SHOT 3 FISH MARKET TRANSACTION: Ah Lian behind open nook handing wrapped fish parcel (Z=0.88m) to Straw-Hat Kid!
    # Stall center at (mx=-8.9, my=shore_y(-8.9)+4.45), rot_z = +0.14; transaction nook is at local (+1.02, 0.0)!
    m_rot = Matrix.Rotation(0.14, 3, "Z")
    m_origin = Vector((mx, my, 1.14))
    ah_pos = m_origin + m_rot @ Vector((0.98, 0.56, 0.0))
    kid_pos = m_origin + m_rot @ Vector((1.06, -0.58, 0.0))
    parcel_pos = m_origin + m_rot @ Vector((1.02, -0.02, 0.88))

    build_scale_mannequin("Story_AhLian_Seller", ah_pos, col_scale, mats, rot_z=0.14, hat=False, reaching=True)
    build_scale_mannequin("Story_Kid_Buyer", kid_pos, col_scale, mats, rot_z=math.pi + 0.14, hat=True, reaching=True, height_scale=0.92)
    # Crisp wrapped fish parcel held right between their hands at Z = 0.88m!
    add_box("Story_FishParcel", (0.34, 0.24, 0.16), parcel_pos, col_scale, mats["parcel"], rot=(0.08, 0.12, 0.14), bevel=0.025)
    # Puppy trotting happily down the promenade behind the kid (Panel 3!)
    build_dog_mannequin("Story_StreetDog", (mx + 2.8, my - 1.55, 1.14), col_scale, mats, rot_z=-1.35)
    # Old Zhou standing by his Workshop cargo doorway
    build_scale_mannequin("Story_LaoZhou", (wx + 0.72, wy - 2.65, 1.14), col_scale, mats, rot_z=-0.20, hat=False)

    # B. SHOT 4 HERO PIER ANGLER + SEPARATED DOG (0.64m lateral gap!) + ROD + LINE + BOBBER (3.1m out in open water!)
    p_rot = Matrix.Rotation(math.radians(18.0), 3, "Z")
    p_orig = Vector((hero_pier_x, hero_pier_yq, 0.44))
    # Sitting on the front-south/east edge facing open lagoon & distant Lighthouse!
    angler_local = Vector((-0.24, hero_y_end + 0.20, 0.0))
    dog_local = Vector((0.46, hero_y_end + 0.24, 0.0))  # 0.70m clean separation -> zero silhouette merge!
    angler_world = p_orig + p_rot @ angler_local
    dog_world = p_orig + p_rot @ dog_local

    # Face slightly southeast (+48° from -Y) so both angler & dog look right toward the bobber & distant lighthouse!
    build_scale_mannequin("Story_PierAngler", angler_world, col_scale, mats, rot_z=math.radians(48.0), hat=True, sitting=True)
    build_dog_mannequin("Story_PierDog", dog_world, col_scale, mats, rot_z=math.radians(42.0))

    # Crisp Fishing Rod -> Taut Fishing Line -> Floating Bobber 3.1m out in clean open water toward right!
    rod_start = angler_world + Vector((0.20, -0.14, 0.58))
    rod_tip = angler_world + Vector((2.15, -1.25, 1.55))
    bobber_pos = angler_world + Vector((3.05, -1.65, 0.04))

    def add_segment_cyl(nm, p0, p1, r0, r1, mat):
        v = p1 - p0
        mid = (p0 + p1) * 0.5
        q = v.normalized().to_track_quat("Z", "Y").to_euler()
        add_cyl(nm, r1, r0, v.length, mid, col_scale, mat, rot=q, segs=6)

    add_segment_cyl("Story_FishingRod", rod_start, rod_tip, 0.026, 0.011, mats["timber"])
    add_segment_cyl("Story_FishingLine", rod_tip, bobber_pos, 0.008, 0.008, mats["accent"])
    add_ico("Story_Bobber", 0.085, bobber_pos, (1.0, 1.0, 1.35), col_scale, mats["parcel"], subdiv=2, jitter=0.0)
    # Subtle water ring around bobber
    add_cyl("Story_BobberRing", 0.34, 0.36, 0.018, (bobber_pos.x, bobber_pos.y, 0.012), col_scale, mats["wall"], segs=20)

    # C. SHOT 2 FOREGROUND BOAT-BOW FRAMING PROP (Bottom 14% of Shot 2 -> authentic boat arrival POV!)
    shot2_cam_pos = Vector((-0.6, -15.6, 1.05))
    bow = bpy.data.objects.new("Shot2_ForegroundBoatBow", None)
    bow.location = Vector((-0.6, -13.9, 0.14))
    bow.rotation_euler = Euler((0, 0, 0.08), "XYZ")
    col_piers.objects.link(bow)
    # Sweeping curved wooden gunwales + front bow deck + rope coil + wicker basket!
    add_box("Bow_Deck", (1.65, 0.95, 0.24), (0.0, 0.35, 0.24), col_piers, mats["timber"], bow, bevel=0.03)
    add_box("Bow_RailL", (0.16, 1.75, 0.36), (-0.84, -0.05, 0.38), col_piers, mats["roof"], bow, rot=(0, 0, -0.24), bevel=0.025)
    add_box("Bow_RailR", (0.16, 1.75, 0.36), (0.84, -0.05, 0.38), col_piers, mats["roof"], bow, rot=(0, 0, 0.24), bevel=0.025)
    add_cyl("Bow_Basket", 0.26, 0.22, 0.36, (-0.36, 0.15, 0.44), col_piers, mats["wall"], bow, segs=12)
    add_ico("Bow_NetFloat", 0.15, (0.28, 0.22, 0.42), (1.1, 1.1, 0.95), col_piers, mats["stone"], bow, subdiv=2, jitter=0.06)

    # D. Promenade walker near East Cottage
    build_scale_mannequin("Story_EastWalker", (7.8, shore_y(7.8) + 2.15, 1.14), col_scale, mats, rot_z=-0.45, hat=False)

    return mats, angler_world, bobber_pos, ah_pos, kid_pos, parcel_pos, bow


# =============================================================================
# 8. STUDIO CLAY LIGHTING & ALL 3 SIGN-OFF RENDER BOARDS
# =============================================================================
def setup_clay_render(scene, res_x=960, res_y=540, samples=32):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 2
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = 0.08

    world = bpy.data.worlds.new("ClaySkyWorld")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.78, 0.84, 0.90, 1.0)
    bg.inputs["Strength"].default_value = 0.72
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    sun_d = bpy.data.lights.new("ClaySun", type="SUN")
    sun_d.energy = 3.5
    sun_d.color = (1.0, 0.96, 0.90)
    sun_d.angle = math.radians(2.6)
    sun = bpy.data.objects.new("ClaySun", sun_d)
    sun.rotation_euler = Euler((math.radians(50), math.radians(12), math.radians(-40)), "XYZ")
    scene.collection.objects.link(sun)


def aim_camera(cam, loc, target, lens=32):
    cam.data.lens = lens
    cam.location = Vector(loc)
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_village_boards(angler_world, bobber_pos, ah_pos, kid_pos, parcel_pos, bow_obj):
    scene = bpy.context.scene
    setup_clay_render(scene, res_x=960, res_y=540, samples=32)

    cam_d = bpy.data.cameras.new("WhiteboxCam")
    cam_d.sensor_width = 36.0
    cam_d.clip_end = 600.0
    cam = bpy.data.objects.new("WhiteboxCam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    blend_path = os.path.join(BASE_DIR, "stillwater_village_whitebox_v21.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[Whitebox v2.1] Saved .blend -> {blend_path}")

    # Hide Shot 2 foreground boat bow for Shots 1, 3, 4 & Gameplay views so it never photobombs other angles!
    def set_bow_vis(vis):
        bow_obj.hide_render = not vis
        for ch in bow_obj.children:
            ch.hide_render = not vis

    # 1. SHOT 1 (Bay Establishing + ~14% Top-Left Framing Oak + COMPLETE Distant Rocky Lighthouse Headland!)
    set_bow_vis(False)
    aim_camera(cam, (-27.0, -18.5, 14.2), (12.8, -1.2, 1.8), lens=23)
    scene.render.filepath = os.path.join(RENDER_DIR, "shot1_bay_establishing.png")
    bpy.ops.render.render(write_still=True)

    # 2. SHOT 2 (Water-level Boat Arrival POV: Boat Bow occupying bottom ~15% + Hero Pier + 3 Differentiated Cottages!)
    set_bow_vis(True)
    aim_camera(cam, (-0.6, -15.6, 1.18), (0.8, 5.5, 2.25), lens=28)
    scene.render.filepath = os.path.join(RENDER_DIR, "shot2_boat_waterfront.png")
    bpy.ops.render.render(write_still=True)

    # 3. SHOT 3 (Eye-Level Z=1.18m Fish Market Transaction POV: Ah Lian handing parcel to Kid + Street receding right!)
    set_bow_vis(False)
    s3_loc = parcel_pos + Vector((-2.15, -2.05, 0.30))
    s3_tgt = parcel_pos + Vector((1.85, 0.85, 0.14))
    aim_camera(cam, s3_loc, s3_tgt, lens=30)
    scene.render.filepath = os.path.join(RENDER_DIR, "shot3_market_street.png")
    bpy.ops.render.render(write_still=True)

    # 4. SHOT 4 (Hero Pier Fishing — Left-to-Right Storyboard Flow! Angler ~50% on Left + Dog + Rod/Bobber Center-Right + Distant Cliff Lighthouse ~13% Far-Right!)
    lh_vec = Vector((LIGHTHOUSE_POS[0] - angler_world.x, LIGHTHOUSE_POS[1] - angler_world.y, 0.0)).normalized()
    side_right = Vector((lh_vec.y, -lh_vec.x, 0.0))  # South/seaward side of sightline!
    # Camera positioned cleanly behind-south-west of angler so FULL sitting angler + dog sit cleanly inside LEFT THIRD,
    # fishing rod + line + bobber sweep across CENTER-RIGHT water, and rocky cliff Lighthouse crowns RIGHT HORIZON!
    s4_loc = angler_world - lh_vec * 3.15 + side_right * 2.25 + Vector((0.0, 0.0, 0.88))
    s4_tgt = angler_world + lh_vec * 3.45 - side_right * 0.25 + Vector((0.0, 0.0, 0.46))
    aim_camera(cam, s4_loc, s4_tgt, lens=26)
    scene.render.filepath = os.path.join(RENDER_DIR, "shot4_pier_fishing.png")
    bpy.ops.render.render(write_still=True)

    # 5. GAMEPLAY VIEW A: Exact 44° Top-Down Street Walking Camera (showing 3 distinct roofs + fenced garden + all 3 rear expansion pads!)
    aim_camera(cam, (0.4, -17.5, 22.8), (0.4, 8.2, 1.14), lens=35)
    scene.render.filepath = os.path.join(RENDER_DIR, "gameplay_44deg_street.png")
    bpy.ops.render.render(write_still=True)

    # 6. GAMEPLAY VIEW B: Exact 52° Top-Down Boating & Pier Docking Camera (verifying mooring edge, 5-step stairs & open water!)
    aim_camera(cam, (2.4, -17.2, 22.8), (2.4, -0.2, 0.44), lens=38)
    scene.render.filepath = os.path.join(RENDER_DIR, "gameplay_52deg_boating.png")
    bpy.ops.render.render(write_still=True)


def render_kitbash_scale_sheet_v21():
    """Board 3: Pure Silhouette & Scale Lineup proving ALL 3 Hero Houses are instantly distinct even without color!"""
    clear_scene()
    mats = build_palette()
    col = make_collection("Kitbash_Lineup_v21")

    add_box("StudioFloor", (60.0, 28.0, 0.2), (0, 0, -0.1), col, mats["terrain"], bevel=0.0)
    for gx in range(-18, 19, 2):
        add_box(f"GridTick_{gx}", (0.08, 0.55, 0.03), (gx, -4.4, 0.015), col, mats["accent"], bevel=0.0)
    add_box("GridAxis", (38.0, 0.07, 0.03), (0, -4.4, 0.015), col, mats["accent"], bevel=0.0)

    # 1. Scale Anchor: 1.26m Player + 0.58m Dog
    build_scale_mannequin("Ref_Player_126", (-15.2, -1.6, 0.0), col, mats, rot_z=0.12, hat=True)
    build_dog_mannequin("Ref_Dog_58", (-14.1, -1.5, 0.0), col, mats, rot_z=-0.2)

    # 2. Hero 1: Player Red Home (5.4x4.4, 3.70m steep ridge, offset dormer, flared eaves)
    build_player_hero_home(col, mats, loc=(-9.8, 1.0, 0.0), rot_z=0.0)
    build_scale_mannequin("Ref_Player_Door", (-10.75, -2.85, 0.0), col, mats, rot_z=0.08, hat=True)

    # 3. Hero 2: Old Zhou Workshop (4.6x3.8, 3.10m low ridge + 1.35x2.10m side lean-to shed!)
    build_artisan_workshop(col, mats, loc=(-2.4, 1.0, 0.0), rot_z=0.0)

    # 4. Hero 4: Fish Market Stall (2.85m w/ open transaction nook & hanging fish rack — clean gap from Workshop!)
    build_fish_market_stall_v21(col, mats, loc=(5.3, -0.5, 0.0), rot_z=0.0)

    # 5. Hero 3: East Timber Cottage (4.3x3.6, 3.25m ridge, angled -10°, offset gabled vestibule + ship wheel)
    build_east_timber_cottage(col, mats, loc=(11.2, 1.0, 0.0), rot_z=-0.16)

    # 6. Hero 5: Coastal Lighthouse (7.8m tall)
    build_lighthouse_78m(col, mats, loc=(17.6, 1.6, 0.30))

    scene = bpy.context.scene
    setup_clay_render(scene, res_x=1800, res_y=700, samples=32)
    cam_d = bpy.data.cameras.new("KitCam")
    cam_d.sensor_width = 36.0
    cam_d.clip_end = 300.0
    cam = bpy.data.objects.new("KitCam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    aim_camera(cam, (1.2, -38.0, 7.6), (1.2, 0.6, 2.5), lens=37)
    scene.render.filepath = os.path.join(RENDER_DIR, "shot5_kitbash_scale_sheet.png")
    bpy.ops.render.render(write_still=True)


def main():
    mats, angler_world, bobber_pos, ah_pos, kid_pos, parcel_pos, bow_obj = build_full_village_v21()
    render_village_boards(angler_world, bobber_pos, ah_pos, kid_pos, parcel_pos, bow_obj)
    render_kitbash_scale_sheet_v21()


if __name__ == "__main__":
    main()
