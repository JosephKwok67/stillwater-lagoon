# 给 Codex 的 Blender 3D 精模专属任务书（角色 + 无缝室内房屋）

> **目标**：把当前游戏里临时占位的 Three.js 几何白模（5 位角色 + 3 栋可推门进出房屋的温馨室内），全部升级为你在 **Blender** 里精雕细琢、带手绘水粉材质的 **`.glb` 精模**！程序端已经搭好了 **零改代码自动热替换加载器（`src/core/glbLoader.js` + `public/assets/models/manifest.json`）**——你每导出一个 `.glb` 并把 `manifest.json` 对应开关改为 `true`，游戏刷新瞬间就会自动换装成你的 Blender 精模！

---

=== 复制开始 ===

你是《钓鱼大冒险（静水 / Stillwater Lagoon）》的 **3D 美术主美与 Blender 技术美术（3D Character & Environment Artist）**。

项目根目录：`I:\antigravity cli\钓鱼大冒险`

目前程序端已经完成了完整玩法闭环（划船、上下船、陆地漫步、无缝推门进出 3 栋房屋、上床睡觉、钓鱼与家里 3D 鱼缸饲养、3 位 NPC 对话与商店），并且**已经写好了 `.glb` 自动热替换加载器**（`src/core/glbLoader.js` 与 `public/assets/models/manifest.json`）。现在程序白模太简陋，需要你**直接用 Blender（可通过 Python `bpy` 脚本化建模/烘焙贴图/绑定骨骼/渲染评审图/导出 `.glb`）** 产出高质量的 3D 人物与房屋室内模型！

> **磁盘约束**：如果本机尚未安装 Blender，请先告知我或将绿色便携版 Blender 放在 **`I:\antigravity cli\tools\blender`**（**严禁安装在 C 盘**）。

---

## 一、优先制作顺序（分两批交付，每批先出多角度渲染评审图！）

### 【Blender 批次 A · 优先】5 位核心 3D 角色（100% 还原你之前画好的 5 张三视图！）
请严格对照 `art_pipeline/concepts/` 里你已通过评审的 5 张三视图建模，逐一导出至 `public/assets/models/characters/`：
1. `npc_market.glb` — **渔市老板娘 · 阿莲**（珊瑚红头巾+发髻蝴蝶结、奶油卷袖衫、青绿宽口袋围裙、深蓝长裤，对照 `art_pipeline/concepts/npcs/npc_market_turnaround.png`）
2. `npc_artisan.glb` — **渔具工匠 · 老周**（睡莲绿平顶帽、靛蓝工装、蜜糖棕皮围裙+侧袋线轴，对照 `art_pipeline/concepts/npcs/npc_artisan_turnaround.png`）
3. `npc_lighthouse.glb` — **灯塔守望者 · 海伯**（深蓝船长帽、银灰短须、孔雀蓝外套、奶油针织衫、珊瑚红窄围巾、右手提旧铜灯，对照 `art_pipeline/concepts/npcs/npc_lighthouse_turnaround.png`）
4. `player.glb` — **草帽垂钓者 · 主角**（宽檐编织草帽+深棕帽带、蓬松棕发、奶油长袖、牛仔背带裤+两颗鹅黄纽扣、棕短靴，对照 `art_pipeline/concepts/characters/player_turnaround.png`）
5. `dog.glb` — **伴游小狗**（暖棕短毛、深棕垂耳、奶油嘴吻白爪、珊瑚红三角领巾+后颈结，对照 `art_pipeline/concepts/characters/dog_turnaround.png`）

#### 角色 `.glb` 硬技术标准（必须 100% 遵守）
- **坐标与原点**：`+Y` 向上、**正面朝 `+Z`**、原点 `(0, 0, 0)` 位于**双脚脚底中心**（小狗四爪着地中心），全部 Apply All Transforms。
- **精确尺寸**：
  - 主角 / 3 位 NPC 身高：**`1.24m ~ 1.28m`**（3 ~ 3.5 头身圆润微缩 Q 版，剪影饱满可爱）。
  - 伴游小狗身长：**`0.65m`**，肩高 **`0.38m`**。
- **面数与材质**：单角色 `2,000 ~ 4,500 tris`；手绘哑光水粉贴图（单张 `1024×1024` BaseColor PNG 打包进 `.glb`），**`Roughness = 0.78 ~ 0.88`、`Metallic = 0.0 ~ 0.05`**，去强烈方向光烘焙（仅保留均匀水粉手绘色与褶皱轻度 AO，交给 Three.js 实时太阳光打光）。
- **骨骼与动画 Clip 名称**（按 NLA Track 导出进 `.glb`，前端 `AnimationMixer` 按名字自动播放；若第一版先交静态高精模也可先验收外观再补骨骼动画）：
  - 主角：`Idle`、`Walk`、`Sit_Row`、`Fish_Cast`、`Fish_Idle`、`Fish_Bite`、`Fish_Catch`、`Sleep_Bed`
  - 3 位 NPC：`Idle`、`Wave`、`Talk`
  - 小狗：`Idle`、`Run`、`Swim`、`Happy`

---

### 【Blender 批次 B】3 栋可无缝开关门进出的房屋 + 精致绘本室内！
我们的游戏支持 **真·推门无缝走入室内（屋顶与南侧前墙上半部自动平滑渐隐，无黑屏传送）**。请你用 Blender 把以下 3 栋建筑的**外观 + 温馨室内家具**做成商业级微缩绘本模型，导出至 `public/assets/models/environment/`：

1. **`house_player.glb`（我的临水红顶小屋）**
   - 占地与门洞：`宽 X = 4.20m × 深 Z = 3.40m × 墙高 Y = 1.92m`；地板顶面 `Y = +0.14m`；大门洞宽 `0.94m × 高 1.24m`，中心偏左在 **`X = -0.68m, Z = +1.70m`**；前方带 `1.22m` 宽木前廊（立柱避开门洞摆动范围）。
   - 室内布局（温暖绘本渔夫之家）：
     - 后右墙：精致木纹大鱼缸底柜与玻璃框（留空透明水体空间，程序端会通过 `Anchor_Aquarium` 自动把玩家钓到的活体 3D 鱼放进缸里游动！）；
     - 后左墙：手绘暖木单人床、蓬松白枕头、珊瑚红格子棉被；
     - 室内细节：编织椭圆地毯、带暖光小台灯的木床头柜、墙上挂鱼装饰画、墙角鱼篓、窗台小盆栽、暖木天花横梁。
2. **`house_artisan.glb`（老周渔具工坊）**
   - 占地与门洞：`宽 X = 3.55m × 深 Z = 2.90m × 墙高 Y = 1.82m`；地板顶面 `Y = +0.14m`；大门居中 **`X = 0.00m, Z = +1.45m`**（宽 `0.94m × 高 1.24m`）。
   - 室内布局：后墙长木匠工作台（堆满木线轴、漆罐、刨花、小提灯、半成品竹竿）、左墙立式 4 支彩绘鱼竿陈列架、右墙挂网与鱼漂架、草绿编织垫、木工具箱。
3. **`house_neighbor_east.glb`（东岸海景木屋）**
   - 占地与门洞：`宽 X = 3.25m × 深 Z = 2.75m × 墙高 Y = 1.76m`；地板顶面 `Y = +0.14m`；大门居中 **`X = 0.00m, Z = +1.375m`**。
   - 室内布局：圆木餐桌与两张圆凳、陶瓷茶壶与茶杯、靠墙木书架、蓝灰圆地毯、海螺贝壳摆件。

#### 房屋 `.glb` 强制节点层级（程序端 `glbLoader.js` 自动按名称绑定，务必精确一致！）
- **`Exterior_Shell`**：石地基、后墙、左右侧墙、门框与门槛、木前廊地板/台阶/栏杆（避开门洞），以及**前墙（`+Z`）底部 `0.36m` 矮裙墙**（进屋时常显）。
- **`Roof_Cutaway`**：红瓦/石板瓦坡屋顶、屋脊、老虎窗、烟囱、前廊雨棚，以及**前墙（`+Z`）高度 `0.36m` 以上的上半墙体与前窗**（玩家走入室内时整体平滑渐隐，确保俯视室内与看鱼缸零遮挡！）。
- **`Door_Hinge`**：空物体（Empty）枢轴严格放在**门洞左侧门框铰链处**，门扇网格作为其子物体向 `+X` 延伸；程序端按 `E` 绕 `Y` 轴平滑旋转 `0° → -92°` 向外推开门扇。
- **`Interior_Floor`** & **`Interior_Props`**：温馨木地板与全部室内家具摆件。
- **交互空锚点（Blender Empties）**：`Anchor_Aquarium`（鱼缸中心）、`Anchor_Bed`（躺床睡觉枕头中心）、`Anchor_Workbench`（工坊工作台前）。

---

## 二、交付、热替换接入与评审流程
1. 所有 `.blend` 工程文件、贴图源与 `bpy` 脚本保存在 `art_pipeline/blender/`；每做好一批模型先在 Blender 里渲染正/斜 45°/俯视（52° 游戏视角）拼图评审图存到 `art_pipeline/staging/blender_preview/` 给我看。
2. 验收导出成品 `.glb` 放到 `public/assets/models/characters/` 或 `public/assets/models/environment/` 后，**直接编辑 `public/assets/models/manifest.json` 把对应模型改为 `true`**（程序会自动热替换白模，**禁止修改 `src/` 代码**）。
3. 同步更新 `docs/ART_ASSET_MANIFEST.md` 勾选状态与 `docs/CHANGELOG.md`！

*(附：之前第 3 批剩余的 17 张鱼类水彩图鉴卡也可继续并行产出，产出后把对应鱼种 ID 加入 `public/assets/models/manifest.json` 的 `fishIconsDelivered` 数组里即可立即自动生效！)*

现在请先检查你的 Blender 运行环境，向我汇报准备情况，并优先启动 **【Blender 批次 A：阿莲 `npc_market.glb`、老周 `npc_artisan.glb`、海伯 `npc_lighthouse.glb`】**！

=== 复制结束 ===
