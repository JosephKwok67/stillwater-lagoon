# 「静水」开源 3D 动作包与 NPC 角色资产备选清单

这份清单整理了已核实可商用（以 **CC0 / MIT** 为主）、且天然兼容 **Three.js (`.glb` / `.gltf`)** 的高质量开源角色与动作库，涵盖后续玩法所需的 **走路、坐姿、钓鱼、NPC 交互、划船** 等全套动作。

---

## 1. 最推荐：开箱即用的 CC0 动作与角色套包（画风最契合）

### ① Quaternius — Universal Animation Library (Vol.1 + Vol.2) & Base Characters
- **协议**：CC0 1.0（完全免费、可商用、无需署名）
- **格式**：`.glb` / `.gltf` / `.fbx` / `.blend`
- **地址**：
  - 官网主页：<https://quaternius.com/>
  - 动作库 Vol.1（基础移动/坐姿/游泳/待机）：<https://quaternius.itch.io/universal-animation-library>
  - 动作库 Vol.2（农作/**钓鱼**/社交动作等 130+ 动作）：<https://quaternius.itch.io/universal-animation-library-2>
  - GitHub 轻量 glTF 镜像参考：`J-Ponzo/gltf-universal-animation-library`
- **包含的关键动作**：
  - 走路/慢跑/冲刺（8 方向 + 原地循环）
  - 坐下/坐姿待机/起身（可直接用于上船/下船、坐长椅）
  - 钓鱼/农作交互动作、挥手/点头等社交动作
  - 配套低多边形风格化人形基础角色（非常适合改造成小镇村民 NPC）

### ② KayKit — Character Animations + Adventurers / Villagers (by Kay Lousberg)
- **协议**：CC0（免费可商用）
- **格式**：`.gltf` / `.glb` / `.fbx`（统一通用骨骼，所有角色可共享全部动作）
- **地址**：
  - 角色动作包：<https://kaylousberg.itch.io/kaykit-character-animations>
  - 作者主页（含各类低多边形角色与小镇物件）：<https://kaylousberg.itch.io/>
  - GitHub Three.js 加载参考：`sketchpunklabs/kaykit_char`
- **包含的关键动作（钓鱼动作非常全！）**：
  - 专属钓鱼套组：`Fishing_Cast`（抛竿）、`Fishing_Idle`（持竿等待）、`Fishing_Bite`（鱼咬钩拉扯）、`Fishing_Catch`（扬竿收鱼）
  - 走路/跑步/跳跃/搬运/挥手/交谈/互动
  - 圆润可爱的玩具微缩比例，与我们现在的「静水」彩绘微缩画风契合度极高！

### ③ Kenney — Animated Characters & Town Kits
- **协议**：CC0
- **地址**：<https://kenney.nl/assets>
- **适合用途**：轻量级小镇村民 NPC 基础模型、简单走路与交互动作、小镇道具补充（木桶、渔网、路牌等）。

---

## 2. 开源骨骼绑定与动作合成工具（解决“划船”等稀缺专属动作）

市面上绝大多数通用开源动作包都有 **走路、交谈、坐姿、钓鱼**，但**“双手握双桨划船”**因为必须和船体/双桨严格联动，极少直接打包在通用包里。最成熟的开源方案是：

### ① Mesh2Motion（开源免费 Mixamo 替代品 + 170+ CC0 动作库）
- **协议**：代码 MIT，内置 3D 资产与动作全为 **CC0**
- **GitHub 源码仓库**：<https://github.com/Mesh2Motion/mesh2motion-app>
- **GitHub 资产/动作源文件仓库**：<https://github.com/Mesh2Motion/mesh2motion-assets>
- **在线工具**：<https://mesh2motion.org/>
- **优势**：
  - 支持直接上传 `.glb` 角色模型（人形、小狗四足、鱼类骨骼都支持！）
  - 可在网页里一键挑选多个动作（走路 + 交谈 + 坐姿 + 钓鱼），**直接打包导出成单个 `.glb`** 交给 Three.js 的 `THREE.AnimationMixer` 播放！

### ② Mixamo + GitHub 合并流水线（补充细分动作：划船/挥手/交易/坐着聊天）
- **工具仓库**：
  - `Mixamo2GLBAnimationMerger`（把 Mixamo 下载的多个 `.fbx` 动作自动合并为单个 Web 友好的 `.glb`）
  - `vrm-mixamo-retarget`（若后续使用 VRM 风格化角色，可在 Three.js 中运行时直接重定向动作）
- **说明**：Mixamo 免费提供大量坐姿、划船（Rowing / Paddling）、钓鱼（Fishing Cast）、交谈（Talking / Waving / Arguing / Nodding）动作；也可配合 **程序化 IK（双手游标紧锁船桨手柄）**，实现比纯关键帧更贴合真实船桨物理的划船动作。

### ③ 大规模开源动捕数据集（用于补充自然走路与生活动作）
- **Bandai Namco Research Motiondataset**（GitHub：`BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset`）：开源 `.bvh` 风格化日常动作数据集（多种情绪走路、招手、交互姿态）。
- **Open Source 3D Assets Registry**（GitHub：`ToxSam/open-source-3D-assets`）：收录近千个 CC0 `.glb` 模型与角色。

---

## 3. 推荐的后续接入策略（给「静水」小镇与钓鱼玩法）
1. **主角 + 小镇 NPC 基础骨骼**：统一采用 **KayKit** 或 **Quaternius** 的 CC0 `.glb` 通用骨架（一套动作所有 NPC 复用，加载快、体积小）。
2. **走路 / 交互 / 钓鱼动作**：直接使用 **KayKit Character Animations**（自带 `Fishing_Cast / Bite / Catch` + 走路/挥手/交谈）或 **Quaternius UAL 1 & 2**，通过 **Mesh2Motion** 或 Blender NLA 打包进单个 `.glb`。
3. **划船动作**：用“坐姿骨骼动画 + 程序化双臂 IK 锁定双桨手柄”，保证无论加速、急转弯还是倒船，主角双手永远死死握住木桨，不会穿模也不会脱手！
