# 《钓鱼大冒险 · 静水》主角 v2.0 角色重构工程规范

v2.0 保留四个身份特征：宽檐草帽、栗色短发、奶油白衬衫、牛仔蓝背带裤。重雕的重点是让角色表现出**身体有重量、衣服有厚薄、动作有意图**。图 2 左下，孩子抬头接鱼，视线、下巴和伸出去的小手朝向同一件事。右下，孩子坐稳在栈桥上，肩膀放松，肘部靠近身体，注意力落在鱼漂上。这两种状态是 v2.0 的表演基准。

以下对 v1 的诊断只依据图 1 的可见外观。尺寸、枢轴、材质范围和验收阈值均为 **v2.0 新设计值**。项目统一按**穿靴戴帽、自然站立、鞋底至帽冠总高 1.260 m**交付。

---

## 1. v1 主角逐部位诊断

| 部位 | 图 1 中可见的问题 | v2.0 重雕指令 |
|---|---|---|
| 头型、下颌与脖颈 | 正面脸颊两侧几乎等宽，底部很快收成小下巴。3/4 角里，脸像一个完整圆块搁在窄颈柱上，耳前、下颌和颈侧缺少连续转面。 | 最饱满处放在眼睛下方、嘴角外侧。让下颌从耳前缓慢向前下方收拢，颏下再回到颈部。转到侧面时，应读出额头、鼻尖、嘴唇、下巴四层很浅的前后关系。 |
| 眉、眼、鼻、嘴、腮红 | 黑眼珠接近圆珠，两侧腮红边界完整，鼻头像单独安放的小团，笑线两端深度相近。所有表情信息都集中在脸的正表面。 | 眼形做成有上睑遮挡的短椭圆，眉毛贴着额面转折。鼻梁到鼻翼只保留一次柔和起伏。腮红随颧面铺开，到耳前和嘴角自然消失。微笑由一侧嘴角略微抬起、下眼睑略收共同形成。 |
| 草帽与头发 | 帽檐接近均匀圆盘，编织纹像整齐的同心环。刘海分成数根粗细相似、末端整齐的深色条。图 1 右侧俯视中，帽面占了大部分辨识面积。 | 帽檐做三处幅度不同的缓起伏。角色左前檐微提，右后檐略垂。头发先做连贯发量，再分出额前、耳前、后颈三组发束。帽带压住头发的位置要有轻微压扁。 |
| 肩膀、袖山、肘部 | 正面肩头有独立圆帽状轮廓，上臂和前臂的袖子像两段近似等径的管。双臂向外张开后，肩、肘、腕沿同一条斜线排列。 | 从颈根经过锁骨、肩峰、外侧袖山画出一条连续下降曲线。上臂向下落，前臂稍向身前回。肘内侧形成压褶，肘外侧保留拉长的干净布面。 |
| 胸廓、腰腹与臀部 | 蓝色腰腹是一块前凸的横椭圆体，下面又出现单独的骨盆轮廓。正面腰线和裤裆附近出现两次明显横向分段，侧面重心显得悬在腿上方。 | 先雕完整的胸廓、腹部、骨盆侧影。小腹最前点略低于腰线，后腰有轻收，臀峰略向后。背带裤沿这个体积自然下垂，裆底留出坐下所需的布量。 |
| 背带裤胸挡、胸袋与扣子 | 胸挡上缘接近水平硬边，胸袋厚得像凸起的小盒子。两条背带宽窄和受力几乎完全相同，黄扣尤为突出。 | 胸挡顺胸廓弯曲，两侧扣点略高，中段轻垂。胸袋只在袋口有微小翻边，轮廓主要靠车线、布纹方向和浅阴影表达。黄铜扣贴住背带，并在扣点下方留下短拉褶。 |
| 袖口、手腕与小手 | 白袖口形成完整圆环，手腕从环中央伸出。手掌短小，指尖朝下散开，拇指根部与掌心握合方向不清楚。 | 袖口做偏椭圆且有高低差的单次翻卷，内侧略贴腕。手背延续前臂方向，掌心略向大腿，拇指向前。即使缩成小图，也要从拇指与食指之间的缺口辨出手的方向。 |
| 裤腿、靴面与鞋底 | 裤腿像两根等粗短柱，裤脚翻边等高。棕靴上部接近圆团，底下另有一道颜色很深的薄片，脚掌朝向和落地受力难以辨认。 | 裤腿从髋部垂落，到膝盖稍收，脚踝上方有少量堆布。靴面塑出后跟、脚背和向前延伸的宽圆鞋头。鞋底沿靴面连续包边，接地阴影集中在后跟和前掌。 |

## 2. v2.0 比例、形体、网格与绑定

### 2.1 尺度、坐标与体块

Blender 单位用米。原点设在自然站姿两靴之间的地面，`+Z` 向上，角色面朝 `−Y`，角色自身左侧为 `+X`。所有高度均指世界坐标 `Z`。正交建模先锁定鞋底、下巴、解剖头顶、帽冠四条线，防止反复调整帽子时把整个人越做越高。

| 项目 | v2.0 尺寸 | 造型要求 |
|---|---:|---|
| 穿靴戴帽总高 | **1.260 m** | 鞋底最低接地点 `Z 0.000`，帽冠最高点 `Z 1.260`。 |
| 解剖头顶、下巴、头长 | `1.225 / 0.735 / 0.490 m` | 穿靴至解剖头顶为 **2.50 头身**，含帽总高为 **2.57 个头长**。帽冠比解剖头顶高 `35 mm`。 |
| 裸头最大宽、深 | `0.424 / 0.382 m` | 宽度取两侧颊部整体外轮廓，深度取额面至后脑。后脑保留足够体积，侧面戴帽后仍能看出后颈发束。 |
| 眼线、鼻尖、嘴中线 | `Z 0.976 / 0.913 / 0.854 m` | 两眼中心距约 `0.145 m`。眉尾和嘴角允许 `2–3 mm` 高低差，静息表情保持安静、好奇。 |
| 下颌弧度 | 嘴线处脸宽约为最大头宽的 `84%`，近颏处约 `55–60%` | 正面以长弧收下巴，侧面将下巴前点放在下唇略后方。微笑时保留脸颊下缘的重量。 |
| 肩、胸、腹、髋 | 两肩枢轴距 `0.336 m`，含袖最大肩宽约 `0.415 m`；胸宽 `0.302 m`，腰腹宽 `0.282 m`，着裤髋宽 `0.342 m` | 肩峰比颈根低 `25–32 mm`。胸廓略扁，小腹略圆，髋部重新展开。正侧面都应看见连续变化。 |
| 腋下、自然腰、裤裆 | `Z 0.635 / 0.505 / 0.323 m` | 裆底低于髋枢轴，保留宽松裤料。站立时两腿间留窄负形，坐下时布料能向腹股沟两侧聚拢。 |
| 手与足 | 手长 `0.092 m`，掌宽约 `0.056 m`；单靴长 `0.181 m`，最宽 `0.088 m` | 四指制为**一拇指加三根长指**。食指略独立，另外两指自然并拢。鞋头宽圆，前端比后跟更宽。 |
| 草帽 | 外檐宽 `0.570 m`，前后深 `0.486 m`；前檐基准高约 `Z 1.108 m` | 左前檐在基准上提高 `12–16 mm`，右后檐下落 `8–12 mm`，用宽缓弧连接。后偏左设置扁平帽带结和两截短带尾。 |

**默认展示站姿。** 双足中心相距约 `0.165 m`，脚尖各向外 `5–8°`，一只脚前移约 `15 mm`。上臂离躯干 `8–12°`，肘屈 `12–18°`，前臂略向前，腕部自然延长。重心约六成落在支撑脚，另一侧膝盖微松。绑定静止姿态可左右对称，四视图和城镇待机使用这套带轻微偏重的展示姿态。

**44° / 52° 俯视。** 本规范的俯角从水平视线向下量，`90°` 为垂直顶视。44° 前 3/4 优先保留近侧眉眼、鼻尖和领口。52° 后 3/4 优先保留帽结、左右袖子、蓝色裤身和一前一后的鞋头。试摆时先看帽檐在哪一段遮住动作，再局部调整檐弧、袖子外轮廓或动作方向，保持总高与肩宽基准。

### 2.2 服装和材质的具体做法

- **草帽与头发。** 帽冠按头型做略扁的椭圆。帽内加一圈细窄汗带，贴住鬓角上方的发量。帽檐建出约 `2.5–3.5 mm` 厚的连续边缘，内侧单独给偏暖、略暗的草色。中近景用宽而浅的编织带方向表现手工感，单根细纤维交给法线和粗糙度。刘海组织成约五簇有主次的形体，每簇根部汇入发冠，末端留少数散丝。
- **衬衫与背带裤。** 奶油白棉麻衬衫用浅圆领，领缘离颈处有微小厚度。袖卷外侧宽、肘内侧窄，卷起的末端藏进内侧。牛仔胸挡与裤腰共享同一片前身曲面，胸挡两侧向腰侧自然过渡。背带在背后形成清楚的 `X`，交叉处一条压住另一条，下端缝入后腰。裤脚各翻一次，左右卷高可差 `4–6 mm`。
- **小手与皮靴。** 手背塑出一块柔和掌骨面，掌侧有拇指根部的肉垫。半握时让三根长指依次收向掌心，虎口留下握杆空间。靴子从脚踝到鞋头先做完整体积，再沿下缘形成 `5–7 mm` 的包底。鞋头有很浅的上翘，外底用比靴面深一档的暖棕。
- **表面手感。** 粗糙度起点可取棉麻 `0.82`、牛仔 `0.78`、草编 `0.72`、柔软旧皮 `0.58`。把黄铜扣做成小面积暗金高光。眼睛只留一个软小反光点。衣物颜色以低频、轻微冷暖变化为主，正常游戏距离仍应先读出奶油白、牛仔蓝、草帽黄三个色块。

### 2.3 Blender 有机网格与烘焙

1. **先雕身体，再裁衣。** 从连续人体基体确定颈肩、胸廓、腹部、骨盆和四肢。先用单色灰模检查正面、侧面与 52° 俯视剪影，通过后再制作衣物。灰模侧视就应看得出后脑、背部、臀峰和鞋头朝向。
2. **让袖子承担肩肘变形。** 袖山、肩部和上臂的可见表面使用连续四边面。边流从锁骨外端绕过三角肌进入上臂，腋下留一条可展开的布面。肩、肘各安排至少三道渐变变形环。肘弯到约 `90°` 时，外肘展开，内肘形成两道短压褶；肩峰仍与胸廓相连。
3. **在袖口和裤腰下保留真实包覆。** 手腕向袖内延伸约 `20–25 mm`，翻卷袖口有内壁。裤腰内部的衬衫下摆预留约 `30–40 mm` 搭接。牛仔裤从腹前、侧腰、臀部到两条裤腿使用同一张连续外表面，裆部边流左右分叉。衣下身体可局部隐藏，抬臂、坐姿能看进的区域必须保留覆盖。
4. **把五官长在脸上。** 鼻翼、嘴角、下眼睑直接雕入脸部曲面。上眼睑压住眼球上缘，闭眼形态沿眼球弧面闭合。眉毛以底色纹理为主，近景需要体积时只加极浅起伏。腮红直接画进脸部底色，用两到三层半透明暖色让中心、外缘、肤色自然相接。嘴角最深处只占短短一段。
5. **烘焙分开处理形体和颜色。** 高模负责唇颊转面、袖褶、帽檐厚度和靴底包边。低模负责实际剪影与关节变形。切线空间法线承接浅编织、布褶和车线，粗糙度承接纤维与磨旧差异。底色按 sRGB 读入，法线、粗糙度和 AO 按 Non-Color 读入。脸、帽、头发、衣服分组烘焙，避免帽檐阴影永久印在脸上。AO 控制在缝窝和真实接触处，保留换灯能力。
6. **为动作做四个局部修形。** 建议至少制作抬臂时的腋下展开、深屈肘时的内袖压缩、坐姿时的髋前压褶、闭眼时的上睑覆盖。由关节角或表情控制驱动。先在最难的姿势下雕正确轮廓，再返回默认姿态检查过渡。

### 2.4 六个主枢轴与动作层级

下表给出对称绑定静止姿态的枢轴，均为角色局部坐标，单位 `m`。六个名字保留为动画主接口。肘、腕、膝、踝使用下级变形骨，主接口可以保持简洁。

| 主接口 | 枢轴 `(X, Y, Z)` | 放置与职责 |
|---|---|---|
| `Rig_Torso` | `(0.000, +0.008, 0.398)` | 位于骨盆中央，控制躯干起伏和俯仰。胸椎下级骨分担弯腰，坐下时骨盆绕髋带动重心后移。 |
| `Rig_Head` | `(0.000, +0.015, 0.751)` | 位于两耳之间偏下的颅底附近。点头时下巴靠近领口，后脑沿弧线抬起。让短颈分担一部分转头。 |
| `Rig_ArmL` | `(+0.168, 0.000, 0.707)` | 左肩关节中心埋在袖山内，向上承接锁骨，向下驱动上臂。 |
| `Rig_ArmR` | `(−0.168, 0.000, 0.707)` | 右肩镜像承接。挥竿时锁骨先抬，肩部随胸廓旋转。 |
| `Rig_LegL` | `(+0.091, +0.006, 0.388)` | 左髋关节中心置于裤内，供屈髋、迈步和外展共用。 |
| `Rig_LegR` | `(−0.091, +0.006, 0.388)` | 右髋镜像承接，脚底落点与骨盆有独立控制。 |

**辅助骨定位。** 左肘约 `(+0.194, −0.010, 0.543)`，左腕约 `(+0.207, −0.049, 0.419)`，左膝约 `(+0.088, −0.012, 0.210)`，左踝约 `(+0.084, +0.010, 0.080)`。右侧镜像 `X`。膝盖预留轻微朝前的弯曲方向，脚掌增加后跟与前掌滚动点。

**层级与权重。** 总根下设骨盆控制，躯干与左右髋从骨盆分别承接；头和锁骨承接胸廓；肩、肘、腕依次承接。这样弯腰持竿时双脚能钉在甲板上。身体和服装共用骨架，衣服先从身体传递权重，再单独修肩、裆、袖口和背带。帽子及主体发量跟随头骨，后颈发梢可轻微跟随颈骨。背带下端跟胸腰，上段随锁骨少量展开。走、跑、挥竿、坐、躺五套动作均需实际变形验收。

## 3. 给 GPT-6.2-Sol（medium + Image 2.5）的构图指令

两次生成都附图 1 和图 2。第一张定稿后，第二次生成再附上第一张定稿作为角色一致性参考。**四视图决定造型，细节表解释造型如何弯曲、受力和表演。** 米制数值由 Blender 执行，生成图用于对齐轮廓、色块与气质。

### 构图 1 · `player_v2_turnaround_4view.png`

**画幅**：横向 `3:1`，建议 `3072 × 1024` 或同等比例。四个等宽栏，人物含帽与靴约占画高 `82%`，帽冠线、眼线、鞋底线在四栏一致。正交相机保持水平，四栏使用相同尺度。

| 从左至右 | 镜头 | 必须画清楚的内容 |
|---|---|---|
| 1 | 正面 `0°`，自然站立 | 一腿承重，另一膝稍松。手臂顺肩落下，双手靠近大腿，脸上是安静的小笑。近侧眉眼清楚。 |
| 2 | 前 3/4，水平转约 `35°` | 保持同一站姿与尺度。用颊部转面、稍抬的前檐、胸挡弧面和一前一后的鞋头形成英雄角。两只眼睛都可见。 |
| 3 | 正侧面 `90°` | 严格侧面，朝画面左方。鼻尖、下巴、后脑、小腹、臀峰、脚背和鞋头构成一条可用于描模的轮廓。 |
| 4 | 正背面 `180°` | 后偏左的帽带扁结、后颈发束、衬衫后领、两条背带的 `X` 交叉和后腰接缝清楚可辨。 |

**英文 Prompt**

```text
Create a production character turnaround for Stillwater Lagoon, a warm coastal
fishing adventure. Use reference 1 for the child's identity and outfit colors.
Use the market handoff and seated pier angler in reference 2 for anatomy,
gesture, and hand-painted gouache treatment.

One wide 3:1 sheet, exactly FOUR equally spaced full-body orthographic views
in a single horizontal row. Left to right: straight front, 35-degree front
three-quarter hero view, exact left-facing side profile, straight back.
Use a level camera, identical scale, identical crown and ground lines, and
the same relaxed standing pose rotated through all four views. Show the
entire hat and both boots inside each cell. Fill about 82% of the sheet height.

Design one recognizable chestnut-haired child. Standing height including hat
is 1.26 m. The anatomical head is about two fifths of the uncapped standing
height. Shape full low cheeks, a softly narrowing jaw, inset dark oval eyes
under gentle upper lids, a tiny modeled nose, a quiet uneven smile, and warm
blush fading into the skin. Give the child a softly domed woven straw hat,
a gently lifted left front brim, a lower right rear brim, and a flat brown
ribbon knot just left of the back center. Hair compresses under the hatband
and opens into soft, varied locks around the temples and nape.

Natural sloping shoulders; loose cream linen shirt; elbows slightly flexed;
small four-digit hands with one thumb and three fingers. Indigo-blue overalls
follow the belly and hips. Include a curved bib, small antique brass buttons,
a shallow sewn chest pocket, crossed back straps, loose trouser legs, and
slightly uneven rolled cuffs. Small chestnut leather boots have broad round
toes and integrated warm-brown soles. Settle the weight on one foot.

Paint with opaque gouache, broad warm and cool color planes, restrained paper
grain, soft sky fill, and one broad upper-left light consistent across views.
Use a plain pale warm paper ground and a faint contact shadow directly beneath
each pair of boots. Keep all four silhouettes clean. No props, scenery, text,
dimensions, panel borders, pedestals, plastic highlights, or doll joints.
```

### 构图 2 · `player_v2_detail_breakdown.png`

**画幅**：横向 `4:3`，建议 `3072 × 2304` 或同等比例。固定 `2 × 2` 四格，阅读顺序为左上 A、右上 B、左下 C、右下 D。A、B、C 各画一个连续取景，D 格内放三枚动作剪影。留白分格，镜头名可在文件外标注。

| 格 | 取景与动作 | 交付重点 |
|---|---|---|
| A | **帽冠至锁骨**，前 3/4。孩子像在鱼市接东西一样，微抬下巴，看向略高处的人。 | 近侧眼睑、笑时轻抬的脸颊、融入肤色的腮红、鬓角压发、草编走向，以及帽带贴住帽冠的接触阴影。 |
| B | **下巴至髋上缘**，接近正面的 3/4。胸口轻转，一侧背带稍紧。 | 衬衫浅圆领、袖山连续曲面、胸挡弧面、黄铜圆扣、扣点拉褶、贴身胸袋和细车线。 |
| C | **从近侧肘部到鞋底的单一近景**。孩子略微屈膝，近侧前臂垂到膝边，半握的小手和近侧裤脚处于同一焦平面。 | 一眼看清肘内压褶、袖口厚度、手腕进入袖内、四指握形、裤脚翻卷方向、鞋头和鞋底包边。保留手和腿之间的一线空隙。 |
| D | **三个小全身动作并排**。左为轻快迈步，中为坐姿持竿，右为 `52°` 后 3/4 俯视。 | 迈步读出承重脚和摆臂；坐姿读出臀部接触、前倾注意力、持竿方向；背面俯视读出帽结、两袖和鞋步方向。 |

**英文 Prompt**

```text
Create a modeler's illustrated detail sheet for the exact child in the
approved Stillwater Lagoon turnaround. Match the same face, head size,
left-front brim lift, chestnut hair, four-digit hands, cream shirt, indigo
overalls, brass buttons, rolled cuffs, and round leather boots. Use the market
exchange and pier fishing scenes in reference 2 for expression and weight.

Landscape 4:3 sheet. Exactly FOUR main panels in a clean 2-by-2 grid, separated
by narrow warm-paper gutters. Each of the first three panels is one coherent
camera view. The fourth panel contains three small full-body pose studies.

UPPER LEFT — head and hat close-up, crown to collarbones, front three-quarter.
The child looks slightly upward toward a market vendor. Show the upper lid
resting over the eye, a cheek raised by the smile, and transparent warm blush
fading across the cheek plane. Show chestnut locks flattening beneath the
hatband, the changing direction of the straw weave, the thin finished brim,
and the soft contact shadow under the brown ribbon.

UPPER RIGHT — neck to upper hips, gentle three-quarter torso close-up. Turn
the chest just enough to pull one strap slightly taut. Show a shallow cream
linen neckline, a continuous shoulder and sleeve cap, the curved denim bib,
two small brass buttons, tiny tension folds beneath the buttons, and a flat
chest pocket described by stitching and a softly curling pocket lip.

LOWER LEFT — one continuous close-up from the near elbow down to the boot
soles. The child bends the knees a little and lets the near forearm hang
beside the near knee. Keep hand and ankle in the same plane of focus. Show
the soft elbow bend, unevenly rolled sleeve, wrist entering the cuff, a relaxed
cupped hand with one thumb and three fingers, rolled trouser hem, broad round
leather toe and integrated outsole. Keep a sliver of warm background between
the hand and trouser leg. Preserve anatomical connections and natural scale.

LOWER RIGHT — three small readable full-body action studies side by side:
a buoyant walking step with opposite arm swing; seated fishing on one simple
pier plank with a light rod, weight on the sit bones and attention on the
float; a rear three-quarter view looking down 52 degrees from horizontal,
with hat knot, both cream sleeves, blue torso and stepping boots visible.
Keep these three studies inside this single lower-right panel.

Paint in warm storybook gouache with broad color planes, quiet paper texture
and soft upper-left daylight. Reserve the strongest small contrast for the
eyes, thumb opening, cuff overlap and boot contact. Plain pale warm paper.
No lettering, arrows, captions, extra panels, loose body parts or glossy
plastic surfaces.
```

## 4. Blender 拼装整合“零失误”自检清单

以下十项在**最终细分、材质、蒙皮和实际游戏相机**下验收。动作检查覆盖起势、最大幅度、回落及中间帧。

| # | 硬指标 | 通过条件 |
|---|---|---|
| 1 | 尺度与地面 | 中性穿靴戴帽站姿总高 `1.260 m ± 0.001 m`。承重靴后跟与前掌都接触地面，非承重脚的离地状态符合当前姿势。 |
| 2 | 六枢轴与层级 | 六个主接口逐一核名和测位。固定双足做一次约 `30°` 前倾，靴底保持原落点；单独转头时帽、发、眼睑同步，无二次位移。 |
| 3 | 关节 `45°` 测试 | 左右肩前抬／外展、肘屈、髋屈、膝屈分别测试 `45°`，做正、侧、背三向环看。肩峰、腋窝、肘内、腕口、裆部均无可见空洞、断缝或突然塌扁。 |
| 4 | 走路与奔跑 | 各播放完整循环并检查首尾衔接。脚掌完成后跟至前掌滚动，支撑期无可见滑步；摆臂经过髋旁时手、袖、裤身之间保持清楚的前后关系。 |
| 5 | 挥竿 | 测过肩蓄力、出竿和收势。杆柄始终落在虎口与掌心之间。肩袖连续，前臂无扭结，帽檐、脸、鱼竿轨迹之间无穿模。 |
| 6 | 坐姿与睡姿 | 测约 `90°` 屈髋坐姿及床上侧躺闭眼。臀部落在坐板上，裤裆有压褶；侧躺时脸颊接枕，眼睑闭合，手臂与床面有接触。睡姿默认摘帽，帽子使用独立挂点。 |
| 7 | 帽内与脸部 | 从低机位、44° 与 52° 各看一遍。帽底有连续内表面和暖色反光，发根覆盖帽口。转头、眨眼、微笑时，眉眼无悬浮，腮红无圆片边界，嘴角无撕裂。 |
| 8 | 俯视识别 | 用实际 Shot 2、Shot 4 的正交尺度，各出 44° 和 52° 两张图。52° 时仍能区分草帽黄、奶油白、牛仔蓝；对比迈步的两个相反相位，应能从两袖位移及鞋头先后判断哪只手脚向前。 |
| 9 | 服装与零件接触 | 逐帧查帽带结、两扣、胸袋、背带交叉、袖卷、裤卷、鞋底。所有可见零件都有固定或接触位置；无悬空扣子、重叠闪烁、手指穿衣和鞋面穿裤脚。 |
| 10 | 游戏距离与最终材质 | 用生产相机、正式灯光和输出分辨率查看，再将人物缩至约 `96 px` 高复核。帽檐和两袖轮廓稳定，草编与车线无闪烁，眼睛有方向，外底不会缩成一条抢眼黑线。 |

## 5. 与 v2.1 海岸小镇的联合渲染

**先用 Shot 4 定角色，再回查 Shot 2 和 Shot 3。** Shot 4 同时包含草帽、亮天空、深水、暖木板和近距离脸部，最容易发现帽下脸过暗、白袖过亮、牛仔蓝混进海面的情况。三镜沿用同一套角色材质。光向、曝光和反弹光以各镜已有场景为准。以下色值是根据图 2 视觉关系拟定的 **sRGB 底色起点**。

| 色块 | 底色起点 | 联合渲染时看什么 |
|---|---|---|
| 草帽黄 | 主面 `#DBB765`，内檐 `#B68F50` | 帽冠亮面略暗于同光照下的奶油白袖子。内檐保留暖色，能看清鬓发接触线。 |
| 奶油白 | 受光底色 `#E9DFC5` | 亮袖保留布褶，背光侧接一点天光或水面灰青。与鱼市白纸包同框时，纸包可略亮。 |
| 牛仔蓝 | 主面 `#496D82`，暗面倾向 `#354F63` | 与海水同框时，裤子偏灰蓝，水面偏青绿。裤身用大块明暗，海水保留碎反光，两者缩小后仍可分辨。 |
| 肤色、栗发、棕靴 | 肤色 `#E9B892`，发 `#624535`，靴 `#805638` | 脸比周围木色略亮，帽下仍读得出鼻尖与颊面。发梢和靴底保留棕色，对应小镇木构的暖暗部。 |

| 镜头 | 角色调度与构图 | 灯光、材质与合成 |
|---|---|---|
| **Shot 2 · 码头** | 中远景先读出“孩子正往码头走”。把白袖放在深色木柱或屋檐阴影前，把蓝裤放在较亮甲板前。用前后错开的鞋头和反向摆臂表达步态。避免帽檐与远处屋顶边线恰好相切。 | 主光沿用建筑投影方向，阴影软硬匹配同一块甲板上的木桩。脚边加窄接触影，再接上场景方向影。水侧袖口可吃到少量青灰反光，远景草编纹理减弱。 |
| **Shot 3 · 鱼市** | 重现左下格的交流关系。孩子微抬下巴，眼神朝摊主，近侧肘离身少许，小手托住纸包下角。让眼睛、拇指和交接物形成清楚的三点关系，背景秤盘和挂鱼避开指尖轮廓。 | 遮阳篷提供大面积柔光，木台给下颌和手背一点暖反弹。纸包保留场景中最亮的小面积，脸颊次之。鼻下、帽檐和手指接触纸包处共用同一种柔边阴影。 |
| **Shot 4 · 栈桥垂钓** | 侧前 3/4。臀部坐实，腰背略向鱼漂前倾，肘靠近腰侧。杆柄穿过虎口，双靴自然垂落并有少许错位。给鱼竿弧线与水面浮漂留完整空间，近侧脸和手能同时读清。 | 帽冠、近侧颊面和鞋头承接同一束侧光。木板给裤腿下缘暖反光，水面给远侧袖子冷填充。最深接触影落在臀下、手握杆处和靴面叠合处。让人物边缘的软硬变化与旁边木桩、绳索一致。 |

**最终合镜判据。** 将三镜各导出一张彩色图及对应灰度图，以正常播放尺寸并排看。彩色图里，三镜都应先认出是同一个孩子，再读出走路、接物、等鱼三种不同动作。灰度图里，码头仍看得见摆臂，鱼市仍找得到递接的手，栈桥仍看得出臀部落在木板上、目光落向鱼漂。三处关系都成立，才算完成从角色设定到场景表演的交付。