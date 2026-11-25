# 「钓鱼大冒险」美术资产清单与命名验收表（ART ASSET MANIFEST）

> **说明**：本清单用于 **Codex（美术策划 / image 2.5 / Blender）** 与 **程序端（Three.js）** 严格对齐文件名、路径、尺寸和状态。
> 文件按下面**精确路径与文件名**保存后，游戏前端可直接自动识别并加载，无需改名。

---

## 一、核心角色与 NPC（共 5 位）

| ID | 角色名称 | 游戏定位 | 概念三视图路径 (`art_pipeline/concepts/...`) | 2D 对话立绘目录 (`public/assets/portraits/...`) | 3D 模型路径 (`public/assets/models/characters/...`) | 状态 |
|---|---|---|---|---|---|---|
| `player` | 草帽垂钓者（主角） | 划船/走路/钓鱼主角 | `characters/player_turnaround.png` | `player/neutral.png`, `happy.png`, `surprised.png` | `player.glb` | `[ ]` 待制作 |
| `dog` | 伴游小狗（渔夫伙伴） | 伴游/上岸跟宠/起鱼欢呼 | `characters/dog_turnaround.png` | `dog/happy.png`, `excited.png` | `dog.glb` | `[ ]` 待制作 |
| `npc_market` | 渔市老板娘（阿莲） | 红白条纹摊位：收鱼/鱼讯/悬赏 | `npcs/npc_market_turnaround.png` | `npc_market/neutral.png`, `happy.png`, `surprised.png` | `npc_market.glb` | `[ ]` 待制作 |
| `npc_artisan` | 渔具工匠（老周） | 小镇木屋工坊：卖竿/买饵/炼竿 | `npcs/npc_artisan_turnaround.png` | `npc_artisan/neutral.png`, `happy.png`, `thinking.png` | `npc_artisan.glb` | `[ ]` 待制作 |
| `npc_lighthouse` | 灯塔守望者（海伯） | 东侧红白灯塔：天气潮汐/巨物传说 | `npcs/npc_lighthouse_turnaround.png` | `npc_lighthouse/neutral.png`, `happy.png`, `mysterious.png` | `npc_lighthouse.glb` | `[ ]` 待制作 |

### 3D 角色标准规格（Blender 导出 `.glb` 必守规范）
- **坐标系与朝向**：`+Y` 向上，人物正面朝 `+Z`（或 `-Z` 并在日志注明），原点 `(0, 0, 0)` 位于**双脚脚底中心**。
- **比例尺寸**（严格匹配当前 2.58m 长的木船与小镇房屋）：
  - 主角 / 成年 NPC 身高：**`1.15m ~ 1.35m`**（3～3.5 头身绘本微缩比例）
  - 伴游小狗身长：**`0.65m`**，肩高 **`0.38m`**
- **面数预算**：角色 **`1,500 ~ 4,500` 三角面**；道具 **`500 ~ 2,000` 三角面**。
- **材质规范**：手绘哑光水粉质感（`Roughness = 0.72 ~ 0.90`，`Metalness = 0.0 ~ 0.05`），单张 `1024×1024` BaseColor 贴图（PNG/WebP），避免写实镜面油光。
- **标准动画 Clip 命名**（打包在 `.glb` 中，供 Three.js `AnimationMixer` 调用）：
  - 主角：`Idle`、`Walk`、`Sit_Row`、`Fish_Cast`、`Fish_Idle`、`Fish_Bite`、`Fish_Catch`
  - NPC：`Idle`、`Walk`、`Wave`、`Talk`
  - 小狗：`Idle`、`Swim`、`Run`、`Happy`

---

## 二、25 种水域生物手绘水彩图鉴卡（`public/assets/icons/fish/<id>.png`）

> 规格：`512×512` PNG，透明背景（或统一米白绘本卡底色并在日志标注），侧面完整姿态、手绘水彩质感、高辨识度。

| 分类 | 精确文件名 (`public/assets/icons/fish/`) | 中文名 | 体型 | 状态 |
|---|---|---|---|---|
| 大型远洋鱼 | `yellowfin_tuna.png` | 黄鳍金枪鱼 | 巨型 | `[ ]` |
| 大型远洋鱼 | `seabass.png` | 海鲈鱼 | 大型 | `[ ]` |
| 大型远洋鱼 | `yellowtail.png` | 鰤鱼 | 大型 | `[ ]` |
| 大型远洋鱼 | `kingfish.png` | 黄尾鰤 | 大型 | `[ ]` |
| 大型远洋鱼 | `spanish_mackerel.png` | 马鲛鱼 | 大型 | `[ ]` |
| 礁石鱼类 | `red_sea_bream.png` | 真鲷 | 大型 | `[ ]` |
| 礁石鱼类 | `black_sea_bream.png` | 黑鲷 | 中大型 | `[ ]` |
| 礁石鱼类 | `rockfish.png` | 眼张鱼 | 中型 | `[ ]` |
| 礁石鱼类 | `chicken_grunt.png` | 伊佐木 | 中型 | `[ ]` |
| 礁石鱼类 | `star_snapper.png` | 星笛鲷 | 中大型 | `[ ]` |
| 群游鱼类 | `mackerel.png` | 青花鲭鱼 | 中型 | `[ ]` |
| 群游鱼类 | `horse_mackerel.png` | 竹荚鱼 | 小型 | `[ ]` |
| 群游鱼类 | `anchovy.png` | 银鳀鱼群 | 迷你 | `[ ]` |
| 奇特鱼类 | `cutlassfish.png` | 银带鱼 | 细长大型 | `[ ]` |
| 奇特鱼类 | `barracuda.png` | 尖嘴梭鱼 | 中大型 | `[ ]` |
| 底栖生物 | `scorpionfish.png` | 石狗公 | 中型 | `[ ]` |
| 底栖生物 | `flathead.png` | 沙鲬 | 中大型 | `[ ]` |
| 彩绘淡水鱼 | `stillwater_koi.png` | 静水锦鲤 | 中型 | `[ ]` |
| 彩绘淡水鱼 | `cardinal_tetra.png` | 宝莲灯鱼 | 迷你 | `[ ]` |
| 彩绘淡水鱼 | `blue_diamond_discus.png` | 蓝钻七彩神仙 | 中型 | `[ ]` |
| 彩绘淡水鱼 | `red_turquoise_discus.png` | 红松石七彩神仙 | 中型 | `[ ]` |
| 彩绘淡水鱼 | `pale_chub.png` | 宽鳍鱲（婚姻色） | 小型 | `[ ]` |
| 头足与虾类 | `bigfin_reef_squid.png` | 软丝鱿鱼 | 中大型 | `[ ]` |
| 头足与虾类 | `golden_cuttlefish.png` | 金乌贼 | 中型 | `[ ]` |
| 头足与虾类 | `red_bee_shrimp.png` | 水晶红白虾 | 迷你 | `[ ]` |

---

## 三、渔具与核心 UI 图标（`public/assets/icons/`）

| 目录 | 精确文件名 | 名称 | 用途 | 状态 |
|---|---|---|---|---|
| `icons/rods/` | `rod_bamboo.png` | 初始竹竿 | 起始装备 | `[ ]` |
| `icons/rods/` | `rod_maple.png` | 枫木溪流竿 | 淡水/礁石进阶 | `[ ]` |
| `icons/rods/` | `rod_ocean.png` | 远洋海钓竿 | 挑战金枪鱼/鰤鱼 | `[ ]` |
| `icons/rods/` | `rod_starlight.png` | 静水秘制竿 | 稀有鱼/放生回响加成 | `[ ]` |
| `icons/baits/` | `bait_dough.png` | 面团香饵 | 吸引淡水/锦鲤/小鱼 | `[ ]` |
| `icons/baits/` | `bait_shrimp.png` | 鲜甜虾仁 | 吸引礁石鱼/底栖鱼/乌贼 | `[ ]` |
| `icons/baits/` | `bait_lure.png` | 彩绘拟饵 | 吸引远洋掠食鱼/金枪鱼 | `[ ]` |
| `icons/baits/` | `bait_glow.png` | 夜光诱饵 | 日落/深水吸引带鱼与稀有种 | `[ ]` |
| `icons/ui/` | `coin.png` | 渔村贝币 | 商店货币 | `[ ]` |
| `icons/ui/` | `echo_leaf.png` | 放生回响徽章 | 放生灵气值图标 | `[ ]` |
| `icons/ui/` | `basket.png` | 随身鱼护 | 背包按钮 | `[ ]` |
| `icons/ui/` | `bobber.png` | 红白浮标 | 钓鱼状态提示 | `[ ]` |
