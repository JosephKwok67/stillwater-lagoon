"""
Antigravity Studio Edition - Shared Blender 5.3 Sculpting, Cycles Gouache+AO Baking & GLB Export Library
Produces WebGL-ready glTF 2.0 (.glb) assets with baked 1024/2048px hand-painted gouache + crevice AO atlases
so Three.js matches our Cycles studio renders 1:1!
"""
import math
import os
import bpy
import bmesh
import addon_utils
from mathutils import Vector, Euler


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_linear(hex_str):
    h = hex_str.lstrip("#")
    r, g, b = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    def conv(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (conv(r), conv(g), conv(b), 1.0)


def make_gouache_mat(
    name,
    base_hex,
    dark_hex=None,
    rough=0.84,
    metal=0.0,
    noise_scale=18.0,
    ao_strength=0.28,
    ao_dist=0.25,
    bump_str=0.04,
    emit_hex=None,
    emit_str=0.0,
    alpha=1.0,
    pattern=None,
    pattern_hex2=None,
    pattern_scale=12.0,
):
    """
    Creates a painterly gouache shader with multi-scale brushwork + soft crevice AO.
    Stores a direct reference tag (`BakeColorOut`) on the final albedo-with-AO Mix node
    so `bake_gouache_atlas()` can cleanly bake pure shadow-free hand-painted color + AO!
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.name = "MatOutput"
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "PrincipledBSDF"
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.22 if alpha == 1.0 else 0.65
    if emit_hex and emit_str > 0 and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emit_hex)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = noise_scale
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.65
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])

    noise2 = nt.nodes.new("ShaderNodeTexNoise")
    noise2.inputs["Scale"].default_value = noise_scale * 0.34
    noise2.inputs["Detail"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], noise2.inputs["Vector"])

    base_col = srgb_to_linear(base_hex)
    if dark_hex:
        dark_col = srgb_to_linear(dark_hex)
    else:
        dark_col = (base_col[0] * 0.78, base_col[1] * 0.78, base_col[2] * 0.82, 1.0)
    light_col = (min(1.0, base_col[0] * 1.12), min(1.0, base_col[1] * 1.10), min(1.0, base_col[2] * 1.06), 1.0)

    mix_brush = nt.nodes.new("ShaderNodeMix")
    mix_brush.data_type = "RGBA"
    mix_brush.inputs["A"].default_value = dark_col
    mix_brush.inputs["B"].default_value = light_col
    nt.links.new(noise.outputs["Fac"], mix_brush.inputs["Factor"])

    mix_base = nt.nodes.new("ShaderNodeMix")
    mix_base.data_type = "RGBA"
    mix_base.inputs["Factor"].default_value = 0.48
    mix_base.inputs["A"].default_value = base_col
    nt.links.new(mix_brush.outputs["Result"], mix_base.inputs["B"])
    color_out = mix_base.outputs["Result"]

    # Optional woven straw / knit rib / gingham checker pattern!
    if pattern == "gingham":
        chk = nt.nodes.new("ShaderNodeTexChecker")
        chk.inputs["Scale"].default_value = pattern_scale
        chk.inputs["Color1"].default_value = base_col
        chk.inputs["Color2"].default_value = srgb_to_linear(pattern_hex2 or "#f7edd9")
        nt.links.new(tc.outputs["Object"], chk.inputs["Vector"])
        mp = nt.nodes.new("ShaderNodeMix")
        mp.data_type = "RGBA"
        mp.inputs["Factor"].default_value = 0.34
        mp.inputs["B"].default_value = base_col
        nt.links.new(chk.outputs["Color"], mp.inputs["A"])
        color_out = mp.outputs["Result"]
    elif pattern == "straw":
        wave1 = nt.nodes.new("ShaderNodeTexWave")
        wave1.wave_type = "RINGS"
        wave1.rings_direction = "Z"
        wave1.inputs["Scale"].default_value = pattern_scale
        wave1.inputs["Distortion"].default_value = 2.5
        nt.links.new(tc.outputs["Object"], wave1.inputs["Vector"])
        mp = nt.nodes.new("ShaderNodeMix")
        mp.data_type = "RGBA"
        mp.inputs["A"].default_value = dark_col
        mp.inputs["B"].default_value = light_col
        nt.links.new(wave1.outputs["Fac"], mp.inputs["Factor"])
        m2 = nt.nodes.new("ShaderNodeMix")
        m2.data_type = "RGBA"
        m2.inputs["Factor"].default_value = 0.42
        nt.links.new(color_out, m2.inputs["A"])
        nt.links.new(mp.outputs["Result"], m2.inputs["B"])
        color_out = m2.outputs["Result"]
    elif pattern == "knit":
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "X"
        wave.inputs["Scale"].default_value = pattern_scale
        wave.inputs["Distortion"].default_value = 1.6
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        mp = nt.nodes.new("ShaderNodeMix")
        mp.data_type = "RGBA"
        mp.inputs["A"].default_value = dark_col
        mp.inputs["B"].default_value = light_col
        nt.links.new(wave.outputs["Fac"], mp.inputs["Factor"])
        m2 = nt.nodes.new("ShaderNodeMix")
        m2.data_type = "RGBA"
        m2.inputs["Factor"].default_value = 0.40
        nt.links.new(color_out, m2.inputs["A"])
        nt.links.new(mp.outputs["Result"], m2.inputs["B"])
        color_out = m2.outputs["Result"]

    if ao_strength > 0.0:
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.samples = 8
        ao.inputs["Distance"].default_value = ao_dist
        nt.links.new(color_out, ao.inputs["Color"])

        mix_ao = nt.nodes.new("ShaderNodeMix")
        mix_ao.name = "BakeColorOut"
        mix_ao.data_type = "RGBA"
        mix_ao.blend_type = "MULTIPLY"
        mix_ao.inputs["Factor"].default_value = ao_strength
        nt.links.new(color_out, mix_ao.inputs["A"])
        nt.links.new(ao.outputs["AO"], mix_ao.inputs["B"])
        final_col = mix_ao.outputs["Result"]
    else:
        pass_node = nt.nodes.new("ShaderNodeMix")
        pass_node.name = "BakeColorOut"
        pass_node.data_type = "RGBA"
        pass_node.inputs["Factor"].default_value = 0.0
        nt.links.new(color_out, pass_node.inputs["A"])
        nt.links.new(color_out, pass_node.inputs["B"])
        final_col = pass_node.outputs["Result"]

    nt.links.new(final_col, bsdf.inputs["Base Color"])

    if bump_str > 0:
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = bump_str
        bump.inputs["Distance"].default_value = 0.009
        nt.links.new(noise2.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def set_smooth(obj):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True


def add_subsurf(obj, levels=1):
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    set_smooth(obj)
    return mod


def create_lathe_mesh(name, profile_rz, segments=26, cap_top=True, cap_bottom=True, z_offset=0.0):
    bm = bmesh.new()
    rings = []
    for r, z in profile_rz:
        ring = []
        for i in range(segments):
            ang = (i / segments) * math.tau
            ring.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, z + z_offset)))
        rings.append(ring)

    for k in range(len(rings) - 1):
        r0, r1 = rings[k], rings[k + 1]
        for i in range(segments):
            ni = (i + 1) % segments
            bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))

    if cap_bottom and profile_rz[0][0] > 1e-4:
        c = bm.verts.new((0, 0, profile_rz[0][1] + z_offset))
        r0 = rings[0]
        for i in range(segments):
            ni = (i + 1) % segments
            bm.faces.new((r0[ni], r0[i], c))

    if cap_top and profile_rz[-1][0] > 1e-4:
        c = bm.verts.new((0, 0, profile_rz[-1][1] + z_offset))
        rt = rings[-1]
        for i in range(segments):
            ni = (i + 1) % segments
            bm.faces.new((rt[i], rt[ni], c))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_smooth(obj)
    return obj


def create_curved_tube(name, points_r, bevel_res=5, cyclic=False):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = 1.0
    curve_data.bevel_resolution = bevel_res
    curve_data.use_fill_caps = not cyclic

    spline = curve_data.splines.new("NURBS")
    spline.points.add(len(points_r) - 1)
    for i, (x, y, z, r) in enumerate(points_r):
        spline.points[i].co = (x, y, z, 1.0)
        spline.points[i].radius = r
    spline.use_cyclic_u = cyclic
    spline.use_endpoint_u = not cyclic
    spline.order_u = min(4, len(points_r))

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    return obj


def add_box(name, size, loc, parent, mat, bevel=0.012, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 2
    for p in obj.data.polygons:
        p.use_smooth = False
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def add_cyl(name, r, h, loc, parent, mat, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def add_sphere(name, scale, loc, parent, mat, rot=(0, 0, 0), segs=18, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def collect_hierarchy_objects(root):
    out = []
    def walk(o):
        out.append(o)
        for ch in list(o.children):
            walk(ch)
    walk(root)
    return out


def convert_and_apply_modifiers(root):
    """Converts all curves to meshes and applies all modifiers cleanly while preserving hierarchy!"""
    bpy.ops.object.select_all(action="DESELECT")
    objs = collect_hierarchy_objects(root)
    for obj in objs:
        if obj.type == "CURVE":
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
            set_smooth(bpy.context.active_object)
            obj.select_set(False)
        elif obj.type == "MESH" and obj.modifiers:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            for mod in list(obj.modifiers):
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception:
                    pass
            obj.select_set(False)


def normalize_character_root(root, target_height=1.26, is_quadruped=False):
    bpy.context.view_layer.update()
    min_x, max_x = 999.0, -999.0
    min_y, max_y = 999.0, -999.0
    min_z, max_z = 999.0, -999.0
    for obj in collect_hierarchy_objects(root):
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            min_x, max_x = min(min_x, wc.x), max(max_x, wc.x)
            min_y, max_y = min(min_y, wc.y), max(max_y, wc.y)
            min_z, max_z = min(min_z, wc.z), max(max_z, wc.z)

    cur_dim = (max_y - min_y) if is_quadruped else (max_z - min_z)
    scale_fix = target_height / cur_dim if cur_dim > 0.05 else 1.0
    root.scale = (scale_fix, scale_fix, scale_fix)
    root.location.x = -0.5 * (min_x + max_x) * scale_fix
    root.location.y = -0.5 * (min_y + max_y) * scale_fix
    root.location.z = -min_z * scale_fix
    bpy.context.view_layer.update()
    print(f"[Normalize] {root.name}: dim {cur_dim:.3f} -> {target_height:.3f}m")


def bake_gouache_atlas(root, out_png_path, tex_size=1024, skip_mat_substrings=("AquaGlass", "WarmLamp", "Brass", "EyeDark", "EyeCatch")):
    """
    Bakes ALL procedural gouache brushwork + crevice AO on opaque meshes under `root`
    into a single crisp PNG BaseColor atlas via Cycles EMIT bake (pure shadow-free albedo+AO!).
    Replaces opaque materials with a clean glTF-native Principled BSDF ImageTexture material
    so Three.js WebGL renders IDENTICALLY to our Cycles studio shots!
    """
    addon_utils.enable("cycles")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 4

    convert_and_apply_modifiers(root)

    bake_objs = []
    used_mats = set()
    for obj in collect_hierarchy_objects(root):
        if obj.type != "MESH" or not obj.data.polygons:
            continue
        mats_on_obj = [m for m in obj.data.materials if m is not None]
        if not mats_on_obj:
            continue
        # Skip only if ALL material slots on this mesh are non-baked special shaders (Brass, EyeDark, Glass...)
        if all(any(sub.lower() in m.name.lower() for sub in skip_mat_substrings) for m in mats_on_obj):
            continue
        bake_objs.append(obj)
        for m in mats_on_obj:
            if not any(sub.lower() in m.name.lower() for sub in skip_mat_substrings):
                used_mats.add(m)

    if not bake_objs:
        return None

    # Create target bake image
    img_name = os.path.basename(out_png_path)
    img = bpy.data.images.new(img_name, width=tex_size, height=tex_size, alpha=False)
    img.colorspace_settings.name = "sRGB"

    # Multi-object Smart UV Project packing into ONE shared 0..1 non-overlapping UV atlas!
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bake_objs:
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name="UVMap")
        obj.select_set(True)
    bpy.context.view_layer.objects.active = bake_objs[0]

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.014, correct_aspect=True)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Temporarily route every procedural material's BakeColorOut -> Emission -> Material Output
    # AND place an active Image Texture node pointing to `img` in each material!
    saved_links = []
    temp_nodes = []
    for mat in used_mats:
        nt = mat.node_tree
        out_n = nt.nodes.get("MatOutput") or next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        bsdf_n = nt.nodes.get("PrincipledBSDF") or next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        col_n = nt.nodes.get("BakeColorOut")
        if not out_n:
            continue

        # Target image node (selected + active for bake!)
        tex_n = nt.nodes.new("ShaderNodeTexImage")
        tex_n.image = img
        for n in nt.nodes:
            n.select = False
        tex_n.select = True
        nt.nodes.active = tex_n
        temp_nodes.append((nt, tex_n))

        emit_n = nt.nodes.new("ShaderNodeEmission")
        emit_n.inputs["Strength"].default_value = 1.0
        temp_nodes.append((nt, emit_n))

        if col_n:
            nt.links.new(col_n.outputs["Result"], emit_n.inputs["Color"])
        elif bsdf_n and bsdf_n.inputs["Base Color"].is_linked:
            src_sock = bsdf_n.inputs["Base Color"].links[0].from_socket
            nt.links.new(src_sock, emit_n.inputs["Color"])
        elif bsdf_n:
            emit_n.inputs["Color"].default_value = bsdf_n.inputs["Base Color"].default_value

        # Save existing surface link & swap to pure Emission
        if out_n.inputs["Surface"].is_linked:
            old_from = out_n.inputs["Surface"].links[0].from_socket
            saved_links.append((nt, out_n, old_from))
        nt.links.new(emit_n.outputs["Emission"], out_n.inputs["Surface"])

    # Execute fast shadow-free EMIT bake across all selected opaque meshes!
    bpy.ops.object.bake(type="EMIT", margin=4, use_clear=True)

    # Save crisp PNG & pack inside .blend
    os.makedirs(os.path.dirname(out_png_path), exist_ok=True)
    img.filepath_raw = out_png_path
    img.file_format = "PNG"
    img.save()
    img.pack()

    # Build clean glTF-native Baked Gouache Principled BSDF material!
    baked_mat = bpy.data.materials.new(name=f"Mat_Baked_{root.name}")
    baked_mat.use_nodes = True
    nt = baked_mat.node_tree
    nt.nodes.clear()
    out_b = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf_b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf_b.inputs["Roughness"].default_value = 0.84
    bsdf_b.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf_b.inputs:
        bsdf_b.inputs["Specular IOR Level"].default_value = 0.20

    tex_b = nt.nodes.new("ShaderNodeTexImage")
    tex_b.image = img
    nt.links.new(tex_b.outputs["Color"], bsdf_b.inputs["Base Color"])
    nt.links.new(bsdf_b.outputs["BSDF"], out_b.inputs["Surface"])

    for obj in bake_objs:
        obj.data.materials.clear()
        obj.data.materials.append(baked_mat)

    # Convert special skipped materials (WarmLamp, AquaGlass, Brass, EyeDark, EyeCatch) to clean flat glTF Principled
    # so glTF exporter writes their exact colors/alpha/emission cleanly too!
    for obj in collect_hierarchy_objects(root):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        mat = obj.data.materials[0]
        if mat == baked_mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf_n = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf_n:
            continue
        # Ensure Base Color has clean constant linear color if procedural node was linked
        if bsdf_n.inputs["Base Color"].is_linked:
            # Grab base hex color from Mix node A if present
            col_val = (0.9, 0.9, 0.9, 1.0)
            for n in nt.nodes:
                if n.type == "MIX" and n.data_type == "RGBA" and not n.inputs["A"].is_linked:
                    col_val = tuple(n.inputs["A"].default_value)
                    break
            for lk in list(bsdf_n.inputs["Base Color"].links):
                nt.links.remove(lk)
            bsdf_n.inputs["Base Color"].default_value = col_val
        if bsdf_n.inputs["Normal"].is_linked:
            for lk in list(bsdf_n.inputs["Normal"].links):
                nt.links.remove(lk)

    print(f"[Bake] Saved {tex_size}x{tex_size} gouache+AO atlas -> {out_png_path} ({len(bake_objs)} meshes)")
    return baked_mat


def setup_studio_render(scene, res_x=900, res_y=900, samples=40, bg_hex="#eae4d7", is_house=False):
    addon_utils.enable("cycles")
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = 0.12

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = srgb_to_linear(bg_hex)
        bg.inputs["Strength"].default_value = 0.85

    if is_house:
        sun_d = bpy.data.lights.new("SunKey", type="SUN")
        sun_d.energy = 3.2
        sun_d.angle = math.radians(4.5)
        sun_d.color = (1.0, 0.94, 0.84)
        sun = bpy.data.objects.new("SunKey", sun_d)
        sun.rotation_euler = (math.radians(48), math.radians(12), math.radians(34))
        bpy.context.collection.objects.link(sun)

        pt_d = bpy.data.lights.new("IndoorWarm", type="POINT")
        pt_d.energy = 85.0
        pt_d.shadow_soft_size = 0.45
        pt_d.color = (1.0, 0.87, 0.65)
        pt = bpy.data.objects.new("IndoorWarm", pt_d)
        pt.location = (0.0, 0.0, 1.85)
        bpy.context.collection.objects.link(pt)
    else:
        key_d = bpy.data.lights.new("SunKey", type="AREA")
        key_d.energy = 115.0
        key_d.size = 2.2
        key_d.color = (1.0, 0.95, 0.86)
        key = bpy.data.objects.new("SunKey", key_d)
        key.location = (1.8, -2.4, 2.6)
        key.rotation_euler = (math.radians(52), 0.0, math.radians(36))
        bpy.context.collection.objects.link(key)

        fill_d = bpy.data.lights.new("CoolFill", type="AREA")
        fill_d.energy = 42.0
        fill_d.size = 2.8
        fill_d.color = (0.76, 0.88, 1.0)
        fill = bpy.data.objects.new("CoolFill", fill_d)
        fill.location = (-2.2, -1.6, 1.6)
        fill.rotation_euler = (math.radians(66), 0.0, math.radians(-52))
        bpy.context.collection.objects.link(fill)

        rim_d = bpy.data.lights.new("WarmRim", type="AREA")
        rim_d.energy = 55.0
        rim_d.size = 1.6
        rim_d.color = (1.0, 0.90, 0.72)
        rim = bpy.data.objects.new("WarmRim", rim_d)
        rim.location = (-1.1, 2.3, 2.2)
        rim.rotation_euler = (math.radians(122), 0.0, math.radians(-155))
        bpy.context.collection.objects.link(rim)

        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.62, depth=0.04, location=(0, 0, -0.02))
        ped = bpy.context.active_object
        ped.name = "Studio_Pedestal"
        ped.data.materials.append(make_gouache_mat("Mat_Pedestal", "#dfd6c5", "#cec2ad", rough=0.92, ao_strength=0.1))


def aim_camera(cam, loc, target):
    cam.location = Vector(loc)
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def set_hierarchy_hidden(obj, hide):
    obj.hide_render = hide
    obj.hide_viewport = hide
    for ch in obj.children:
        set_hierarchy_hidden(ch, hide)


def export_clean_glb(blend_path, glb_path):
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    print(f"[Export] GLB saved -> {glb_path} ({os.path.getsize(glb_path)//1024} KB)")
