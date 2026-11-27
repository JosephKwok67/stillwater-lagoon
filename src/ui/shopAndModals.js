import {
  ROD_CATALOG,
  BAIT_CATALOG,
  PORTRAITS,
  getFishIconUrl,
} from '../core/assetRegistry.js';
import { WEATHER_CYCLE, WEATHER_NAMES } from '../core/sleepSequence.js';

/**
 * Village UI Modals & Drawers Controller:
 * - Ah Lian Fish Market (daily 1.5x hot species) & Old Zhou Tackle Shop
 * - NPC Storybook Dialogue Scripts (Ah Lian, Old Zhou, Hai Bo)
 * - Portable Fish Basket & Home Indoor Aquarium Transfer Drawers
 * - Interactive 25-Species Fish Guide Drawer
 */
export function createShopAndModals({
  gameState,
  ecosystem,
  specMap,
  playerAvatar,
  playerController,
  dialogueSystem,
  voiceBlip,
  atmosphere,
  cameraDirector,
  syncWeatherUI,
  showToast,
}) {
  const shopModalEl = document.getElementById('shop-modal');
  const shopNpcPortraitEl = document.getElementById('shop-npc-portrait');
  const shopTitleEl = document.getElementById('shop-title');
  const shopSubtitleEl = document.getElementById('shop-subtitle');
  const shopCoinsEl = document.getElementById('shop-coins');
  const shopContentEl = document.getElementById('shop-content');
  const shopFooterEl = document.getElementById('shop-footer');

  const aquariumModal = document.getElementById('aquarium-modal');
  const basketModal = document.getElementById('basket-modal');
  const fishPanel = document.getElementById('fish-panel');
  const tweakPanel = document.getElementById('tweak-panel');
  const fishListContainer = document.getElementById('fish-catalog-list');

  const shopState = { open: false, mode: 'market' };

  function getDailyHotSpeciesIds() {
    const day = gameState.data.day || 1;
    const list = ecosystem.speciesCatalog;
    const i1 = (day * 7 + 2) % list.length;
    const i2 = (day * 13 + 9) % list.length;
    return new Set([list[i1].id, list[i2 === i1 ? (i2 + 1) % list.length : i2].id]);
  }

  function getFishSellPrice(fishRec) {
    const base = fishRec.price || 28;
    const hot = getDailyHotSpeciesIds().has(fishRec.speciesId);
    return hot ? Math.round(base * 1.5) : base;
  }

  function openShop(mode) {
    shopState.open = true;
    shopState.mode = mode;
    shopModalEl?.classList.remove('hidden');
    playerController.clearKeys();
    renderShopContent();
  }

  function closeShop() {
    if (!shopState.open) return;
    shopState.open = false;
    shopModalEl?.classList.add('hidden');
  }

  function renderShopContent() {
    if (!shopContentEl || !shopFooterEl) return;
    if (shopCoinsEl) shopCoinsEl.textContent = String(gameState.data.coins);
    shopContentEl.innerHTML = '';
    shopFooterEl.innerHTML = '';

    if (shopState.mode === 'market') {
      const hotIds = getDailyHotSpeciesIds();
      const hotNames = Array.from(hotIds)
        .map((id) => specMap.get(id)?.nameZh || id)
        .join('、');

      if (shopNpcPortraitEl) shopNpcPortraitEl.src = PORTRAITS.npc_market.happy;
      if (shopTitleEl) shopTitleEl.textContent = '阿莲渔市收购摊';
      if (shopSubtitleEl) shopSubtitleEl.textContent = `第 ${gameState.data.day} 天行情 · 高价鱼享受 1.5 倍溢价`;

      const banner = document.createElement('div');
      banner.className = 'shop-hot-banner';
      banner.textContent = `🔥 今日高价收购鱼（1.5x）：${hotNames}`;
      shopContentEl.appendChild(banner);

      const fishes = gameState.data.inventory.filter((i) => i.kind === 'fish');
      if (!fishes.length) {
        const empty = document.createElement('div');
        empty.className = 'shop-empty';
        empty.textContent = '随身鱼护里暂时没有鱼哦！先去湖里甩几竿，钓到鱼再带给阿莲估价吧～';
        shopContentEl.appendChild(empty);
      } else {
        let totalAll = 0;
        for (const f of fishes) {
          const sp = specMap.get(f.speciesId);
          const isHot = hotIds.has(f.speciesId);
          const salePrice = getFishSellPrice(f);
          totalAll += salePrice;
          const iconUrl = getFishIconUrl(f.speciesId, sp);

          const row = document.createElement('div');
          row.className = 'shop-row';
          row.innerHTML = `
            <img class="shop-item-img" src="${iconUrl || ''}" alt="${sp?.nameZh || ''}" />
            <div class="shop-item-info">
              <div class="shop-item-name">
                ${sp?.nameZh || f.speciesId}
                <span class="aq-grade">${f.grade || '普通'}</span>
                ${isHot ? '<span class="shop-hot-tag">今日 1.5x</span>' : ''}
              </div>
              <div class="shop-item-desc">体长 ${f.lengthCm} cm · 收购价 ${salePrice} 贝币</div>
            </div>
          `;
          const btn = document.createElement('button');
          btn.className = 'shop-buy-btn sell';
          btn.textContent = `卖出 +${salePrice}`;
          btn.addEventListener('click', () => {
            const res = gameState.sellFishFromInventory(f.uid, salePrice);
            if (res) {
              voiceBlip.playCoinChime();
              showToast({
                text: `阿莲收下了「${sp?.nameZh}」，入账 +${res.earned} 贝币！`,
                portrait: 'npc_market',
                mood: 'happy',
              });
              renderShopContent();
            }
          });
          row.appendChild(btn);
          shopContentEl.appendChild(row);
        }

        const summary = document.createElement('span');
        summary.className = 'shop-item-desc';
        summary.textContent = `共 ${fishes.length} 条渔获 · 合计可售 ${totalAll} 贝币`;
        const btnAll = document.createElement('button');
        btnAll.className = 'shop-buy-btn sell';
        btnAll.textContent = `一键全部卖出 (+${totalAll} 贝币)`;
        btnAll.addEventListener('click', () => {
          const res = gameState.sellAllFishFromInventory(getFishSellPrice);
          if (res.count > 0) {
            voiceBlip.playCoinChime();
            showToast({
              text: `阿莲：「好丰收！共收下 ${res.count} 条新鲜渔获，给你 ${res.totalEarned} 贝币！」`,
              portrait: 'npc_market',
              mood: 'surprised',
            });
            renderShopContent();
          }
        });
        shopFooterEl.append(summary, btnAll);
      }
    } else {
      if (shopNpcPortraitEl) shopNpcPortraitEl.src = PORTRAITS.npc_artisan.happy;
      if (shopTitleEl) shopTitleEl.textContent = '老周渔具工坊商店';
      if (shopSubtitleEl) shopSubtitleEl.textContent = '手工鱼竿与特制鱼饵，钓大鱼更得心应手';

      const rodHeader = document.createElement('div');
      rodHeader.className = 'shop-section-title';
      rodHeader.textContent = '🎣 手工钓竿（购买后自动装备，底部可随时切换）';
      shopContentEl.appendChild(rodHeader);

      for (const rod of ROD_CATALOG) {
        const owned = gameState.data.equipment.ownedRods.includes(rod.id);
        const equipped = gameState.data.equipment.rodId === rod.id;
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <img class="shop-item-img" src="${rod.icon}" alt="${rod.nameZh}" />
          <div class="shop-item-info">
            <div class="shop-item-name">${rod.nameZh}</div>
            <div class="shop-item-desc">射程 ${rod.castRange}m · 拉力 ×${rod.power} · ${rod.desc}</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = `shop-buy-btn ${equipped ? 'equipped' : ''}`;
        btn.textContent = equipped ? '已装备' : owned ? '装备' : `${rod.price} 贝币购买`;
        btn.addEventListener('click', () => {
          const res = gameState.buyRod(rod);
          if (!res.ok) {
            showToast({ text: res.reason, portrait: 'npc_artisan', mood: 'thinking' });
            return;
          }
          playerAvatar.setRodStyle(rod.id);
          voiceBlip.playCoinChime();
          showToast({
            text: res.equippedOnly
              ? `已换上「${rod.nameZh}」！`
              : `老周：「好眼光！这根「${rod.nameZh}」我已经帮你配好线轮装上了！」`,
            portrait: 'npc_artisan',
            mood: 'happy',
          });
          renderShopContent();
        });
        row.appendChild(btn);
        shopContentEl.appendChild(row);
      }

      const baitHeader = document.createElement('div');
      baitHeader.className = 'shop-section-title';
      baitHeader.textContent = '🪱 特制鱼饵（每包 5 份，吸引对应水层鱼群）';
      shopContentEl.appendChild(baitHeader);

      for (const bait of BAIT_CATALOG) {
        const curQty = gameState.data.equipment.baitCounts[bait.id] || 0;
        const packPrice = bait.price * 5;
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <img class="shop-item-img" src="${bait.icon}" alt="${bait.nameZh}" />
          <div class="shop-item-info">
            <div class="shop-item-name">${bait.nameZh} <span class="aq-grade">持有 ${curQty}</span></div>
            <div class="shop-item-desc">吸引：${bait.targetHint}</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'shop-buy-btn';
        btn.textContent = `${packPrice} 贝币 / 5份`;
        btn.addEventListener('click', () => {
          const res = gameState.buyBaitPack(bait, 5);
          if (!res.ok) {
            showToast({ text: res.reason, portrait: 'npc_artisan', mood: 'thinking' });
            return;
          }
          voiceBlip.playCoinChime();
          showToast({
            text: `购买了 5 份「${bait.nameZh}」，已顺手装上鱼钩！`,
            portrait: 'npc_artisan',
            mood: 'happy',
          });
          renderShopContent();
        });
        row.appendChild(btn);
        shopContentEl.appendChild(row);
      }

      const tip = document.createElement('span');
      tip.className = 'shop-item-desc';
      tip.textContent = '提示：赚够贝币升级远洋海钓竿，挑战东海黄鳍金枪鱼更轻松！';
      shopFooterEl.appendChild(tip);
    }
  }

  document.getElementById('btn-close-shop')?.addEventListener('click', closeShop);

  function startNpcConversation(npc) {
    playerController.clearKeys();
    npc.setTalking(true);
    cameraDirector.setMode('dialogue', npc.id);

    const restoreCamera = () => {
      npc.setTalking(false);
      if (!shopState.open) {
        cameraDirector.setMode(gameState.data.insideBuildingId ? 'indoor' : 'walking');
      }
    };

    if (npc.id === 'npc_market') {
      const hotNames = Array.from(getDailyHotSpeciesIds())
        .map((id) => specMap.get(id)?.nameZh || id)
        .join('」和「');
      const fishCount = gameState.data.inventory.filter((i) => i.kind === 'fish').length;

      dialogueSystem.open(
        {
          speakerId: 'npc_market',
          speakerName: '渔市老板娘 · 阿莲',
          role: '渔获收购与鱼讯',
          lines: [
            {
              mood: 'happy',
              text:
                fishCount > 0
                  ? `哟，小渔夫回来啦！看你鱼护沉甸甸的，今天装了 ${fishCount} 条新鲜渔获呢！`
                  : '早安呀小渔夫！今天泻湖水面亮堂堂的，正适合划着红木小船出去转转。',
            },
            {
              mood: 'neutral',
              text: `偷偷告诉你，今天镇上酒馆最抢手的是「${hotNames}」，钓到了拿来我这儿，直接按 1.5 倍高价收！`,
            },
          ],
          choices: [
            { label: `🐟 出售鱼护里的渔获（${fishCount} 条）`, primary: true, onSelect: () => openShop('market') },
            {
              label: '💬 聊聊大房子和镇上近况',
              onSelect: () => {
                dialogueSystem.open(
                  {
                    speakerId: 'npc_market',
                    speakerName: '渔市老板娘 · 阿莲',
                    role: '渔获收购与鱼讯',
                    lines: [
                      {
                        mood: 'happy',
                        text: '等你多攒些贝币，听说镇里以后还会开放更大的带厨房木屋呢！到时候自己煎条真鲷，想想都香～',
                      },
                      {
                        mood: 'surprised',
                        text: '对了，最稀有的王冠大鱼别急着全卖了，留几条放进自家屋里的大鱼缸养着，每天回家看一眼可治愈了！',
                      },
                    ],
                  },
                  restoreCamera
                );
              },
            },
            { label: '👋 一会儿再来', onSelect: () => {} },
          ],
        },
        restoreCamera
      );
    } else if (npc.id === 'npc_artisan') {
      dialogueSystem.open(
        {
          speakerId: 'npc_artisan',
          speakerName: '渔具工匠 · 老周',
          role: '鱼竿与鱼饵工坊',
          lines: [
            { mood: 'neutral', text: '嗯……欢迎来我这间小工坊。手里的竹竿用得还顺手吗？' },
            {
              mood: 'thinking',
              text: '浅滩小鱼用面团香饵和竹竿就够了；但要是想去东边灯塔外海拉黄鳍金枪鱼，最好换一根更柔韧的枫木竿或远洋海钓竿。',
            },
          ],
          choices: [
            { label: '🎣 逛逛老周渔具商店（买竿 / 买饵）', primary: true, onSelect: () => openShop('artisan') },
            {
              label: '💬 请教不同鱼饵的秘密',
              onSelect: () => {
                dialogueSystem.open(
                  {
                    speakerId: 'npc_artisan',
                    speakerName: '渔具工匠 · 老周',
                    role: '鱼竿与鱼饵工坊',
                    lines: [
                      { mood: 'happy', text: '面团香饵最讨静水锦鲤和宝莲灯喜欢；鲜甜虾仁专攻礁石边的真鲷、黑鲷和石狗公。' },
                      { mood: 'neutral', text: '彩绘拟饵是远洋大鱼的克星，至于我手削的夜光木虾诱饵……黄昏日落时甩出去，银带鱼和软丝鱿鱼准会凑过来！' },
                    ],
                  },
                  restoreCamera
                );
              },
            },
            { label: '👋 下次再来', onSelect: () => {} },
          ],
        },
        restoreCamera
      );
    } else if (npc.id === 'npc_lighthouse') {
      dialogueSystem.open(
        {
          speakerId: 'npc_lighthouse',
          speakerName: '灯塔守望者 · 海伯',
          role: '天气潮汐与巨物传说',
          lines: [
            { mood: 'happy', text: '哈哈，年轻人，海风把你吹到东海角灯塔来啦！这儿的浪花和远景最解乏。' },
            { mood: 'mysterious', text: '我在这灯塔守了三十年，见过比你那条小红船还长的黄鳍金枪鱼，就在灯塔东南外海的深蓝水沟里巡游……' },
          ],
          choices: [
            {
              label: '🌅 请海伯观潮换个好时辰（切换天气）',
              primary: true,
              onSelect: () => {
                const curIdx = WEATHER_CYCLE.indexOf(gameState.data.weather);
                const nextWeather = WEATHER_CYCLE[(curIdx + 1) % WEATHER_CYCLE.length];
                atmosphere.applyPreset(nextWeather);
                syncWeatherUI(nextWeather);
                gameState.setWeather(nextWeather, false);
                showToast({
                  text: `海伯提灯望向海平线，天色渐渐转为了「${WEATHER_NAMES[nextWeather]}」`,
                  portrait: 'npc_lighthouse',
                  mood: 'happy',
                });
              },
            },
            {
              label: '🌊 听听静水泻湖的巨物传说',
              onSelect: () => {
                dialogueSystem.open(
                  {
                    speakerId: 'npc_lighthouse',
                    speakerName: '灯塔守望者 · 海伯',
                    role: '天气潮汐与巨物传说',
                    lines: [
                      { mood: 'mysterious', text: '划船经过浅滩时动作轻一点，猛划桨会把胆小的鱼群吓散；静静漂着靠近，才能钓到真正罕见的「王冠」体型！' },
                      { mood: 'happy', text: '要是偶尔把钓上的鱼温柔放生，泻湖会记住你的善意——积攒下的放生回响灵气，迟早会带来意想不到的好运气。' },
                    ],
                  },
                  restoreCamera
                );
              },
            },
            { label: '👋 谢谢海伯，我去钓鱼啦', onSelect: () => {} },
          ],
        },
        restoreCamera
      );
    }
  }

  function buildFishRowHtml(rec) {
    const sp = specMap.get(rec.speciesId);
    const iconUrl = getFishIconUrl(rec.speciesId, sp);
    return `
      <div class="aq-fish-thumb">
        <img src="${iconUrl || ''}" alt="${sp?.nameZh || ''}" />
      </div>
      <div class="aq-fish-info">
        <div class="aq-fish-name">${sp?.nameZh || rec.speciesId} <span class="aq-grade">${rec.grade || '普通'}</span></div>
        <div class="aq-fish-sub">体长 ${rec.lengthCm} cm${rec.price ? ` · 约 ${rec.price} 贝币` : ''}</div>
      </div>
    `;
  }

  function renderBasketModal() {
    const listEl = document.getElementById('basket-fish-list');
    const countBadge = document.getElementById('basket-count-badge');
    if (!listEl) return;
    const fishes = gameState.data.inventory.filter((i) => i.kind === 'fish');
    if (countBadge) countBadge.textContent = `${fishes.length} 条`;
    listEl.innerHTML = '';

    if (!fishes.length) {
      listEl.innerHTML = '<div class="aq-empty">随身鱼护还是空的，划船或到码头按 Space 钓几条鱼吧！</div>';
      return;
    }

    for (const rec of fishes) {
      const row = document.createElement('div');
      row.className = 'aq-fish-row';
      row.innerHTML = buildFishRowHtml(rec);
      listEl.appendChild(row);
    }
  }

  function renderAquariumModal() {
    const tankListEl = document.getElementById('aquarium-fish-list');
    const basketListEl = document.getElementById('aquarium-basket-list');
    const capBadge = document.getElementById('aq-cap-badge');
    if (!tankListEl || !basketListEl) return;

    const tankFish = gameState.data.aquariumFish;
    const basketFish = gameState.data.inventory.filter((i) => i.kind === 'fish');
    if (capBadge) capBadge.textContent = `${tankFish.length} / 10`;

    tankListEl.innerHTML = '';
    if (!tankFish.length) {
      tankListEl.innerHTML = '<div class="aq-empty">鱼缸目前空着，从下方随身鱼护挑一条放进来吧！</div>';
    } else {
      for (const rec of tankFish) {
        const sp = specMap.get(rec.speciesId);
        const row = document.createElement('div');
        row.className = 'aq-fish-row';
        row.innerHTML = buildFishRowHtml(rec);
        const btnOut = document.createElement('button');
        btnOut.className = 'aq-action-btn btn-out';
        btnOut.textContent = '捞回鱼护';
        btnOut.addEventListener('click', () => {
          if (gameState.removeFishFromAquarium(rec.uid)) {
            showToast({
              text: `已将「${sp?.nameZh || rec.speciesId}」捞回随身鱼护`,
              portrait: 'player',
              mood: 'neutral',
            });
          }
        });
        row.appendChild(btnOut);
        tankListEl.appendChild(row);
      }
    }

    basketListEl.innerHTML = '';
    if (!basketFish.length) {
      basketListEl.innerHTML = '<div class="aq-empty">随身鱼护暂无活鱼，快去湖里钓一条带回家吧！</div>';
    } else {
      for (const rec of basketFish) {
        const sp = specMap.get(rec.speciesId);
        const row = document.createElement('div');
        row.className = 'aq-fish-row';
        row.innerHTML = buildFishRowHtml(rec);
        const btnIn = document.createElement('button');
        btnIn.className = 'aq-action-btn';
        btnIn.textContent = '放入鱼缸';
        btnIn.addEventListener('click', () => {
          if (gameState.data.aquariumFish.length >= 10) {
            showToast({
              text: '当前小屋鱼缸已满 10 条啦！以后买大房子就能换更大的巨型鱼缸哦',
              portrait: 'player',
              mood: 'surprised',
            });
            return;
          }
          if (gameState.moveFishToAquarium(rec.uid)) {
            showToast({
              text: `已将「${sp?.nameZh || rec.speciesId}（${rec.lengthCm}cm）」放进家里的大生态鱼缸！`,
              portrait: 'dog',
              mood: 'excited',
            });
          }
        });
        row.appendChild(btnIn);
        basketListEl.appendChild(row);
      }
    }
  }

  function openAquariumView() {
    basketModal?.classList.add('hidden');
    fishPanel?.classList.add('hidden');
    tweakPanel?.classList.add('hidden');
    aquariumModal?.classList.remove('hidden');
    renderAquariumModal();
    cameraDirector.setMode('aquarium');
    playerController.clearKeys();
  }

  function closeAquariumView() {
    aquariumModal?.classList.add('hidden');
    if (cameraDirector.state.mode === 'aquarium') {
      cameraDirector.setMode(gameState.data.insideBuildingId ? 'indoor' : 'walking');
    }
  }

  function highlightSelectedSpecies(activeId) {
    document.querySelectorAll('.species-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.speciesId === activeId);
    });
  }

  function initFishGuide() {
    if (!fishListContainer) return;
    const countBadge = document.getElementById('fish-total-badge');
    if (countBadge) {
      countBadge.textContent = `${ecosystem.speciesCatalog.length} 种 · ${ecosystem.totalCount} 只`;
    }

    const grouped = new Map();
    for (const sp of ecosystem.speciesCatalog) {
      if (!grouped.has(sp.category)) grouped.set(sp.category, []);
      grouped.get(sp.category).push(sp);
    }

    for (const [category, list] of grouped.entries()) {
      const catHeader = document.createElement('div');
      catHeader.className = 'species-cat';
      catHeader.textContent = category;
      fishListContainer.appendChild(catHeader);

      for (const sp of list) {
        const iconUrl = getFishIconUrl(sp.id, sp);
        const btn = document.createElement('button');
        btn.className = 'species-item';
        btn.dataset.speciesId = sp.id;
        btn.innerHTML = `
          <img class="species-thumb" src="${iconUrl || ''}" alt="${sp.nameZh}" />
          <span class="species-name">${sp.nameZh}</span>
          <span class="species-meta">${sp.sizeLabel} ×${sp.count}</span>
        `;
        btn.addEventListener('click', () => {
          if (cameraDirector.state.mode === 'fish' && cameraDirector.state.watchSpeciesId === sp.id) {
            cameraDirector.setMode(gameState.data.playerMode === 'walking' ? 'walking' : 'boat');
          } else {
            cameraDirector.setMode('fish', sp.id);
          }
        });
        fishListContainer.appendChild(btn);
      }
    }
  }

  document.getElementById('btn-close-aquarium')?.addEventListener('click', closeAquariumView);
  document.getElementById('btn-open-basket')?.addEventListener('click', () => {
    if (cameraDirector.state.mode === 'aquarium' || shopState.open || dialogueSystem.isOpen()) return;
    const willShow = basketModal?.classList.contains('hidden');
    fishPanel?.classList.add('hidden');
    tweakPanel?.classList.add('hidden');
    if (willShow) {
      renderBasketModal();
      basketModal?.classList.remove('hidden');
    } else {
      basketModal?.classList.add('hidden');
    }
  });
  document.getElementById('btn-close-basket')?.addEventListener('click', () => {
    basketModal?.classList.add('hidden');
  });

  initFishGuide();

  return {
    isShopOpen: () => shopState.open,
    openShop,
    closeShop,
    renderShopContent,
    renderBasketModal,
    renderAquariumModal,
    openAquariumView,
    closeAquariumView,
    startNpcConversation,
    highlightSelectedSpecies,
    closeSidePanels() {
      basketModal?.classList.add('hidden');
      fishPanel?.classList.add('hidden');
      tweakPanel?.classList.add('hidden');
    },
  };
}
