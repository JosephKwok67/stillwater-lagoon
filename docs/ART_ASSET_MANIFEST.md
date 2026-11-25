# 「钓鱼大冒险」美术资产清单与命名验收表（ART ASSET MANIFEST）

> **说明**：本清单用于 **Codex（美术策划 / image 2.5 / Blender）** 与 **程序端（Three.js）** 严格对齐文件名、路径、尺寸和状态。
> 前端可按表中路径引用文件。`[x]` 表示对应文件已交付并通过技术检查。项目方已于 2026-11-26 确认第一批美术全部通过，以[居民三视图与立绘](../art_pipeline/staging/batch01/review/角色评审.jpg)和[渔具原图与 64 px 小样](../art_pipeline/staging/batch01/review/渔具评审.jpg)作为全项目画风、配色、水粉笔触、透明边缘及缩略辨识度的基准。

---

## 一、核心角色与 NPC（共 5 位）

| ID | 角色名称 | 游戏定位 | 概念三视图路径 (`art_pipeline/concepts/...`) | 2D 对话立绘目录 (`public/assets/portraits/...`) | 3D 模型路径 (`public/assets/models/characters/...`) | 状态 |
|---|---|---|---|---|---|---|
| `player` | 草帽垂钓者（主角） | 划船/走路/钓鱼主角 | `characters/player_turnaround.png` | `player/neutral.png`, `happy.png`, `surprised.png` | `player.glb` | 三视图 `[x]` · 立绘 `[x]` · GLB `[ ]` |
| `dog` | 伴游小狗（渔夫伙伴） | 伴游/上岸跟宠/起鱼欢呼 | `characters/dog_turnaround.png` | `dog/happy.png`, `excited.png` | `dog.glb` | 三视图 `[x]` · 立绘 `[x]` · GLB `[ ]` |
| `npc_market` | 渔市老板娘（阿莲） | 红白条纹摊位：收鱼/鱼讯/悬赏 | `npcs/npc_market_turnaround.png` | `npc_market/neutral.png`, `happy.png`, `surprised.png` | `npc_market.glb` | 三视图 `[x]` · 立绘 `[x]` · GLB `[ ]` |
| `npc_artisan` | 渔具工匠（老周） | 小镇木屋工坊：卖竿/买饵/炼竿 | `npcs/npc_artisan_turnaround.png` | `npc_artisan/neutral.png`, `happy.png`, `thinking.png` | `npc_artisan.glb` | 三视图 `[x]` · 立绘 `[x]` · GLB `[ ]` |
| `npc_lighthouse` | 灯塔守望者（海伯） | 东侧红白灯塔：天气潮汐/巨物传说 | `npcs/npc_lighthouse_turnaround.png` | `npc_lighthouse/neutral.png`, `happy.png`, `mysterious.png` | `npc_lighthouse.glb` | 三视图 `[x]` · 立绘 `[x]` · GLB `[ ]` |

### 3D 角色标准规格（Blender 导出 `.glb` 必守规范）
- **坐标系与朝向**：`+Y` 向上，人物正面朝 `+Z`（或 `-Z` 并在日志注明），原点 `(0, 0, 0)` 位于**双脚脚底中心**。
- **比例尺寸**（严格匹配当前 2.58m 长的木船与小镇房屋）：
  - 主角 / 成年 NPC 身高：**`1.15m ~ 1.35m`**（3～3.5 头身绘本微缩比例）
  - 伴游小狗身长：**`0.65m`**，肩高 **`0.38m`**
- **面数预算**：角色 **`1,500 ~ 4,500` 三角面**；道具 **`500 ~ 2,000` 三角面**。
- **材质规范**：手绘哑光水粉质感（`Roughness = 0.72 ~ 0.90`，`Metalness = 0.0 ~ 0.05`），单张 `1024×1024` BaseColor 贴图（PNG/WebP），避免写实镜面油光。
- **角色 BaseColor 烘焙**：保留均匀的水粉手绘色与褶缝处轻度 AO，去除固定方向的强高光和投影。Three.js 的实时太阳光负责角色的方向性明暗。
- **标准动画 Clip 命名**（打包在 `.glb` 中，供 Three.js `AnimationMixer` 调用）：
  - 主角：`Idle`、`Walk`、`Sit_Row`、`Fish_Cast`、`Fish_Idle`、`Fish_Bite`、`Fish_Catch`
  - NPC：`Idle`、`Walk`、`Wave`、`Talk`
  - 小狗：`Idle`、`Swim`、`Run`、`Happy`

---

## 二、25 种水域生物手绘水彩图鉴卡（`public/assets/icons/fish/<id>.png`）

> 鱼卡统一为 `512×512` 透明 PNG，一张一个物种，完整侧面、头朝画面左侧，鳍、触腕和尾端均留出安全边距。配色和体型取自 `src/fishCatalog.js`。鱿鱼以眼和腕部辨别头端，虾以眼和额剑辨别头端。

| 分类 | 精确文件名 (`public/assets/icons/fish/`) | 中文名 | 体型 | 状态 |
|---|---|---|---|---|
| 大型远洋鱼 | `yellowfin_tuna.png` | 黄鳍金枪鱼 | 巨型 | `[x]` |
| 大型远洋鱼 | `seabass.png` | 海鲈鱼 | 大型 | `[x]` |
| 大型远洋鱼 | `yellowtail.png` | 鰤鱼 | 大型 | `[ ]` |
| 大型远洋鱼 | `kingfish.png` | 黄尾鰤 | 大型 | `[ ]` |
| 大型远洋鱼 | `spanish_mackerel.png` | 马鲛鱼 | 大型 | `[ ]` |
| 礁石鱼类 | `red_sea_bream.png` | 真鲷 | 大型 | `[x]` |
| 礁石鱼类 | `black_sea_bream.png` | 黑鲷 | 中大型 | `[ ]` |
| 礁石鱼类 | `rockfish.png` | 眼张鱼 | 中型 | `[ ]` |
| 礁石鱼类 | `chicken_grunt.png` | 伊佐木 | 中型 | `[ ]` |
| 礁石鱼类 | `star_snapper.png` | 星笛鲷 | 中大型 | `[ ]` |
| 群游鱼类 | `mackerel.png` | 青花鲭鱼 | 中型 | `[ ]` |
| 群游鱼类 | `horse_mackerel.png` | 竹荚鱼 | 小型 | `[ ]` |
| 群游鱼类 | `anchovy.png` | 银鳀鱼群 | 迷你 | `[ ]` |
| 奇特鱼类 | `cutlassfish.png` | 银带鱼 | 细长大型 | `[x]` |
| 奇特鱼类 | `barracuda.png` | 尖嘴梭鱼 | 中大型 | `[ ]` |
| 底栖生物 | `scorpionfish.png` | 石狗公 | 中型 | `[ ]` |
| 底栖生物 | `flathead.png` | 沙鲬 | 中大型 | `[ ]` |
| 彩绘淡水鱼 | `stillwater_koi.png` | 静水锦鲤 | 中型 | `[x]` |
| 彩绘淡水鱼 | `cardinal_tetra.png` | 宝莲灯鱼 | 迷你 | `[ ]` |
| 彩绘淡水鱼 | `blue_diamond_discus.png` | 蓝钻七彩神仙 | 中型 | `[x]` |
| 彩绘淡水鱼 | `red_turquoise_discus.png` | 红松石七彩神仙 | 中型 | `[ ]` |
| 彩绘淡水鱼 | `pale_chub.png` | 宽鳍鱲（婚姻色） | 小型 | `[ ]` |
| 头足与虾类 | `bigfin_reef_squid.png` | 软丝鱿鱼 | 中大型 | `[x]` |
| 头足与虾类 | `golden_cuttlefish.png` | 金乌贼 | 中型 | `[ ]` |
| 头足与虾类 | `red_bee_shrimp.png` | 水晶红白虾 | 迷你 | `[x]` |

---

## 三、渔具与核心 UI 图标（`public/assets/icons/`）

| 目录 | 精确文件名 | 名称 | 用途 | 状态 |
|---|---|---|---|---|
| `icons/rods/` | `rod_bamboo.png` | 初始竹竿 | 起始装备 | `[x]` |
| `icons/rods/` | `rod_maple.png` | 枫木溪流竿 | 淡水/礁石进阶 | `[x]` |
| `icons/rods/` | `rod_ocean.png` | 远洋海钓竿 | 挑战金枪鱼/鰤鱼 | `[x]` |
| `icons/rods/` | `rod_starlight.png` | 静水秘制竿 | 稀有鱼/放生回响加成 | `[x]` |
| `icons/baits/` | `bait_dough.png` | 面团香饵 | 吸引淡水/锦鲤/小鱼 | `[x]` |
| `icons/baits/` | `bait_shrimp.png` | 鲜甜虾仁 | 吸引礁石鱼/底栖鱼/乌贼 | `[x]` |
| `icons/baits/` | `bait_lure.png` | 彩绘拟饵 | 吸引远洋掠食鱼/金枪鱼 | `[x]` |
| `icons/baits/` | `bait_glow.png` | 夜光诱饵 | 日落/深水吸引带鱼与稀有种 | `[x]` |
| `icons/ui/` | `coin.png` | 渔村贝币 | 商店货币 | `[x]` |
| `icons/ui/` | `echo_leaf.png` | 放生回响徽章 | 放生灵气值图标 | `[x]` |
| `icons/ui/` | `basket.png` | 随身鱼护 | 背包按钮 | `[x]` |
| `icons/ui/` | `bobber.png` | 红白浮标 | 钓鱼状态提示 | `[x]` |

---

## 四、可无缝开关门进出的房屋与室内 Blender `.glb` 节点规范（`public/assets/models/environment/`）

> 本项目房屋采用 **大世界 1:1 无缝开关门进出（非黑屏传送）** 架构：玩家靠近按 `E` 推开铰链木门，直接走入屋内时，屋顶与南侧前墙上半部自动平滑渐隐，露出温馨室内与可交互家具（家用大鱼缸、木床、工作台等）。Codex 后续在 Blender 制作房屋室内 `.glb` 时，请严格遵守以下尺寸与节点分组名称，前端将自动绑定门铰链动画与进屋渐隐：

| 精确文件名 (`public/assets/models/environment/`) | 建筑名称 | 占地尺寸 (`宽 X × 深 Z × 墙高 Y`) | 门洞位置 (`+Z` 朝前) | 室内核心交互家具 | 状态 |
|---|---|---|---|---|---|
| `house_player.glb` | 玩家自家临水红顶小屋 | `4.20m × 3.40m × 1.92m` | 门宽 `0.94m × 高 1.24m`，中心 `X = -0.68m` | 后右墙大生态鱼缸（`1.82m` 宽）、后左墙木床、圆地毯、台灯 | `[ ]` 待制作 |
| `house_artisan.glb` | 老周渔具工坊 | `3.55m × 2.90m × 1.82m` | 门宽 `0.94m × 高 1.24m`，中心 `X = 0.00m` | 后墙制竿工作台、左侧 4 支鱼竿陈列架、线轴、木箱 | `[ ]` 待制作 |
| `house_neighbor_east.glb` | 东岸木屋 | `3.25m × 2.75m × 1.76m` | 门宽 `0.94m × 高 1.24m`，中心 `X = 0.00m` | 圆桌、木凳、茶壶、书架、编织地毯 | `[ ]` 待制作 |

### Blender 场景层级与材质硬标准（用于无缝门与屋顶渐隐）
1. **坐标与朝向**：`+Y` 向上，大门正面朝 `+Z`，原点 `(0, 0, 0)` 位于建筑底面中心，室内地板顶面高度 `Y = +0.14m`，墙体厚度 `0.16m`。
2. **强制子节点命名**（Three.js 加载后按节点名自动绑定逻辑）：
   - `Exterior_Shell`：石质地基、后墙、左右侧墙、门框与门槛、前墙底部 `0.36m` 矮裙墙（进屋后保持常显）。
   - `Roof_Cutaway`：屋顶、脊梁、老虎窗、烟囱、前廊雨棚，以及前墙（`+Z`）高度 `0.36m` 以上的上半墙体与前窗（玩家进屋时整体平滑渐隐，不遮挡室内与鱼缸视线）。
   - `Door_Hinge`：空物体枢轴放在**门洞左侧门框铰链处**，门扇挂在其下向 `+X` 延伸；程序通过绕 `Y` 轴旋转 `0° → -104°` 实现平滑推开（不占室内家具空间）。
   - `Interior_Floor` & `Interior_Props`：室内木地板、地毯、床、鱼缸柜、工作台等家具摆件。
   - 空锚点（Empty）：`Anchor_Aquarium`（鱼缸中心）、`Anchor_Bed`（床交互点）、`Anchor_Workbench`（工作台交互点）。
3. **面数与贴图**：单栋含室内控制在 `3,000 ~ 7,500 tris`，沿用哑光水粉手绘感（`Roughness = 0.78 ~ 0.90`，`Metalness = 0.0`），避免硬方向高光烘焙。
