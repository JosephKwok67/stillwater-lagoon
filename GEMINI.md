# 《钓鱼大冒险 · 静水泻湖》工作室永久协作规则 (Studio Pipeline Rule)

## 1. 美术风格、引擎与模型分工铁律
- **目标画风与引擎**：坚持 **Three.js + Vite 网页零门槛试玩**（不迁 UE），整体视觉往 **《动物森友会》× 吉卜力治愈手绘微缩海岛风** 打磨（柔和暖光、低反光磨砂水粉质感、圆润有机造型）。
- **思路框架、结构策划、解剖/建筑比例规范与严苛终审**：必须调用 Codex **`gpt-6.2-astra` (`reasoning_effort = "ultra"`)** 完成，并沉淀文档至 `art_pipeline/brief/`。
- **概念构图、三视图与细节分镜图生成（`imagegen` / Image 2.5）**：必须调用 Codex **`gpt-6.2-sol` (`reasoning_effort = "medium"`)** 完成，所有图像输出严格限定在 `art_pipeline/concepts/` 目录内。
- **高细节有机资产 3D 初模（Tripo 免费版图生 3D 协同）**：针对角色雕刻、小狗/生物、鱼类、花树植被、木船与精细摆件，优先将 `6.2-Sol` 裁切好的独立多视图（`art_pipeline/tripo_kit/ready_to_upload/`）交由用户上传至 Tripo Web 生成高精 `.glb` 并放入 `art_pipeline/tripo_inbox/`；可无缝推门进入的房屋壳体与碰撞骨架仍由 Blender 代码精准构建。
- **3D 清洗减面、去除塑料反光、骨骼绑定、水粉烘焙、GLB 导出、场景合图与游戏源码 (`src/`, `public/`)**：由 **Antigravity + Blender 5.3** 负责执行（含 `ingest_tripo_glb.py` 自动管线）与多视角零穿模验收；Codex 不直接操作 Blender 或修改游戏源码。

## 2. 明确分镜镜头先行铁律（Mandatory Shot Breakdown）
- **任何角色、道具或场景在进入 3D 建模前，都必须先有明确的分镜镜头构图，把细节拆透**：
  - **角色建模**必须包含：① 全身多角度正交视图（正面 / 3/4 英雄角 / 侧面 / 背面）；② **全身各部位细节特写分镜图**（头部面部+发型+帽饰、躯干衣领+背带/纽扣+衣褶、四肢袖口+手部+靴底、典型动态动作剪影）。
  - **场景/建筑建模**必须先有四分镜/多视角构图 → Blender 纯白模定比例与动线 → 评审通过后再烘焙上色渲染。
- **拼装整合零失误校验**：在 Blender 拼装所有部件并绑定 `Rig_*` 关节后，必须输出多角度 + 部位特写 + 动作姿态巡检图，确认**无僵硬拼插球缝、无穿模、无漂浮部件、比例自然流畅**后，再与场景联合渲染并导出游戏资产。

## 3. 本地与 GitHub 双同步发布铁律
- 本项目远程仓库：`https://github.com/JosephKwok67/stillwater-lagoon.git`（分支 `master`，通过 `.github/workflows/deploy-pages.yml` 自动部署至 GitHub Pages：`https://josephkwok67.github.io/stillwater-lagoon/`）。
- **每完成一轮验证通过的更新（代码、模型、场景或美术资产）**：
  1. 必须保持相对资源路径（`base: './'` 与 `./assets/...`），确保 `npm run build` 与本地浏览器实测零报错；
  2. 除本地生效外，必须同步 `git add` → `git commit` → `git push origin master` 推送到 GitHub，保持朋友可访问的在线试玩版同步最新。

## 4. 磁盘路径规范
- 所有项目源码、工具脚本、渲染产出与模型备份均保存在 `I:\antigravity cli\` 下，禁止向 `C:` 盘写入项目或大型缓存文件。
