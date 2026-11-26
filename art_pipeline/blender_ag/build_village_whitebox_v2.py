"""
Antigravity Studio — 《钓鱼大冒险》（静水 / Stillwater Lagoon）
Whitebox Architectural Blockout v2.0 (Blender 5.3 Clay Maquette)

Directly translates the Codex 4-panel storyboard into an enlarged, breathable
curved coastal village layout (~1.28x scaled-up cozy cottages, curved stone
waterfront quay, stepped timber piers, enlarged fish market stall, terraced
hillside cottages, and a rocky eastern lighthouse promontory).

Outputs (pure clay whitebox — zero final texturing yet, for proportion review):
  1. art_pipeline/blender_ag/whitebox/stillwater_village_whitebox_v2.blend
  2. art_pipeline/blender_ag/whitebox/renders/shot1_bay_establishing.png
  3. art_pipeline/blender_ag/whitebox/renders/shot2_boat_waterfront.png
  4. art_pipeline/blender_ag/whitebox/renders/shot3_market_street.png
  5. art_pipeline/blender_ag/whitebox/renders/shot4_pier_fishing.png
  6. art_pipeline/blender_ag/whitebox/renders/shot5_kitbash_scale_sheet.png
"""

import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Euler, Matrix

BASE_DIR = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\whitebox"
RENDER_DIR = os.path.join(BASE_DIR, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)


# =============================================================================
# 1. SCENE & ARCHITECTURAL CLAY MATERIAL PALETTE (Pure Whitebox Maquette)
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


def make_clay_mat(name, base_rgb, ao_rgb, roughness=0.82, ao_dist=0.65, spec=0.22):
    """Crisp architectural clay with Cycles Ambient Occlusion crevice shading."""
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
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (*ao_rgb, 1.0)
    ramp.color_ramp.elements[1].position = 0.88
    ramp.color_ramp.elements[1].color = (*base_rgb, 1.0)

    nt.links.new(ao.outputs["AO"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_water_clay_mat():
    """Pale satin mist-whitebox water plane with subtle painterly ripple normals."""
    mat = bpy.data.materials.new(name="Clay_Water")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.76, 0.83, 0.85, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.24
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.55

    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.2
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.45

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.055
    bump.inputs["Distance"].default_value = 0.08

    nt.links.new(texcoord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_palette():
    return {
        "wall": make_clay_mat("Clay_Wall_Ivory", (0.95, 0.94, 0.90), (0.64, 0.62, 0.58), roughness=0.84, ao_dist=0.75),
        "roof": make_clay_mat("Clay_Roof_WarmGrey", (0.65, 0.62, 0.58), (0.38, 0.36, 0.33), roughness=0.78, ao_dist=0.65),
        "roof_alt": make_clay_mat("Clay_Roof_CoolGrey", (0.56, 0.60, 0.62), (0.32, 0.35, 0.37), roughness=0.78, ao_dist=0.65),
        "timber": make_clay_mat("Clay_Timber_Taupe", (0.52, 0.47, 0.41), (0.28, 0.25, 0.21), roughness=0.76, ao_dist=0.55),
        "stone": make_clay_mat("Clay_Stone_Quay", (0.76, 0.75, 0.72), (0.44, 0.43, 0.41), roughness=0.88, ao_dist=0.85),
        "terrain": make_clay_mat("Clay_Terrain_Soft", (0.85, 0.86, 0.81), (0.56, 0.57, 0.52), roughness=0.92, ao_dist=1.4),
        "foliage": make_clay_mat("Clay_Foliage_Matte", (0.77, 0.80, 0.74), (0.44, 0.48, 0.42), roughness=0.90, ao_dist=0.95),
        "accent": make_clay_mat("Clay_Mannequin_Charcoal", (0.35, 0.33, 0.31), (0.18, 0.17, 0.16), roughness=0.72, ao_dist=0.35),
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


def add_box(name, size, loc, col, mat, parent=None, rot=(0, 0, 0), bevel=0.025):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * 0.28), segments=2, affect="EDGES")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(rot, "XYZ")
    return link_obj(obj, col, parent, mat)


def add_cyl(name, r_top, r_bot, depth, loc, col, mat, parent=None, rot=(0, 0, 0), segs=14, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_bot, radius2=r_top, depth=depth
    )
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


def add_gable_roof(name, width, depth, ridge_h, overhang_x, overhang_y, thick, base_z, col, mat, parent=None):
    """Sculpted thick overhanging gable roof with subtle cozy Storybook eaves flare."""
    bm = bmesh.new()
    hw = width * 0.5 + overhang_x
    hd = depth * 0.5 + overhang_y
    # Two sloped slabs meeting crisply at ridge (ridge runs along X)
    slope_len = math.hypot(hd, ridge_h)
    slope_ang = math.atan2(ridge_h, hd)

    for side in (-1, 1):
        sub = bmesh.new()
        bmesh.ops.create_cube(sub, size=1.0)
        bmesh.ops.scale(sub, vec=Vector((hw * 2.0, slope_len + 0.08, thick)), verts=sub.verts)
        bmesh.ops.bevel(sub, geom=list(sub.edges), offset=0.02, segments=1, affect="EDGES")
        rot_m = Matrix.Rotation(side * slope_ang, 4, "X")
        cy = -side * hd * 0.5
        cz = base_z + ridge_h * 0.5 + thick * 0.25
        trans_m = Matrix.Translation(Vector((0.0, cy, cz))) @ rot_m
        bmesh.ops.transform(sub, matrix=trans_m, verts=sub.verts)
        # Merge into main bmesh
        vmap = [bm.verts.new(v.co) for v in sub.verts]
        for f in sub.faces:
            bm.faces.new([vmap[v.index] for v in f.verts])
        sub.free()

    # Ridge cap beam
    sub = bmesh.new()
    bmesh.ops.create_cube(sub, size=1.0)
    bmesh.ops.scale(sub, vec=Vector((hw * 2.0 + 0.08, 0.20, 0.18)), verts=sub.verts)
    bmesh.ops.transform(sub, matrix=Matrix.Translation(Vector((0.0, 0.0, base_z + ridge_h + thick * 0.45))), verts=sub.verts)
    vmap = [bm.verts.new(v.co) for v in sub.verts]
    for f in sub.faces:
        bm.faces.new([vmap[v.index] for v in f.verts])
    sub.free()

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    return link_obj(obj, col, parent, mat)


def add_gable_triangles(name, width, depth, ridge_h, base_z, col, mat, parent=None):
    """Fills left/right triangular gable wall ends cleanly under the roof."""
    bm = bmesh.new()
    hw = width * 0.5
    hd = depth * 0.5
    for sx in (-hw, hw):
        v0 = bm.verts.new((sx, -hd, base_z))
        v1 = bm.verts.new((sx, hd, base_z))
        v2 = bm.verts.new((sx, 0.0, base_z + ridge_h + 0.04))
        if sx > 0:
            bm.faces.new((v0, v1, v2))
        else:
            bm.faces.new((v1, v0, v2))
    # Add thickness slightly via solidify modifier
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    link_obj(obj, col, parent, mat)
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = 0.14
    mod.offset = 0.0
    return obj


# =============================================================================
# 3. CRESCENT BAY TOPOGRAPHY FUNCTION (Matches Storyboard Panel 1 & 2!)
# =============================================================================
def shore_y(x):
    """
    Returns Y coordinate of the curved stone quay waterline for world X!
    Blender coordinates here:
      -X = West (Left in Panel 1/2)
      +X = East (Right -> Rocky Lighthouse Promontory!)
      +Y = North / Inland (Village & Rolling Hills behind cottages!)
      -Y = South / Open Lagoon Water (Boat & Camera side!)
    """
    # Graceful sweeping crescent bay: indents northward around center (x=0..4),
    # curves southward at West Bluff (x < -14) and dramatic East Lighthouse Headland (x > 16)!
    bay_curve = (
        1.8
        - 0.014 * (x - 1.5) ** 2
        - 4.6 * math.exp(-((x - 24.5) / 7.5) ** 2)   # Eastern rocky lighthouse headland jutting into lagoon!
        - 3.4 * math.exp(-((x + 19.5) / 7.5) ** 2)   # Western wooded bluff framing Panel 1!
    )
    return bay_curve


def terrain_height(x, y):
    """Smooth sculpted coastal terrace: underwater lagoon -> curved quay terrace -> upper village hill -> rolling hills."""
    sy = shore_y(x)
    inland = y - sy  # > 0 inland, < 0 lagoon water

    # Smoothstep helper
    def ss(a, b, v):
        t = max(0.0, min(1.0, (v - a) / (b - a)))
        return t * t * (3.0 - 2.0 * t)

    # Underwater seabed sloping gently down to -2.2m
    seabed = -0.35 - 1.65 * ss(0.5, -9.5, inland)

    # Crisp stone-quay coastal terrace at z = 1.15m (wide 10m promenade + front-row cottages!)
    quay_rise = 1.50 * ss(-0.5, 0.85, inland)

    # Gentle elevated 2nd village terrace (back-row cottages!) around inland = 10..17m -> z ≈ 2.6m
    terrace2 = 1.65 * ss(8.5, 13.5, inland)

    # Lush rolling Ghibli hills behind village (inland > 17m)
    hill_wave = (
        0.55 * math.sin(x * 0.14 + 0.6)
        + 0.45 * math.cos(x * 0.08 - 1.1)
        + 0.35 * math.sin(y * 0.12 + x * 0.06)
    )
    back_hills = ss(15.5, 34.0, inland) * (6.8 + hill_wave * 2.2)

    # Eastern rocky headland knoll for the iconic Lighthouse at (x=25.5, y=-4.5)!
    lh_d = math.hypot((x - 25.5) / 5.4, (y + 3.8) / 4.8)
    lh_knoll = math.exp(-lh_d * lh_d) * 3.15

    # Western tree bluff framing Shot 1 left foreground at (x=-21.0, y=-2.5)!
    west_d = math.hypot((x + 21.5) / 6.2, (y + 2.5) / 5.5)
    west_knoll = math.exp(-west_d * west_d) * 2.65

    z = seabed + quay_rise + terrace2 + back_hills + lh_knoll + west_knoll

    # Keep central front-row village promenade cleanly flat at z = 1.15m!
    if -14.5 < x < 16.0 and 0.6 < inland < 9.2:
        flat_w = ss(0.6, 1.8, inland) * (1.0 - ss(7.2, 9.2, inland)) * ss(-14.5, -11.5, x) * (1.0 - ss(13.0, 16.0, x))
        z = z * (1.0 - flat_w) + 1.15 * flat_w

    return z


# =============================================================================
# 4. MODULAR ARCHITECTURAL WHITEBOX BUILDERS (Scaled ~1.28x for Cozy Breathing Room!)
# =============================================================================
def build_hero_cottage(
    name,
    width,
    depth,
    wall_h,
    ridge_h,
    col,
    mats,
    loc=(0, 0, 0),
    rot_z=0.0,
    has_porch=True,
    has_dormer=False,
    has_chimney=True,
    roof_alt=False,
    has_wheel=False,
    has_fish_rack=False,
):
    """
    Cozy scaled-up storybook cottage whitebox (1.28x current game size!):
      - Stone plinth foundation (sits solidly into terrain)
      - Timber corner posts + wall massing + framed multi-pane windows + flower boxes
      - Generous overhanging gable roof + optional dormer + stone chimney w/ smoke spheres
      - Covered wooden front porch with timber posts, railings, entrance steps & hanging lantern!
    Front faces -Y (toward the crescent lagoon!).
    """
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    roof_mat = mats["roof_alt"] if roof_alt else mats["roof"]

    # Deep stone foundation plinth so slopes never expose gaps
    plinth_h = 0.55
    add_box(f"{name}_Plinth", (width + 0.30, depth + 0.30, plinth_h + 0.9), (0, 0, plinth_h * 0.5 - 0.45), col, mats["stone"], root, bevel=0.03)
    base_z = plinth_h

    # Main stucco wall body
    add_box(f"{name}_Body", (width, depth, wall_h), (0, 0, base_z + wall_h * 0.5), col, mats["wall"], root, bevel=0.03)
    add_gable_triangles(f"{name}_Gables", width, depth, ridge_h, base_z + wall_h, col, mats["wall"], root)

    # Timber corner beams & horizontal fascia trim
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(
                f"{name}_Corner_{sx}_{sy}",
                (0.18, 0.18, wall_h + 0.06),
                (sx * (width * 0.5 - 0.04), sy * (depth * 0.5 - 0.04), base_z + wall_h * 0.5),
                col,
                mats["timber"],
                root,
                bevel=0.015,
            )

    # Overhanging gable roof
    add_gable_roof(f"{name}_Roof", width, depth, ridge_h, overhang_x=0.42, overhang_y=0.42, thick=0.16, base_z=base_z + wall_h - 0.04, col=col, mat=roof_mat, parent=root)

    # Front doorway (generous 1.15m wide x 1.62m tall for 1.26m character — zero Z-fighting!)
    door_x = -0.35 if has_porch and width >= 4.8 else 0.0
    door_w, door_h = 1.12, 1.62
    add_box(f"{name}_DoorFrame", (door_w + 0.18, 0.12, door_h + 0.12), (door_x, -depth * 0.5 - 0.06, base_z + door_h * 0.5), col, mats["timber"], root, bevel=0.015)
    add_box(f"{name}_DoorLeaf", (door_w - 0.04, 0.06, door_h - 0.04), (door_x, -depth * 0.5 - 0.10, base_z + door_h * 0.5), col, mats["roof"], root, bevel=0.010)

    # Front & side cottage windows with shutters & flower boxes
    win_xs = [width * 0.27] if door_x < -0.1 else [-width * 0.30, width * 0.30]
    for idx, wx in enumerate(win_xs):
        wz = base_z + wall_h * 0.54
        add_box(f"{name}_WinFrame_{idx}", (0.86, 0.10, 0.78), (wx, -depth * 0.5 - 0.055, wz), col, mats["timber"], root, bevel=0.012)
        for sh in (-1, 1):
            add_box(f"{name}_Shutter_{idx}_{sh}", (0.24, 0.07, 0.74), (wx + sh * 0.56, -depth * 0.5 - 0.07, wz), col, roof_mat, root, bevel=0.01)
        # Window flower box
        add_box(f"{name}_FlowerBox_{idx}", (0.92, 0.26, 0.20), (wx, -depth * 0.5 - 0.15, wz - 0.48), col, mats["timber"], root, bevel=0.015)
        for fx in (-0.26, 0.0, 0.26):
            add_ico(f"{name}_Bloom_{idx}_{fx:.2f}", 0.13, (wx + fx, -depth * 0.5 - 0.17, wz - 0.33), (1.0, 0.9, 0.75), col, mats["foliage"], root, subdiv=1, jitter=0.14, seed=int(abs(wx * 10 + fx * 30)))

    for sx in (-1, 1):
        wz = base_z + wall_h * 0.54
        add_box(f"{name}_SideWin_{sx}", (0.10, 0.86, 0.78), (sx * (width * 0.5 + 0.055), 0.0, wz), col, mats["timber"], root, bevel=0.012)

    # Optional Hero Dormer Window on front roof slope (Matches Storyboard Red Hero Home!)
    if has_dormer:
        dz = base_z + wall_h + ridge_h * 0.42
        dy = -depth * 0.28
        add_box(f"{name}_DormerBox", (1.24, 1.08, 0.92), (0.0, dy, dz), col, mats["wall"], root, bevel=0.02)
        # Solid dormer front gable peak so zero dark gap appears under dormer eaves
        d_bm = bmesh.new()
        dv0 = d_bm.verts.new((-0.62, dy - 0.54, dz + 0.44))
        dv1 = d_bm.verts.new((0.62, dy - 0.54, dz + 0.44))
        dv2 = d_bm.verts.new((0.0, dy - 0.54, dz + 0.84))
        dv3 = d_bm.verts.new((-0.62, dy + 0.54, dz + 0.44))
        dv4 = d_bm.verts.new((0.62, dy + 0.54, dz + 0.44))
        dv5 = d_bm.verts.new((0.0, dy + 0.54, dz + 0.84))
        d_bm.faces.new((dv0, dv1, dv2))
        d_bm.faces.new((dv4, dv3, dv5))
        d_bm.faces.new((dv0, dv2, dv5, dv3))
        d_bm.faces.new((dv1, dv4, dv5, dv2))
        d_mesh = bpy.data.meshes.new(f"{name}_DormerPeak")
        d_bm.to_mesh(d_mesh)
        d_bm.free()
        link_obj(bpy.data.objects.new(f"{name}_DormerPeak", d_mesh), col, root, mats["wall"])
        add_box(f"{name}_DormerWin", (0.74, 0.09, 0.58), (0.0, dy - 0.56, dz + 0.04), col, mats["timber"], root, bevel=0.01)
        for sx in (-1, 1):
            add_box(
                f"{name}_DormerRoof_{sx}",
                (0.92, 1.34, 0.12),
                (sx * 0.36, dy - 0.05, dz + 0.64),
                col,
                roof_mat,
                root,
                rot=(0.0, sx * 0.56, 0.0),
                bevel=0.012,
            )

    # Stone chimney + rising clay smoke puffs
    if has_chimney:
        cx = width * 0.26
        cy = depth * 0.16
        ch_h = ridge_h + 0.95
        add_box(f"{name}_Chimney", (0.62, 0.62, ch_h), (cx, cy, base_z + wall_h + ch_h * 0.45), col, mats["stone"], root, bevel=0.025)
        add_box(f"{name}_ChimneyCap", (0.76, 0.76, 0.14), (cx, cy, base_z + wall_h + ch_h * 0.96), col, mats["stone"], root, bevel=0.015)
        top_z = base_z + wall_h + ch_h + 0.18
        for k in range(3):
            add_ico(f"{name}_Smoke_{k}", 0.22 + k * 0.11, (cx + k * 0.36, cy + k * 0.12, top_z + k * 0.52), (1.15, 1.0, 0.85), col, mats["wall"], root, subdiv=1, jitter=0.12, seed=20 + k)

    # Covered Cozy Wooden Porch + Steps + Railings + Hanging Lantern!
    if has_porch:
        porch_d = 1.48
        porch_w = width + 0.16
        py_mid = -depth * 0.5 - porch_d * 0.5
        # Deck & support base
        add_box(f"{name}_PorchDeck", (porch_w, porch_d, 0.16), (0.0, py_mid, base_z - 0.02), col, mats["timber"], root, bevel=0.015)
        add_box(f"{name}_PorchBase", (porch_w - 0.12, porch_d - 0.12, plinth_h + 0.5), (0.0, py_mid, plinth_h * 0.5 - 0.32), col, mats["stone"], root, bevel=0.02)

        # Porch awning roof sloping cleanly forward
        awning_z = base_z + wall_h - 0.18
        add_box(
            f"{name}_PorchAwning",
            (porch_w + 0.36, porch_d + 0.46, 0.13),
            (0.0, py_mid - 0.08, awning_z),
            col,
            roof_mat,
            root,
            rot=(0.24, 0.0, 0.0),
            bevel=0.015,
        )

        # Timber porch pillars
        post_y = -depth * 0.5 - porch_d + 0.12
        post_h = awning_z - base_z - 0.12
        post_xs = [-porch_w * 0.46, door_x + door_w * 0.68, porch_w * 0.46] if width >= 4.8 else [-porch_w * 0.46, porch_w * 0.46]
        for idx, px in enumerate(post_xs):
            add_box(f"{name}_PorchPost_{idx}", (0.14, 0.14, post_h), (px, post_y, base_z + post_h * 0.5), col, mats["timber"], root, bevel=0.012)

        # Porch wooden stairs centered on doorway
        for st in range(2):
            add_box(
                f"{name}_Step_{st}",
                (1.52, 0.34, 0.18),
                (door_x, -depth * 0.5 - porch_d - 0.17 - st * 0.32, base_z - 0.18 - st * 0.18),
                col,
                mats["timber"],
                root,
                bevel=0.012,
            )

        # Porch side railing on non-step side
        rail_x = width * 0.24 if door_x < 0 else width * 0.32
        rail_w = width * 0.42
        add_box(f"{name}_RailTop", (rail_w, 0.09, 0.09), (rail_x, post_y, base_z + 0.68), col, mats["timber"], root, bevel=0.01)
        for bi in range(4):
            bx = rail_x - rail_w * 0.4 + bi * (rail_w * 0.27)
            add_box(f"{name}_Baluster_{bi}", (0.06, 0.06, 0.64), (bx, post_y, base_z + 0.34), col, mats["timber"], root, bevel=0.006)

        # Hanging porch lantern silhouette
        add_box(f"{name}_PorchLantern", (0.20, 0.20, 0.30), (door_x + door_w * 0.68, post_y - 0.14, awning_z - 0.36), col, mats["accent"], root, bevel=0.02)

    # Signature Ship Wheel on East Honey Cottage (Matches Storyboard Panel 2!)
    if has_wheel:
        wx, wy, wz = width * 0.30, -depth * 0.5 - 0.10, base_z + wall_h * 0.48
        add_cyl(f"{name}_WheelRim", 0.36, 0.36, 0.06, (wx, wy, wz), col, mats["timber"], root, rot=(math.pi * 0.5, 0, 0), segs=14)
        add_cyl(f"{name}_WheelHub", 0.11, 0.11, 0.10, (wx, wy - 0.02, wz), col, mats["accent"], root, rot=(math.pi * 0.5, 0, 0), segs=10)

    # Wooden Hanging Dried-Fish Rack beside West/Workshop Cottage (Matches Storyboard Panels 1, 2, 3!)
    if has_fish_rack:
        rx = -width * 0.5 - 0.82
        ry = -depth * 0.38
        for sx in (-0.65, 0.65):
            add_cyl(f"{name}_RackPost_{sx}", 0.055, 0.065, 1.95, (rx + sx, ry, base_z + 0.82), col, mats["timber"], root, segs=8)
        add_cyl(f"{name}_RackBar", 0.045, 0.045, 1.55, (rx, ry, base_z + 1.66), col, mats["timber"], root, rot=(0, math.pi * 0.5, 0), segs=8)
        for fi in range(5):
            fx = rx - 0.48 + fi * 0.24
            add_ico(f"{name}_DryFish_{fi}", 0.14, (fx, ry, base_z + 1.24), (0.34, 0.26, 1.45), col, mats["wall"], root, subdiv=1, jitter=0.05, seed=fi + 5)

    return root


def build_fish_market_stall(col, mats, loc, rot_z=0.0):
    """Hero Fish Market Booth (Panel 3!) — Striped canopy ribs, ice fish crates, hanging fish, scale & barrels."""
    root = bpy.data.objects.new("Hero_FishMarket_Stall", None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    # Sturdy timber counter + back display crates
    add_box("Market_Counter", (2.85, 1.05, 0.88), (0, 0, 0.44), col, mats["timber"], root, bevel=0.02)
    for sx in (-1.32, 1.32):
        for sy in (-0.44, 0.44):
            add_box(f"Market_Post_{sx}_{sy}", (0.12, 0.12, 2.28), (sx, sy, 1.14), col, mats["timber"], root, bevel=0.012)

    # Ribbed striped canopy (alternating roof/wall clay stripes so pattern reads even in pure whitebox!)
    for i in range(6):
        sx = -1.25 + i * 0.50
        mat_s = mats["roof"] if i % 2 == 0 else mats["wall"]
        add_box(f"Market_Awning_{i}", (0.48, 1.72, 0.09), (sx, -0.10, 2.26), col, mat_s, root, rot=(0.24, 0, 0), bevel=0.01)
        # Cute scalloped valance flap at front
        add_box(f"Market_Valance_{i}", (0.46, 0.07, 0.24), (sx, -0.92, 1.98), col, mat_s, root, bevel=0.01)

    # Hanging dried fish row along left beam (Panel 3 foreground!)
    add_cyl("Market_FishBar", 0.035, 0.035, 1.35, (-0.70, -0.44, 1.88), col, mats["timber"], root, rot=(0, math.pi * 0.5, 0), segs=8)
    for fi in range(4):
        fx = -1.12 + fi * 0.26
        add_ico(f"Market_HangFish_{fi}", 0.14, (fx, -0.44, 1.54), (0.34, 0.24, 1.35), col, mats["wall"], root, subdiv=1, jitter=0.04, seed=40 + fi)

    # Vintage countertop scale + fresh fish ice crates on counter & ground!
    add_cyl("Market_ScaleBase", 0.12, 0.16, 0.22, (-0.85, -0.15, 0.99), col, mats["accent"], root, segs=10)
    add_cyl("Market_ScaleBowl", 0.22, 0.10, 0.09, (-0.85, -0.15, 1.15), col, mats["wall"], root, segs=12)
    for ci, cx in enumerate([-0.15, 0.62]):
        add_box(f"Market_Crate_{ci}", (0.66, 0.52, 0.24), (cx, -0.10, 0.98), col, mats["timber"], root, rot=(0.14, 0, 0), bevel=0.015)
        for f in range(3):
            add_ico(f"Market_CrateFish_{ci}_{f}", 0.11, (cx - 0.18 + f * 0.18, -0.10, 1.11), (0.35, 1.2, 0.30), col, mats["wall"], root, subdiv=1, jitter=0.05, seed=60 + ci * 5 + f)

    # Wooden barrels flanking stall
    for bi, bx in enumerate([-1.85, -2.30, 1.78]):
        add_cyl(f"Market_Barrel_{bi}", 0.28, 0.30, 0.72, (bx, -0.05 + (bi % 2) * 0.25, 0.36), col, mats["timber"], root, segs=12)

    return root


def build_tiered_pier(name, px, y_quay, y_end, col, mats, pier_w=2.45, has_boat=False, has_lantern=True):
    """
    Proper storyboard wooden pier:
      - Wide timber steps descending smoothly FROM the stone quay wall (z=1.15m) down to dock deck (z=0.52m)!
      - Zero planks poking into grass or floating!
      - Heavy wooden pilings, longitudinal beams, mooring bollards, wicker basket & rope coil!
    """
    root = bpy.data.objects.new(name, None)
    col.objects.link(root)

    deck_z = 0.52
    quay_z = 1.15
    step_count = 4
    step_depth = 0.38
    y_deck_start = y_quay - step_count * step_depth

    # Timber staircase descending from stone quay down onto wooden pier
    for s in range(step_count):
        t = (s + 1) / (step_count + 1)
        sz = quay_z * (1.0 - t) + deck_z * t
        sy = y_quay - s * step_depth - step_depth * 0.5
        add_box(f"{name}_Stair_{s}", (pier_w * 0.92, step_depth + 0.04, 0.14), (px, sy, sz), col, mats["timber"], root, bevel=0.015)
    # Stair cheek stringers
    for sx in (-1, 1):
        add_box(
            f"{name}_StairBeam_{sx}",
            (0.14, step_count * step_depth + 0.3, 0.22),
            (px + sx * (pier_w * 0.45), y_quay - step_count * step_depth * 0.5, (quay_z + deck_z) * 0.5 - 0.06),
            col,
            mats["timber"],
            root,
            rot=(0.38, 0, 0),
            bevel=0.015,
        )

    # Flat timber pier planks out over lagoon water
    deck_len = abs(y_deck_start - y_end)
    plank_n = max(8, int(deck_len * 2.8))
    for i in range(plank_n):
        t = i / max(1, plank_n - 1)
        py = y_deck_start - t * deck_len
        add_box(f"{name}_Plank_{i}", (pier_w, 0.31, 0.11), (px + (i % 2 - 0.5) * 0.02, py, deck_z), col, mats["timber"], root, bevel=0.012)

    # Side stringers & stout cylindrical pilings going down into seabed
    for sx in (-1, 1):
        add_box(f"{name}_Stringer_{sx}", (0.14, deck_len + 0.2, 0.18), (px + sx * (pier_w * 0.42), (y_deck_start + y_end) * 0.5, deck_z - 0.12), col, mats["timber"], root, bevel=0.012)

    pile_rows = max(3, int(deck_len / 1.9) + 1)
    for r in range(pile_rows):
        py = y_deck_start - 0.45 - (r / max(1, pile_rows - 1)) * (deck_len - 0.6)
        for sx in (-1, 1):
            add_cyl(f"{name}_Pile_{r}_{sx}", 0.13, 0.15, 2.6, (px + sx * (pier_w * 0.47), py, deck_z - 0.85), col, mats["timber"], root, segs=10)

    # Pier lantern post + wicker fishing basket + rope coil (Matches Panel 4!)
    if has_lantern:
        lx = px + pier_w * 0.42
        ly = y_end + 0.35
        add_cyl(f"{name}_LampPost", 0.055, 0.075, 2.05, (lx, ly, deck_z + 1.02), col, mats["accent"], root, segs=8)
        add_box(f"{name}_LampArm", (0.42, 0.07, 0.07), (lx - 0.16, ly, deck_z + 1.98), col, mats["accent"], root, bevel=0.01)
        add_box(f"{name}_LampBox", (0.22, 0.22, 0.30), (lx - 0.32, ly, deck_z + 1.78), col, mats["wall"], root, bevel=0.02)

    # Cozy wicker basket + crate on deck
    add_cyl(f"{name}_Basket", 0.22, 0.18, 0.34, (px - pier_w * 0.30, y_end + 0.72, deck_z + 0.22), col, mats["wall"], root, segs=12)

    # Moored Wooden Rowboat beside Hero Pier (Matches Panels 1 & 2!)
    if has_boat:
        bx = px - pier_w * 0.5 - 1.35
        by = y_end + 0.95
        boat = bpy.data.objects.new(f"{name}_MooredBoat", None)
        boat.location = Vector((bx, by, 0.08))
        boat.rotation_euler = Euler((0, 0, 0.28), "XYZ")
        col.objects.link(boat)
        add_ico(f"{name}_BoatHull", 1.0, (0, 0, 0.12), (1.45, 0.66, 0.38), col, mats["timber"], boat, subdiv=2, jitter=0.0)
        add_box(f"{name}_BoatCut", (2.0, 0.86, 0.16), (0, 0, 0.34), col, mats["wall"], boat, bevel=0.02)
        add_box(f"{name}_BoatBench", (0.34, 0.96, 0.08), (0.0, 0.0, 0.38), col, mats["timber"], boat, bevel=0.01)
        add_cyl(f"{name}_BoatBasket", 0.20, 0.16, 0.28, (-0.52, 0.12, 0.42), col, mats["wall"], boat, segs=10)

    return root


def build_lighthouse_headland(col, mats, loc):
    """Iconic tall striped Coastal Lighthouse on the sculpted eastern rocky promontory (Panels 1 & 4!)."""
    root = bpy.data.objects.new("Hero_Lighthouse", None)
    root.location = Vector(loc)
    col.objects.link(root)

    # Octagonal stone base plinth
    add_cyl("LH_Plinth", 1.75, 2.25, 2.2, (0, 0, 0.45), col, mats["stone"], root, segs=10)
    # Tapered alternating-band tower segments (5 bands -> crisp silhouette!)
    bands = [
        (1.52, 1.70, 1.45, 2.25, mats["wall"]),
        (1.36, 1.52, 1.35, 3.65, mats["roof"]),
        (1.22, 1.36, 1.35, 5.00, mats["wall"]),
        (1.10, 1.22, 1.25, 6.30, mats["roof"]),
    ]
    for i, (rt, rb, h, cz, m) in enumerate(bands):
        add_cyl(f"LH_Band_{i}", rt, rb, h, (0, 0, cz), col, m, root, segs=16)

    # Gallery walkway & lantern room & conical red roof cupola
    add_cyl("LH_Gallery", 1.38, 1.18, 0.30, (0, 0, 7.05), col, mats["accent"], root, segs=16)
    add_cyl("LH_LanternGlass", 0.82, 0.82, 1.18, (0, 0, 7.75), col, mats["wall"], root, segs=12)
    add_cyl("LH_RoofCone", 0.06, 1.15, 1.25, (0, 0, 8.95), col, mats["roof"], root, segs=14)
    add_cyl("LH_Finial", 0.04, 0.06, 0.55, (0, 0, 9.75), col, mats["accent"], root, segs=8)

    # Tiny stone keeper shed beside lighthouse with deep grounded plinth (zero floating on hill!)
    add_box("LH_ShedPlinth", (2.05, 1.65, 2.2), (-2.15, 0.55, -0.35), col, mats["stone"], root, bevel=0.02)
    add_box("LH_Shed", (1.85, 1.45, 1.35), (-2.15, 0.55, 1.38), col, mats["wall"], root, bevel=0.025)
    add_gable_roof("LH_ShedRoof", 1.85, 1.45, 0.65, 0.25, 0.25, 0.12, 2.02, col, mats["roof"], root)
    return root


def build_tree(name, loc, scale, col, mats, seed=1):
    """Faceted painterly Storybook tree cluster (matches Codex storyboard canopy style!)."""
    rng = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    col.objects.link(root)

    trunk_h = 1.95 * scale
    add_cyl(f"{name}_Trunk", 0.18 * scale, 0.30 * scale, trunk_h, (0, 0, trunk_h * 0.46), col, mats["timber"], root, segs=8)
    # 3-4 plump faceted canopy puffs
    puffs = [
        (0.0, 0.0, trunk_h + 0.62 * scale, 1.12 * scale, (1.12, 1.05, 0.92)),
        (-0.58 * scale, -0.22 * scale, trunk_h + 0.35 * scale, 0.78 * scale, (1.0, 1.0, 0.88)),
        (0.62 * scale, 0.18 * scale, trunk_h + 0.42 * scale, 0.82 * scale, (1.0, 1.0, 0.90)),
        (0.08 * scale, 0.48 * scale, trunk_h + 0.75 * scale, 0.76 * scale, (1.0, 0.95, 0.92)),
    ]
    for i, (px, py, pz, r, sc) in enumerate(puffs):
        add_ico(f"{name}_Crown_{i}", r, (px, py, pz), sc, col, mats["foliage"], root, subdiv=2, jitter=0.10, seed=seed * 17 + i)
    return root


def build_scale_mannequin(name, loc, col, mats, rot_z=0.0, hat=True, sitting=False):
    """Exact 1.26m tall Chibi Character Scale Reference so house proportions can be judged at a glance!"""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)

    z_off = -0.22 if sitting else 0.0
    # Legs
    if sitting:
        for sx in (-0.11, 0.11):
            add_cyl(f"{name}_Leg_{sx}", 0.07, 0.07, 0.36, (sx, -0.18, 0.22), col, mats["accent"], root, rot=(1.35, 0, 0), segs=8)
    else:
        for sx in (-0.11, 0.11):
            add_cyl(f"{name}_Leg_{sx}", 0.075, 0.08, 0.38, (sx, 0, 0.19), col, mats["accent"], root, segs=8)
    # Chubby torso + arms
    add_cyl(f"{name}_Torso", 0.20, 0.23, 0.46, (0, 0, 0.58 + z_off), col, mats["accent"], root, segs=12)
    for sx in (-1, 1):
        add_cyl(f"{name}_Arm_{sx}", 0.065, 0.065, 0.34, (sx * 0.26, -0.05 if sitting else 0.0, 0.62 + z_off), col, mats["accent"], root, rot=(0.5 if sitting else 0, sx * 0.35, 0), segs=8)
    # Chibi head (total height = 1.26m!)
    add_ico(f"{name}_Head", 0.21, (0, 0, 1.02 + z_off), (1.04, 1.0, 0.98), col, mats["wall"], root, subdiv=2, jitter=0.0)
    if hat:
        # Iconic wide straw hat brim (exact player silhouette!)
        add_cyl(f"{name}_HatBrim", 0.38, 0.40, 0.04, (0, 0.02, 1.15 + z_off), col, mats["roof"], root, rot=(-0.15, 0, 0), segs=16)
        add_ico(f"{name}_HatCrown", 0.20, (0, 0.02, 1.20 + z_off), (1.0, 1.0, 0.65), col, mats["roof"], root, subdiv=2, jitter=0.0)
    return root


def build_dog_mannequin(name, loc, col, mats, rot_z=0.0):
    """Exact 0.58m Companion Dog scale reference."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(loc)
    root.rotation_euler = Euler((0, 0, rot_z), "XYZ")
    col.objects.link(root)
    add_ico(f"{name}_Body", 0.18, (0, 0, 0.22), (0.85, 1.45, 0.85), col, mats["accent"], root, subdiv=2, jitter=0.0)
    add_ico(f"{name}_Head", 0.15, (0, -0.22, 0.32), (1.0, 1.0, 0.95), col, mats["accent"], root, subdiv=2, jitter=0.0)
    add_cyl(f"{name}_Tail", 0.03, 0.045, 0.20, (0, 0.26, 0.30), col, mats["accent"], root, rot=(-0.7, 0, 0), segs=8)
    for sx in (-0.09, 0.09):
        for sy in (-0.12, 0.12):
            add_cyl(f"{name}_Paw_{sx}_{sy}", 0.04, 0.045, 0.16, (sx, sy, 0.08), col, mats["wall"], root, segs=8)
    return root


# =============================================================================
# 5. TERRAIN, CURVED STONE QUAY WALL, WATER & PROPS BUILDER
# =============================================================================
def build_landscape_and_quay(col, mats):
    # 1. Sculpted terrain mesh spanning X:[-38..42], Y:[-24..46]
    nx, ny = 84, 72
    x0, x1 = -38.0, 42.0
    y0, y1 = -24.0, 46.0
    bm = bmesh.new()
    grid = []
    for iy in range(ny):
        ty = iy / (ny - 1)
        y = y0 + (y1 - y0) * ty
        row = []
        for ix in range(nx):
            tx = ix / (nx - 1)
            x = x0 + (x1 - x0) * tx
            z = terrain_height(x, y)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for iy in range(ny - 1):
        for ix in range(nx - 1):
            bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tmesh = bpy.data.meshes.new("Village_Terrain")
    bm.to_mesh(tmesh)
    bm.free()
    for p in tmesh.polygons:
        p.use_smooth = True
    tobj = bpy.data.objects.new("Village_Terrain", tmesh)
    link_obj(tobj, col, None, mats["terrain"])

    # 2. Calm Satin-Clay Lagoon Water Surface at Z = 0.0
    w_bm = bmesh.new()
    v0 = w_bm.verts.new((-85, -75, 0.0))
    v1 = w_bm.verts.new((85, -75, 0.0))
    v2 = w_bm.verts.new((85, 30, 0.0))
    v3 = w_bm.verts.new((-85, 30, 0.0))
    w_bm.faces.new((v0, v1, v2, v3))
    wmesh = bpy.data.meshes.new("Lagoon_Water")
    w_bm.to_mesh(wmesh)
    w_bm.free()
    link_obj(bpy.data.objects.new("Lagoon_Water", wmesh), col, None, mats["water"])

    # 3. Seamless Continuous Curved Stone Quay Wall, Coping Ledge & Paved Waterfront Promenade (ZERO Z-fighting!)
    def build_curved_ribbon(name, xs, y_in, y_out, z_bot, z_top, mat):
        rbm = bmesh.new()
        rings = []
        for x in xs:
            sy = shore_y(x)
            # Tangent normal along curve so ribbon width stays clean around bends
            dy = (shore_y(x + 0.25) - shore_y(x - 0.25)) / 0.5
            n = Vector((-dy, 1.0)).normalized()
            p_out = Vector((x, sy)) + n * y_out
            p_in = Vector((x, sy)) + n * y_in
            v_ob = rbm.verts.new((p_out.x, p_out.y, z_bot))
            v_ot = rbm.verts.new((p_out.x, p_out.y, z_top))
            v_it = rbm.verts.new((p_in.x, p_in.y, z_top))
            v_ib = rbm.verts.new((p_in.x, p_in.y, z_bot))
            rings.append((v_ob, v_ot, v_it, v_ib))
        for k in range(len(rings) - 1):
            a0, a1, a2, a3 = rings[k]
            b0, b1, b2, b3 = rings[k + 1]
            rbm.faces.new((a0, b0, b1, a1))  # waterfront front face
            rbm.faces.new((a1, b1, b2, a2))  # top walkway face
            rbm.faces.new((a2, b2, b3, a3))  # inland back face
            rbm.faces.new((a3, b3, b0, a0))  # underside
        # Cap ends
        rbm.faces.new((rings[0][3], rings[0][2], rings[0][1], rings[0][0]))
        rbm.faces.new((rings[-1][0], rings[-1][1], rings[-1][2], rings[-1][3]))
        bmesh.ops.recalc_face_normals(rbm, faces=rbm.faces)
        rm = bpy.data.meshes.new(name)
        rbm.to_mesh(rm)
        rbm.free()
        return link_obj(bpy.data.objects.new(name, rm), col, None, mat)

    quay_xs = [(-17.5 + i * 0.85) for i in range(47)]  # smooth curve x=-17.5 .. +21.6
    build_curved_ribbon("Quay_Seawall", quay_xs, y_in=0.62, y_out=-0.12, z_bot=-0.55, z_top=1.16, mat=mats["stone"])
    build_curved_ribbon("Quay_CopingLedge", quay_xs, y_in=0.72, y_out=-0.22, z_bot=1.16, z_top=1.31, mat=mats["wall"])
    build_curved_ribbon("Village_StonePromenade", quay_xs, y_in=3.75, y_out=0.68, z_bot=1.02, z_top=1.20, mat=mats["stone"])

    # Natural coastal boulders hugging the waterline along the stone seawall (Matches Panels 1 & 2!)
    rng = random.Random(101)
    for idx in range(0, len(quay_xs) - 1, 3):
        xm = quay_xs[idx]
        ym = shore_y(xm)
        if not (-9.4 < xm < -5.6 or 0.6 < xm < 4.6 or 11.6 < xm < 15.2):
            r = 0.56 + rng.random() * 0.42
            add_ico(f"ShoreRock_{idx}", r, (xm, ym - 0.42 - rng.random() * 0.35, 0.16), (1.35, 1.05, 0.68), col, mats["stone"], subdiv=1, jitter=0.18, seed=idx + 10)

    # 4. Dramatic Coastal Cliff Boulders around Eastern Lighthouse Promontory & Western Bluff!
    cliff_spots = [
        (21.5, -2.5, 1.4, (1.5, 1.2, 0.9)),
        (24.0, -7.2, 1.8, (1.6, 1.3, 1.1)),
        (26.8, -7.5, 2.0, (1.5, 1.4, 1.2)),
        (29.2, -5.2, 1.9, (1.4, 1.5, 1.1)),
        (28.5, -1.8, 1.6, (1.4, 1.2, 0.95)),
        (22.2, -5.8, 1.3, (1.3, 1.1, 0.85)),
        # Foreground water islets & rocks (matching Panels 1, 2, 4!)
        (-13.5, -6.5, 1.5, (1.5, 1.1, 0.65)),
        (-2.5, -11.5, 1.2, (1.4, 1.1, 0.55)),
        (10.5, -9.8, 1.3, (1.3, 1.2, 0.58)),
        (17.8, -10.5, 1.1, (1.3, 1.0, 0.52)),
        # Western rocky bluff framing Panel 1 bottom-left!
        (-18.2, -2.8, 1.6, (1.4, 1.2, 0.9)),
        (-16.5, -4.5, 1.2, (1.3, 1.1, 0.72)),
    ]
    for i, (rx, ry, rr, sc) in enumerate(cliff_spots):
        add_ico(f"CliffRock_{i}", rr, (rx, ry, 0.18), sc, col, mats["stone"], subdiv=2, jitter=0.18, seed=300 + i)

    # 5. Lily pads floating gently in lagoon water (Panels 1, 2, 4!)
    lily_spots = [
        (-4.5, -4.2, 0.36), (-3.8, -4.7, 0.28), (-5.0, -4.9, 0.24),
        (5.5, -4.6, 0.42), (6.3, -5.0, 0.34), (6.0, -4.1, 0.26), (7.1, -5.4, 0.38),
        (7.8, -4.8, 0.30), (4.8, -5.5, 0.25),
        (14.5, -6.2, 0.36), (15.3, -6.6, 0.28),
    ]
    for i, (lx, ly, lr) in enumerate(lily_spots):
        add_cyl(f"LilyPad_{i}", lr, lr, 0.03, (lx, ly, 0.025), col, mats["foliage"], segs=12)

    # 6. Cozy Garden Plot with Raised Timber Beds (between Hero Home & Workshop)
    gx, gy = -1.6, shore_y(-1.6) + 5.6
    gz = terrain_height(gx, gy)
    add_box("Garden_Frame", (3.2, 2.2, 0.18), (gx, gy, gz + 0.09), col, mats["timber"], bevel=0.02)
    for r in (-0.55, 0.55):
        add_box(f"Garden_Row_{r}", (2.7, 0.65, 0.12), (gx, gy + r, gz + 0.18), col, mats["stone"], bevel=0.02)


# =============================================================================
# 6. MAIN VILLAGE ASSEMBLY (Proportional Scale-Up ~1.28x!)
# =============================================================================
def build_full_village_whitebox():
    clear_scene()
    mats = build_palette()

    col_land = make_collection("01_Terrain_Bay_Quay")
    col_hero = make_collection("02_Hero_Houses_Scaled")
    col_back = make_collection("03_Upper_Hillside_Houses")
    col_piers = make_collection("04_Piers_Stairs_Boat")
    col_props = make_collection("05_Market_Props_Foliage")
    col_lh = make_collection("06_Lighthouse_Headland")
    col_scale = make_collection("07_Scale_Mannequins")

    build_landscape_and_quay(col_land, mats)

    # -------------------------------------------------------------------------
    # FRONT-ROW HERO COTTAGES (~1.28x enlarged from current game — cozy, spacious, never oversized!)
    # Current game Player Home: 4.2 x 3.4 x 1.92  -->  Whitebox v2: 5.4 x 4.4 x 2.35 (+28%!)
    # Current game Workshop:    3.55 x 2.9 x 1.82 -->  Whitebox v2: 4.6 x 3.8 x 2.20 (+29%!)
    # Current game East House:  3.25 x 2.75 x 1.76-->  Whitebox v2: 4.3 x 3.6 x 2.15 (+31%!)
    # -------------------------------------------------------------------------
    # 1. CENTER HERO: Player's Red-Roof Cottage (with dormer, deep porch, stone chimney)
    hx, hy = 2.6, shore_y(2.6) + 6.4
    build_hero_cottage(
        "House_01_PlayerHero",
        width=5.4,
        depth=4.4,
        wall_h=2.35,
        ridge_h=1.78,
        col=col_hero,
        mats=mats,
        loc=(hx, hy, terrain_height(hx, hy)),
        rot_z=-0.04,
        has_porch=True,
        has_dormer=True,
        has_chimney=True,
        roof_alt=False,
    )

    # 2. LEFT-CENTER HERO: Old Zhou's Teal-Roof Workshop (with porch & side hanging fish rack)
    wx, wy = -6.6, shore_y(-6.6) + 6.3
    build_hero_cottage(
        "House_02_ArtisanWorkshop",
        width=4.6,
        depth=3.8,
        wall_h=2.22,
        ridge_h=1.62,
        col=col_hero,
        mats=mats,
        loc=(wx, wy, terrain_height(wx, wy)),
        rot_z=0.14,
        has_porch=True,
        has_dormer=False,
        has_chimney=True,
        roof_alt=True,
        has_fish_rack=True,
    )

    # 3. RIGHT-CENTER HERO: East Honey-Wood Cottage (with porch & signature ship's wheel!)
    ex, ey = 10.6, shore_y(10.6) + 6.2
    build_hero_cottage(
        "House_03_EastHoneyCottage",
        width=4.3,
        depth=3.6,
        wall_h=2.16,
        ridge_h=1.55,
        col=col_hero,
        mats=mats,
        loc=(ex, ey, terrain_height(ex, ey)),
        rot_z=-0.16,
        has_porch=True,
        has_dormer=False,
        has_chimney=True,
        roof_alt=False,
        has_wheel=True,
    )

    # 4. FAR-LEFT: Blue-Slate Fisherman's Hut (Frames Panel 1 & 2 left edge!)
    fx, fy = -13.2, shore_y(-13.2) + 5.8
    build_hero_cottage(
        "House_04_WestBlueHut",
        width=3.5,
        depth=3.0,
        wall_h=2.02,
        ridge_h=1.42,
        col=col_hero,
        mats=mats,
        loc=(fx, fy, terrain_height(fx, fy)),
        rot_z=0.28,
        has_porch=False,
        has_dormer=False,
        has_chimney=True,
        roof_alt=True,
    )

    # 5. FAR-RIGHT COVE COTTAGE (Frames Panel 1 & 2 right shore before lighthouse headland!)
    rx, ry = 16.5, shore_y(16.5) + 5.5
    build_hero_cottage(
        "House_05_EastCoveCottage",
        width=3.6,
        depth=3.1,
        wall_h=2.05,
        ridge_h=1.45,
        col=col_hero,
        mats=mats,
        loc=(rx, ry, terrain_height(rx, ry)),
        rot_z=-0.30,
        has_porch=False,
        has_dormer=False,
        has_chimney=True,
        roof_alt=False,
    )

    # -------------------------------------------------------------------------
    # UPPER HILLSIDE TERRACE ROW (Elevated cozy storybook village backdrop!)
    # -------------------------------------------------------------------------
    back_specs = [
        ("House_Back_01", -11.5, 13.8, 3.8, 3.1, 2.05, 1.48, 0.20, False),
        ("House_Back_02", -3.2, 14.8, 4.1, 3.3, 2.15, 1.56, 0.06, False),
        ("House_Back_03", 6.8, 14.6, 4.0, 3.2, 2.10, 1.52, -0.08, True),
        ("House_Back_04", 14.6, 12.6, 3.6, 2.9, 1.98, 1.42, -0.22, False),
    ]
    for nm, bx, by, bw, bd, bh, brh, brot, ralt in back_specs:
        build_hero_cottage(
            nm, bw, bd, bh, brh, col_back, mats,
            loc=(bx, by, terrain_height(bx, by)), rot_z=brot,
            has_porch=False, has_dormer=False, has_chimney=True, roof_alt=ralt
        )

    # -------------------------------------------------------------------------
    # HERO FISH MARKET STALL (Right beside Workshop along stone promenade — Panel 3!)
    # -------------------------------------------------------------------------
    mx, my = -8.6, shore_y(-8.6) + 3.45
    build_fish_market_stall(col_props, mats, loc=(mx, my, terrain_height(mx, my)), rot_z=0.16)

    # -------------------------------------------------------------------------
    # 3 TIERED WOODEN PIERS WITH STAIRS FROM STONE QUAY (Panels 1, 2, 4!)
    # -------------------------------------------------------------------------
    # West Market Pier
    build_tiered_pier("Pier_01_Market", px=-7.5, y_quay=shore_y(-7.5) + 0.15, y_end=shore_y(-7.5) - 5.4, col=col_piers, mats=mats, pier_w=2.35, has_boat=False, has_lantern=True)
    # Center Hero Home Pier (wider + moored rowboat!)
    build_tiered_pier("Pier_02_PlayerHome", px=2.6, y_quay=shore_y(2.6) + 0.15, y_end=shore_y(2.6) - 6.0, col=col_piers, mats=mats, pier_w=2.65, has_boat=True, has_lantern=True)
    # East Cove Jetty
    build_tiered_pier("Pier_03_EastCove", px=13.4, y_quay=shore_y(13.4) + 0.15, y_end=shore_y(13.4) - 4.8, col=col_piers, mats=mats, pier_w=2.15, has_boat=False, has_lantern=True)

    # -------------------------------------------------------------------------
    # EASTERN ROCKY HEADLAND & ICONIC LIGHTHOUSE (Panels 1 & 4 — scaled cleanly for full horizon silhouette!)
    # -------------------------------------------------------------------------
    lhx, lhy = 26.2, -3.4
    lh_root = build_lighthouse_headland(col_lh, mats, loc=(lhx, lhy, terrain_height(lhx, lhy) - 0.18))
    lh_root.scale = (0.78, 0.78, 0.78)

    # -------------------------------------------------------------------------
    # STREET LANTERNS, FLOWER BUSHES & STORYBOOK TREES
    # -------------------------------------------------------------------------
    for idx, lx in enumerate([-11.2, -4.0, 0.2, 6.4, 11.8, 17.6]):
        ly = shore_y(lx) + 1.15
        lz = 1.18
        add_cyl(f"StreetLamp_Post_{idx}", 0.05, 0.07, 2.35, (lx, ly, lz + 1.18), col_props, mats["accent"], segs=8)
        add_box(f"StreetLamp_Head_{idx}", (0.24, 0.24, 0.34), (lx, ly - 0.12, lz + 2.38), col_props, mats["wall"], bevel=0.02)

    tree_spots = [
        # Dramatic foreground-left framing tree on western bluff (Panel 1!)
        (-19.5, -1.2, 1.65),
        (-16.8, 2.6, 1.25),
        (-17.8, 8.2, 1.35),
        # Lush backdrop tree clusters crowning the rolling hills
        (-14.5, 16.5, 1.35),
        (-8.2, 17.8, 1.48),
        (-4.5, 19.2, 1.30),
        (1.2, 18.8, 1.52),
        (4.5, 20.5, 1.28),
        (10.8, 18.2, 1.44),
        (16.8, 16.0, 1.38),
        (21.2, 9.5, 1.22),
        (22.8, 4.2, 1.05),
        # Mid-village cozy shade trees between cottages
        (-1.2, 10.6, 1.08),
        (7.0, 10.2, 1.02),
        (-10.2, 9.8, 1.05),
        (14.5, 8.8, 0.98),
        # Distant ridge trees
        (-22.0, 16.5, 1.45),
        (-16.0, 24.0, 1.55),
        (-6.0, 26.5, 1.60),
        (6.5, 27.0, 1.58),
        (18.0, 23.0, 1.45),
    ]
    for i, (tx, ty, ts) in enumerate(tree_spots):
        build_tree(f"Tree_{i:02d}", (tx, ty, terrain_height(tx, ty) - 0.15), ts, col_props, mats, seed=500 + i)

    # Cozy hydrangea bushes along promenade & market stall
    bush_spots = [
        (-11.4, shore_y(-11.4) + 3.2), (-5.0, shore_y(-5.0) + 3.2),
        (-0.2, shore_y(-0.2) + 3.8), (6.4, shore_y(6.4) + 3.5),
        (14.2, shore_y(14.2) + 3.4), (-7.0, shore_y(-7.0) + 2.5),
    ]
    for i, (bx, by) in enumerate(bush_spots):
        add_ico(f"Bush_{i}", 0.48, (bx, by, 1.36), (1.25, 1.05, 0.78), col_props, mats["foliage"], subdiv=2, jitter=0.14, seed=700 + i)

    # -------------------------------------------------------------------------
    # EXACT 1.26m CHARACTER & 0.58m DOG SCALE MANNEQUINS (So player judges scale immediately!)
    # -------------------------------------------------------------------------
    # 1. Ah Lian behind Fish Market Counter + Player buying fish (Panel 3!)
    build_scale_mannequin("Mannequin_AhLian", (mx - 0.10, my + 0.52, 1.15), col_scale, mats, rot_z=0.18, hat=False)
    build_scale_mannequin("Mannequin_MarketVisitor", (mx + 0.35, my - 1.05, 1.15), col_scale, mats, rot_z=math.pi + 0.22, hat=True)
    # 2. Old Zhou standing in front of Workshop
    build_scale_mannequin("Mannequin_LaoZhou", (wx + 1.05, wy - 2.95, 1.15), col_scale, mats, rot_z=-0.25, hat=False)
    # 3. Player sitting at the end of Center Hero Pier with Companion Dog (Panel 4!)
    p2_end = shore_y(2.6) - 5.55
    build_scale_mannequin("Mannequin_PlayerPier", (2.25, p2_end, 0.52), col_scale, mats, rot_z=-0.25, hat=True, sitting=True)
    build_dog_mannequin("Mannequin_DogPier", (3.08, p2_end + 0.18, 0.52), col_scale, mats, rot_z=-0.30)
    # Fishing rod silhouette held by pier fisherman!
    add_cyl("Mannequin_FishingRod", 0.018, 0.032, 2.35, (2.68, p2_end - 0.92, 1.38), col_scale, mats["timber"], rot=(1.08, 0.0, -0.35), segs=6)
    # 4. Promenade walker & second dog near East Cottage (Panel 2 scale reference!)
    build_scale_mannequin("Mannequin_EastVillager", (8.2, shore_y(8.2) + 2.1, 1.15), col_scale, mats, rot_z=-0.4, hat=False)
    build_dog_mannequin("Mannequin_DogPromenade", (6.8, shore_y(6.8) + 1.85, 1.15), col_scale, mats, rot_z=1.2)

    return mats


# =============================================================================
# 7. STUDIO CLAY LIGHTING & 4 STORYBOARD CAMERAS + KITBASH SCALE SHEET
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

    # Soft bright studio sky dome (cool architectural daylight fill)
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

    # Warm crisp architectural Sun Key Light casting soft sculpted clay shadows!
    sun_d = bpy.data.lights.new("ClaySun", type="SUN")
    sun_d.energy = 3.4
    sun_d.color = (1.0, 0.96, 0.90)
    sun_d.angle = math.radians(2.8)
    sun = bpy.data.objects.new("ClaySun", sun_d)
    sun.rotation_euler = Euler((math.radians(52), math.radians(12), math.radians(-38)), "XYZ")
    scene.collection.objects.link(sun)


def aim_camera(cam, loc, target, lens=35):
    cam.data.lens = lens
    cam.location = Vector(loc)
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_4_storyboard_shots():
    scene = bpy.context.scene
    setup_clay_render(scene, res_x=960, res_y=540, samples=32)

    cam_d = bpy.data.cameras.new("StoryboardCam")
    cam_d.clip_end = 500.0
    cam = bpy.data.objects.new("StoryboardCam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # Save full assembled whitebox .blend BEFORE rendering so user can also inspect in Blender!
    blend_path = os.path.join(BASE_DIR, "stillwater_village_whitebox_v2.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[Whitebox] Saved assembled village .blend -> {blend_path}")

    shots = [
        # Shot 1 (Panel 1 - Top Left): Elevated wide establishing shot over crescent bay, ALL cottages & full lighthouse headland!
        ("shot1_bay_establishing.png", (-25.8, -21.5, 16.5), (5.5, 3.2, 2.2), 27),
        # Shot 2 (Panel 2 - Top Right): Lagoon boat-level hero facade elevation of the 3 enlarged cottages & piers!
        ("shot2_boat_waterfront.png", (0.8, -19.2, 3.7), (1.2, 4.5, 2.4), 34),
        # Shot 3 (Panel 3 - Bottom Left): Street-level Fish Market & Village Promenade human-scale shot!
        ("shot3_market_street.png", (-11.8, -2.2, 2.75), (-2.0, 5.2, 2.0), 33),
        # Shot 4 (Panel 4 - Bottom Right): Pier-end cozy fishing view with fisherman, dog & FULL distant lighthouse headland!
        ("shot4_pier_fishing.png", (-1.4, -7.8, 2.35), (12.8, -2.8, 2.55), 27),
    ]

    for fname, loc, tgt, lens in shots:
        aim_camera(cam, loc, tgt, lens=lens)
        out_p = os.path.join(RENDER_DIR, fname)
        scene.render.filepath = out_p
        bpy.ops.render.render(write_still=True)
        print(f"[Whitebox Render] Saved {out_p}")


def render_kitbash_scale_sheet():
    """
    Shot 5 (Aetheria-style Asset Segregation / Scale Comparison Lineup!):
    Lines up all enlarged modular whitebox buildings side-by-side next to a 1.26m player
    mannequin and clean 1m metric reference markers so the user can judge exact house scale!
    """
    clear_scene()
    mats = build_palette()
    col = make_collection("Kitbash_Lineup")

    # Studio seamless floor plinth
    add_box("StudioFloor", (56.0, 26.0, 0.2), (0, 0, -0.1), col, mats["terrain"], bevel=0.0)

    # 2m interval metric grid ruler strips in front for instant visual scale reading!
    for gx in range(-18, 19, 2):
        add_box(f"GridTick_{gx}", (0.08, 0.55, 0.03), (gx, -4.2, 0.015), col, mats["accent"], bevel=0.0)
    add_box("GridAxis", (37.0, 0.07, 0.03), (0, -4.2, 0.015), col, mats["accent"], bevel=0.0)

    # Clean non-overlapping showcase lineup left-to-right!
    # 1. 1.26m Player + 0.58m Dog Scale Anchor
    build_scale_mannequin("Ref_Player_126cm", (-14.8, -1.6, 0.0), col, mats, rot_z=0.15, hat=True)
    build_dog_mannequin("Ref_Dog_58cm", (-13.8, -1.5, 0.0), col, mats, rot_z=-0.2)

    # 2. Enlarged Red Hero Cottage (5.4m x 4.4m x 4.68m total w/ plinth)
    build_hero_cottage("Kit_PlayerHero_5.4m", 5.4, 4.4, 2.35, 1.78, col, mats, loc=(-9.4, 1.0, 0.0), has_porch=True, has_dormer=True, has_chimney=True)
    build_scale_mannequin("Ref_Player_AtDoor", (-9.9, -2.5, 0.0), col, mats, rot_z=0.1, hat=True)

    # 3. Enlarged Teal Workshop (4.6m x 3.8m)
    build_hero_cottage("Kit_Workshop_4.6m", 4.6, 3.8, 2.22, 1.62, col, mats, loc=(-2.2, 1.0, 0.0), has_porch=True, has_chimney=True, roof_alt=True, has_fish_rack=True)

    # 4. Enlarged Fish Market Stall (2.85m wide — cleanly spaced!)
    build_fish_market_stall(col, mats, loc=(3.2, -0.4, 0.0), rot_z=0.0)
    build_scale_mannequin("Ref_AhLian_AtStall", (3.1, 0.25, 0.0), col, mats, rot_z=0.0, hat=False)

    # 5. Enlarged East Honey Cottage (4.3m x 3.6m)
    build_hero_cottage("Kit_EastCottage_4.3m", 4.3, 3.6, 2.16, 1.55, col, mats, loc=(8.6, 1.0, 0.0), has_porch=True, has_chimney=True, has_wheel=True)

    # 6. Coastal Lighthouse Tower (scaled 0.78x -> ~7.8m tall)
    lh_k = build_lighthouse_headland(col, mats, loc=(15.4, 1.6, -0.20))
    lh_k.scale = (0.78, 0.78, 0.78)

    scene = bpy.context.scene
    setup_clay_render(scene, res_x=1800, res_y=700, samples=32)
    cam_d = bpy.data.cameras.new("KitCam")
    cam_d.type = "PERSP"
    cam_d.clip_end = 300.0
    cam = bpy.data.objects.new("KitCam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    aim_camera(cam, (0.6, -34.0, 7.8), (0.6, 0.6, 2.6), lens=38)
    out_p = os.path.join(RENDER_DIR, "shot5_kitbash_scale_sheet.png")
    scene.render.filepath = out_p
    bpy.ops.render.render(write_still=True)
    print(f"[Whitebox Render] Saved {out_p}")


def main():
    build_full_village_whitebox()
    render_4_storyboard_shots()
    render_kitbash_scale_sheet()


if __name__ == "__main__":
    main()
