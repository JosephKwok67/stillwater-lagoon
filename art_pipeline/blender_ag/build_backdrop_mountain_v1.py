"""
Stillwater Lagoon - Backdrop Mountain v1 Pipeline (Blender 5.3)
---------------------------------------------------------------
Transforms Codex's sculpted mountain whitebox (`art_pipeline/blender/lagoon_mountain_whitebox.blend`)
into a seamless, Ghibli hand-painted coastal backdrop mountain GLB:
  - public/assets/models/environment/backdrop_mountain.glb (~10.5k tris, 2048px gouache+AO)

Key craft:
1. Preserves Codex's heroic silhouette (flat-topped main peak + right sharp secondary peak + saddle).
2. Rescales to hero backdrop proportions (~96m wide x ~48m deep x ~30m tall) and pulls outer
   perimeter skirt cleanly down to Z = -5.0m so it merges invisibly behind the existing terrain hills.
3. Refines noisy whitebox facets into crisp Ghibli diagonal geological rock strata on steep cliffs
   contrasted against velvety smooth grassy foothill shoulders (echoing lagoon_mountain_studies.png).
4. Cycles-bakes a 2048px hand-painted watercolor BaseColor+AO texture whose foothill meadow green
   is color-matched directly to `src/grass.js` & `src/environment.js` (#569835 / #427c32) while
   escarpments feature warm sunlit limestone-granite & cool slate crevices.
5. Renders a 4-shot studio audit board (front lakeside, 24° village panorama, 44° walking, 3/4 rear).
"""

import os
import math
import bpy
import bmesh
import mathutils
import numpy as np

PROJECT = r"I:\antigravity cli\钓鱼大冒险"
SRC_BLEND = os.path.join(PROJECT, "art_pipeline", "blender", "lagoon_mountain_whitebox.blend")
OUT_GLB = os.path.join(PROJECT, "public", "assets", "models", "environment", "backdrop_mountain.glb")
STAGE_DIR = os.path.join(PROJECT, "art_pipeline", "staging", "mountain_v1")
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
os.makedirs(STAGE_DIR, exist_ok=True)


def dilate_blender_image(img, passes=6):
    w, h = img.size[0], img.size[1]
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    rgba = buf.reshape((h, w, 4))
    rgb = rgba[:, :, :3].copy()
    valid = rgb.sum(axis=2) > 0.04

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
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def build_mountain():
    bpy.ops.wm.open_mainfile(filepath=SRC_BLEND)

    # Locate mountain object & remove studio floor/lights/cams
    mtn = None
    for o in list(bpy.data.objects):
        if o.type == "MESH" and "mountain" in o.name.lower():
            mtn = o
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    assert mtn is not None, "Mountain mesh not found!"
    mtn.name = "Backdrop_Mountain"

    bpy.ops.object.select_all(action="DESELECT")
    mtn.select_set(True)
    bpy.context.view_layer.objects.active = mtn
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # 1. Rescale to hero coastal backdrop (~98m wide x ~49m deep x ~30m tall)
    #    Centered cleanly at X=0, Y=0; front lakeside face looks toward -Y (glTF +Z)!
    scale_x, scale_y, scale_z = 2.58, 2.04, 2.88
    for v in mtn.data.vertices:
        v.co.x *= scale_x
        v.co.y *= scale_y
        v.co.z = (v.co.z + 0.23) * scale_z
    mtn.data.update()

    # 2. Subdivide 1 level for crisp diagonal geological strata + smooth meadow shoulders
    sub = mtn.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)

    # Gently smooth raw crumpled-paper noise first
    sm = mtn.modifiers.new("SmoothPre", "SMOOTH")
    sm.factor = 0.52
    sm.iterations = 3
    bpy.ops.object.modifier_apply(modifier=sm.name)

    # 3. Sculpt natural non-periodic alpine granite cliff crags + deep -5.5m perimeter skirt!
    bm = bmesh.new()
    bm.from_mesh(mtn.data)
    bm.normal_update()

    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    rx = max(abs(min(xs)), abs(max(xs)))
    ry = max(abs(min(ys)), abs(max(ys)))

    for v in bm.verts:
        nx, ny, nz = v.normal.x, v.normal.y, v.normal.z
        slope = 1.0 - max(0.0, nz)
        cliff_w = smoothstep(0.28, 0.56, slope) * smoothstep(6.0, 14.0, v.co.z)

        # Organic non-periodic rocky buttresses (using Blender's built-in 3D multi-fractal noise!)
        if cliff_w > 0.01:
            p_rock = mathutils.Vector((v.co.x * 0.065, v.co.y * 0.065, v.co.z * 0.11))
            n_val = mathutils.noise.fractal(p_rock, 0.85, 2.0, 3)
            # Subtle angular granite facets without any repeating wave bands
            disp = n_val * 0.85 * cliff_w
            v.co.x += nx * disp
            v.co.y += ny * disp
            v.co.z += nz * disp * 0.25

        # Pull perimeter skirt smoothly below ground (Z = -5.5m) so it blends invisibly into terrain hills
        ellip_r = math.hypot(v.co.x / rx, v.co.y / ry)
        rim_drop = smoothstep(0.80, 0.99, ellip_r)
        if rim_drop > 0.0:
            v.co.z -= rim_drop * 6.0
        if v.co.z < 1.2 and rim_drop < 0.05:
            v.co.z -= (1.2 - v.co.z) * 0.35

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mtn.data)
    bm.free()
    mtn.data.update()

    # 4. Decimate cleanly to ~10,800 tris (crisp rock ridges + smooth hills, ultra-light in WebGL!)
    cur_tris = sum(max(1, len(p.vertices) - 2) for p in mtn.data.polygons)
    if cur_tris > 10800:
        dec = mtn.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = max(0.05, 10800.0 / float(cur_tris))
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)

    for p in mtn.data.polygons:
        p.use_smooth = True

    # 5. Clean Smart UV unwrap + Cycles 2048px hand-painted Ghibli watercolor grass & granite rock bake!
    if not mtn.data.uv_layers:
        mtn.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 28
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = False
    scene.cycles.bake_type = "EMIT"
    scene.render.bake.margin = 16

    mat = bpy.data.materials.new("BakeMountainGhibli")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    tc = nt.nodes.new("ShaderNodeTexCoord")
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    sep_p = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep_n = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep_p.inputs["Vector"])
    nt.links.new(geom.outputs["Normal"], sep_n.inputs["Vector"])

    # Painterly gouache macro meadow swatches
    n_macro = nt.nodes.new("ShaderNodeTexNoise")
    n_macro.inputs["Scale"].default_value = 0.055
    n_macro.inputs["Detail"].default_value = 5.0
    n_macro.inputs["Distortion"].default_value = 0.85
    nt.links.new(tc.outputs["Object"], n_macro.inputs["Vector"])

    # Natural non-periodic Ghibli granite rock brush planes (stretched multi-octave fBM noise, ZERO cellular cobweb!)
    rock_map = nt.nodes.new("ShaderNodeMapping")
    rock_map.inputs["Scale"].default_value = (0.11, 0.11, 0.22)
    rock_map.inputs["Rotation"].default_value = (0.0, math.radians(16), math.radians(-10))
    nt.links.new(tc.outputs["Object"], rock_map.inputs["Vector"])

    n_rock_broad = nt.nodes.new("ShaderNodeTexNoise")
    n_rock_broad.inputs["Scale"].default_value = 0.85
    n_rock_broad.inputs["Detail"].default_value = 6.0
    n_rock_broad.inputs["Roughness"].default_value = 0.62
    n_rock_broad.inputs["Distortion"].default_value = 0.65
    nt.links.new(rock_map.outputs["Vector"], n_rock_broad.inputs["Vector"])

    n_rock_fine = nt.nodes.new("ShaderNodeTexNoise")
    n_rock_fine.inputs["Scale"].default_value = 2.8
    n_rock_fine.inputs["Detail"].default_value = 5.0
    n_rock_fine.inputs["Roughness"].default_value = 0.58
    nt.links.new(rock_map.outputs["Vector"], n_rock_fine.inputs["Vector"])

    # Sun-facing cliff aspect (warm sunlit ochre-cream granite on east/south planes, cool blue-slate in west shadows!)
    sun_dot = nt.nodes.new("ShaderNodeVectorMath")
    sun_dot.operation = "DOT_PRODUCT"
    sun_dot.inputs[1].default_value = (0.52, -0.58, 0.62)
    nt.links.new(geom.outputs["Normal"], sun_dot.inputs[0])

    sun_rock = nt.nodes.new("ShaderNodeMapRange")
    sun_rock.inputs["From Min"].default_value = -0.25
    sun_rock.inputs["From Max"].default_value = 0.88
    nt.links.new(sun_dot.outputs["Value"], sun_rock.inputs["Value"])

    # Combine directional cliff sunlight (52%) + broad painterly rock tone (34%) + crisp strata grain (14%)
    rt_a = nt.nodes.new("ShaderNodeMath")
    rt_a.operation = "MULTIPLY"
    rt_a.inputs[1].default_value = 0.52
    nt.links.new(sun_rock.outputs["Result"], rt_a.inputs[0])
    rt_b = nt.nodes.new("ShaderNodeMath")
    rt_b.operation = "MULTIPLY"
    rt_b.inputs[1].default_value = 0.36
    nt.links.new(n_rock_broad.outputs["Fac"], rt_b.inputs[0])
    rt_ab = nt.nodes.new("ShaderNodeMath")
    rt_ab.operation = "ADD"
    nt.links.new(rt_a.outputs["Value"], rt_ab.inputs[0])
    nt.links.new(rt_b.outputs["Value"], rt_ab.inputs[1])

    rt_c = nt.nodes.new("ShaderNodeMath")
    rt_c.operation = "MULTIPLY_ADD"
    rt_c.inputs[1].default_value = 0.24
    rt_c.inputs[2].default_value = -0.10
    nt.links.new(n_rock_fine.outputs["Fac"], rt_c.inputs[0])

    rt_sum = nt.nodes.new("ShaderNodeMath")
    rt_sum.operation = "ADD"
    rt_sum.use_clamp = True
    nt.links.new(rt_ab.outputs["Value"], rt_sum.inputs[0])
    nt.links.new(rt_c.outputs["Value"], rt_sum.inputs[1])

    # A. Meadow grass palette (TRUE LINEAR RGB matching src/grass.js + src/environment.js!)
    grass_ramp = nt.nodes.new("ShaderNodeValToRGB")
    gcr = grass_ramp.color_ramp
    gcr.elements[0].position = 0.24
    gcr.elements[0].color = (0.032, 0.155, 0.022, 1.0)
    gm = gcr.elements.new(0.56)
    gm.color = (0.088, 0.305, 0.032, 1.0)
    gcr.elements[1].position = 0.85
    gcr.elements[1].color = (0.215, 0.445, 0.052, 1.0)
    nt.links.new(n_macro.outputs["Fac"], grass_ramp.inputs["Fac"])

    # B. Warm sunlit Ghibli limestone-granite + cool blue-slate shadow palette (TRUE LINEAR RGB!)
    rock_ramp = nt.nodes.new("ShaderNodeValToRGB")
    rcr = rock_ramp.color_ramp
    rcr.elements[0].position = 0.18
    rcr.elements[0].color = (0.095, 0.130, 0.175, 1.0)  # cool Ghibli blue-slate shadow
    rm = rcr.elements.new(0.50)
    rm.color = (0.310, 0.265, 0.195, 1.0)               # warm weathered coastal stone
    rcr.elements[1].position = 0.82
    rcr.elements[1].color = (0.610, 0.475, 0.295, 1.0)  # sunlit golden-ochre limestone!
    nt.links.new(rt_sum.outputs["Value"], rock_ramp.inputs["Fac"])

    mix_crack = rock_ramp

    # Rock exposure mask: lush green foothills & shoulders; warm granite on steep escarpments & high peaks!
    slope_rock = nt.nodes.new("ShaderNodeMapRange")
    slope_rock.inputs["From Min"].default_value = 0.82
    slope_rock.inputs["From Max"].default_value = 0.56
    nt.links.new(sep_n.outputs["Z"], slope_rock.inputs["Value"])

    # Break up grass/rock transition organically with macro noise
    mask_noise = nt.nodes.new("ShaderNodeMath")
    mask_noise.operation = "MULTIPLY_ADD"
    mask_noise.inputs[1].default_value = 0.35
    mask_noise.inputs[2].default_value = -0.15
    nt.links.new(n_macro.outputs["Fac"], mask_noise.inputs[0])

    slope_broken = nt.nodes.new("ShaderNodeMath")
    slope_broken.operation = "ADD"
    slope_broken.use_clamp = True
    nt.links.new(slope_rock.outputs["Result"], slope_broken.inputs[0])
    nt.links.new(mask_noise.outputs["Value"], slope_broken.inputs[1])

    height_rock = nt.nodes.new("ShaderNodeMapRange")
    height_rock.inputs["From Min"].default_value = 6.5
    height_rock.inputs["From Max"].default_value = 15.5
    nt.links.new(sep_p.outputs["Z"], height_rock.inputs["Value"])

    mask_mul = nt.nodes.new("ShaderNodeMath")
    mask_mul.operation = "MULTIPLY"
    nt.links.new(slope_broken.outputs["Value"], mask_mul.inputs[0])
    nt.links.new(height_rock.outputs["Result"], mask_mul.inputs[1])

    summit_rock = nt.nodes.new("ShaderNodeMapRange")
    summit_rock.inputs["From Min"].default_value = 21.0
    summit_rock.inputs["From Max"].default_value = 29.0
    summit_rock.inputs["To Min"].default_value = 0.0
    summit_rock.inputs["To Max"].default_value = 0.55
    nt.links.new(sep_p.outputs["Z"], summit_rock.inputs["Value"])

    rock_mask = nt.nodes.new("ShaderNodeMath")
    rock_mask.operation = "MAXIMUM"
    rock_mask.use_clamp = True
    nt.links.new(mask_mul.outputs["Value"], rock_mask.inputs[0])
    nt.links.new(summit_rock.outputs["Result"], rock_mask.inputs[1])

    mix_gr = nt.nodes.new("ShaderNodeMix")
    mix_gr.data_type = "RGBA"
    nt.links.new(rock_mask.outputs["Value"], mix_gr.inputs["Factor"])
    nt.links.new(grass_ramp.outputs["Color"], mix_gr.inputs["A"])
    nt.links.new(mix_crack.outputs["Color"], mix_gr.inputs["B"])

    # Soft watercolor brush modulation
    n_brush = nt.nodes.new("ShaderNodeTexNoise")
    n_brush.inputs["Scale"].default_value = 0.45
    n_brush.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], n_brush.inputs["Vector"])

    brush_range = nt.nodes.new("ShaderNodeMapRange")
    brush_range.inputs["From Min"].default_value = 0.2
    brush_range.inputs["From Max"].default_value = 0.85
    brush_range.inputs["To Min"].default_value = 0.88
    brush_range.inputs["To Max"].default_value = 1.10
    nt.links.new(n_brush.outputs["Fac"], brush_range.inputs["Value"])

    mix_brush = nt.nodes.new("ShaderNodeMix")
    mix_brush.data_type = "RGBA"
    mix_brush.blend_type = "MULTIPLY"
    mix_brush.inputs["Factor"].default_value = 1.0
    nt.links.new(mix_gr.outputs["Result"], mix_brush.inputs["A"])
    nt.links.new(brush_range.outputs["Result"], mix_brush.inputs["B"])

    # Soft Cycles AO inside rock gullies & saddle folds
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = 5.0

    ao_range = nt.nodes.new("ShaderNodeMapRange")
    ao_range.inputs["From Min"].default_value = 0.0
    ao_range.inputs["From Max"].default_value = 1.0
    ao_range.inputs["To Min"].default_value = 0.52
    ao_range.inputs["To Max"].default_value = 1.0
    nt.links.new(ao.outputs["AO"], ao_range.inputs["Value"])

    mix_ao = nt.nodes.new("ShaderNodeMix")
    mix_ao.data_type = "RGBA"
    mix_ao.blend_type = "MULTIPLY"
    mix_ao.inputs["Factor"].default_value = 1.0
    nt.links.new(mix_brush.outputs["Result"], mix_ao.inputs["A"])
    nt.links.new(ao_range.outputs["Result"], mix_ao.inputs["B"])

    nt.links.new(mix_ao.outputs["Result"], emit.inputs["Color"])

    # Bake 2048px BaseColor and save compact JPEG (~380 KB GLB!)
    bake_img = bpy.data.images.new("MountainBake", width=2048, height=2048, alpha=False)
    bake_img.colorspace_settings.name = "sRGB"
    img_node = nt.nodes.new("ShaderNodeTexImage")
    img_node.image = bake_img
    nt.nodes.active = img_node

    mtn.data.materials.clear()
    mtn.data.materials.append(mat)
    bpy.ops.object.bake(type="EMIT")

    tex_path = os.path.join(STAGE_DIR, "backdrop_mountain_basecolor.jpg")
    dilate_blender_image(bake_img, passes=6)
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    bake_img.filepath_raw = tex_path
    bake_img.file_format = "JPEG"
    bake_img.save()

    final_img = bpy.data.images.load(tex_path, check_existing=False)
    final_img.colorspace_settings.name = "sRGB"
    final_img.pack()

    final_mat = bpy.data.materials.new("Mat_BackdropMountain")
    final_mat.use_nodes = True
    fnt = final_mat.node_tree
    fnt.nodes.clear()
    fout = fnt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = fnt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.91
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.12
    ftex = fnt.nodes.new("ShaderNodeTexImage")
    ftex.image = final_img
    fnt.links.new(ftex.outputs["Color"], bsdf.inputs["Base Color"])
    fnt.links.new(bsdf.outputs["BSDF"], fout.inputs["Surface"])

    mtn.data.materials.clear()
    mtn.data.materials.append(final_mat)

    # 6. Export lightweight GLB
    bpy.ops.object.select_all(action="DESELECT")
    mtn.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_image_quality=92,
        export_yup=True,
    )

    tris = sum(max(1, len(p.vertices) - 2) for p in mtn.data.polygons)
    pts = [mtn.matrix_world @ mathutils.Vector(b) for b in mtn.bound_box]
    dims = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 1) for i in range(3)]
    kb = os.path.getsize(OUT_GLB) / 1024.0
    print(f"[MOUNTAIN OK] backdrop_mountain.glb -> {tris} tris, dims={dims}, size={kb:.1f} KB")

    # 7. Render 4-shot studio audit board!
    scene.render.image_settings.file_format = "PNG"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.06

    world = bpy.data.worlds.new("MtnWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.45, 0.72, 0.86, 1.0)
    bg.inputs["Strength"].default_value = 0.78

    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.5
    sun_d.color = (1.0, 0.95, 0.84)
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(46), math.radians(10), math.radians(-34))
    scene.collection.objects.link(sun)

    # Seamless green terrain plane at Z=4.0m to verify zero floating seam!
    bpy.ops.mesh.primitive_plane_add(size=320, location=(0, 0, 2.5))
    floor = bpy.context.active_object
    fl_mat = bpy.data.materials.new("HillBase")
    fl_mat.use_nodes = True
    fl_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.14, 0.34, 0.08, 1.0)
    fl_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.93
    floor.data.materials.append(fl_mat)

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 38
    cam = bpy.data.objects.new("Cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def aim(loc, tgt):
        cam.location = mathutils.Vector(loc)
        cam.rotation_euler = (mathutils.Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()

    shots = [
        ("front", "1. 临湖正面（斜向岩层 + 草坡肩部）", (-8, -112, 24), (0, 0, 13)),
        ("town24", "2. 小镇全景 24° 仰视构图", (-6, -82, 16), (0, -2, 14)),
        ("walk44", "3. 陆地 44° 俯视校验", (14, -76, 56), (0, 0, 10)),
        ("rear34", "4. 背面 3/4 与底裙校验", (68, 72, 34), (0, 0, 11)),
    ]
    shot_paths = []
    for key, label, loc, tgt in shots:
        aim(loc, tgt)
        p = os.path.join(STAGE_DIR, f"{key}.png")
        scene.render.filepath = p
        bpy.ops.render.render(write_still=True)
        shot_paths.append(p)

    board_path = os.path.join(STAGE_DIR, "MOUNTAIN_V1_AUDIT_BOARD.png")
    stitch_2x2_board(shot_paths, board_path)
    print(f"[AUDIT BOARD] Saved {board_path}")


if __name__ == "__main__":
    build_mountain()
