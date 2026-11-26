r"""
Antigravity Studio — Tripo v3.1 HD Puppy v2.0 -> Blender 5.3 Clean, Matte Stylize,
7-Bone Anatomical Armature Skinning, Pose Stress-Test & 6-Shot Audit Board Pipeline.

Input:  I:\antigravity cli\钓鱼大冒险\art_pipeline\tripo_inbox\dog_v2.glb
Output:
  - Blender source: I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\dog_v2_tripo.blend
  - Game GLB:       I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\exports\characters\dog.glb
  - 6-Shot Audit:   I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\previews\dog_v2_tripo\DOG_V2_TRIPO_AUDIT_BOARD.png

Coordinate & Rig Contract (`src/wildlife.js` + `src/core/glbLoader.js`):
  - Faces -Y in Blender (+Z in glTF/Three.js; wildlife.js rotates +90deg Y so dog trots along +X).
  - Normalized Y length = 0.62m (height ~0.57m; root.scale 0.86 -> ~0.49m tall companion next to 1.26m player).
  - Grounded cleanly at Z = 0.000, centered X = 0, Y = 0.
  - Armature `Armature_Dog_v2` with 7 vertical (+Z, roll=0) identity-oriented bones:
      Rig_Body (root)
       ├── Rig_Head
       ├── Rig_Tail
       ├── Rig_PawFL (+X, -Y)
       ├── Rig_PawFR (-X, -Y)
       ├── Rig_PawBL (+X, +Y)
       └── Rig_PawBR (-X, +Y)
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

from ag_studio_lib import clear_scene, setup_studio_render, aim_camera

RAW_GLB = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\tripo_inbox\dog_v2.glb"
BLEND_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\dog_v2_tripo.blend"
GLB_OUT = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\exports\characters\dog.glb"
PREV_DIR = r"I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\previews\dog_v2_tripo"
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
os.makedirs(PREV_DIR, exist_ok=True)

TARGET_LENGTH_Y = 0.62
TARGET_TRIS = 11500


def smoothstep(edge0, edge1, x):
    if abs(edge1 - edge0) < 1e-6:
        return 1.0 if x >= edge1 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def mesh_world_bounds(obj):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    mw = obj.matrix_world
    for v in obj.data.vertices:
        p = mw @ v.co
        mn.x = min(mn.x, p.x)
        mn.y = min(mn.y, p.y)
        mn.z = min(mn.z, p.z)
        mx.x = max(mx.x, p.x)
        mx.y = max(mx.y, p.y)
        mx.z = max(mx.z, p.z)
    return mn, mx


def dilate_uv_gutters(img, passes=6):
    """Fills dark/empty UV gutter background pixels from neighbor island colors so mipmaps never bleed dark seams."""
    w, h = img.size[0], img.size[1]
    if w <= 0 or h <= 0:
        return
    try:
        import numpy as np
        px = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))
        rgb = px[:, :, :3]
        # Mask out pure/near-black UV background gutter pixels (Tripo fills empty atlas space with near-0 black)
        luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
        valid = luma > 0.035
        for _ in range(passes):
            if valid.all():
                break
            acc = np.zeros_like(rgb)
            cnt = np.zeros((h, w, 1), dtype=np.float32)
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                shifted_v = np.roll(np.roll(valid, dy, axis=0), dx, axis=1)
                shifted_c = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)
                acc += shifted_c * shifted_v[:, :, None]
                cnt += shifted_v[:, :, None].astype(np.float32)
            fill = (~valid) & (cnt[:, :, 0] > 0.5)
            if not fill.any():
                break
            rgb[fill] = acc[fill] / cnt[fill]
            valid[fill] = True
        px[:, :, :3] = rgb
        px[:, :, 3] = 1.0
        img.pixels[:] = px.ravel().tolist()
        img.pack()
        print(f"    -> Dilated UV gutters ({passes} passes) on {img.name}")
    except Exception as ex:
        print(f"    -> UV gutter dilation skipped: {ex}")


def optimize_and_stylize_materials(mesh_obj):
    """
    Unifies Tripo materials into tactile Animal Crossing × Studio Ghibli matte clay-gouache
    AND resizes oversized raw textures to crisp 1024px WebGL budget (cutting GLB weight 3x!).
    """
    print("[Dog v2] Inspecting embedded images & materials...")
    for img in list(bpy.data.images):
        w, h = img.size[0], img.size[1]
        print(f"  Image: {img.name} ({w}x{h}, channels={img.channels})")
        if max(w, h) > 1024:
            scale = 1024.0 / float(max(w, h))
            nw = max(64, int(round(w * scale)))
            nh = max(64, int(round(h * scale)))
            img.scale(nw, nh)
            img.pack()
            print(f"    -> Resized to {nw}x{nh} for crisp WebGL budget")
        if "color" in img.name.lower() or "albedo" in img.name.lower() or len(bpy.data.images) == 1:
            dilate_uv_gutters(img, passes=6)

    for slot in mesh_obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        mat.name = "Mat_Dog_v2_AC_Matte"
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue

        # Remove separate Roughness/Metallic image links so glTF doesn't pack redundant ORM maps
        # and gives clean soft matte clay finish (0.83 roughness, 0.0 metallic) matching our town cast!
        for sock_name, val in (("Roughness", 0.83), ("Metallic", 0.0), ("Coat Weight", 0.0)):
            if sock_name in bsdf.inputs:
                inp = bsdf.inputs[sock_name]
                for lnk in list(inp.links):
                    nt.links.remove(lnk)
                inp.default_value = val

        # Soften Normal map slightly so decimated clay looks velvety, never noisy
        if "Normal" in bsdf.inputs and bsdf.inputs["Normal"].is_linked:
            nmap = bsdf.inputs["Normal"].links[0].from_node
            if nmap.type == "NORMAL_MAP" and "Strength" in nmap.inputs:
                nmap.inputs["Strength"].default_value = 0.45

        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.22

        # Clean orphan image texture nodes so unused PBR maps aren't exported into the GLB!
        linked_nodes = set()
        stack = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"]
        while stack:
            cur = stack.pop()
            if cur in linked_nodes:
                continue
            linked_nodes.add(cur)
            for inp in cur.inputs:
                for lnk in inp.links:
                    stack.append(lnk.from_node)
        for n in list(nt.nodes):
            if n not in linked_nodes:
                nt.nodes.remove(n)

    # Purge unused images so GLB only embeds the active Base Color (and soft normal if linked)
    for img in list(bpy.data.images):
        if img.users == 0:
            bpy.data.images.remove(img)


def measure_anatomy(mesh_obj):
    """Automatically measures exact anatomical landmarks of the oriented, grounded puppy mesh."""
    verts = [v.co.copy() for v in mesh_obj.data.vertices]
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    zs = [v.z for v in verts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    H = max_z - min_z
    L = max_y - min_y
    W = max_x - min_x
    print(f"[Anatomy] Bounds: X=[{min_x:.3f},{max_x:.3f}] (W={W:.3f}), Y=[{min_y:.3f},{max_y:.3f}] (L={L:.3f}), Z=[{min_z:.3f},{max_z:.3f}] (H={H:.3f})")

    # Find leg column centroids in lower leg slice z in [0.05*H, 0.22*H]
    leg_slice = [v for v in verts if 0.05 * H <= v.z <= 0.22 * H]
    y_leg_mid = sum(v.y for v in leg_slice) / max(1, len(leg_slice))
    print(f"[Anatomy] Lower-leg slice count={len(leg_slice)}, y_leg_mid={y_leg_mid:.4f}")

    def cluster_center(cond, fallback):
        pts = [v for v in leg_slice if cond(v)]
        if not pts:
            return Vector(fallback)
        cx = sum(v.x for v in pts) / len(pts)
        cy = sum(v.y for v in pts) / len(pts)
        cz = sum(v.z for v in pts) / len(pts)
        return Vector((cx, cy, cz))

    # Recall: puppy faces -Y, so Front is y < y_leg_mid, Back is y > y_leg_mid;
    # Anatomical Left is +X, Anatomical Right is -X!
    c_fl = cluster_center(lambda v: v.x > 0.0 and v.y < y_leg_mid, (0.09, -0.10, 0.06))
    c_fr = cluster_center(lambda v: v.x < 0.0 and v.y < y_leg_mid, (-0.09, -0.10, 0.06))
    c_bl = cluster_center(lambda v: v.x > 0.0 and v.y >= y_leg_mid, (0.09, 0.12, 0.06))
    c_br = cluster_center(lambda v: v.x < 0.0 and v.y >= y_leg_mid, (-0.09, 0.12, 0.06))

    # Symmetrize X & Y cleanly across left/right pairs for balanced trot gait
    fx = 0.5 * (abs(c_fl.x) + abs(c_fr.x))
    fy = 0.5 * (c_fl.y + c_fr.y)
    bx = 0.5 * (abs(c_bl.x) + abs(c_br.x))
    by = 0.5 * (c_bl.y + c_br.y)

    # Detect actual belly clearance between front & back legs (strictly center X and mid-torso Y to ignore inner toes!)
    mid_belly = [v.z for v in verts if abs(v.x) < 0.035 and (fy + 0.07) < v.y < (by - 0.07) and v.z > 0.12 * H]
    belly_z = max(0.16 * H, min(mid_belly) if mid_belly else 0.18 * H)
    shoulder_z = min(0.31 * H, belly_z + 0.082)
    print(f"[Anatomy] Belly clearance z={belly_z:.3f}m, Shoulder/Hip pivot z={shoulder_z:.3f}m")
    print(f"[Anatomy] Front paws: (±{fx:.3f}, {fy:.3f}) | Back paws: (±{bx:.3f}, {by:.3f})")

    # Detect tail peak (rearmost vertices with z in upper rump band)
    rump_rear = [v for v in verts if v.y > max_y - 0.075 and v.z > 0.32 * H and abs(v.x) < 0.09]
    if rump_rear:
        tail_tip_y = max(v.y for v in rump_rear)
        tail_mid_z = sum(v.z for v in rump_rear) / len(rump_rear)
        tail_base_y = tail_tip_y - 0.075
    else:
        tail_tip_y = max_y
        tail_mid_z = 0.48 * H
        tail_base_y = max_y - 0.075
    print(f"[Anatomy] Tail base=(0.0, {tail_base_y:.3f}, {tail_mid_z:.3f}), tip_y={tail_tip_y:.3f}")

    # Detect neck/head transition:
    # Front of head extends toward min_y; neck sits above front legs around y ~ fy * 0.65, z ~ 0.53*H
    # Let's refine neck_y using head centroid (vertices above 0.62*H)
    head_verts = [v for v in verts if v.z > 0.62 * H]
    head_cy = sum(v.y for v in head_verts) / max(1, len(head_verts))
    neck_y = head_cy + 0.025
    neck_z = 0.53 * H
    body_cy = 0.5 * (fy + by)
    body_z = 0.34 * H
    print(f"[Anatomy] Head center_y={head_cy:.3f} -> Neck pivot=(0.0, {neck_y:.3f}, {neck_z:.3f}), Body pivot=(0.0, {body_cy:.3f}, {body_z:.3f})")

    return {
        "H": H,
        "L": L,
        "W": W,
        "min_y": min_y,
        "max_y": max_y,
        "y_leg_mid": y_leg_mid,
        "belly_z": belly_z,
        "shoulder_z": shoulder_z,
        "body": Vector((0.0, body_cy, body_z)),
        "head": Vector((0.0, neck_y, neck_z)),
        "tail": Vector((0.0, tail_base_y, tail_mid_z)),
        "pawFL": Vector((fx, fy, shoulder_z)),
        "pawFR": Vector((-fx, fy, shoulder_z)),
        "pawBL": Vector((bx, by, shoulder_z)),
        "pawBR": Vector((-bx, by, shoulder_z)),
        "fx": fx,
        "fy": fy,
        "bx": bx,
        "by": by,
    }


def build_armature_and_skin(mesh_obj, lm):
    """
    Creates Armature_Dog_v2 with 7 vertical (+Z, roll=0) identity-oriented bones
    so glTF THREE.Bone nodes match src/wildlife.js axes 1:1 with smooth continuous skin weights!
    """
    arm_data = bpy.data.armatures.new("Armature_Dog_v2")
    arm_obj = bpy.data.objects.new("Armature_Dog_v2", arm_data)
    bpy.context.collection.objects.link(arm_obj)

    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    bone_len = 0.055
    eb = arm_data.edit_bones

    def add_bone(name, head_pt, parent_bone=None):
        b = eb.new(name)
        b.head = head_pt.copy()
        b.tail = head_pt + Vector((0.0, 0.0, bone_len))
        b.roll = 0.0
        b.use_connect = False
        if parent_bone is not None:
            b.parent = parent_bone
        return b

    b_body = add_bone("Rig_Body", lm["body"], None)
    add_bone("Rig_Head", lm["head"], b_body)
    add_bone("Rig_Tail", lm["tail"], b_body)
    add_bone("Rig_PawFL", lm["pawFL"], b_body)
    add_bone("Rig_PawFR", lm["pawFR"], b_body)
    add_bone("Rig_PawBL", lm["pawBL"], b_body)
    add_bone("Rig_PawBR", lm["pawBR"], b_body)

    bpy.ops.object.mode_set(mode="OBJECT")

    # Parent mesh to armature cleanly with Armature deform modifier
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new("ArmatureDeform", "ARMATURE")
    mod.object = arm_obj
    mod.use_vertex_groups = True

    bone_names = ["Rig_Body", "Rig_Head", "Rig_Tail", "Rig_PawFL", "Rig_PawFR", "Rig_PawBL", "Rig_PawBR"]
    vgs = {n: mesh_obj.vertex_groups.new(name=n) for n in bone_names}

    H = lm["H"]
    neck_y = lm["head"].y
    neck_z = lm["head"].z
    tail_y = lm["tail"].y
    tail_z = lm["tail"].z
    y_leg_mid = lm["y_leg_mid"]
    sh_z = lm["shoulder_z"]
    belly_z = lm["belly_z"]

    # Assign smooth anatomical vertex weights
    counts = {n: 0 for n in bone_names}
    for v in mesh_obj.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z

        # 1. Head + floppy ears + snout (tilted collar plane: higher at back nape, lower under chin!)
        # In side view: collar rises from z~0.47*H at front throat to z~0.58*H at back nape; behind y>0.03 is pure back!
        collar_z = neck_z - 0.010 + 0.38 * (y - neck_y)
        is_ear_zone = (abs(x) > 0.105) and (y < neck_y + 0.13) and (z > 0.45 * H)
        w_head = smoothstep(collar_z - 0.024, collar_z + 0.034, z)
        # Strictly prevent the smooth orange back behind the collar (below skull/ears) from getting head weight!
        if z < 0.62 * H and y > 0.015:
            w_head *= 1.0 - smoothstep(0.015, 0.085, y)
        if is_ear_zone:
            w_head = max(w_head, smoothstep(0.45 * H, 0.52 * H, z))

        # 2. Tail (plump stubby tail sticking out cleanly behind rump; tighter root prevents rump pinch!)
        w_tail = 0.0
        if y > tail_y + 0.002 and z > 0.35 * H:
            wy = smoothstep(tail_y + 0.006, tail_y + 0.048, y)
            wz = smoothstep(0.35 * H, 0.43 * H, z)
            wx = 1.0 - smoothstep(0.056, 0.086, abs(x))
            w_tail = wy * wz * wx

        # 3. Four Paws (clean smooth hip/shoulder blend below torso)
        w_paws = {"Rig_PawFL": 0.0, "Rig_PawFR": 0.0, "Rig_PawBL": 0.0, "Rig_PawBR": 0.0}
        if z < sh_z + 0.065:
            wz_leg = 1.0 - smoothstep(belly_z - 0.015, sh_z + 0.055, z)
            if wz_leg > 1e-4:
                # Distance-based assignment to each of the 4 leg columns
                leg_pts = [
                    ("Rig_PawFL", lm["pawFL"]),
                    ("Rig_PawFR", lm["pawFR"]),
                    ("Rig_PawBL", lm["pawBL"]),
                    ("Rig_PawBR", lm["pawBR"]),
                ]
                # Soft-select nearest leg column only if within generous leg radius (keeps center belly on Rig_Body!)
                best_k = None
                best_d = 1e9
                for k, pt in leg_pts:
                    d = math.hypot(x - pt.x, y - pt.y)
                    if d < best_d:
                        best_d = d
                        best_k = k
                # Leg column radius ~0.095m; taper smoothly into lower belly/flank
                w_rad = 1.0 - smoothstep(0.082, 0.132, best_d)
                # Ensure paw soles/lower legs below belly_z get 100% clean paw binding!
                if z < belly_z - 0.005:
                    w_rad = 1.0
                w_paws[best_k] = wz_leg * w_rad

        # Combine & normalize so every vertex sums strictly to 1.0
        other_sum = w_head + w_tail + sum(w_paws.values())
        if other_sum > 1.0:
            inv = 1.0 / other_sum
            w_head *= inv
            w_tail *= inv
            for k in w_paws:
                w_paws[k] *= inv
            w_body = 0.0
        else:
            w_body = 1.0 - other_sum

        all_w = {"Rig_Body": w_body, "Rig_Head": w_head, "Rig_Tail": w_tail, **w_paws}
        for k, val in all_w.items():
            if val > 0.002:
                vgs[k].add([v.index], val, "REPLACE")
                counts[k] += 1

    print("[Skinning] Vertex counts per bone:", counts)
    return arm_obj


def export_rigged_glb(blend_path, glb_path):
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in ("MESH", "ARMATURE"):
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=False,
        export_animations=False,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_image_quality=92,
        export_texcoords=True,
        export_normals=True,
    )
    sz_kb = os.path.getsize(glb_path) // 1024
    print(f"[Export] Rigged GLB saved -> {glb_path} ({sz_kb} KB)")


def apply_trot_stress_pose(arm_obj, enable=True):
    """Applies a lively mid-trot + cute head-tilt + tail-wag pose to audit skinning quality."""
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones
    for b in pb:
        b.rotation_mode = "XYZ"
        b.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        b.location = Vector((0.0, 0.0, 0.0))

    if enable:
        # Note: in Blender Pose space for a +Z bone, local X = world X (left-right),
        # local Y = world Z? Wait: for vertical +Z bone with roll=0:
        #   bone +Y is along bone (+Z world), bone +X is +X world, bone +Z is -Y world!
        # Let's check: rotation around bone local X tilts forward/back; around bone local Y twists/wags!
        pb["Rig_Body"].location = Vector((0.0, 0.024, 0.0))  # subtle trot hop along bone +Y (world +Z!)
        pb["Rig_Body"].rotation_euler = Euler((math.radians(5.0), math.radians(6.0), math.radians(6.0)), "XYZ")
        pb["Rig_Head"].rotation_euler = Euler((math.radians(-6.0), math.radians(14.0), math.radians(9.0)), "XYZ")
        pb["Rig_Tail"].rotation_euler = Euler((math.radians(12.0), math.radians(28.0), 0.0), "XYZ")
        # Diagonal trot stride: FL & BR forward (-34 deg X), FR & BL back (+34 deg X)!
        pb["Rig_PawFL"].rotation_euler = Euler((math.radians(-34.0), 0.0, 0.0), "XYZ")
        pb["Rig_PawBR"].rotation_euler = Euler((math.radians(-34.0), 0.0, 0.0), "XYZ")
        pb["Rig_PawFR"].rotation_euler = Euler((math.radians(34.0), 0.0, 0.0), "XYZ")
        pb["Rig_PawBL"].rotation_euler = Euler((math.radians(34.0), 0.0, 0.0), "XYZ")

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


def stitch_audit_board(shot_paths, out_board):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("[Audit Board] PIL not in Blender python; skip inline stitch (stitch via system python)")
        return
    imgs = [Image.open(p).convert("RGB") for _, p in shot_paths]
    w, h = imgs[0].size
    cols, rows = 3, 2
    pad = 14
    header = 34
    board = Image.new("RGB", (cols * w + (cols + 1) * pad, rows * (h + header) + (rows + 1) * pad), (242, 236, 224))
    draw = ImageDraw.Draw(board)
    for idx, ((label, _), im) in enumerate(zip(shot_paths, imgs)):
        r = idx // cols
        c = idx % cols
        x0 = pad + c * (w + pad)
        y0 = pad + r * (h + header + pad)
        board.paste(im, (x0, y0 + header))
        draw.rectangle([x0, y0, x0 + w, y0 + header], fill=(58, 76, 66))
        draw.text((x0 + 12, y0 + 10), label, fill=(252, 246, 232))
    board.save(out_board)
    print(f"[Audit Board] Saved 6-shot board -> {out_board}")


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=RAW_GLB)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.data and len(o.data.polygons) > 0]
    if not meshes:
        raise RuntimeError(f"No mesh found in {RAW_GLB}")

    # Join all imported meshes into one unified object and unparent cleanly
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    dog = bpy.context.view_layer.objects.active
    dog.name = "Dog_v2_Mesh"
    if dog.parent:
        mw = dog.matrix_world.copy()
        dog.parent = None
        dog.matrix_world = mw

    # Delete leftover empty parent nodes from Tripo glTF
    for o in list(bpy.context.scene.objects):
        if o != dog:
            bpy.data.objects.remove(o, do_unlink=True)

    # Rotate -90 deg around Z so puppy faces -Y in Blender (+Z in glTF/Three.js!)
    dog.matrix_world = Matrix.Rotation(math.radians(-90.0), 4, "Z") @ dog.matrix_world
    bpy.ops.object.select_all(action="DESELECT")
    dog.select_set(True)
    bpy.context.view_layer.objects.active = dog
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Normalize exact Y length = 0.62m, center X & Y, ground soles at exact Z = 0.000
    mn, mx = mesh_world_bounds(dog)
    sz = mx - mn
    sf = TARGET_LENGTH_Y / max(1e-4, sz.y)
    dog.scale = (sf, sf, sf)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    mn2, mx2 = mesh_world_bounds(dog)
    cx = 0.5 * (mn2.x + mx2.x)
    cy = 0.5 * (mn2.y + mx2.y)
    dog.location = Vector((-cx, -cy, -mn2.z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # CRITICAL: Weld split UV-seam vertices BEFORE decimation so mesh is 100% watertight
    # (UV coordinates live on face loops in Blender, so welding vertices preserves UVs while eliminating seam cracks!)
    bm = bmesh.new()
    bm.from_mesh(dog.data)
    before_v = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(dog.data)
    bm.free()
    dog.data.update()
    print(f"[Dog v2] Watertight weld: {before_v} -> {len(dog.data.vertices)} verts")

    # Clean decimation to crisp WebGL budget (~11,500 tris, delimiting UV borders so seams never tear!)
    raw_tris = len(dog.data.polygons)
    if raw_tris > TARGET_TRIS:
        dec = dog.modifiers.new("WebGLDecimate", "DECIMATE")
        dec.ratio = max(0.004, TARGET_TRIS / float(raw_tris))
        dec.delimit = {"UV"}
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    # Clear any stale custom split normals from raw Tripo glTF so shading is buttery smooth
    if hasattr(dog.data, "has_custom_normals") and dog.data.has_custom_normals:
        bpy.ops.object.select_all(action="DESELECT")
        dog.select_set(True)
        bpy.context.view_layer.objects.active = dog
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in dog.data.polygons:
        p.use_smooth = True
    print(f"[Dog v2] Decimated {raw_tris} -> {len(dog.data.polygons)} tris")

    # Matte Animal Crossing clay-gouache stylization + 1024px WebGL texture budget
    optimize_and_stylize_materials(dog)

    # Measure anatomy & build 7-bone vertical identity Armature + smooth continuous skin weights
    lm = measure_anatomy(dog)
    arm_obj = build_armature_and_skin(dog, lm)

    # Pack active texture & export clean REST-POSE rigged GLB!
    try:
        bpy.ops.file.pack_all()
    except Exception:
        pass
    export_rigged_glb(BLEND_OUT, GLB_OUT)

    # Render 6-shot Audit Board (4 Rest views + 1 Mid-Trot/Wag Pose Test + 1 Top 52° Gameplay View!)
    mn3, mx3 = mesh_world_bounds(dog)
    sz3 = mx3 - mn3
    rad = max(sz3.x, sz3.y, sz3.z) * 0.56
    mid_z = 0.5 * (mn3.z + mx3.z)
    dist = max(1.35, rad * 4.2)

    scene = bpy.context.scene
    setup_studio_render(scene, res_x=540, res_y=540, samples=28, is_house=False)
    cam_d = bpy.data.cameras.new("AuditCam")
    cam_d.lens = 65
    cam = bpy.data.objects.new("AuditCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    rest_shots = [
        ("1. FRONT (-Y Face Check)", "01_front.png", (0.0, -dist, mid_z + rad * 0.12)),
        ("2. HERO 3/4 (Rest)", "02_hero34.png", (dist * 0.62, -dist * 0.78, mid_z + rad * 0.22)),
        ("3. LEFT SIDE", "03_left.png", (dist, 0.0, mid_z + rad * 0.12)),
        ("4. BACK", "04_back.png", (0.0, dist, mid_z + rad * 0.12)),
    ]
    rendered = []
    for lbl, fn, loc in rest_shots:
        out_p = os.path.join(PREV_DIR, fn)
        aim_camera(cam, loc, (0.0, 0.0, mid_z))
        scene.render.filepath = out_p
        bpy.ops.render.render(write_still=True)
        rendered.append((lbl, out_p))

    # Shot 5: Mid-Trot + Head Tilt + Tail Wag Pose Deformation Audit!
    apply_trot_stress_pose(arm_obj, enable=True)
    p5 = os.path.join(PREV_DIR, "05_trot_pose.png")
    aim_camera(cam, (dist * 0.72, -dist * 0.68, mid_z + rad * 0.24), (0.0, 0.0, mid_z))
    scene.render.filepath = p5
    bpy.ops.render.render(write_still=True)
    rendered.append(("5. TROT + WAG POSE TEST", p5))

    # Shot 6: Top 52-deg Gameplay Camera Angle (in lively Trot Pose!)
    p6 = os.path.join(PREV_DIR, "06_gameplay_top52.png")
    aim_camera(cam, (dist * 0.45, -dist * 0.60, mid_z + dist * 0.92), (0.0, 0.0, mid_z * 0.9))
    scene.render.filepath = p6
    bpy.ops.render.render(write_still=True)
    rendered.append(("6. TOP 52deg GAMEPLAY VIEW", p6))

    # Restore rest pose in .blend
    apply_trot_stress_pose(arm_obj, enable=False)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

    board_path = os.path.join(PREV_DIR, "DOG_V2_TRIPO_AUDIT_BOARD.png")
    stitch_audit_board(rendered, board_path)
    print(f"[Dog v2] ALL DONE! GLB={GLB_OUT} | Board={board_path}")


if __name__ == "__main__":
    main()
