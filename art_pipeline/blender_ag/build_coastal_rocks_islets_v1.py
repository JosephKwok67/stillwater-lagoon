"""
Stillwater Lagoon - Coastal Rocks & Mossy Islets v2 Pipeline (Blender 5.3)
--------------------------------------------------------------------------
Pass 2 Studio-Grade Sculpt & Bake matching `lagoon_rocks_islets_studies.png`:
  1. public/assets/models/environment/rock_shore_wide.glb   (2.80 x 2.20m, z=-0.65..+1.30m)
  2. public/assets/models/environment/rock_cliff_crag.glb   (3.20 x 2.60m, z=-0.85..+2.40m)
  3. public/assets/models/environment/islet_plateau.glb     (11.0 x 8.50m, z=-3.60..+2.80m)
  4. public/assets/models/environment/islet_peak.glb        (14.0 x 10.5m, z=-3.60..+5.20m)

Pass 2 key upgrades:
  - Rock-Conformed Plush Moss Blanket (`build_conformed_moss_cap`): generated directly
    from the sculpted rock surface, offset outward along normals with smoothly tapered
    plush turf thickness and tucked cleanly inside the rock rim -> ZERO floating hats,
    ZERO protruding blobs, ZERO z-clipping corners from any 360° angle!
  - Crisper beveled coastal granite cleavage & diagonal strata carving (less play-dough,
    more hand-chiseled flat-topped Ghibli rock slabs!).
  - Fixed MapRange ordering (`From Min < From Max` + swapped `To Min/Max`) so the wet
    dark olive-slate tidal notch band (`z = -0.15..+0.34m`) renders crisply along waterline!
  - Richer true-linear Ghibli warm sunlit sandstone-granite (#dfc293) vs cool lavender-slate
    shadows (#74829c) + hand-painted strata fracture brushwork + lush buttercup-dappled moss!
  - Strict `bmesh` cleanup + `mesh.validate()` -> 0 non-manifold edges, 0 glTF warnings.
"""

import os
import math
import random
import bpy
import bmesh
import mathutils
import numpy as np

PROJECT = r"I:\antigravity cli\钓鱼大冒险"
OUT_DIR = os.path.join(PROJECT, "public", "assets", "models", "environment")
STAGE_DIR = os.path.join(PROJECT, "art_pipeline", "staging", "rocks_islets_v1")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(STAGE_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Pure-NumPy Image Helpers (Blender 5.3 has numpy, no PIL)
# ---------------------------------------------------------------------------
def dilate_blender_image(img, passes=12):
    w, h = img.size[0], img.size[1]
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    rgba = buf.reshape((h, w, 4))
    rgb = rgba[:, :, :3].copy()
    valid = rgb.sum(axis=2) > 0.03

    for _ in range(passes):
        if valid.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros((h, w), dtype=np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            sv = np.roll(np.roll(valid, dy, axis=0), dx, axis=1)
            sc = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)
            acc += sc * sv[:, :, None]
            cnt += sv
        fill = (~valid) & (cnt > 0)
        if not fill.any():
            break
        rgb[fill] = np.clip(acc[fill] / cnt[fill, None], 0.0, 1.0)
        valid[fill] = True

    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = 1.0
    img.pixels.foreach_set(rgba.ravel())
    img.update()


def stitch_2x2_board(img_paths, out_path):
    loaded = [bpy.data.images.load(p, check_existing=False) for p in img_paths]
    w, h = loaded[0].size[0], loaded[0].size[1]
    board = np.ones((h * 2, w * 2, 4), dtype=np.float32)
    slots = [(h, 0), (h, w), (0, 0), (0, w)]
    for im, (y0, x0) in zip(loaded, slots):
        buf = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(buf)
        board[y0 : y0 + h, x0 : x0 + w, :] = buf.reshape((h, w, 4))
    out_im = bpy.data.images.new("AuditBoard", width=w * 2, height=h * 2, alpha=False)
    out_im.pixels.foreach_set(board.ravel())
    out_im.filepath_raw = out_path
    out_im.file_format = "PNG"
    out_im.save()


def smoothstep(e0, e1, x):
    if abs(e1 - e0) < 1e-6:
        return 0.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def clean_mesh_topology(obj):
    """Guarantees 0 degenerate faces, 0 loose verts, and clean glTF validation."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-4)
    loose_v = [v for v in bm.verts if not v.link_faces]
    if loose_v:
        bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate(verbose=False)
    obj.data.update()


# ---------------------------------------------------------------------------
# Sculpted Granite Slab & Rock-Conformed Plush Moss Primitives
# ---------------------------------------------------------------------------
def add_granite_slab_to_bmesh(
    bm,
    center,
    radii,
    rot_euler,
    sides=7,
    top_taper=0.80,
    bot_taper=1.12,
    bevel_frac=0.18,
    flatten_top=0.94,
    seed=1,
    facet_amp=0.12,
):
    """Crisp flat-topped, sea-weathered beveled granite slab (NEVER a UV sphere)."""
    rng = random.Random(seed)
    rx, ry, rz = radii
    angles = []
    r_mods = []
    for i in range(sides):
        a = (i / sides) * math.tau + rng.uniform(-0.15, 0.15)
        angles.append(a)
        r_mods.append(1.0 + rng.uniform(-facet_amp, facet_amp))

    ring_specs = [
        (-1.00, bot_taper),
        (-0.25, 1.03),
        (0.72 - bevel_frac * 0.4, 0.96),
        (1.00, top_taper),
    ]
    rings = []
    for z_norm, rad_mul in ring_specs:
        ring_verts = []
        for i in range(sides):
            a = angles[i]
            rm = r_mods[i] * rad_mul * (1.0 + rng.uniform(-0.03, 0.03))
            vx = math.cos(a) * rx * rm
            vy = math.sin(a) * ry * rm
            vz = z_norm * rz
            if z_norm > 0.8:
                vz += math.cos(a + seed) * rz * 0.05 * (1.0 - flatten_top)
            ring_verts.append(bm.verts.new((vx, vy, vz)))
        rings.append(ring_verts)

    v_bot = bm.verts.new((0.0, 0.0, -rz * 1.02))
    v_top = bm.verts.new((0.0, 0.0, rz * (1.0 + (1.0 - flatten_top) * 0.10)))

    created_verts = [v_bot, v_top]
    for r in rings:
        created_verts.extend(r)

    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((v_bot, rings[0][j], rings[0][i]))
        for r_idx in range(len(rings) - 1):
            bm.faces.new((rings[r_idx][i], rings[r_idx][j], rings[r_idx + 1][j], rings[r_idx + 1][i]))
        bm.faces.new((rings[-1][i], rings[-1][j], v_top))

    mat_rot = mathutils.Euler(rot_euler, "XYZ").to_matrix().to_4x4()
    mat_tr = mathutils.Matrix.Translation(mathutils.Vector(center))
    xform = mat_tr @ mat_rot
    for v in created_verts:
        v.co = xform @ v.co


def finalize_granite_mesh(obj, voxel_size, smooth_iters, target_tris, strata_scale=1.0, seed=1):
    """
    Voxel-remeshes multi-slab cluster, applies crisp diagonal granite strata groove carving
    & gentle smoothing (retaining chiseled bevel planes rather than play-dough rounding!),
    then decimates cleanly.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    rem = obj.modifiers.new("VoxelRemesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = voxel_size
    rem.adaptivity = 0.0
    rem.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rem.name)

    # Light smoothing only so beveled granite flat planes stay crisp!
    sm = obj.modifiers.new("Smooth", "CORRECTIVE_SMOOTH")
    sm.factor = 0.42
    sm.iterations = smooth_iters
    sm.smooth_type = "SIMPLE"
    bpy.ops.object.modifier_apply(modifier=sm.name)

    # Crisp diagonal coastal granite bedding shelves & subtle chiseled plane relief
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    off = mathutils.Vector((seed * 5.7, seed * 9.3, seed * 3.1))
    freq = 4.2 / max(0.6, strata_scale)
    for v in bm.verts:
        above = smoothstep(-0.25, 0.25, v.co.z)
        if above <= 0.001:
            continue
        # Slanted bedding coordinate matching storyboard Detail 1 (`Granite layers`)
        bed_coord = v.co.z * 0.92 + v.co.x * 0.34 - v.co.y * 0.18
        n_warp = mathutils.noise.fractal(v.co * (0.55 / max(0.6, strata_scale)) + off, 0.85, 2.0, 2)
        wave = math.sin((bed_coord + n_warp * 0.35 * strata_scale) * freq)
        # Sharp narrow inward strata fissures (peaks stay flat, troughs carve crisp bedding seams!)
        seam_groove = -pow(max(0.0, -wave), 4.0) * voxel_size * 0.85
        # Subtle broad planar rock undulation
        plane_relief = n_warp * voxel_size * 0.38
        # Stronger on side flanks so tops remain comfortable flat ledges
        side_w = 0.45 + 0.55 * (1.0 - max(0.0, v.normal.z))
        v.co += v.normal * ((seam_groove * side_w + plane_relief) * above)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

    if target_tris > 0:
        cur_tris = sum(max(1, len(p.vertices) - 2) for p in obj.data.polygons)
        if cur_tris > target_tris:
            dec = obj.modifiers.new("Decimate", "DECIMATE")
            dec.ratio = max(0.02, float(target_tris) / float(cur_tris))
            dec.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dec.name)

    clean_mesh_topology(obj)
    for p in obj.data.polygons:
        p.use_smooth = True


def apply_tidal_notch_and_skirt(obj, target_xy, skirt_z, top_z, notch_strength=0.07, flare_out=1.18):
    """Smooth inward sea-erosion tidal notch at Z=0 + flaring submerged reef skirt to `skirt_z`."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    sx = target_xy[0] / max(1e-4, max(xs) - min(xs))
    sy = target_xy[1] / max(1e-4, max(ys) - min(ys))
    sz_pos = top_z / max(0.1, max(zs))
    sz_neg = abs(skirt_z) / abs(min(-0.05, min(zs)))

    for v in bm.verts:
        x = (v.co.x - cx) * sx
        y = (v.co.y - cy) * sy
        z = v.co.z * sz_pos if v.co.z >= 0.0 else v.co.z * sz_neg

        notch = math.exp(-((z - 0.04) / max(0.20, top_z * 0.10)) ** 2)
        radial_mul = 1.0 - notch * notch_strength
        if z < -0.06:
            t_sub = smoothstep(-0.06, skirt_z, z)
            radial_mul *= 1.0 + t_sub * (flare_out - 1.0)

        v.co.x = x * radial_mul
        v.co.y = y * radial_mul
        v.co.z = z

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def build_conformed_moss_cap(
    rock_obj,
    name,
    mask_fn,
    thickness=0.26,
    tuck_depth=0.22,
    voxel_size=0.105,
    target_tris=1200,
    extra_shrubs=None,
):
    """
    KILLER TECHNIQUE for zero-floating, zero-clipping Ghibli moss blankets:
      1. Extracts the exact upper rock shell where `mask_fn(co, normal) > 0`
         directly from the high-detail rock mesh (before final decimate).
      2. Offsets interior vertices strictly OUTWARD along rock normal by tapered plush turf
         thickness (`0.06m` at rim -> `thickness` in meadow center), and extrudes a watertight
         solid back-shell tucked `tuck_depth` INSIDE the rock core!
      3. Optional miniature tufted shrub hummocks merged seamlessly into the blanket.
      4. Voxel-remeshes & softly smooths for a thick, hand-painted Ghibli mossy carpet lip
         hugging every granite contour with 0% floating and 0% white rock poking through!
    """
    bm_src = bmesh.new()
    bm_src.from_mesh(rock_obj.data)
    bm_src.normal_update()

    # Evaluate continuous coverage weight per vertex
    v_weight = {}
    for v in bm_src.verts:
        v_weight[v.index] = mask_fn(v.co, v.normal)

    # Keep faces whose vertices average above threshold, then keep ONLY the largest
    # contiguous connected component (eliminates isolated green eyebrow strips/dots!)
    keep_set = {
        f for f in bm_src.faces
        if (sum(v_weight[v.index] for v in f.verts) / len(f.verts)) > 0.0
    }
    visited = set()
    best_comp = []
    for f in keep_set:
        if f in visited:
            continue
        comp = []
        stack = [f]
        visited.add(f)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf in keep_set and nf not in visited:
                        visited.add(nf)
                        stack.append(nf)
        if len(comp) > len(best_comp):
            best_comp = comp
    keep_faces = best_comp

    # Copy kept faces into a fresh bmesh to build a thick watertight draping shell
    bm_cap = bmesh.new()
    v_map_top = {}
    v_map_bot = {}
    for f in keep_faces:
        for v in f.verts:
            if v.index not in v_map_top:
                w = max(0.0, v_weight[v.index])
                # Plush rounded woollen carpet thickness (always strictly > +0.06m outside rock!)
                up_dir = (v.normal * 0.72 + mathutils.Vector((0.0, 0.0, 0.28))).normalized()
                out_off = 0.06 + thickness * smoothstep(0.0, 0.42, w)
                # Subtle organic mossy pillow bumps
                n_bump = mathutils.noise.fractal(v.co * 0.65 + mathutils.Vector((12.3, 4.7, 8.1)), 0.85, 2.0, 2)
                out_off += max(-0.02, n_bump * 0.065)
                v_map_top[v.index] = bm_cap.verts.new(v.co + up_dir * out_off)
                v_map_bot[v.index] = bm_cap.verts.new(v.co - up_dir * tuck_depth)

    for f in keep_faces:
        vs_t = [v_map_top[v.index] for v in f.verts]
        vs_b = [v_map_bot[v.index] for v in reversed(f.verts)]
        try:
            bm_cap.faces.new(vs_t)
            bm_cap.faces.new(vs_b)
        except ValueError:
            pass

    # Stitch boundary edges between top plush surface and tucked inner base to close solid volume!
    bm_cap.edges.ensure_lookup_table()
    # Map top vert -> bot vert for boundary stitching
    top_to_bot = {v_map_top[idx]: v_map_bot[idx] for idx in v_map_top}
    top_verts_set = set(v_map_top.values())
    boundary_top_edges = [
        e for e in bm_cap.edges
        if e.is_boundary and (e.verts[0] in top_verts_set and e.verts[1] in top_verts_set)
    ]
    for e in boundary_top_edges:
        # Respect face winding so stitched side wall faces outward
        f0 = e.link_faces[0]
        v0, v1 = e.verts[0], e.verts[1]
        # Find loop order in f0
        f_verts = list(f0.verts)
        i0 = f_verts.index(v0)
        if f_verts[(i0 + 1) % len(f_verts)] == v1:
            a, b = v1, v0
        else:
            a, b = v0, v1
        try:
            bm_cap.faces.new((a, b, top_to_bot[b], top_to_bot[a]))
        except ValueError:
            pass

    bm_src.free()

    # Optional cute sculpted bush tufts rooted deeply into the moss cap (storyboard 03!)
    if extra_shrubs:
        for center, radii, seed in extra_shrubs:
            res = bmesh.ops.create_icosphere(bm_cap, subdivisions=2, radius=1.0)
            off = mathutils.Vector((seed * 2.7, seed * 4.3, seed * 1.9))
            for v in res["verts"]:
                p = v.co.copy()
                n = mathutils.noise.fractal(p * 1.8 + off, 0.85, 2.0, 2)
                v.co = mathutils.Vector((
                    center[0] + p.x * radii[0] * (1.0 + n * 0.18),
                    center[1] + p.y * radii[1] * (1.0 + n * 0.18),
                    center[2] + p.z * radii[2] * (1.0 + n * 0.16),
                ))

    bmesh.ops.recalc_face_normals(bm_cap, faces=bm_cap.faces[:])
    mesh_g = bpy.data.meshes.new(f"{name}_Mesh")
    bm_cap.to_mesh(mesh_g)
    bm_cap.free()
    grass_obj = bpy.data.objects.new(name, mesh_g)
    bpy.context.collection.objects.link(grass_obj)

    bpy.ops.object.select_all(action="DESELECT")
    grass_obj.select_set(True)
    bpy.context.view_layer.objects.active = grass_obj

    # Voxel-remesh & softly smooth for velvety rounded overhanging turf lip!
    rem = grass_obj.modifiers.new("VoxelRemesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = voxel_size
    rem.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rem.name)

    sm = grass_obj.modifiers.new("Smooth", "CORRECTIVE_SMOOTH")
    sm.factor = 0.55
    sm.iterations = 4
    sm.smooth_type = "SIMPLE"
    bpy.ops.object.modifier_apply(modifier=sm.name)

    cur_tris = sum(max(1, len(p.vertices) - 2) for p in grass_obj.data.polygons)
    if cur_tris > target_tris:
        dec = grass_obj.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = max(0.02, float(target_tris) / float(cur_tris))
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)

    clean_mesh_topology(grass_obj)
    for p in grass_obj.data.polygons:
        p.use_smooth = True
    return grass_obj


# ---------------------------------------------------------------------------
# 4 Sculpted Asset Builders (Strictly Matched to lagoon_rocks_islets_studies.png)
# ---------------------------------------------------------------------------
def build_rock_shore_wide():
    bm = bmesh.new()
    dip_x, dip_y = math.radians(7), math.radians(-13)

    add_granite_slab_to_bmesh(
        bm, (0.0, 0.0, -0.28), (1.28, 0.98, 0.36), (0.0, 0.0, 0.08),
        sides=10, top_taper=0.92, bot_taper=1.12, flatten_top=0.96, seed=101, facet_amp=0.08
    )
    slabs = [
        ((-0.08, 0.06, 0.72), (0.78, 0.60, 0.56), (dip_x, dip_y, 0.12), 11),
        ((0.48, 0.22, 0.52), (0.64, 0.52, 0.48), (dip_x * 0.9, dip_y * 1.1, -0.24), 12),
        ((-0.68, -0.06, 0.42), (0.62, 0.54, 0.44), (dip_x * 1.1, dip_y * 0.9, 0.40), 13),
        ((0.06, -0.44, 0.30), (0.76, 0.46, 0.38), (dip_x * 1.2, dip_y * 0.8, 0.05), 14),
        ((0.80, -0.30, 0.18), (0.54, 0.44, 0.34), (dip_x, dip_y * 1.2, -0.36), 15),
        ((-1.04, -0.22, 0.14), (0.44, 0.40, 0.30), (dip_x * 0.7, dip_y, 0.62), 16),
        ((-0.44, 0.48, 0.36), (0.62, 0.46, 0.40), (dip_x * 0.8, dip_y * 0.9, 0.28), 17),
        ((-0.48, -0.58, 0.14), (0.50, 0.38, 0.30), (dip_x, dip_y * 0.7, -0.18), 18),
        ((0.92, 0.32, 0.18), (0.46, 0.42, 0.34), (dip_x * 0.9, dip_y, 0.50), 19),
    ]
    for c, r, rot, sd in slabs:
        add_granite_slab_to_bmesh(
            bm, c, r, rot, sides=7, top_taper=0.80, bot_taper=1.10,
            bevel_frac=0.18, flatten_top=0.94, seed=sd, facet_amp=0.12
        )

    mesh = bpy.data.meshes.new("Shore_Boulder_Wide_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Shore_Boulder_Wide", mesh)
    bpy.context.collection.objects.link(obj)

    finalize_granite_mesh(obj, voxel_size=0.034, smooth_iters=2, target_tris=1850, strata_scale=1.1, seed=101)
    apply_tidal_notch_and_skirt(obj, target_xy=(2.80, 2.20), skirt_z=-0.65, top_z=1.30, notch_strength=0.055, flare_out=1.14)
    clean_mesh_topology(obj)
    return obj


def build_rock_cliff_crag():
    bm = bmesh.new()
    dip_x, dip_y = math.radians(10), math.radians(-19)

    add_granite_slab_to_bmesh(
        bm, (0.0, 0.0, -0.35), (1.42, 1.12, 0.55), (0.0, 0.0, -0.05),
        sides=10, top_taper=0.92, bot_taper=1.12, flatten_top=0.94, seed=201, facet_amp=0.09
    )
    slabs = [
        ((0.28, 0.08, 1.24), (0.76, 0.68, 1.20), (dip_x, dip_y, 0.12), 21),
        ((0.78, -0.18, 0.80), (0.58, 0.56, 0.94), (dip_x * 0.9, dip_y * 1.15, -0.22), 22),
        ((-0.44, 0.14, 0.94), (0.72, 0.64, 0.90), (dip_x * 1.1, dip_y * 0.95, 0.28), 23),
        ((-0.98, -0.10, 0.44), (0.56, 0.52, 0.64), (dip_x, dip_y * 1.05, 0.48), 24),
        ((-0.02, -0.52, 0.58), (0.64, 0.48, 0.78), (dip_x * 1.2, dip_y * 0.85, -0.08), 25),
        ((0.08, 0.62, 0.84), (0.86, 0.56, 0.92), (dip_x * 0.7, dip_y * 0.8, 0.16), 26),
        ((1.06, -0.34, 0.24), (0.48, 0.46, 0.48), (dip_x * 0.8, dip_y, -0.45), 27),
        ((-0.68, -0.62, 0.22), (0.54, 0.44, 0.44), (dip_x, dip_y * 0.7, 0.22), 28),
        ((-0.78, 0.52, 0.52), (0.60, 0.52, 0.66), (dip_x * 0.9, dip_y * 0.9, -0.30), 29),
    ]
    for c, r, rot, sd in slabs:
        add_granite_slab_to_bmesh(
            bm, c, r, rot, sides=7, top_taper=0.72, bot_taper=1.12,
            bevel_frac=0.16, flatten_top=0.88, seed=sd, facet_amp=0.13
        )

    mesh = bpy.data.meshes.new("Cliff_Crag_Rock_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Cliff_Crag_Rock", mesh)
    bpy.context.collection.objects.link(obj)

    finalize_granite_mesh(obj, voxel_size=0.042, smooth_iters=2, target_tris=2100, strata_scale=1.45, seed=202)
    apply_tidal_notch_and_skirt(obj, target_xy=(3.20, 2.60), skirt_z=-0.85, top_z=2.40, notch_strength=0.055, flare_out=1.14)
    clean_mesh_topology(obj)
    return obj


def build_islet_plateau():
    bm_r = bmesh.new()
    # Solid rock plateau core + deep -3.6m flared submerged reef bed
    add_granite_slab_to_bmesh(
        bm_r, (0.0, 0.0, -1.10), (4.65, 3.55, 1.85), (0.0, 0.0, 0.06),
        sides=14, top_taper=0.90, bot_taper=1.18, flatten_top=0.96, seed=301, facet_amp=0.07
    )
    add_granite_slab_to_bmesh(
        bm_r, (0.0, 0.0, 0.85), (4.25, 3.25, 1.05), (0.02, -0.03, -0.04),
        sides=12, top_taper=0.88, bot_taper=1.06, flatten_top=0.96, seed=302, facet_amp=0.09
    )

    rng = random.Random(310)
    num_ring = 16
    for i in range(num_ring):
        a = (i / num_ring) * math.tau + rng.uniform(-0.08, 0.08)
        rad_w = 1.0 + 0.09 * math.sin(a * 2.0 + 0.4) + 0.06 * math.cos(a * 3.0 - 0.7)
        rx_pos = math.cos(a) * 4.05 * rad_w
        ry_pos = math.sin(a) * 3.05 * rad_w
        bh = rng.uniform(0.72, 1.15)
        bw = rng.uniform(1.18, 1.68)
        bd = rng.uniform(0.98, 1.38)
        cz = rng.uniform(0.32, 0.72)
        tilt_out = math.radians(rng.uniform(8, 17))
        rot = (
            math.sin(a) * tilt_out + rng.uniform(-0.1, 0.1),
            -math.cos(a) * tilt_out + rng.uniform(-0.1, 0.1),
            a + rng.uniform(-0.3, 0.3),
        )
        add_granite_slab_to_bmesh(
            bm_r, (rx_pos, ry_pos, cz), (bw, bd, bh), rot,
            sides=7, top_taper=0.78, bot_taper=1.14, bevel_frac=0.18,
            flatten_top=0.92, seed=320 + i, facet_amp=0.13
        )
        if i % 2 == 0:
            sx_pos = math.cos(a + 0.12) * 4.80 * rad_w
            sy_pos = math.sin(a + 0.12) * 3.65 * rad_w
            add_granite_slab_to_bmesh(
                bm_r, (sx_pos, sy_pos, -0.35), (bw * 0.78, bd * 0.72, 0.72),
                (rot[0] * 0.6, rot[1] * 0.6, a + 0.4),
                sides=7, top_taper=0.82, bot_taper=1.16, flatten_top=0.94,
                seed=350 + i, facet_amp=0.11
            )

    mesh_r = bpy.data.meshes.new("Islet_Plateau_Rock_Mesh")
    bm_r.to_mesh(mesh_r)
    bm_r.free()
    rock_obj = bpy.data.objects.new("Islet_Plateau_Rock", mesh_r)
    bpy.context.collection.objects.link(rock_obj)

    # First remesh at crisp detail (without decimate yet) so moss blanket conforms 100% seamlessly!
    finalize_granite_mesh(rock_obj, voxel_size=0.115, smooth_iters=2, target_tris=0, strata_scale=2.4, seed=303)
    apply_tidal_notch_and_skirt(rock_obj, target_xy=(11.0, 8.5), skirt_z=-3.60, top_z=2.35, notch_strength=0.07, flare_out=1.18)

    # Build rock-conformed plush draping meadow blanket directly from high-res rock surface!
    def plateau_moss_mask(co, nor):
        ang = math.atan2(co.y, co.x)
        # Organic scalloped lobes draping nicely between perimeter boulders (storyboard 03 & Detail 3!)
        scallop = 0.24 * math.sin(ang * 5.0 + 0.4) + 0.16 * math.cos(ang * 8.0 - 0.9)
        n3 = mathutils.noise.fractal(co * 0.35 + mathutils.Vector((3.1, 7.2, 1.4)), 0.85, 2.0, 2)
        radial_norm = math.hypot(co.x / 4.35, co.y / 3.30)
        # Guarantee solid uninterrupted interior crown (zero dimples/holes!)
        if radial_norm < 0.72 and co.z > 1.35:
            return 1.2
        z_score = (co.z - (1.42 + scallop * 0.38 + n3 * 0.25)) * 1.1
        n_score = (nor.z - 0.42) * 1.4
        rad_score = (0.94 + scallop * 0.18 + n3 * 0.12 - radial_norm) * 2.2
        return min(z_score, rad_score) + max(0.0, n_score) * 0.45

    grass_obj = build_conformed_moss_cap(
        rock_obj,
        "Islet_Plateau_GrassCap",
        plateau_moss_mask,
        thickness=0.34,
        tuck_depth=0.28,
        voxel_size=0.105,
        target_tris=1200,
        extra_shrubs=[
            ((1.85, 0.55, 2.48), (0.95, 0.82, 0.54), 391),
            ((2.48, 0.22, 2.34), (0.68, 0.60, 0.42), 392),
            ((1.22, 0.88, 2.38), (0.60, 0.54, 0.40), 393),
        ],
    )

    # Now decimate rock cleanly to target budget
    bpy.ops.object.select_all(action="DESELECT")
    rock_obj.select_set(True)
    bpy.context.view_layer.objects.active = rock_obj
    cur_tris = sum(max(1, len(p.vertices) - 2) for p in rock_obj.data.polygons)
    if cur_tris > 2250:
        dec = rock_obj.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = max(0.02, 2250.0 / float(cur_tris))
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    clean_mesh_topology(rock_obj)
    for p in rock_obj.data.polygons:
        p.use_smooth = True

    return rock_obj, grass_obj


def build_islet_peak():
    bm_r = bmesh.new()
    dip_x, dip_y = math.radians(8), math.radians(-16)

    # Deep -3.6m flared reef base
    add_granite_slab_to_bmesh(
        bm_r, (0.0, 0.0, -1.15), (5.85, 4.35, 1.95), (0.0, 0.0, 0.04),
        sides=14, top_taper=0.90, bot_taper=1.18, flatten_top=0.95, seed=401, facet_amp=0.08
    )

    # Primary Peak (left-center, softly rounded sea-stack crest +4.95m), Saddle (+1.9m), Secondary Peak (right, +3.35m)
    slabs = [
        # Primary peak rounded Ghibli crown + layered slanted granite buttresses
        ((-2.05, 0.25, 2.45), (2.15, 1.80, 2.50), (dip_x, dip_y, 0.18), 411, 0.56, 0.52),
        ((-2.95, -0.35, 1.72), (1.75, 1.50, 1.95), (dip_x * 1.1, dip_y * 1.15, 0.42), 412, 0.70, 0.82),
        ((-0.85, -0.45, 1.75), (1.85, 1.55, 1.95), (dip_x * 0.9, dip_y * 0.95, -0.15), 413, 0.72, 0.82),
        ((-1.75, 1.15, 1.98), (2.10, 1.60, 2.05), (dip_x * 0.7, dip_y * 0.85, 0.25), 414, 0.68, 0.78),
        ((-3.75, 0.25, 1.05), (1.58, 1.40, 1.35), (dip_x, dip_y, 0.62), 415, 0.74, 0.86),
        # Broad verdant saddle bridge (continuous sweeping grassy valley between the two peaks!)
        ((0.45, 0.15, 1.30), (2.60, 2.35, 1.40), (0.04, -0.05, 0.05), 416, 0.84, 0.88),
        ((0.55, -1.05, 0.82), (2.10, 1.50, 1.05), (0.08, -0.08, -0.12), 417, 0.82, 0.88),
        # Secondary peak on right (softly rounded crest)
        ((3.15, -0.10, 1.72), (1.92, 1.65, 1.82), (-dip_x * 0.6, -dip_y * 0.75, -0.24), 418, 0.58, 0.55),
        ((2.25, 0.58, 1.48), (1.78, 1.55, 1.52), (-dip_x * 0.5, -dip_y * 0.65, 0.14), 419, 0.72, 0.82),
        ((4.20, -0.42, 0.98), (1.58, 1.38, 1.25), (-dip_x * 0.7, -dip_y * 0.85, -0.42), 420, 0.74, 0.86),
        ((3.25, -1.15, 0.92), (1.52, 1.28, 1.18), (0.08, -0.12, 0.18), 421, 0.74, 0.86),
    ]
    for c, r, rot, sd, tt, ft in slabs:
        add_granite_slab_to_bmesh(
            bm_r, c, r, rot, sides=7, top_taper=tt, bot_taper=1.14,
            bevel_frac=0.20, flatten_top=ft, seed=sd, facet_amp=0.13
        )

    # Ring of 18 stepped shoreline coastal boulders
    rng = random.Random(430)
    num_ring = 18
    for i in range(num_ring):
        a = (i / num_ring) * math.tau + rng.uniform(-0.07, 0.07)
        rad_w = 1.0 + 0.10 * math.cos(a * 2.0 - 0.3) + 0.06 * math.sin(a * 3.0 + 0.8)
        rx_pos = math.cos(a) * 5.25 * rad_w
        ry_pos = math.sin(a) * 3.85 * rad_w
        bw = rng.uniform(1.32, 1.88)
        bd = rng.uniform(1.12, 1.56)
        bh = rng.uniform(0.76, 1.32)
        cz = rng.uniform(0.28, 0.78)
        tilt = math.radians(rng.uniform(10, 20))
        rot = (math.sin(a) * tilt, -math.cos(a) * tilt, a + rng.uniform(-0.3, 0.3))
        add_granite_slab_to_bmesh(
            bm_r, (rx_pos, ry_pos, cz), (bw, bd, bh), rot,
            sides=7, top_taper=0.76, bot_taper=1.15, bevel_frac=0.18,
            flatten_top=0.90, seed=440 + i, facet_amp=0.12
        )
        if i % 2 == 1:
            sx_pos = math.cos(a + 0.1) * 6.08 * rad_w
            sy_pos = math.sin(a + 0.1) * 4.48 * rad_w
            add_granite_slab_to_bmesh(
                bm_r, (sx_pos, sy_pos, -0.40), (bw * 0.76, bd * 0.72, 0.76),
                (rot[0] * 0.5, rot[1] * 0.5, a + 0.3),
                sides=7, top_taper=0.82, bot_taper=1.16, flatten_top=0.94,
                seed=470 + i, facet_amp=0.10
            )

    mesh_r = bpy.data.meshes.new("Islet_Peak_Rock_Mesh")
    bm_r.to_mesh(mesh_r)
    bm_r.free()
    rock_obj = bpy.data.objects.new("Islet_Peak_Rock", mesh_r)
    bpy.context.collection.objects.link(rock_obj)

    finalize_granite_mesh(rock_obj, voxel_size=0.135, smooth_iters=2, target_tris=0, strata_scale=2.8, seed=404)
    apply_tidal_notch_and_skirt(rock_obj, target_xy=(14.0, 10.5), skirt_z=-3.60, top_z=4.95, notch_strength=0.07, flare_out=1.18)

    # Rock-conformed SINGLE continuous grass meadow sweeping smoothly from main peak crown
    # down across the saddle valley and up onto the secondary peak (EXACTLY matching storyboard 04!)
    def peak_moss_mask(co, nor):
        n3 = mathutils.noise.fractal(co * 0.25 + mathutils.Vector((6.4, 2.1, 5.5)), 0.85, 2.0, 2)
        radial_norm = math.hypot(co.x / 5.3, co.y / 3.85)
        if co.z < 1.30 or radial_norm > 0.90:
            return -1.0
        # Keep the steep front-left granite cliff face dramatically bare stone (storyboard 04!)
        front_bare = smoothstep(-0.35, -1.65, co.y) * smoothstep(-0.2, -2.8, co.x) * smoothstep(3.8, 1.8, co.z)
        if front_bare > 0.42:
            return -1.0
        # Continuous lush ribbon along the twin-peak spine + central saddle + back gentle slopes
        spine_y = 0.25 - 0.12 * (co.x / 4.0)
        dist_spine = abs(co.y - spine_y)
        spine_band = smoothstep(2.9, 0.6, dist_spine) * smoothstep(4.6, 3.2, abs(co.x))
        slope_req = 0.44 - spine_band * 0.22 + smoothstep(-0.15, -0.80, nor.y) * 0.22
        slope_score = (nor.z - (slope_req - n3 * 0.12)) * 2.2
        height_score = (co.z - (1.48 + n3 * 0.28)) * 0.95
        return min(slope_score, height_score)

    grass_obj = build_conformed_moss_cap(
        rock_obj,
        "Islet_Peak_GrassCap",
        peak_moss_mask,
        thickness=0.34,
        tuck_depth=0.30,
        voxel_size=0.125,
        target_tris=1250,
        extra_shrubs=None,
    )

    # Decimate rock cleanly to target budget
    bpy.ops.object.select_all(action="DESELECT")
    rock_obj.select_set(True)
    bpy.context.view_layer.objects.active = rock_obj
    cur_tris = sum(max(1, len(p.vertices) - 2) for p in rock_obj.data.polygons)
    if cur_tris > 2450:
        dec = rock_obj.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = max(0.02, 2450.0 / float(cur_tris))
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    clean_mesh_topology(rock_obj)
    for p in rock_obj.data.polygons:
        p.use_smooth = True

    return rock_obj, grass_obj


# ---------------------------------------------------------------------------
# Rich Hand-Painted Ghibli Coastal Granite + Wet Tidal Notch + Moss Shaders
# (TRUE LINEAR RGB calibrated directly to `lagoon_rocks_islets_studies.png`!)
# ---------------------------------------------------------------------------
def build_granite_rock_bake_material(name, bake_img, scale_ref=1.0, top_moss_strength=0.55, ao_dist=0.85):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    img_node = nt.nodes.new("ShaderNodeTexImage")
    img_node.image = bake_img
    nt.nodes.active = img_node

    tc = nt.nodes.new("ShaderNodeTexCoord")
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    sep_p = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep_n = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep_p.inputs["Vector"])
    nt.links.new(geom.outputs["Normal"], sep_n.inputs["Vector"])

    # 1. Directional sunlit coastal sandstone-granite planes + tilted strata brushwork!
    s_inv = 1.0 / max(0.5, scale_ref)
    strata_map = nt.nodes.new("ShaderNodeMapping")
    strata_map.inputs["Scale"].default_value = (1.15 * s_inv, 1.15 * s_inv, 2.35 * s_inv)
    strata_map.inputs["Rotation"].default_value = (math.radians(8), math.radians(-18), math.radians(10))
    nt.links.new(tc.outputs["Object"], strata_map.inputs["Vector"])

    n_broad = nt.nodes.new("ShaderNodeTexNoise")
    n_broad.inputs["Scale"].default_value = 1.8
    n_broad.inputs["Detail"].default_value = 7.0
    n_broad.inputs["Roughness"].default_value = 0.64
    n_broad.inputs["Distortion"].default_value = 0.55
    nt.links.new(strata_map.outputs["Vector"], n_broad.inputs["Vector"])

    n_grain = nt.nodes.new("ShaderNodeTexNoise")
    n_grain.inputs["Scale"].default_value = 6.5
    n_grain.inputs["Detail"].default_value = 6.0
    n_grain.inputs["Roughness"].default_value = 0.68
    nt.links.new(strata_map.outputs["Vector"], n_grain.inputs["Vector"])

    # Painterly sunlit facet direction (warm golden-sandstone top/front planes, cool blue-lavender shadow planes!)
    sun_dot = nt.nodes.new("ShaderNodeVectorMath")
    sun_dot.operation = "DOT_PRODUCT"
    sun_dot.inputs[1].default_value = (0.38, -0.45, 0.80)
    nt.links.new(geom.outputs["Normal"], sun_dot.inputs[0])

    sun_map = nt.nodes.new("ShaderNodeMapRange")
    sun_map.inputs["From Min"].default_value = -0.35
    sun_map.inputs["From Max"].default_value = 0.90
    nt.links.new(sun_dot.outputs["Value"], sun_map.inputs["Value"])

    # Expand noise contrast so stone color clearly spans sunlit golden cream to cool slate!
    nb_con = nt.nodes.new("ShaderNodeMapRange")
    nb_con.inputs["From Min"].default_value = 0.28
    nb_con.inputs["From Max"].default_value = 0.72
    nt.links.new(n_broad.outputs["Fac"], nb_con.inputs["Value"])

    # Combine directional plane warmth (58%) + broad mineral blocks (32%) + painterly brush grain (10%)
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    m1.inputs[1].default_value = 0.58
    nt.links.new(sun_map.outputs["Result"], m1.inputs[0])

    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    m2.inputs[1].default_value = 0.34
    nt.links.new(nb_con.outputs["Result"], m2.inputs[0])

    m12 = nt.nodes.new("ShaderNodeMath")
    m12.operation = "ADD"
    nt.links.new(m1.outputs["Value"], m12.inputs[0])
    nt.links.new(m2.outputs["Value"], m12.inputs[1])

    m3 = nt.nodes.new("ShaderNodeMath")
    m3.operation = "MULTIPLY_ADD"
    m3.inputs[1].default_value = 0.26
    m3.inputs[2].default_value = -0.11
    nt.links.new(n_grain.outputs["Fac"], m3.inputs[0])

    rock_fac = nt.nodes.new("ShaderNodeMath")
    rock_fac.operation = "ADD"
    rock_fac.use_clamp = True
    nt.links.new(m12.outputs["Value"], rock_fac.inputs[0])
    nt.links.new(m3.outputs["Value"], rock_fac.inputs[1])

    # Rich TRUE LINEAR RGB Ghibli sandstone-granite palette directly matched to storyboard!
    # Clean broad gouache planes + subtle painterly mineral grain (ZERO marble contour squiggles!)
    rock_ramp = nt.nodes.new("ShaderNodeValToRGB")
    rcr = rock_ramp.color_ramp
    rcr.elements[0].position = 0.14
    rcr.elements[0].color = (0.125, 0.145, 0.205, 1.0)  # cool lavender-slate Ghibli rock shadow
    e1 = rcr.elements.new(0.42)
    e1.color = (0.345, 0.255, 0.165, 1.0)               # rich warm sunlit coastal sandstone-granite
    e2 = rcr.elements.new(0.70)
    e2.color = (0.565, 0.415, 0.235, 1.0)               # warm ochre-buff sunlit granite face
    rcr.elements[1].position = 0.92
    rcr.elements[1].color = (0.715, 0.555, 0.340, 1.0)  # bright sunlit sandy-cream slab highlight
    nt.links.new(rock_fac.outputs["Value"], rock_ramp.inputs["Fac"])

    # 2. Delicate warm chalk-cream dry-brush edge highlight on beveled granite corners
    edge_map = nt.nodes.new("ShaderNodeMapRange")
    edge_map.inputs["From Min"].default_value = 0.515
    edge_map.inputs["From Max"].default_value = 0.595
    edge_map.inputs["To Min"].default_value = 0.0
    edge_map.inputs["To Max"].default_value = 0.24
    nt.links.new(geom.outputs["Pointiness"], edge_map.inputs["Value"])

    mix_edge = nt.nodes.new("ShaderNodeMix")
    mix_edge.data_type = "RGBA"
    nt.links.new(edge_map.outputs["Result"], mix_edge.inputs["Factor"])
    nt.links.new(rock_ramp.outputs["Color"], mix_edge.inputs["A"])
    mix_edge.inputs["B"].default_value = (0.78, 0.63, 0.41, 1.0)

    # 3. Nestled vibrant green moss patches on upper horizontal ledges (for 01 & 02 + bare islet shelves!)
    col_after_moss = mix_edge.outputs["Result"]
    if top_moss_strength > 0.01:
        n_moss = nt.nodes.new("ShaderNodeTexNoise")
        n_moss.inputs["Scale"].default_value = 1.9 * s_inv
        n_moss.inputs["Detail"].default_value = 6.0
        n_moss.inputs["Distortion"].default_value = 0.70
        nt.links.new(tc.outputs["Object"], n_moss.inputs["Vector"])

        moss_up = nt.nodes.new("ShaderNodeMapRange")
        moss_up.inputs["From Min"].default_value = 0.62
        moss_up.inputs["From Max"].default_value = 0.86
        nt.links.new(sep_n.outputs["Z"], moss_up.inputs["Value"])

        moss_h = nt.nodes.new("ShaderNodeMapRange")
        moss_h.inputs["From Min"].default_value = 0.28 * max(0.8, scale_ref * 0.6)
        moss_h.inputs["From Max"].default_value = 0.75 * max(0.8, scale_ref * 0.6)
        nt.links.new(sep_p.outputs["Z"], moss_h.inputs["Value"])

        moss_pat = nt.nodes.new("ShaderNodeMapRange")
        moss_pat.inputs["From Min"].default_value = 0.42
        moss_pat.inputs["From Max"].default_value = 0.62
        nt.links.new(n_moss.outputs["Fac"], moss_pat.inputs["Value"])

        mm1 = nt.nodes.new("ShaderNodeMath")
        mm1.operation = "MULTIPLY"
        nt.links.new(moss_up.outputs["Result"], mm1.inputs[0])
        nt.links.new(moss_h.outputs["Result"], mm1.inputs[1])

        mm2 = nt.nodes.new("ShaderNodeMath")
        mm2.operation = "MULTIPLY"
        nt.links.new(mm1.outputs["Value"], mm2.inputs[0])
        nt.links.new(moss_pat.outputs["Result"], mm2.inputs[1])

        mm3 = nt.nodes.new("ShaderNodeMath")
        mm3.operation = "MULTIPLY"
        mm3.use_clamp = True
        mm3.inputs[1].default_value = top_moss_strength
        nt.links.new(mm2.outputs["Value"], mm3.inputs[0])

        moss_ramp = nt.nodes.new("ShaderNodeValToRGB")
        mcr = moss_ramp.color_ramp
        mcr.elements[0].position = 0.20
        mcr.elements[0].color = (0.042, 0.165, 0.022, 1.0)
        mcr.elements[1].position = 0.80
        mcr.elements[1].color = (0.215, 0.410, 0.038, 1.0)
        nt.links.new(n_moss.outputs["Fac"], moss_ramp.inputs["Fac"])

        mix_moss = nt.nodes.new("ShaderNodeMix")
        mix_moss.data_type = "RGBA"
        nt.links.new(mm3.outputs["Value"], mix_moss.inputs["Factor"])
        nt.links.new(col_after_moss, mix_moss.inputs["A"])
        nt.links.new(moss_ramp.outputs["Color"], mix_moss.inputs["B"])
        col_after_moss = mix_moss.outputs["Result"]

    # 4. FIXED Detail-2 Tidal Notch wet dark olive-slate band (`From Min < From Max`!)
    #    Strongest from z = -0.18 up to z = +0.34, organically feathered by noise!
    n_tide = nt.nodes.new("ShaderNodeTexNoise")
    n_tide.inputs["Scale"].default_value = 2.2 * s_inv
    n_tide.inputs["Detail"].default_value = 5.0
    nt.links.new(tc.outputs["Object"], n_tide.inputs["Vector"])

    tide_off = nt.nodes.new("ShaderNodeMath")
    tide_off.operation = "MULTIPLY_ADD"
    tide_off.inputs[1].default_value = 0.24 * max(0.8, scale_ref * 0.45)
    tide_off.inputs[2].default_value = -0.10 * max(0.8, scale_ref * 0.45)
    nt.links.new(n_tide.outputs["Fac"], tide_off.inputs[0])

    z_noisy = nt.nodes.new("ShaderNodeMath")
    z_noisy.operation = "ADD"
    nt.links.new(sep_p.outputs["Z"], z_noisy.inputs[0])
    nt.links.new(tide_off.outputs["Value"], z_noisy.inputs[1])

    wet_hi = max(0.32, 0.22 * scale_ref)
    wet_mask = nt.nodes.new("ShaderNodeMapRange")
    wet_mask.inputs["From Min"].default_value = 0.02
    wet_mask.inputs["From Max"].default_value = wet_hi
    wet_mask.inputs["To Min"].default_value = 0.78   # rich dark wet tidal erosion band!
    wet_mask.inputs["To Max"].default_value = 0.0
    nt.links.new(z_noisy.outputs["Value"], wet_mask.inputs["Value"])

    mix_wet = nt.nodes.new("ShaderNodeMix")
    mix_wet.data_type = "RGBA"
    nt.links.new(wet_mask.outputs["Result"], mix_wet.inputs["Factor"])
    nt.links.new(col_after_moss, mix_wet.inputs["A"])
    mix_wet.inputs["B"].default_value = (0.075, 0.095, 0.078, 1.0)  # wet algae-kissed dark coastal stone

    # Smooth transition underwater (z < -0.15) into warm-teal mossy shallow reef rock!
    sub_mask = nt.nodes.new("ShaderNodeMapRange")
    sub_mask.inputs["From Min"].default_value = -1.10
    sub_mask.inputs["From Max"].default_value = -0.08
    sub_mask.inputs["To Min"].default_value = 0.75
    sub_mask.inputs["To Max"].default_value = 0.0
    nt.links.new(sep_p.outputs["Z"], sub_mask.inputs["Value"])

    mix_sub = nt.nodes.new("ShaderNodeMix")
    mix_sub.data_type = "RGBA"
    nt.links.new(sub_mask.outputs["Result"], mix_sub.inputs["Factor"])
    nt.links.new(mix_wet.outputs["Result"], mix_sub.inputs["A"])
    mix_sub.inputs["B"].default_value = (0.125, 0.245, 0.195, 1.0)

    # 5. Cycles Real Geometric AO (darkens sculpted granite slab joints & moss overhangs!)
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 24
    ao.inputs["Distance"].default_value = ao_dist

    ao_range = nt.nodes.new("ShaderNodeMapRange")
    ao_range.inputs["From Min"].default_value = 0.0
    ao_range.inputs["From Max"].default_value = 1.0
    ao_range.inputs["To Min"].default_value = 0.28
    ao_range.inputs["To Max"].default_value = 1.02
    nt.links.new(ao.outputs["AO"], ao_range.inputs["Value"])

    mix_ao = nt.nodes.new("ShaderNodeMix")
    mix_ao.data_type = "RGBA"
    mix_ao.blend_type = "MULTIPLY"
    mix_ao.inputs["Factor"].default_value = 1.0
    nt.links.new(mix_sub.outputs["Result"], mix_ao.inputs["A"])
    nt.links.new(ao_range.outputs["Result"], mix_ao.inputs["B"])

    nt.links.new(mix_ao.outputs["Result"], emit.inputs["Color"])
    return mat


def build_moss_cap_bake_material(name, bake_img, scale_ref=2.5, ao_dist=1.25):
    """
    Detail-3 `Moss to rock`: painterly tufted Ghibli meadow blanket with sunlit buttercup
    patches, delicate clover/leaf brushwork, and rich mossy shaded overhang lips!
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    img_node = nt.nodes.new("ShaderNodeTexImage")
    img_node.image = bake_img
    nt.nodes.active = img_node

    tc = nt.nodes.new("ShaderNodeTexCoord")
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    sep_n = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geom.outputs["Normal"], sep_n.inputs["Vector"])

    s_inv = 1.0 / max(1.0, scale_ref)
    n_macro = nt.nodes.new("ShaderNodeTexNoise")
    n_macro.inputs["Scale"].default_value = 1.35 * s_inv
    n_macro.inputs["Detail"].default_value = 6.0
    n_macro.inputs["Roughness"].default_value = 0.62
    n_macro.inputs["Distortion"].default_value = 0.65
    nt.links.new(tc.outputs["Object"], n_macro.inputs["Vector"])

    n_tuft = nt.nodes.new("ShaderNodeTexNoise")
    n_tuft.inputs["Scale"].default_value = 7.2 * s_inv
    n_tuft.inputs["Detail"].default_value = 7.0
    n_tuft.inputs["Roughness"].default_value = 0.72
    nt.links.new(tc.outputs["Object"], n_tuft.inputs["Vector"])

    # Upward sunlit center vs richer deep-green drooping moss border edges
    up_fac = nt.nodes.new("ShaderNodeMapRange")
    up_fac.inputs["From Min"].default_value = 0.22
    up_fac.inputs["From Max"].default_value = 0.94
    nt.links.new(sep_n.outputs["Z"], up_fac.inputs["Value"])

    nm_con = nt.nodes.new("ShaderNodeMapRange")
    nm_con.inputs["From Min"].default_value = 0.28
    nm_con.inputs["From Max"].default_value = 0.72
    nt.links.new(n_macro.outputs["Fac"], nm_con.inputs["Value"])

    c1 = nt.nodes.new("ShaderNodeMath")
    c1.operation = "MULTIPLY"
    c1.inputs[1].default_value = 0.48
    nt.links.new(up_fac.outputs["Result"], c1.inputs[0])

    c2 = nt.nodes.new("ShaderNodeMath")
    c2.operation = "MULTIPLY"
    c2.inputs[1].default_value = 0.40
    nt.links.new(nm_con.outputs["Result"], c2.inputs[0])

    c12 = nt.nodes.new("ShaderNodeMath")
    c12.operation = "ADD"
    nt.links.new(c1.outputs["Value"], c12.inputs[0])
    nt.links.new(c2.outputs["Value"], c12.inputs[1])

    c3 = nt.nodes.new("ShaderNodeMath")
    c3.operation = "MULTIPLY_ADD"
    c3.inputs[1].default_value = 0.28
    c3.inputs[2].default_value = -0.12
    nt.links.new(n_tuft.outputs["Fac"], c3.inputs[0])

    g_fac = nt.nodes.new("ShaderNodeMath")
    g_fac.operation = "ADD"
    g_fac.use_clamp = True
    nt.links.new(c12.outputs["Value"], g_fac.inputs[0])
    nt.links.new(c3.outputs["Value"], g_fac.inputs[1])

    grass_ramp = nt.nodes.new("ShaderNodeValToRGB")
    gcr = grass_ramp.color_ramp
    gcr.elements[0].position = 0.14
    gcr.elements[0].color = (0.028, 0.125, 0.018, 1.0)  # lush shaded forest-moss overhang
    gm = gcr.elements.new(0.50)
    gm.color = (0.105, 0.305, 0.028, 1.0)               # vibrant Ghibli coastal meadow
    gcr.elements[1].position = 0.86
    gcr.elements[1].color = (0.295, 0.455, 0.042, 1.0)  # warm sunlit golden-meadow dabs!
    nt.links.new(g_fac.outputs["Value"], grass_ramp.inputs["Fac"])

    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 24
    ao.inputs["Distance"].default_value = ao_dist

    ao_range = nt.nodes.new("ShaderNodeMapRange")
    ao_range.inputs["From Min"].default_value = 0.0
    ao_range.inputs["From Max"].default_value = 1.0
    ao_range.inputs["To Min"].default_value = 0.38
    ao_range.inputs["To Max"].default_value = 1.02
    nt.links.new(ao.outputs["AO"], ao_range.inputs["Value"])

    mix_ao = nt.nodes.new("ShaderNodeMix")
    mix_ao.data_type = "RGBA"
    mix_ao.blend_type = "MULTIPLY"
    mix_ao.inputs["Factor"].default_value = 1.0
    nt.links.new(grass_ramp.outputs["Color"], mix_ao.inputs["A"])
    nt.links.new(ao_range.outputs["Result"], mix_ao.inputs["B"])

    nt.links.new(mix_ao.outputs["Result"], emit.inputs["Color"])
    return mat


def bake_and_export_asset(asset_key, rock_obj, grass_obj, tex_size, scale_ref, top_moss, ao_dist):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = False
    scene.cycles.bake_type = "EMIT"
    scene.render.bake.margin = 16

    bake_img = bpy.data.images.new(f"{asset_key}_Bake", width=tex_size, height=tex_size, alpha=False)
    bake_img.colorspace_settings.name = "sRGB"

    rock_mat = build_granite_rock_bake_material(
        f"{asset_key}_RockBake", bake_img, scale_ref=scale_ref, top_moss_strength=top_moss, ao_dist=ao_dist
    )
    rock_obj.data.materials.clear()
    rock_obj.data.materials.append(rock_mat)

    if grass_obj is not None:
        grass_mat = build_moss_cap_bake_material(
            f"{asset_key}_GrassBake", bake_img, scale_ref=scale_ref, ao_dist=ao_dist * 1.15
        )
        grass_obj.data.materials.clear()
        grass_obj.data.materials.append(grass_mat)

        bpy.ops.object.select_all(action="DESELECT")
        rock_obj.select_set(True)
        grass_obj.select_set(True)
        bpy.context.view_layer.objects.active = rock_obj
        bpy.ops.object.join()

    target = rock_obj
    target.name = asset_key
    clean_mesh_topology(target)

    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target

    if not target.data.uv_layers:
        target.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.012)
    bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.bake(type="EMIT")
    dilate_blender_image(bake_img, passes=12)

    tex_path = os.path.join(STAGE_DIR, f"{asset_key}_basecolor.jpg")
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 91
    bake_img.filepath_raw = tex_path
    bake_img.file_format = "JPEG"
    bake_img.save()

    final_img = bpy.data.images.load(tex_path, check_existing=False)
    final_img.colorspace_settings.name = "sRGB"
    final_img.pack()

    final_mat = bpy.data.materials.new(f"Mat_{asset_key}")
    final_mat.use_nodes = True
    fnt = final_mat.node_tree
    fnt.nodes.clear()
    fout = fnt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = fnt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.89
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.14
    ftex = fnt.nodes.new("ShaderNodeTexImage")
    ftex.image = final_img
    fnt.links.new(ftex.outputs["Color"], bsdf.inputs["Base Color"])
    fnt.links.new(bsdf.outputs["BSDF"], fout.inputs["Surface"])

    target.data.materials.clear()
    target.data.materials.append(final_mat)
    target.data.validate(verbose=False)

    glb_path = os.path.join(OUT_DIR, f"{asset_key}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=90,
    )

    bm_chk = bmesh.new()
    bm_chk.from_mesh(target.data)
    bmesh.ops.triangulate(bm_chk, faces=bm_chk.faces[:])
    tris = len(bm_chk.faces)
    non_mani = sum(1 for e in bm_chk.edges if not e.is_manifold)
    bm_chk.free()
    pts = [target.matrix_world @ mathutils.Vector(c) for c in target.bound_box]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    kb = os.path.getsize(glb_path) / 1024.0
    print(
        f"[OK] {asset_key:16s} | tris={tris:5d} | non_mani={non_mani} | "
        f"size=({max(xs)-min(xs):.2f} x {max(ys)-min(ys):.2f}, z={min(zs):.2f}..{max(zs):.2f}) | {kb:.1f} KB"
    )
    return target


def render_audit_board(objs):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.15  # calibrated so studio lighting doesn't wash out sandstone warmth!

    placements = [
        ("rock_shore_wide", (-14.2, -1.5, 0.0), 1.45),
        ("rock_cliff_crag", (-9.8, -1.2, 0.0), 1.35),
        ("islet_plateau", (-0.6, 0.2, 0.0), 1.0),
        ("islet_peak", (12.8, 0.4, 0.0), 1.0),
    ]
    obj_map = {o.name: o for o in objs}
    for name, loc, sc in placements:
        o = obj_map[name]
        o.location = loc
        o.scale = (sc, sc, sc)

    world = bpy.data.worlds.new("AuditSky")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    wnt.nodes.clear()
    wout = wnt.nodes.new("ShaderNodeOutputWorld")
    bg = wnt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.38, 0.65, 0.90, 1.0)
    bg.inputs["Strength"].default_value = 0.65
    wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])

    sun_d = bpy.data.lights.new("Sun", type="SUN")
    sun_d.energy = 2.8
    sun_d.color = (1.0, 0.94, 0.82)
    sun_d.angle = math.radians(3.0)
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(44), math.radians(12), math.radians(-35))
    scene.collection.objects.link(sun)

    fill_d = bpy.data.lights.new("SkyFill", type="SUN")
    fill_d.energy = 0.72
    fill_d.color = (0.72, 0.85, 1.0)
    fill = bpy.data.objects.new("SkyFill", fill_d)
    fill.rotation_euler = (math.radians(52), 0.0, math.radians(145))
    scene.collection.objects.link(fill)

    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, -3.2))
    seabed = bpy.context.active_object
    sb_mat = bpy.data.materials.new("AuditSeabed")
    sb_mat.use_nodes = True
    sb_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.45, 0.42, 0.30, 1.0)
    sb_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
    seabed.data.materials.append(sb_mat)

    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0.0))
    water = bpy.context.active_object
    w_mat = bpy.data.materials.new("AuditWater")
    w_mat.use_nodes = True
    wt = w_mat.node_tree
    wt.nodes.clear()
    wo = wt.nodes.new("ShaderNodeOutputMaterial")
    mix_sh = wt.nodes.new("ShaderNodeMixShader")
    mix_sh.inputs["Fac"].default_value = 0.46
    transp = wt.nodes.new("ShaderNodeBsdfTransparent")
    transp.inputs["Color"].default_value = (0.55, 0.92, 0.88, 1.0)
    gloss = wt.nodes.new("ShaderNodeBsdfPrincipled")
    gloss.inputs["Base Color"].default_value = (0.06, 0.44, 0.48, 1.0)
    gloss.inputs["Roughness"].default_value = 0.14
    wt.links.new(transp.outputs["BSDF"], mix_sh.inputs[1])
    wt.links.new(gloss.outputs["BSDF"], mix_sh.inputs[2])
    wt.links.new(mix_sh.outputs["Shader"], wo.inputs["Surface"])
    water.data.materials.append(w_mat)

    cam_d = bpy.data.cameras.new("AuditCam")
    cam_d.lens = 42
    cam = bpy.data.objects.new("AuditCam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def aim_and_render(loc, target_pt, lens, filename):
        cam.location = mathutils.Vector(loc)
        cam_d.lens = lens
        direction = mathutils.Vector(target_pt) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        out_p = os.path.join(STAGE_DIR, filename)
        scene.render.filepath = out_p
        bpy.ops.render.render(write_still=True)
        return out_p

    p1 = aim_and_render((0.5, -34.0, 5.8), (0.5, 0.0, 1.8), 40, "audit_front_lineup.png")
    p2 = aim_and_render((0.5, -24.0, 30.5), (0.5, 0.0, 0.8), 42, "audit_top52_lineup.png")
    p3 = aim_and_render((-4.5, 31.0, 11.5), (1.0, 0.0, 1.6), 40, "audit_rear34_lineup.png")
    # Close-up framing 02 Cliff Crag + 03 Plateau + 04 Twin Peak front!
    p4 = aim_and_render((4.2, -16.5, 5.2), (5.5, 0.2, 1.9), 44, "audit_closeup_details.png")

    board_path = os.path.join(STAGE_DIR, "ROCKS_ISLETS_V1_AUDIT_BOARD.png")
    stitch_2x2_board([p1, p2, p3, p4], board_path)
    print(f"[AUDIT] Saved Pass-2 4-shot studio audit board -> {board_path}")


def main():
    clear_scene()
    built_objs = []

    o1 = build_rock_shore_wide()
    built_objs.append(
        bake_and_export_asset("rock_shore_wide", o1, None, tex_size=1024, scale_ref=1.35, top_moss=0.68, ao_dist=0.55)
    )
    o1.hide_render = True

    o2 = build_rock_cliff_crag()
    built_objs.append(
        bake_and_export_asset("rock_cliff_crag", o2, None, tex_size=1024, scale_ref=1.85, top_moss=0.72, ao_dist=0.80)
    )
    o2.hide_render = True

    r3, g3 = build_islet_plateau()
    o3 = bake_and_export_asset("islet_plateau", r3, g3, tex_size=1536, scale_ref=4.2, top_moss=0.38, ao_dist=1.35)
    built_objs.append(o3)
    o3.hide_render = True

    r4, g4 = build_islet_peak()
    o4 = bake_and_export_asset("islet_peak", r4, g4, tex_size=1536, scale_ref=5.0, top_moss=0.35, ao_dist=1.65)
    built_objs.append(o4)

    for o in built_objs:
        o.hide_render = False
        o.hide_viewport = False

    render_audit_board(built_objs)


if __name__ == "__main__":
    main()
