## 1. 全家福统一比例标尺与差异化体态

以 **Player v2.0 的 1.260 m 站立总高**为标尺。三人沿用图 2 的肩袖连接、四指手、柔和面部着色和一体鞋底。阿莲的笑容、低发髻和递物时的身体前倾取自图 3 左下。图 1 保留三人的职业识别物，其中老周按新版设定改用深海蓝鸭舌帽。下列尺寸和坐标是本轮重雕的**设计定值**。本稿仅依据三张附图，`src/npcs.js` 的实际轴向、节点层级和动画幅度尚未核验。

### 1.1 尺寸与站姿

单位均为 **m**。总高从双脚落地面量到头饰最高点。头身比用「裸头站高 ÷ 解剖头高」计算，解剖头高从颅顶量到下巴，海伯的胡须尖另计。肩宽量左右肩峰，胸／腰／臀量自然站姿下衣物最外层的**正面横宽**，不含手臂、木锤和提灯。

| 项目 | 阿莲 `npc_market` | 老周 `npc_artisan` | 海伯 `npc_lighthouse` |
|---|---|---|---|
| 站立总高 | **1.280**，高于主角 20 mm | **1.310**，高于主角 50 mm | **1.350**，高于主角 90 mm |
| 裸头站高／头高／头身比 | 1.246／0.371／**3.36 头身** | 1.274／0.364／**3.50 头身** | 1.306／0.362／**3.61 头身** |
| 肩宽 | **0.348** | **0.386** | **0.420**，大衣外肩可到 0.460 |
| 胸／腰／臀宽 | **0.330／0.292／0.368** | **0.366／0.350／0.338** | **0.420／0.390／0.402**，大衣下摆展开至 0.450 |
| 年龄与体量 | 约 40 岁。面颊饱满，肩窄、腰线清楚，围裙从髋部柔和放开 | 约 60 岁。胸背厚、腰短，重量集中在胸廓和前臂。鬓发与笑纹带出年纪 | 约 72 岁。肩背最宽，颈略向前，腿仍站得稳。白眉、胡须与高领共同塑造下颌轮廓 |
| 自然站姿 | 肩线从颈侧向外落约 12°，肘屈 16°。重心略偏左脚，双手靠身前，随时能递出一包鱼 | 肩线外落约 10°，肘屈 20°。脚跟中心距 0.200，前臂自然向内，右肘与腰之间留出握工具的空间 | 肩线外落约 8°，左肘屈 14°、提灯右肘屈 22°。右手比左手更靠前、离身更远，双肩仍保持放松 |
| 远景第一识别点 | **红头巾、细腰、青绿围裙宽摆** | **低帽檐、厚前臂、短方皮围裙** | **宽软帽、白胡须、敞开大衣和右侧提灯** |

三人同框校尺时使用同一地面、正交相机和像素比例。不要为了排齐各自的头顶而单独缩放。阿莲和主角只差 20 mm，成年感主要靠肩胯、面部和动作表达。海伯的高度则要由躯干与腿共同撑起，避免把身高差全加到帽冠上。

### 1.2 六个 `Rig_*` 枢轴

以下为 **Blender 模型空间绝对坐标 `(X, Y, Z)`**，原点在两脚跟中心连线的地面投影，`+Z` 向上，角色面向 `−Y`。`L/R` 始终按**角色自身**命名，因此角色左肩是 `+X`，正面看海伯的提灯位于画面左侧。坐标给的是旋转中心，手臂的下垂角和屈肘形状建在绑定静姿里。

| 节点 | 阿莲 `(X, Y, Z)` | 老周 `(X, Y, Z)` | 海伯 `(X, Y, Z)` |
|---|---|---|---|
| `Rig_Torso` | `(0.000, 0.008, 0.545)` | `(0.000, 0.012, 0.558)` | `(0.000, 0.015, 0.578)` |
| `Rig_Head` | `(0.000, 0.002, 0.883)` | `(0.000, 0.002, 0.918)` | `(0.000, −0.004, 0.950)` |
| `Rig_ArmL` | `(+0.174, 0.002, 0.841)` | `(+0.193, 0.005, 0.865)` | `(+0.210, 0.007, 0.891)` |
| `Rig_ArmR` | `(−0.174, 0.002, 0.841)` | `(−0.193, 0.005, 0.865)` | `(−0.210, 0.007, 0.891)` |
| `Rig_LegL` | `(+0.088, 0.006, 0.513)` | `(+0.095, 0.010, 0.526)` | `(+0.102, 0.012, 0.546)` |
| `Rig_LegR` | `(−0.088, 0.006, 0.513)` | `(−0.095, 0.010, 0.526)` | `(−0.102, 0.012, 0.546)` |

**绑定与接入约束**

- **挥手。** 肩枢轴落在袖山内部的肩峰处。锁骨侧和腋下由躯干、上臂共同带动，权重从领口向袖筒逐圈过渡。腰带、围裙主体和大衣前襟由躯干带动。若运行时只驱动整条 `Rig_Arm*`，静姿里的微屈肘和腕角也应成立。
- **点头。** `Rig_Head` 放在耳垂连线下方、接近头颈连接处。头巾、帽、头发、眉毛、八字胡和落腮胡随头转。海伯的高领、围巾结留在胸前，胡须下缘与衣领之间预留点头空间。
- **右手提灯。** 海伯的提梁与右掌共用握点，由 `Rig_ArmR` 驱动。建议静姿握点为 **`(−0.306, −0.098, 0.538)`**，灯体最宽 0.104，握点到灯底 0.205。先用这一净空摆好大衣和手臂，再雕手指。若增加提梁活动轴，轴放在握点，限制其向大衣内侧摆动的角度。
- **导出。** 沿用 Player v2.0 已验证的节点类型、局部轴、层级和绑定静姿。上表是绝对位置，建父子关系时须换算为父空间。每个角色实例内部的六个动画目标各出现一次，保留准确大小写。最终以游戏对导出模型实际执行的挥手、点头和提灯动作验收。

## 2. 三位 NPC 的有机形体与材质重雕

**共同制作基线。** 直接复用图 2 主角的眼睛尺度、鼻口简化程度、袖口厚度和靴底圆角作为近景参照。上衣从颈根经锁骨、肩峰一直放样到袖筒，腋下留布量。以 3–5 圈连续边环完成肩袖变形，再按 90° 抬臂结果修正权重。手采用一拇指加三指，掌心有厚度，指根并入掌面。鞋面、包头与鞋底共用连续外轮廓，鞋底色沿侧墙转折分区。

材质采用 **2048 px 手绘水粉底色与柔和 AO**，对齐图 2 的近景密度。下表色号为 **sRGB 底色**，粗糙度建议为 Blender Principled BSDF 的 Roughness。脸颊使用沿面颊曲率展开的低强度渐变，鼻翼、耳缘和下眼睑少量呼应。AO 集中在帽檐内、布料叠压、口袋根部和鞋面翻折处，脸周和肩袖保留干净亮面。

### 2.1 阿莲 `npc_market` · 渔市老板娘

- **头与脸。** 以图 3 左下的笑容为准。先抬颊，再让下眼睑随之上提，嘴角一侧略高。日常对话留得见瞳孔，递物笑时眼睛可收成柔弧。红润从颧面外侧向鼻侧消散。头巾顺额头绕到枕骨下方打结，一条巾尾稍长。低发髻从布结下方露出深棕体块，正侧面都能读出布与发的前后关系。
- **肩袖与围裙。** 奶油白衬衣从颈侧自然滑向肩峰，短袖在肘上方形成薄卷边，卷层厚约 5–7 mm。孔雀青围裙在腰带下方分出两三条浅褶，越接近下摆越平。前兜上缘受自重轻垂，袋角缝回围裙。后腰蝴蝶结压在腰带上，两条尾带长短有别，后视避开头巾结的中轴。
- **脚与动作。** 暖棕工作鞋包头圆、脚背低，鞋底前端略上翘。递鱼包时，躯干从髋部略前倾，前臂先向身前靠拢，手掌托物。肩膀保持下沉，保留图 3 中与孩子说话时的亲近感。

| 部位 | 精确 sRGB 色值 | 表面处理 |
|---|---|---|
| 珊瑚红头巾 | 主色 `#CB5949`，折影 `#A7453B`，受光 `#E78167` | 粗糙度 0.84，棉纹沿巾尾转折 |
| 深棕发髻／眉／瞳 | `#493329`／`#593B2D`／`#30251F` | 发束做宽瓣，避免密集刻丝 |
| 肤色／颊红／唇 | `#EDBE98`／`#DF917C`／`#A45E50` | 颊红中心建议以 20–30% 强度混入底色 |
| 奶油白衬衣 | 底 `#F2E6CA`，叠布阴影 `#D7C8A9` | 粗糙度 0.88，保留暖色反光 |
| 孔雀青围裙／系带 | 底 `#287E75`，褶影 `#205E59`，磨亮边 `#55A092` | 粗糙度 0.82，兜口窄边略亮 |
| 裤脚／鞋面／鞋底 | `#344C54`／`#90603C`／`#64442F` | 鞋面粗糙度 0.60，鞋底 0.78 |

### 2.2 老周 `npc_artisan` · 渔具工匠

- **帽、鬓发与八字胡。** 鸭舌帽冠前低后饱，短帽檐在侧面形成清楚的前突。灰棕鬓发在帽口处压扁，到耳后恢复厚度，后脑留一圈短发。八字胡从人中两侧长出，胡梢向外略翘，中央留出笑时可见的唇线。颧面较宽，眼尾各有一条短笑纹。
- **手臂与衬衣。** 上背稍厚，肩线连续滑入上臂。暖米白工装袖卷到肘下，肘内侧挤出两道短褶，肘外侧布面拉平。前臂最宽处靠肘，向手腕收细。左掌可半摊，右手可虚握，让工匠手在全身像里也读得出来。
- **围裙与工具。** 焦糖皮围裙上窄下方，下缘停在膝上。胸袋口做出厚度，袋内露一截钝头木柄。黄铜铆钉只放在袋角、带根等受力点。后交叉皮带在肩胛间相交，能从背面一路追到腰侧。小木锤挂角色左腰、绕线轴挂右腰，二者贴近髋侧，为前臂摆动留空。皮面磨亮集中在胸袋口、腰前和下缘。
- **裤靴。** 深卡其裤在膝下有少量积褶。靴头比阿莲宽，鞋底厚约 20 mm，后跟饱满。通过包头宽度、鞋帮折线和底沿厚度表现工作靴的重量。

| 部位 | 精确 sRGB 色值 | 表面处理 |
|---|---|---|
| 深海蓝鸭舌帽 | 帽冠 `#35536A`，帽檐 `#293F50`，受光 `#526E7B` | 粗糙度 0.86，压旧斜纹布 |
| 灰棕头发／八字胡／瞳 | `#74685C`／`#827467`／`#322A25` | 胡梢受光略亮于鬓发 |
| 肤色／暖颊／鼻尖 | `#DDB08B`／`#CB8F75`／`#C98169` | 红润沿颊骨横向铺开 |
| 暖米白衬衣 | 底 `#E9DEC3`，卷袖里层 `#CDBD9E` | 粗糙度 0.88，袖口有洗旧感 |
| 焦糖旧皮围裙 | 底 `#AB7042`，暗面 `#795036`，磨亮 `#C28B57` | 常规粗糙度 0.66，常摸处 0.51 |
| 铆钉／木锤／绕线 | `#AE854B`／`#866041`／`#CCBA91` | 金属反光集中在凸起边，木纹顺柄 |
| 深卡其裤／靴面／靴底 | `#68634A`／`#715039`／`#4D392D` | 裤面 0.90，靴面 0.63 |

### 2.3 海伯 `npc_lighthouse` · 灯塔守望者

- **帽、眉与胡须。** 船长软帽的帽冠宽于头颅，侧后方略塌，暗金装饰线只沿帽檐上缘走一圈。浓白眉内侧略高，眉下留出完整笑眼。银白落腮胡用两颊、下颌和下巴几组大绺构出蓬度，远看有清楚的下收轮廓。鼻尖偏暖，胡须上缘绕开鼻翼，嘴角留一小段可见笑线。
- **毛衣、围巾与大衣。** 奶油白高领包住颈根，粗针纹集中在领口、胸前开口和袖口可见区。珊瑚红围巾结偏向角色左侧，从白胡须外缘露出。大衣肩背最宽，侧缝在腰部收进，再向下摆放开。两列各三颗黄铜扣随左右前片的弧面走。下部前襟微开，露出深裤与两腿间隙，背面开短衩。宽肩、收腰和分开的下摆须在纯色轮廓图中成立。
- **右手提灯。** 先把提梁落在四指手的三根屈指上，再让拇指从对侧合拢。提梁在虎口两端各露一段，近景能看到手如何承重。黄铜上盖和底座夹住略带烟色的玻璃，中央保留一枚能辨认轮廓的暖光灯芯。提灯从角色自身右侧垂下，正面读得到灯和衣摆之间的纸底。
- **渔靴。** 高帮覆盖裤脚，靴身深青灰，宽底在前掌略外扩。防水表面有宽而柔的高光。与老周沉厚的棕皮靴相比，海伯的辨识点是更高的靴筒和连续光滑的包脚面。

| 部位 | 精确 sRGB 色值 | 表面处理 |
|---|---|---|
| 船长软帽／帽檐／暗金线 | `#293E53`／`#253341`／`#A58B59` | 帽布粗糙度 0.86，金线低反差 |
| 银白落腮胡／白眉 | 胡底 `#DAD8CB`，胡影 `#B5B8AE`，眉峰 `#EEE8D8` | 绺与绺之间用暖灰分层 |
| 肤色／鼻尖／瞳 | `#E1B398`／`#CF8A78`／`#302B28` | 鼻尖颜色向鼻梁和鼻翼渐退 |
| 高领毛衣／针织阴影 | `#EEE3C9`／`#CFC4AB` | 粗糙度 0.93，领口纹理最清楚 |
| 围巾／结部阴影 | `#C75E4D`／`#9A493F` | 粗糙度 0.84，结形优先于布纹 |
| 深海蓝呢大衣 | 底 `#30566A`，折影 `#263F50`，翻领受光 `#486D7B` | 粗糙度 0.92，用大块明暗交代前襟 |
| 铜扣／灯体／提梁暗部 | `#B39459`／`#AF864A`／`#705738` | 实体黄铜金属度 0.85，粗糙度 0.40–0.48 |
| 玻璃着色／灯芯／火焰中心 | `#D8E0D7`／`#E9A34F`／`#FFE2A0` | 玻璃仅轻微着色，以游戏曝光下灯芯仍清楚为准 |
| 长裤／高帮渔靴／靴底 | `#414B50`／`#364B4C`／`#293636` | 靴面粗糙度 0.48，底沿 0.72 |

## 3. 六套英文分镜 Prompt

每段可独立使用。四视图统一从**角色右前方 35°**拍 Hero 位，便于检查海伯的握灯手。第三格统一看角色自身左侧，因此允许远侧道具被身体自然遮挡。生成细节表时，把该角色选定的四视图一并作为参考，锁定脸型、左右手、结位和道具位置。

### `PROMPT_AHLIAN_TURNAROUND`

```text
Create a production character turnaround for Ah Lian, the adult fish-market owner of Stillwater Lagoon. Use reference 1 for her identity, reference 2 for the approved Player v2.0 sculpt language, and the lower-left panel of reference 3 for her raised cheeks, low dark bun and welcoming expression. Match the player's small dark eyes, soft facial planes, continuous shoulders, four-digit hands and integrated footwear. Hand-painted gouache over softly lit sculpted forms, subtle brush variation, gentle contact shadows.

A single 3:1 landscape sheet. Four equally spaced, full-body orthographic views in this exact left-to-right order: straight Front, 35-degree Hero from her anatomical right, true anatomical Left Side, straight Back. Identical model, neutral relaxed pose, camera elevation, head size, sole baseline and scale in all four views. Leave air above her headscarf and below her soles. Plain pale warm paper, no scenery, lettering, labels, borders or panel lines.

She is 1.280 m tall including the scarf, a mature woman around forty. Soft narrow sloping shoulders, defined waist, fuller hips, elbows bent about 16 degrees, hands slightly forward. Coral cotton headscarf #CB5949 tied at the nape with unequal hanging ends; a full dark-brown low bun #493329 visible beneath the knot. Warm smile, open kind eyes, diffuse cheek blush fading into skin. Cream blouse #F2E6CA with softly rolled short sleeves. Peacock-teal apron #287E75 with shallow waist folds, one sagging front pocket, a visible rear waist bow and softly widening hem. Muted dark trouser cuffs, warm brown round-toe shoes #90603C with continuous low soles. Keep shoulder-to-sleeve contours unbroken. No blush discs, plastic joint balls, detached sleeves or stacked torso pieces.
```

### `PROMPT_AHLIAN_DETAILS`

```text
Create a 4:3 landscape character detail sheet of Ah Lian, the same 1.280 m fish-market owner as the approved turnaround. Lock her face, low bun, scarf tails, bow placement, apron cut and colors to that model. Match the Player v2.0 reference for soft sculpted anatomy, gouache shading, naturally rolled sleeves and four-digit hands. Four equally sized studies in a 2-by-2 arrangement, separated only by blank pale warm paper. No text, lettering, frames, grid lines or scenery.

Upper left: a close right three-quarter portrait from crown to collar. Show the coral #CB5949 scarf wrapping over the hair, the low dark bun and unequal tails visible behind the ear. Lift the cheeks and lower eyelids into the fish-market smile from storyboard panel three. Carry warm blush smoothly across the cheek plane.
Upper right: a rear three-quarter crop from shoulders to upper thighs. Show the cream blouse flowing into the shoulders, the peacock-teal #287E75 apron ties bearing tension around the waist, a soft rear bow, and folds releasing toward the hem. The short scarf knot sits clearly above the waist bow.
Lower left: two enlarged construction studies sharing the same open quadrant: a rolled sleeve, bent elbow and open palm with one thumb and three fingers; beside it, one low warm-brown work shoe in side view showing the toe turning into the sole.
Lower right: one complete three-quarter action silhouette, leaning forward from the hips to pass a small paper-wrapped fish parcel to a child just outside the frame. Both hands support the parcel, shoulders stay low, feet stay planted, and the front apron pocket is visible. Keep the gesture readable at thumbnail size. No ball joints or blush stickers.
```

### `PROMPT_LAOZHOU_TURNAROUND`

```text
Create the production turnaround of Lao Zhou, the fishing-tackle artisan of Stillwater Lagoon, around sixty. Use reference 1 for the artisan's identity and tool apron, reference 2 for the approved Player v2.0 sculpt and material language, and reference 3 for the village craftsman's easy warmth. Use the redesigned deep-sea-blue flat cap. Softly lit three-dimensional forms with hand-painted gouache surfaces, broad quiet highlights and subtle brushwork.

One 3:1 landscape sheet, four equally spaced full-body orthographic views: straight Front, 35-degree Hero from his anatomical right, true anatomical Left Side, straight Back. Lock the same pose, scale, baseline, outfit and camera elevation. Show the entire bill and both boot soles. Pure pale warm paper, no labels, letters, scenery, frames or dividing lines.

Height 1.310 m including cap. A compact thick rib cage, short sturdy waist, wide-set boots and strong tapering forearms. Sloped shoulders, elbows naturally bent about 20 degrees. Low deep-sea-blue flat cap #35536A with a short projecting bill, compressed gray-brown temple hair and a visible rear hairline. Gentle upturned two-part moustache, warm cheeks with blended color and a visible smiling mouth. Warm ivory work shirt #E9DEC3, sleeves rolled just below the elbows. Old caramel leather apron #AB7042, squared knee-high hem, raised chest tool pocket, sparse brass load-bearing rivets and two crossed rear leather straps. Hang a small wooden mallet on his anatomical left hip and a line spool on his right; retain these sides in every view. Dark khaki work trousers #68634A and heavy round brown boots #715039 with thick integrated soles. Emphasize the cap bill, forearm mass and short apron silhouette. No shoulder spheres, segmented elbows, plastic shine or separate sole slabs.
```

### `PROMPT_LAOZHOU_DETAILS`

```text
Create a 4:3 landscape, 2-by-2 production detail sheet of Lao Zhou, the same fishing-tackle artisan as his approved turnaround. He is 1.310 m tall in his deep-sea-blue cap. Lock the moustache, facial age, arm thickness, pocket shape, straps and tool sides. Use the Player v2.0 reference for soft continuous anatomy, four-digit hands and integrated boots. Hand-painted gouache surfaces on gently lit sculpted forms. Separate the four studies with plain pale warm paper. No writing, borders, visible grids or background scene.

Upper left: head close-up, slight three-quarter angle. Study the short flat-cap bill #35536A, compressed gray-brown temple hair, warm cheeks and two softly lifted moustache tips. Leave the smile line visible between and beneath the moustache halves.
Upper right: close front three-quarter torso, collar to apron hem. Show the ivory rolled work shirt, old caramel leather #AB7042, chest tool pocket with a blunt wooden handle, brass rivets at stress points, edge wear around the pocket mouth, left-hip mallet loop and right-hip line spool. Keep leather wear broad and selective.
Lower left: two enlarged studies sharing the open quadrant: a thick tapering forearm bending out of a rolled sleeve, four-digit fingers loosely holding a wooden handle; beside it, one heavy brown work boot with a full toe, creased upper and continuous thick sole.
Lower right: complete rear three-quarter action silhouette as he shifts his weight to inspect a fishing line held in front. Keep the elbows clear of the waist, expose the two crossed back straps and show the left-hip mallet hanging below his forearm. The short cap bill and squared apron hem must read in silhouette. No plastic shoulder caps or bead-shaped hands.
```

### `PROMPT_HAIBO_TURNAROUND`

```text
Create the production turnaround of Hai Bo, the elderly lighthouse keeper of Stillwater Lagoon. Preserve the identity and right-hand lantern from reference 1. Match the approved Player v2.0 in reference 2 for facial simplification, soft shoulder anatomy, integrated footwear and painted surface quality. Use the coastal warmth and gouache palette of reference 3. Broad softly lit forms, restrained cloth texture, gentle contact shadows.

One 3:1 landscape canvas. Four equal full-body orthographic views, left to right: straight Front, 35-degree Hero from his anatomical right so the lantern grip is visible, true anatomical Left Side, straight Back. Same character, standing pose, scale, camera elevation and sole baseline. In Front the lantern is on the viewer's left. Let the far-side lantern be naturally occluded in Left Side. Plain pale warm paper, no scenery, text, labels, borders or dividing lines.

Height 1.350 m including cap, early seventies, broad shoulders, slightly forward neck, firm stance. Soft navy captain's cap #293E53 with a single muted gold brim line. Full silver-white beard #DAD8CB shaped in broad tapered locks, thick white brows, kind visible eyes, rosy nose tip. Cream chunky turtleneck #EEE3C9, small coral sailor-scarf knot #C75E4D visible on his anatomical left. Deep ocean-blue wool coat #30566A, two rows of three brass buttons, gently shaped waist, parted front hem, short rear vent. Dark trousers, tall waterproof blue-green boots. His anatomical right elbow bends about 22 degrees. His right hand carries an antique brass-and-glass storm lantern by the top handle, with three curled fingers and an opposing thumb. Expose the handle on both sides of the grip. Hang the lantern clear of the coat, with transparent glass, brass cap and base, one small warm wick. Left hand relaxed. No switched hands, barrel-shaped coat, plastic joints or floating lantern.
```

### `PROMPT_HAIBO_DETAILS`

```text
Create a 4:3 landscape character detail sheet, four equally sized studies arranged 2 by 2, of Hai Bo, the same 1.350 m lighthouse keeper as his approved turnaround. Retain his face, shoulder breadth, coat cut and anatomical right-hand lantern. Match the Player v2.0 reference for soft sculpted anatomy, four-digit hands, continuous cloth and hand-painted gouache shading. Use blank pale warm paper between the studies. No words, frames, grid lines or scenic props.

Upper left: a close three-quarter portrait. Show the soft navy captain's cap and its subdued gold brim line, silver-white brow masses lifted above his warm eyes, rosy nose and broad beard locks narrowing below the jaw. Leave the corners of his smile visible.
Upper right: a torso study, neck to coat hem. Show the cream chunky turtleneck, coral scarf knot emerging to his anatomical left of the beard, deep-blue wool lapels, two curved rows of three brass buttons, a shaped waist and a gently opening front hem revealing dark trousers.
Lower left: a large right-hand lantern grip study, from bent elbow to lantern base. Place the curved brass handle inside three curled fingers, opposed by the thumb, with the handle emerging on both sides of the palm. Show the gap to the wool coat, the brass cap and base, lightly tinted transparent glass and a small amber wick. Preserve the glass silhouette around the flame.
Lower right: complete front-right three-quarter silhouette during one measured walking step. The left boot advances, the right elbow stays soft and the lantern hangs outside the right coat edge. Show both high waterproof boot shafts, the coat opening around the legs and a clear strip of paper between lantern and hem. Keep the flame small enough for daylight. No hand swap, clipping, plastic joint balls or rigid tubular coat.
```

## 4. Blender 零失误自检硬标准

以下为**交付验收条件**。每项都应在最终导出的角色上复查，尤其是游戏实机的动画、材质和俯视镜头。

| 检查项 | 操作 | 通过条件 |
|---|---|---|
| 总高与比例 | 四人脚底对齐，以同一正交相机拍正面和侧面。读取三位 NPC 从鞋底到头饰最高点的包围高度 | 阿莲 **1.280 m**、老周 **1.310 m**、海伯 **1.350 m**，误差各 ≤2 mm。阿莲腰胯、老周胸背和海伯外肩在同一比例下清楚可辨 |
| 节点与左右手 | 在每个导出角色实例内查找六个 `Rig_*`，单独驱动左右臂、左右腿和头，再播放现有 `src/npcs.js` 动作 | 六个目标均唯一命中，轴向、动作方向和复位姿势正确。驱动海伯 `Rig_ArmR` 时，角色自身右掌与提灯同步移动 |
| 90° 肩袖 | 左右臂分别由自然下垂抬到上臂水平，再连续放下。前、后、腋下三个角度检查 0°、45°、75°、90° 和回程 | 肩峰至袖山轮廓连续；无透底裂缝、裸露球面、翻面或腋下尖刺。袖口保持厚度，领口和围裙腰带保持在原位 |
| 对话点头与头饰 | 先跑实际对话点头，再做低头 12°、仰头 8°、左右转头各 25° 的组合检查 | 头巾、帽和头发同步。帽冠、帽檐和头巾外表面无发丝穿出。阿莲的巾结与发髻都可辨，海伯的胡须不穿过围巾结，笑眼仍可见 |
| 手与脸近景 | 以图 2 面部和袖口特写的裁切比例，检查正面、35° 和侧面，并转动主光 | 每手一拇指加三指，虎口和指根连续。腮红边缘无色圈，侧光下无凸贴片。三人的笑容分别由抬颊、胡梢和眉眼读出 |
| 阿莲围裙与老周工具 | 检查背面，再播放递物、挥手和迈步极值。观察后腰结、两根交叉带、锤柄和线轴 | 阿莲前兜、后结有明确厚度与受力方向。老周皮带可追踪到腰侧，木锤始终在角色左侧、线轴在右侧。工具不穿手肘、大腿或围裙外表面 |
| 海伯提灯 | 正面确认画面左侧握灯。逐帧检查实际待机、点头、挥手和摆臂循环，并检查右臂测试范围的两个极值 | 提梁始终落在掌内，手指不脱把。**灯体到大衣下摆静姿净距 ≥15 mm，动作全过程净距 ≥5 mm**。玻璃与铜座不穿腿、不穿衣，暖光灯芯在实机曝光下仍有清楚边缘 |
| 鞋底与步姿 | 在水平地面检查静姿、抬脚和落地瞬间，再从侧面看包头、鞋底与脚跟 | 静姿承重脚接地误差 ≤2 mm，动作中鞋底随脚整体转动。阿莲低圆鞋、老周宽厚工靴、海伯高帮渔靴缩小后仍可区分 |
| 52° 俯视辨识 | 镜头从水平视线向下俯 **52°**，固定焦距和同一世界比例，拍三人正常游戏尺寸的彩色图及纯黑剪影。再分别缩至约 96 px 人物高度复核 | 彩色图一眼能分出阿莲的**珊瑚红／孔雀青**、老周的**蓝帽／焦糖皮**、海伯的**白胡／深蓝大衣／铜灯**。纯剪影下仍能凭低发髻与宽裙摆、短帽檐与腰锤、宽肩与悬灯逐一指认 |
| 最终同框 | 把导出后的三人和获批 Player v2.0 放进同一游戏场景、同一光照，截取正面、35°、背面和实际游玩镜头 | 四人眼睛、高光、腮红、衣褶尺度和鞋底处理属于同一套美术语言。实机挥手、点头和右手提灯全部回放通过后，方可将本轮重雕标记为验收完成 |