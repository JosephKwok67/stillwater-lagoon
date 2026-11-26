# 「钓鱼大冒险 / 静水」开发与更新日志（CHANGELOG）

> 每次完成功能里程碑、核心美术资产接入或重大代码重构后，请同步更新本日志并执行 `npm run backup`（或在 Git 中打版本 Tag）。

---

## [v0.7.1 · 场景概念] - 2026-11-26（泻湖渔村的一天）

- 新增[渔村四格分镜](../art_pipeline/concepts/storyboards/stillwater_fishing_village_storyboard.png)。山坡远景和船头视角交代渔市、小屋与码头的位置，鱼摊和栈桥近景供居民互动与垂钓镜头参考。

## [v0.7.1 · Blender 首版] - 2026-11-26（角色与无缝室内静态模型）
- **house_artisan**　已保存 `art_pipeline/blender/house_artisan.blend` 和 BaseColor 贴图，导出 `public/assets/models/environment/house_artisan.glb`。7,116 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **house_player**　已保存 `art_pipeline/blender/house_player.blend` 和 BaseColor 贴图，导出 `public/assets/models/environment/house_player.glb`。6,663 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **house_neighbor_east**　已保存 `art_pipeline/blender/house_neighbor_east.blend` 和 BaseColor 贴图，导出 `public/assets/models/environment/house_neighbor_east.glb`。7,354 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **dog**　已保存 `art_pipeline/blender/dog.blend` 和 BaseColor 贴图，导出 `public/assets/models/characters/dog.glb`。2,707 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **player**　已保存 `art_pipeline/blender/player.blend` 和 BaseColor 贴图，导出 `public/assets/models/characters/player.glb`。4,328 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **npc_lighthouse**　已保存 `art_pipeline/blender/npc_lighthouse.blend` 和 BaseColor 贴图，导出 `public/assets/models/characters/npc_lighthouse.glb`。4,088 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **npc_artisan**　已保存 `art_pipeline/blender/npc_artisan.blend` 和 BaseColor 贴图，导出 `public/assets/models/characters/npc_artisan.glb`。4,348 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。
- **npc_market**　已保存 `art_pipeline/blender/npc_market.blend` 和 BaseColor 贴图，导出 `public/assets/models/characters/npc_market.glb`。3,955 tris，单张内嵌图集，通过 GLB 尺寸、材质和节点检查，对应 manifest 开关已启用。

- **交付状态**　静态模型先验收外观，骨骼与动画待补。BaseColor 为均匀色域的 1024 × 1024 手绘感颜料图集，实时光照负责明暗。
- **评审来源**　桌面 Blender 经本地 MCP 制作，逐件调用 `look` 检查多角度；评审图与文件指标在 `art_pipeline/staging/blender_preview/`。
- **性能与构建**　五个角色各合并为一个网格。房屋按功能节点与材质合并为 5～6 个网格。八个 GLB 的纹理均已内嵌，独立目录 Vite 生产构建通过，构建副本与源文件 SHA-256 全部一致。
- **锚点兼容**　家用鱼缸的 `Anchor_Aquarium` 使用父偏移节点，世界位置落在缸体中央，局部位置保留现有加载器所需的旧鱼缸根节点位置，以兼容其同时读取世界位置和局部位置的行为。
- **外观评审**　[五位角色](../art_pipeline/staging/blender_preview/角色评审.jpg)与[三栋房屋室内](../art_pipeline/staging/blender_preview/室内评审.jpg)为首版静态模型。贴图采用程序生成的颜料色块与织物纹理。骨骼动作、游戏内实机外观与进出屋操作待后续验收。

## [v0.7.1] - 2026-11-26（Blender `.glb` 零代码自动热替换加载器与 Codex 3D 精模任务书）
- **Git 里程碑记号**：`v0.7.1-glb-hotswap`
- **Blender `.glb` 热替换管线（`src/core/glbLoader.js`、`public/assets/models/manifest.json`）**：
  - 接入 Three.js `GLTFLoader` + `AnimationMixer` 零 404 自动加载机制：Codex 导出角色/小狗/可推门室内房屋 `.glb` 后，只需把 `public/assets/models/manifest.json` 对应键改为 `true`，游戏刷新瞬间即自动替换程序白模，零改 `src/` 代码。
  - **角色自动适配（`player.js`、`npcs.js`、`wildlife.js`）**：自动归一化身高与脚底贴地，绑定标准骨骼动画 Clip 名称，并兼容静态精模的柔和呼吸与移动动态。
  - **房屋无缝室内自动绑定（`town.js`）**：自动解析 Blender 导出的 `Roof_Cutaway`（进屋屋顶与南前墙渐隐）、`Door_Hinge`（按 `E` 旋转开关门）与 `Anchor_Aquarium` / `Anchor_Bed` / `Anchor_Workbench` 空锚点，同时保留室内 3D 活鱼缸游动与局部 OBB 墙体碰撞。
  - 同步支持 `fishIconsDelivered` 动态登记：Codex 补齐剩余 17 张水彩鱼卡后只需加入该数组即自动替换程序彩绘回退图。
- **Codex Blender 专属任务书**：创建 [CODEX_BLENDER_3D_BRIEF.md](../art_pipeline/brief/CODEX_BLENDER_3D_BRIEF.md)，涵盖 5 位角色精模 + 3 栋无缝室内房屋的精确尺寸、分层节点与导出交付规范。

---

## [v0.7.0] - 2026-11-26（场景穿模全面修复、25 种鱼全图鉴补全、上床睡觉动作、3 位小镇 NPC 与渔村商店）
- **Git 里程碑记号**：`v0.7.0-npcs-shops-polish`
- **灵感档案更新**：[USER_IDEAS.md](./USER_IDEAS.md) 新增「第四节：完整畜牧业系统（鸡/牛/羊/猪养殖 + 渔农牧厨四维联动）」。
- **3 大实机体验问题彻底修复**：
  1. **全 25 种鱼显示鱼图（`src/core/assetRegistry.js`）**：Codex 已画好的首批 8 种鱼直读水彩 PNG；其余 17 种待 Codex 第 3 批完成前，自动按 `fishCatalog.js` 真实体型与斑纹配色动态绘制头朝左的彩绘鱼侧面图，鱼种图鉴、结算卡、鱼护、鱼缸与商店全员零白圆点。
  2. **场景穿模重点重构（`src/town.js`、`src/terrain.js`、`src/wildlife.js`）**：
     - 重建玩家红顶小屋前院石台为带深石地基的稳固平台并纳入 `walkableDecks`，与木栈桥斜坡严丝合缝衔接，彻底消除石台悬空切穿人物与小狗问题；
     - 重排全部可进出房屋的前廊立柱与栏杆位置，门扇 92° 平开零穿柱，并补齐门扇、前廊栏杆以及 3 栋可进出房屋内全部家具（鱼缸、木床、床头柜、工作台、鱼竿架、圆桌、书架）的局部 OBB 碰撞；
     - 升级伴游小狗陆地寻路：碰撞半径调至 `0.36`，跨门时自动瞄准敞开的门洞中心穿过，关门时在门廊乖乖等候，零穿墙穿门。
  3. **真实上床躺下睡觉交互动画（`src/player.js`、`src/main.js`）**：靠近小屋木床按 `E`，主角会跃上床、平躺枕在白枕头上（`Sleep_Bed` 呼吸姿态）并飘出 `Z z z ...` 气泡，伴随柔和暮色渐隐过渡自然切换时段/推进次日后欢快起身下床。
- **3 位小镇 NPC 落地 + 立绘字幕「嗯唔」拟声对话 + 商店经济系统（`src/npcs.js`、`src/core/dialogueSystem.js`、`src/core/voiceBlip.js`、`src/core/gameState.js`）**：
  - 落地 3 位按 Codex 三视图定制造型的 3D 居民：**渔市老板娘 · 阿莲**（渔市红白摊位旁）、**渔具工匠 · 老周**（老周渔具工坊室内，推门进屋找他）、**灯塔守望者 · 海伯**（东海角红白灯塔旁手持暖光提灯），靠近会微笑挥手、对话时面向玩家点头。
  - 新增绘本立绘逐字打字机对话框 + Web Audio API 纯合成《动森》风轻柔「嗯/唔/嘟」角色专属拟声（右上角可一键切换 `拟声: 开/关`）。
  - 接入完整商店交易：**阿莲渔市收购摊**（每日刷新 2 种 1.5 倍溢价高价鱼，支持单条出售/一键全部卖出入账贝币）、**老周渔具工坊商店**（购买并自动装备 4 把鱼竿与 4 种 5 份装特制鱼饵，底部栏实时显示余量）、**海伯灯塔观潮切换天气与巨物传说**。
- **端到端真机全通验收**：实测全部 25 种鱼缩略图无圆点、码头→庭院→屋门零穿模、上床躺下 Zzz 睡至日落、与阿莲/海伯/老周全部对话、老周商店买面团香饵（贝币 `120 → 90`、余量 `15 → 20`），全程零控制台错误、零网络报错。

---

## [v0.6.5] - 2026-11-26（完整钓鱼系统、真鱼游来咬钩遛鱼、随身鱼护与室内鱼缸放鱼闭环）
- **Git 里程碑记号**：`v0.6.5-fishing-aquarium`
- **新增项目构想备忘录**：创建 [USER_IDEAS.md](./USER_IDEAS.md)，独立记录长期构想（前期保持小屋尺寸、后期金钱交易买大房子、大房子配厨房与做饭系统、向阳菜地种田联动等）。
- **完整 6 阶段钓鱼系统与动作包（`src/core/fishingSystem.js`、`src/player.js`、`src/wildlife.js`）**：
  - 支持在**红边木船上**与**岸边木栈桥上**通用操作：按住 `Space`/`F` 蓄力瞄准（水面实时显示落点光环 + `Fish_Aim` 拉弓蓄力姿态）→ 松手挥竿抛投红白浮标与垂弧鱼线 → **水下真实的 3D 活鱼按鱼饵偏好被吸引游到浮标下方**试探轻啄并拉沉浮标咬钩！
  - 咬钩后弹出浮标上方 **`! 咬钩了！`** 提示，按 `Space` 或点击提竿进入**张力遛鱼博弈**：鱼儿在「游累了（按住收线）」与「猛烈挣扎（松手卸力）」间交替拉扯，3D 活鱼在水面左右窜动翻起水花、钓竿随张力弯弧抖动。
  - 上鱼进度满 `100%` 触发 **3D 活鱼跃出水面飞向主角** 与 `Fish_Catch` 举竿欢呼动画，弹出绘本风**「渔获结算卡」**（展示水彩鱼卡、体长 `cm`、普通/大物/王冠等级、新图鉴/破纪录标、渔市估价与小狗欢呼立绘），支持一键**收入随身鱼护**或**温柔放生换回响灵气**。
- **随身鱼护 & 家里 3D 大鱼缸饲养联动（`src/main.js`、`index.html`、`src/style.css`）**：
  - 点击左上角鱼护按钮（或按 `B`）随时查看捕获的活鱼；回自家红顶小屋推门进入室内鱼缸按 `E`，打开无遮挡 3D 鱼缸特写与管理面板，支持一键将鱼护里的活鱼 **`放入鱼缸`**（实时按真实体长生成 3D 活鱼在缸里游动并持久化存档）或 **`捞回鱼护`**。
- **端到端真机验收**：浏览器实测完整闭环（蓄力抛竿 → 真鱼咬钩 → 遛鱼起鱼「静水锦鲤 30cm」→ 收入鱼护 → 停船进屋 → 放入家里 3D 大鱼缸实时游动 `3/10 -> 4/10`），零控制台错误、零网络报错。

---

## [v0.6.0] - 2026-11-26（底层系统、无缝开关门进出房屋、核心动作包与 Codex 美术接入）
- **Git 里程碑记号**：`v0.6.0-foundation-walkin`
- **轻量化 5 大底层底座（`src/core/`）**：
  - `eventBus.js`（事件总线）、`gameState.js`（统一状态中心与 `localStorage` 自动存档，内置通用物品结构、家用鱼缸活鱼列表、25 种鱼图鉴纪录与 12 块未来种田菜地数据）、`assetRegistry.js`（自动管理 Codex 产出的 2D 立绘/图标及未来 `.glb` 模型热替换路径）、`interactionSystem.js`（世界空间投影浮动 `[E]` 交互提示系统）、`playerController.js`（陆地行走/小跑、上下船抛物线跳跃过渡与甩竿浮标动作控制器）。
- **无缝推门进出房屋 & 场景完善（`src/town.js`、`src/terrain.js`）**：
  - 实现 **3 栋可真实开关门直接走入的房屋**（非传送黑屏）：**我的临水小屋**（含室内发光 3D 活鱼缸、可小憩切换时段的红被木床、地毯台灯）、**老周渔具工坊**（含工作台与 4 支鱼竿陈列架）、**东岸木屋**。推开铰链木门走入室内后，屋顶与南侧前墙上半部自动平滑渐隐露出全室内，并已将 Blender 房屋节点规范同步写入 `docs/ART_ASSET_MANIFEST.md`。
  - 扩建 **3 座可步行上下船的木栈桥码头**（自家小屋码头、渔市集码头、东海角灯塔栈桥），完善陆地行走高度贴合与局部 OBB 墙体/门洞碰撞；并在自家小屋旁预留 **12 格向阳菜地空地（未来种田系统预留区）**。
- **主角动作包、陆海双栖小狗与鱼群个体体型（`src/player.js`、`src/boat.js`、`src/wildlife.js`）**：
  - 独立出标准化 `PlayerAvatar`（`+Y` 朝上、`+Z` 朝前、原点在脚底，对齐 Blender `.glb` 骨骼接口），支持 `Idle` / `Walk` / `Run` / `Sit_Row` / `Board_Boat` / `Fish_Cast` / `Fish_Idle` / `Fish_Reel` / `Interact` 全套动作，并支持在船上或码头按 `Space` / `F` 甩竿落水起涟漪、侦测附近真鱼与收竿。
  - 伴游小狗加上标志性**珊瑚红三角领巾**，升级为陆海双栖跟宠（划船时下水伴游，上岸时跳上码头一路跟跑进小镇与进屋）。
  - 水下 25 种鱼全面扩展个体大小分布（普通 / 大物 / 稀有王冠体型与真实厘米数）。
- **Codex 第 1 & 2 批美术全面接入 HUD（`index.html`、`src/style.css`、`src/main.js`）**：
  - 左上角接入主角立绘头像与贝币/放生回响/鱼护手绘图标；底部接入 4 把手绘鱼竿、4 种鱼饵切换栏与红白浮标甩竿按钮；鱼种图鉴与家里生态鱼缸观赏面板自动显示 Codex 绘制的水彩鱼卡。

---

## [v0.5.0 · 美术批次 02] - 2026-11-26（两位小镇居民、核心 UI 与八张鱼卡）

- **画风基准**　第一批 19 项美术资产已获项目方全部通过。后续角色以阿莲的三视图和对话立绘校对比例、笔触与轮廓，物件与图鉴以第一批渔具图标校对透明边缘和 64 px 表现。
- **居民 · 8 张**　`art_pipeline/concepts/npcs/` 下新增 `npc_artisan_turnaround.png` 与 `npc_lighthouse_turnaround.png`，均为纯白底正、侧、背三视图。`public/assets/portraits/npc_artisan/` 新增 `neutral.png`、`happy.png`、`thinking.png`，`public/assets/portraits/npc_lighthouse/` 新增 `neutral.png`、`happy.png`、`mysterious.png`。六张立绘均为 1024 × 1024 透明 PNG。
- **核心 UI · 4 枚**　`public/assets/icons/ui/` 的 `coin.png` 为贝壳纹村币，`echo_leaf.png` 为嫩叶与两道水纹，`basket.png` 为带盖竹编鱼护，`bobber.png` 为红白浮标。每枚均为 512 × 512 透明 PNG。[居民与界面评审板](../art_pipeline/staging/batch02/review/居民与界面评审.jpg)
- **水彩图鉴 · 8 张**　`public/assets/icons/fish/` 新增 `stillwater_koi.png`、`yellowfin_tuna.png`、`red_sea_bream.png`、`seabass.png`、`blue_diamond_discus.png`、`cutlassfish.png`、`bigfin_reef_squid.png`、`red_bee_shrimp.png`。全部采用 512 × 512 透明方图，完整侧面、头朝左，按 `src/fishCatalog.js` 中的 ID 引用。[八种鱼类拼图与 64 px 小样](../art_pipeline/staging/batch02/review/鱼类图鉴评审.jpg)
- **交付验证**　已核对三视图纯白画布与头脚对齐、18 张运行时 PNG 的尺寸和透明通道、8 张鱼卡的朝向和留白。Vite 生产构建通过，18 张输出文件与源图的 SHA-256 全部一致。[本批生成提示词](../art_pipeline/staging/batch02/prompts/)
- **下批衔接**　八张鱼卡待项目方评审。通过后继续余下 17 个物种和 Blender 角色建模。角色 BaseColor 烘焙采用均匀水粉手绘色与轻度 AO，方向性明暗交给 Three.js 实时太阳光。

---

## [v0.5.0 · 美术批次 01] - 2026-11-26（泻湖居民与渔具首轮评审）

- **角色设定**　[五位核心角色美术设定简案](../art_pipeline/brief/五位核心角色美术设定简案.md)记录了草帽垂钓者、伴游小狗、阿莲、老周与海伯的服装、道具和表演方向。
- **三视图 · 3 张**　`art_pipeline/concepts/characters/` 收录 `player_turnaround.png` 与 `dog_turnaround.png`，`art_pipeline/concepts/npcs/` 收录 `npc_market_turnaround.png`。三面从左到右依次为正面、侧面、背面。小狗采用四足对称站姿。
- **对话立绘 · 8 张**　`public/assets/portraits/` 下的 `player/` 和 `npc_market/` 各含 `neutral.png`、`happy.png`、`surprised.png`，`dog/` 含 `happy.png`、`excited.png`。全部为 1024 × 1024 透明 PNG，程序可复用同一个正方形显示框切换表情。
- **渔具图标 · 8 枚**　`public/assets/icons/rods/` 收录 `rod_bamboo`、`rod_maple`、`rod_ocean`、`rod_starlight`；`public/assets/icons/baits/` 收录 `bait_dough`、`bait_shrimp`、`bait_lure`、`bait_glow`。每项均以对应 ID 加 `.png` 命名，尺寸为 512 × 512。
- **使用与验证**　Vite 静态地址从 `/assets/` 起算，例如 `/assets/portraits/dog/excited.png` 和 `/assets/icons/rods/rod_bamboo.png`。已核对透明通道、四角透明度、三视图白底，以及图标在 64 像素下的辨识度。独立目录生产构建通过，16 张运行时 PNG 与构建副本的 SHA-256 逐一相符。对话和背包界面的实际接入由程序端维护。
- **画风评审**　[角色与表情](../art_pipeline/staging/batch01/review/角色评审.jpg)和[渔具与背包小样](../art_pipeline/staging/batch01/review/渔具评审.jpg)待项目方确认。老周、海伯、25 种鱼卡及 Blender 模型待本批评审后制作。记录的生成工具为内置 imagegen，界面未显示具体模型版本。[本批生成提示词](../art_pipeline/staging/batch01/prompts/)

---

## [v0.5.0] - 2026-11-26（当前里程碑：场景与生态封版 + 美术协作工程化）
- **Git 里程碑记号**：`v0.5.0-scene-milestone`
- **水波流体物理重构**（`src/water.js`、`src/boat.js`）：
  - 移除机械同心圆弧和尾迹端帽闭合伪影，升级为**连续有向距离场并集（SDF Union）开尔文 V 字尾浪** + 切线尾端开口遮罩，实现真实液体折射波峰、迎光波谷光影与沿流拉伸细泡。
  - 修复划桨水波延迟，按下移动键瞬间触发入水漩涡与持续拉桨水花，并加入自然划桨脉冲推进手感。
- **全海域生态扩展与互动机制**（`src/fishCatalog.js`、`src/wildlife.js`、`src/environment.js`）：
  - 25 种水生生物（近 300 只）与礁石/珊瑚/海星/睡莲铺满半径 42 的全部外围水域、东西外海岛屿与灯塔礁石区。
  - 修复船过荷叶/睡莲回弹瞬移 bug，改为帧率无关的水阻尼弹性物理避让（同时响应船身胶囊与伴游小狗）。
  - 新增**划到鱼头上惊鱼逃窜机制**：动态惊吓半径（静漂可靠近、猛划提早惊散）、群游鱼连锁惊散、爆发加速下潜、浅水惊慌水花、鱿鱼喷水倒退逃窜。
- **工程化目录、备份与美术交接框架**：
  - 独立项目目录 `I:\antigravity cli\钓鱼大冒险`，划分 `public/assets/`（游戏运行时资产）、`art_pipeline/`（Codex 美术概念与 Blender 源文件）、`docs/`、`backups/`、`scripts/`。
  - 新增自动化源码快照备份脚本 `scripts/backup.ps1`、资产总清单 `docs/ART_ASSET_MANIFEST.md` 与 Codex 美术策划总提示词 `art_pipeline/brief/CODEX_ART_DIRECTOR_PROMPT.md`。

---

## [v0.4.0] - 2026-11-25（25 种多体型自主游动生态鱼类与图鉴跟踪）
- 参考 Nachat's Aquarium 图鉴，新增 `src/fishCatalog.js`，程序化构建 **8 套差异化 3D 鱼身轮廓**（流线远洋鱼、高身鲷鱼、圆盘七彩神仙、长带鱼、底栖扁平鱼、群游小鱼、裙鳍鱿鱼/乌贼、红白水晶虾）+ 独立 Canvas 斑纹贴图。
- 实现 **25 个鱼种**从迷你（`0.45x`）到巨型黄鳍金枪鱼（`2.45x`）的跨体型差异与各自游动 AI（Boids 群游、巡游、悬停突进、贴底停顿窜动、带鱼斜浮波浪、鱿鱼往返滑行）。
- 右上角新增可折叠**「鱼种图鉴」**面板，支持点击任意鱼种平滑拉近镜头实时跟踪观赏。

---

## [v0.3.0] - 2026-11-25（扩大地图、岸边小镇与太阳天气基础）
- 新增 `src/terrain.js` 将地图拓展至 `164×164`，构建北部弯月形海湾、沙滩浅滩、梯田草坡与外围小岛。
- 新增 `src/town.js`：搭建**玩家自家临水红顶小屋**（老虎窗、前廊、院台、栅栏、飘散炊烟、伸入湖面的木质栈桥码头与暖光灯）、7 座彩绘风小镇木屋、红白条纹渔获摊位、石板滨水小路、东侧海角红白灯塔与圆冠树林。
- 新增 `src/atmosphere.js`：构建程序化天空穹顶、可见太阳光球与柔云、动态太阳方向光影与水面阳光波光反射带，预置 **晴朗午后 / 清晨微光 / 黄金日落 / 薄雾微阴** 四套天气时段，并联动日落自动点亮小屋窗灯与码头灯。

---

## [v0.2.0] - 2026-11-25（水体色彩空间修复与初版画风精修）
- 修复 `ShaderMaterial` 水面缺少 `#include <tonemapping_fragment>` / `#include <colorspace_fragment>` 导致的线性空间水下偏暗问题，还原通透明亮的青绿—深孔雀蓝彩绘泻湖质感。
- 修复 `PlaneGeometry` 顶点负零导致的 `Math.pow` `NaN` 边界球报错；优化镜头微缩俯视构图、手绘碎波光、水底有机焦散与睡莲密度。

---

## [v0.1.0] - 2026-11-25（彩绘泻湖场景初版立项）
- 搭建 Vite + Three.js 工程，完成双通道真实水深折射水面（`WebGLRenderTarget` + `DepthTexture`）、程序化手绘笔触贴图、水底焦散、青苔礁石、珊瑚水草、红边木船、草帽垂钓者、双桨动画与伴游小狗原型。

---

## 后续版本记录模板（复制追加到顶部）
```markdown
## [v0.x.x] - YYYY-MM-DD（简短标题）
- **Git 记号**：`v0.x.x-...`
- **新增 / 优化**：
- **美术资产接入**：
- **修复问题**：
```
