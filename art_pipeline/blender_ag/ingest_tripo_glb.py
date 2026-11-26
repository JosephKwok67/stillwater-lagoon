"""
Antigravity Studio — Tripo Free-Tier GLB -> Blender 5.3 Animal Crossing / Ghibli Ingest Pipeline
Automatically cleans, normalizes, decimates, de-plastics (matte storybook roughness), grounds,
audits (4-view studio sheet), and exports any `.glb` downloaded from Tripo Web (`studio.tripo3d.ai`)!

Usage:
  1. Drop any `.glb` downloaded from Tripo into:
     I:\antigravity cli\钓鱼大冒险\art_pipeline\tripo_inbox\<asset_name>.glb
  2. Run:
     blender --background --python ingest_tripo_glb.py -- --input "<in.glb>" --name "<asset_name>" --height 0.58 --target-tris 6500 --rot-z 0
  3. Outputs:
     - Cleaned WebGL GLB:  art_pipeline/blender_ag/exports/tripo_cleaned/<asset_name>.glb
     - Blender source:     art_pipeline/blender_ag/tripo_cleaned/<asset_name>.blend
     - 4-View Audit Sheet: art_pipeline/blender_ag/previews/tripo_audit/<asset_name>_AUDIT.png
"""

import math
import os
import sys
import bpy
from mathutils import Vector, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ag_studio_lib import (
    clear_scene,
    setup_studio_render,
    aim_camera,
    export_clean_glb,
)

BASE_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"
BLEND_DIR = os.path.join(BASE_OUT, "tripo_cleaned")
EXP_DIR = os.path.join(BASE_OUT, "exports", "tripo_cleaned")
PREV_DIR = os.path.join(BASE_OUT, "previews", "tripo_audit")
for d in (BLEND_DIR, EXP_DIR, PREV_DIR):
    os.makedirs(d, exist_ok=True)


def get_meshes(objs):
    return [o for o in objs if o.type == "MESH" and o.data and len(o.data.polygons) > 0]


def world_bounds(meshes):
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    for obj in meshes:
        for c in obj.bound_box:
            wc = obj.matrix_world @ Vector(c)
            min_v.x = min(min_v.x, wc.x)
            min_v.y = min(min_v.y, wc.y)
            min_v.z = min(min_v.z, wc.z)
            max_v.x = max(max_v.x, wc.x)
            max_v.y = max(max_v.y, wc.y)
            max_v.z = max(max_v.z, wc.z)
    return min_v, max_v


def stylize_materials_animal_crossing(meshes, rough_min=0.78, rough_max=0.90, max_metal=0.06):
    """
    Removes Tripo's default plastic/metallic shine and unifies all imported PBR textures
    into soft, tactile Animal Crossing × Studio Ghibli matte clay-gouache shading!
    """
    seen = set()
    for obj in meshes:
        for slot in obj.material_slots:
            mat = slot.material
            if not mat or mat.name in seen or not mat.use_nodes:
                continue
            seen.add(mat.name)
            nt = mat.node_tree
            bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not bsdf:
                continue

            # Unlink raw Tripo metallic/roughness maps if they cause overly glossy plastic hotspots,
            # or softly clamp them into cozy storybook matte range!
            if bsdf.inputs["Roughness"].is_linked:
                src = bsdf.inputs["Roughness"].links[0].from_socket
                nt.links.remove(bsdf.inputs["Roughness"].links[0])
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.clamp = True
                mr.inputs["From Min"].default_value = 0.0
                mr.inputs["From Max"].default_value = 1.0
                mr.inputs["To Min"].default_value = rough_min
                mr.inputs["To Max"].default_value = rough_max
                nt.links.new(src, mr.inputs["Value"])
                nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
            else:
                bsdf.inputs["Roughness"].default_value = max(rough_min, bsdf.inputs["Roughness"].default_value)

            if bsdf.inputs["Metallic"].is_linked:
                src_m = bsdf.inputs["Metallic"].links[0].from_socket
                nt.links.remove(bsdf.inputs["Metallic"].links[0])
                mr_m = nt.nodes.new("ShaderNodeMapRange")
                mr_m.clamp = True
                mr_m.inputs["To Min"].default_value = 0.0
                mr_m.inputs["To Max"].default_value = max_metal
                nt.links.new(src_m, mr_m.inputs["Value"])
                nt.links.new(mr_m.outputs["Result"], bsdf.inputs["Metallic"])
            else:
                bsdf.inputs["Metallic"].default_value = min(max_metal, bsdf.inputs["Metallic"].default_value)

            if "Specular IOR Level" in bsdf.inputs:
                bsdf.inputs["Specular IOR Level"].default_value = 0.22


def ingest_tripo(input_glb, asset_name, target_height=1.26, target_tris=8000, rot_z_deg=0.0, measure_axis="Z"):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=input_glb)
    imported = list(bpy.context.scene.objects)
    meshes = get_meshes(imported)
    if not meshes:
        raise RuntimeError(f"No meshes found in {input_glb}")

    # Create unified root empty
    root = bpy.data.objects.new(f"Tripo_{asset_name}", None)
    bpy.context.collection.objects.link(root)
    for o in imported:
        if o.parent is None:
            o.parent = root

    # Optional yaw correction so character/asset faces -Y in Blender (+Z in Three.js!)
    if abs(rot_z_deg) > 1e-3:
        root.rotation_euler = Euler((0.0, 0.0, math.radians(rot_z_deg)), "XYZ")
    bpy.context.view_layer.update()

    # 1. Measure & normalize exact game-world scale + ground to Z = 0.000, centered X/Y!
    mn, mx = world_bounds(meshes)
    size = mx - mn
    cur_dim = size.y if measure_axis.upper() == "Y" else (size.x if measure_axis.upper() == "X" else size.z)
    sf = target_height / cur_dim if cur_dim > 1e-4 else 1.0
    root.scale = (sf, sf, sf)
    bpy.context.view_layer.update()

    mn2, mx2 = world_bounds(meshes)
    cx = 0.5 * (mn2.x + mx2.x)
    cy = 0.5 * (mn2.y + mx2.y)
    root.location = Vector((-cx, -cy, -mn2.z))
    bpy.context.view_layer.update()

    # 2. Decimate cleanly to WebGL budget (preserving UVs & silhouette!)
    total_tris = sum(len(m.data.polygons) for m in meshes)
    print(f"[Tripo Ingest] {asset_name}: raw polys={total_tris}, scaled {cur_dim:.3f} -> {target_height:.3f}m")
    if total_tris > target_tris:
        ratio = max(0.004, target_tris / float(total_tris))
        for m in meshes:
            bpy.ops.object.select_all(action="DESELECT")
            m.select_set(True)
            bpy.context.view_layer.objects.active = m
            dec = m.modifiers.new("TripoDecimate", "DECIMATE")
            dec.ratio = ratio
            dec.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dec.name)
            for p in m.data.polygons:
                p.use_smooth = True
        new_tris = sum(len(m.data.polygons) for m in meshes)
        print(f"[Tripo Ingest] Decimated {total_tris} -> {new_tris} polys (ratio={ratio:.3f})")

    # 3. Unify shading to soft Animal Crossing × Ghibli matte gouache look
    stylize_materials_animal_crossing(meshes)

    # 4. Pack textures, save .blend & export clean WebGL .glb!
    try:
        bpy.ops.file.pack_all()
    except Exception:
        pass
    blend_path = os.path.join(BLEND_DIR, f"{asset_name}.blend")
    glb_path = os.path.join(EXP_DIR, f"{asset_name}.glb")
    export_clean_glb(blend_path, glb_path)

    # 5. Render 4-angle studio audit shots (Front / 35° Hero / Left Side / Back)
    mn3, mx3 = world_bounds(meshes)
    sz3 = mx3 - mn3
    rad = max(sz3.x, sz3.y, sz3.z) * 0.55
    mid_z = (mn3.z + mx3.z) * 0.5
    dist = max(1.6, rad * 4.4)

    scene = bpy.context.scene
    setup_studio_render(scene, res_x=640, res_y=640, samples=28, is_house=(rad > 1.2))
    cam_d = bpy.data.cameras.new("AuditCam")
    cam_d.lens = 68
    cam = bpy.data.objects.new("AuditCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    shots = [
        ("01_front.png", (0.0, -dist, mid_z + rad * 0.15)),
        ("02_hero34.png", (dist * 0.62, -dist * 0.78, mid_z + rad * 0.28)),
        ("03_side.png", (-dist, 0.0, mid_z + rad * 0.15)),
        ("04_back.png", (0.0, dist, mid_z + rad * 0.15)),
    ]
    for fn, loc in shots:
        aim_camera(cam, loc, (0.0, 0.0, mid_z))
        scene.render.filepath = os.path.join(PREV_DIR, f"{asset_name}_{fn}")
        bpy.ops.render.render(write_still=True)
    print(f"[Tripo Ingest] DONE -> {glb_path} & 4 audit previews in {PREV_DIR}")


def main():
    argv = sys.argv
    extra = argv[argv.index("--") + 1 :] if "--" in argv else []

    def arg(flag, default=None):
        return extra[extra.index(flag) + 1] if flag in extra else default

    inp = arg("--input")
    name = arg("--name", "tripo_asset")
    height = float(arg("--height", "1.26"))
    tris = int(arg("--target-tris", "8000"))
    rot_z = float(arg("--rot-z", "0.0"))
    axis = arg("--axis", "Z")
    if not inp:
        raise ValueError("Missing --input <path_to_tripo.glb>")
    ingest_tripo(inp, name, target_height=height, target_tris=tris, rot_z_deg=rot_z, measure_axis=axis)


if __name__ == "__main__":
    main()
