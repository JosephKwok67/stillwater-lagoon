# 钓鱼大冒险 · 静水泻湖 (Stillwater Lagoon)

一款 **《动物森友会》× 吉卜力水粉手绘风格** 的 3D 治愈系钓鱼与海滨渔村生活网页游戏（Three.js + Vite + Codex + Tripo v3.1 HD + Blender 5.3 绑骨烘焙管线）。

- **在线试玩（GitHub Pages 自动同步）**：<https://josephkwok67.github.io/stillwater-lagoon/>
- **代码仓库**：<https://github.com/JosephKwok67/stillwater-lagoon>

---

## 核心玩法与特色
- **双模式无缝漫游**：划着木船探索静水泻湖与 25 种生态游鱼，靠岸直接步入新月石护岸与 2.65m 石板滨海长廊，无缝推门进入 3 栋差异化渔村小屋（屋顶与前墙自动柔隐切开）。
- **六段式真实手感钓鱼**：按住蓄力抛竿 → 水下真鱼被饵吸引咬钩 → 张力进度遛鱼拉扯 → 收入随身鱼护或放生获得回响灵气。
- **自家红顶海景小屋**：内置 3D 活体生态大鱼缸（随时放入/取出钓获活鱼近景观赏）与红格小床小憩切换天气与昼夜，屋外配有围栏小花园。
- **全员 v2.0 有机精模与陪伴小狗**：
  - **主角 v2.0** 与三位性格鲜明的小镇居民（渔市老板娘 **阿莲**、渔具工匠 **老周**、手提暖光风雨灯的灯塔守望者 **海伯**）均已完成 2048px 手绘水粉+AO 烘焙与零穿模验收；
  - **陪伴小狗 v2.0** 采用 Tripo v3.1 HD 高精雕塑 + Blender 5.3 水密减面与 7 骨蒙皮绑骨，支持船侧游泳与陆地小跑摇尾跟随。
- **v2.1 放大海滨渔村**：3 栋差异化建筑（玩家红瓦小屋、老周蓝瓦工坊、东侧黄瓦邻屋）、海鲜渔市摊位、7.8m 悬崖灯塔、3 条 5 阶木栈桥与多面体海岸岩礁。

## 操作指南
| 按键 | 功能 |
| :--- | :--- |
| `W / A / S / D` | 划船 / 陆地行走（按住 `Shift` 奔跑） |
| `Space`（长按→松开） | 蓄力抛竿 / 咬钩提竿 / 按住收线遛鱼 |
| `E` | 码头上下船 / 开关木门 / 观赏家里大鱼缸 / 上床小憩 / 与 NPC 对话 |
| `B` | 打开随身鱼护 |
| 鼠标左键拖拽 / 滚轮 | 旋转与缩放镜头视角 |

## 美术与 3D 生产管线
详见 [GEMINI.md](./GEMINI.md)：
- **框架设计与结构评审**：Codex `gpt-6.2-astra` (`ultra`)
- **三视图与细节分镜**：Codex `gpt-6.2-sol` (`medium`) + Image 2.5
- **有机高精初模**：Tripo MCP 自动化管线（`v3.1-20260211` HD）
- **清洗减面、水密缝合、UV 渗色膨胀、骨骼绑定与 WebGL 导出**：Blender 5.3 + Antigravity

## 项目文档索引
- 开发与更新日志：[docs/CHANGELOG.md](./docs/CHANGELOG.md)
- 工作室永久协作规则：[GEMINI.md](./GEMINI.md)
- 美术资产清单：[docs/ART_ASSET_MANIFEST.md](./docs/ART_ASSET_MANIFEST.md)
- 动画与资产规范：[ASSETS_ANIMATIONS.md](./ASSETS_ANIMATIONS.md)
- 灵感与长期玩法规划：[docs/USER_IDEAS.md](./docs/USER_IDEAS.md)

## 本地运行与构建
```bash
npm install
npm run dev      # 启动本地开发服 http://127.0.0.1:5173/
npm run build    # 生产构建（输出至 dist/，相对路径兼容 GitHub Pages）
```

## 自动部署在线试玩（GitHub Pages）
仓库内置 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)。每次经本地构建与实机验证通过后，代码、资产、`README.md` 与 `docs/CHANGELOG.md` 同步推送至 `origin/master`，自动触发 GitHub Actions 发布至在线试玩地址。
