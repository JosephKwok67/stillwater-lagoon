# 「钓鱼大冒险 / 静水」开发与更新日志（CHANGELOG）

> 每次完成功能里程碑、核心美术资产接入或重大代码重构后，请同步更新本日志并执行 `npm run backup`（或在 Git 中打版本 Tag）。

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
