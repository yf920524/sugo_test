/* ============================================================
   トリリオネアを目指せ！ - ゲームロジック
   データ（都市・路線・クイズ）は data.js 側にすべて分離してある。
   ここでは「動かし方」だけを扱う。
   ============================================================ */

const START_CASH = 3000; // 万円
const GOAL_REVENUE = 100000000; // 万円 = 1兆円
const MILESTONES = [
  { value: 1000000, label: "年間収益100億円" },
  { value: 10000000, label: "年間収益1000億円" },
];
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

// ---- DOM 参照 ----
let startScreen, gameScreen, startBtn;
let statYear, statMonth, victoryBadge, statAnnualRevenue, goalBarFill;
let statCash, statAssets, statProps, statMonopoly;
let cityIcon, cityName, cityCatch, miniMap;
let diceFace, directionButtons;
let shopBtn, logBtn, mapBtn;
let modalRoot, modalBox;

// ---- ゲーム状態 ----
let state = {
  currentCity: "tokyo",
  year: 1,
  month: 1,
  cash: START_CASH,
  owned: new Set(),
  monopolyCities: new Set(),
  cityQuizCorrect: {},
  quizCorrectTotal: 0,
  quizAskedTotal: 0,
  discountCoupons: 0,
  incomeBoost: { multiplier: 1, turnsLeft: 0 },
  milestonesHit: new Set(),
  victoryAchieved: false,
  firstPurchaseDone: false,
  quizRecent: [],
  logHistory: [],
  busy: false,
};

let pendingAfterClose = null;
let quizOnDone = null;
let quizCityKey = null;
let currentQuizData = null;
let currentQuizOptions = [];
let currentQuizAnswered = false;
let activeCityKey = null;
let shopCloseCallback = null;

// ============================================================
// ユーティリティ
// ============================================================
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function propKey(cityKey, idx) {
  return cityKey + "#" + idx;
}
function getCity(cityKey) {
  return CITIES.find((c) => c.key === cityKey);
}
function trimNum(n) {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}
function fmtMoney(manEn) {
  const v = Math.round(manEn);
  if (v >= 1e8) return trimNum(v / 1e8) + "兆円";
  if (v >= 10000) return trimNum(v / 10000) + "億円";
  return v.toLocaleString("ja-JP") + "万円";
}
function getTotalPropertyCount() {
  return CITIES.reduce((s, c) => s + c.properties.length, 0);
}
function getOwnedPropertyValueSum() {
  let sum = 0;
  CITIES.forEach((city) => {
    city.properties.forEach((p, i) => {
      if (state.owned.has(propKey(city.key, i))) sum += p.price;
    });
  });
  return sum;
}
function getBaseAnnualRevenue() {
  let total = 0;
  CITIES.forEach((city) => {
    let cityRev = 0;
    let ownedCount = 0;
    city.properties.forEach((p, i) => {
      if (state.owned.has(propKey(city.key, i))) {
        cityRev += p.revenue;
        ownedCount++;
      }
    });
    if (ownedCount === city.properties.length && ownedCount > 0) cityRev *= 2;
    total += cityRev;
  });
  return total;
}
function addLog(text, cls) {
  state.logHistory.push({ text, cls, when: `${state.year}年${state.month}月` });
  if (state.logHistory.length > 300) state.logHistory.shift();
}

// ============================================================
// 路線・移動
// ============================================================
function getNeighbors(cityKey) {
  const result = [];
  const seen = new Set();
  LINES.forEach((line) => {
    const idx = line.cities.indexOf(cityKey);
    if (idx < 0) return;
    if (idx > 0) {
      const n = line.cities[idx - 1];
      if (!seen.has(n)) {
        seen.add(n);
        result.push({ cityKey: n, lineKey: line.key, dir: -1 });
      }
    }
    if (idx < line.cities.length - 1) {
      const n = line.cities[idx + 1];
      if (!seen.has(n)) {
        seen.add(n);
        result.push({ cityKey: n, lineKey: line.key, dir: 1 });
      }
    }
  });
  return result;
}

async function movePlayerAlongLine(neighbor, steps) {
  const line = LINES.find((l) => l.key === neighbor.lineKey);
  const fromIdx = line.cities.indexOf(state.currentCity);
  const targetIdx = Math.min(line.cities.length - 1, Math.max(0, fromIdx + neighbor.dir * steps));
  let cur = fromIdx;
  while (cur !== targetIdx) {
    cur += neighbor.dir;
    state.currentCity = line.cities[cur];
    renderCityDisplayOnly();
    await delay(200);
  }
  advanceMonth();
  handleCityArrival(state.currentCity);
}

function rollDiceThenMove(neighbor) {
  diceFace.classList.add("rolling");
  let cycles = 0;
  const spin = setInterval(() => {
    diceFace.textContent = DICE_FACES[randInt(0, 5)];
    cycles++;
    if (cycles > 7) {
      clearInterval(spin);
      diceFace.classList.remove("rolling");
      const value = randInt(1, 6);
      diceFace.textContent = DICE_FACES[value - 1];
      addLog(`🎲 ${value}が出た！${getCity(neighbor.cityKey).name}方面へ進んだ。`);
      movePlayerAlongLine(neighbor, value);
    }
  }, 70);
}

// ============================================================
// 経済（月次収益・年月進行）
// ============================================================
function advanceMonth() {
  const annual = getBaseAnnualRevenue();
  const boostActive = state.incomeBoost.turnsLeft > 0;
  const boostMult = boostActive ? state.incomeBoost.multiplier : 1;
  const monthly = Math.round((annual / 12) * boostMult);
  if (monthly > 0) {
    state.cash += monthly;
    addLog(`📅 ${state.year}年${state.month}月の収益: +${fmtMoney(monthly)}${boostActive ? "（ブースト中）" : ""}`, "good");
  }
  state.month++;
  if (state.month > 12) {
    state.month = 1;
    state.year++;
  }
  if (state.incomeBoost.turnsLeft > 0) {
    state.incomeBoost.turnsLeft--;
    if (state.incomeBoost.turnsLeft === 0) state.incomeBoost.multiplier = 1;
  }
  renderHeader();
}

// ============================================================
// 描画
// ============================================================
function renderHeader() {
  statYear.textContent = state.year;
  statMonth.textContent = state.month;
  const annual = getBaseAnnualRevenue();
  statAnnualRevenue.textContent = fmtMoney(annual);
  goalBarFill.style.width = Math.min(100, (annual / GOAL_REVENUE) * 100) + "%";
  statCash.textContent = fmtMoney(state.cash);
  statAssets.textContent = fmtMoney(state.cash + getOwnedPropertyValueSum());
  statProps.textContent = `${state.owned.size}/${getTotalPropertyCount()}`;
  statMonopoly.textContent = `${state.monopolyCities.size}/${CITIES.length}`;
  victoryBadge.classList.toggle("hidden", !state.victoryAchieved);
}

function renderMiniMap() {
  const line = LINES[0];
  miniMap.innerHTML = line.cities
    .map((key) => {
      const c = getCity(key);
      const ownedCount = c.properties.filter((_, i) => state.owned.has(propKey(key, i))).length;
      const isMonopoly = state.monopolyCities.has(key);
      const isCurrent = key === state.currentCity;
      return `<div class="map-node ${isCurrent ? "current" : ""} ${ownedCount > 0 ? "owned" : ""} ${isMonopoly ? "monopoly" : ""}">
        <div class="node-line"></div>
        <div class="node-icon">${c.icon}</div>
        ${isMonopoly ? '<span class="node-crown">👑</span>' : ""}
        <div class="node-name">${c.name}</div>
      </div>`;
    })
    .join("");
}

function renderDirectionButtons() {
  const neighbors = getNeighbors(state.currentCity);
  directionButtons.innerHTML = neighbors
    .map((n) => {
      const c = getCity(n.cityKey);
      return `<button class="dir-btn ${neighbors.length === 1 ? "solo" : ""}" data-city-key="${n.cityKey}" data-line-key="${n.lineKey}" data-dir="${n.dir}">
        <span class="dir-icon">${c.icon}</span>${c.name}方面へ 🎲
      </button>`;
    })
    .join("");
}

function renderCityDisplayOnly() {
  const city = getCity(state.currentCity);
  cityIcon.textContent = city.icon;
  cityName.textContent = city.name;
  cityCatch.textContent = city.catch;
  renderMiniMap();
}

function renderCityPanel() {
  renderCityDisplayOnly();
  renderDirectionButtons();
}

// ============================================================
// モーダル制御
// ============================================================
function setModalContent(html) {
  modalBox.innerHTML = html;
  modalRoot.classList.remove("hidden");
}
function setAfterClose(fn) {
  pendingAfterClose = fn;
}
function closeModal() {
  modalRoot.classList.add("hidden");
  modalBox.innerHTML = "";
  const cb = pendingAfterClose;
  pendingAfterClose = null;
  if (cb) cb();
}
function setControlsEnabled(enabled) {
  document.querySelectorAll(".dir-btn").forEach((b) => (b.disabled = !enabled));
  shopBtn.disabled = !enabled;
  logBtn.disabled = !enabled;
  mapBtn.disabled = !enabled;
  state.busy = !enabled;
}

// ============================================================
// ターン進行
// ============================================================
function afterTurnComplete() {
  renderCityPanel();
  setControlsEnabled(true);
}

function handleCityArrival(cityKey) {
  state.currentCity = cityKey;
  renderCityDisplayOnly();
  renderHeader();
  showQuizModal(cityKey, () => openCityShop(cityKey));
}

// ============================================================
// クイズ
// ============================================================
function pickQuiz(cityKey) {
  const tagged = QUIZ_BANK.filter((q) => q.tags && q.tags.includes(cityKey));
  const pool = tagged.length && Math.random() < 0.7 ? tagged : QUIZ_BANK;
  let available = pool.filter((q) => !state.quizRecent.includes(QUIZ_BANK.indexOf(q)));
  if (!available.length) available = pool;
  const q = pick(available);
  const idx = QUIZ_BANK.indexOf(q);
  state.quizRecent.push(idx);
  if (state.quizRecent.length > 12) state.quizRecent.shift();
  return q;
}

function getUnlockHint(cityKey) {
  const city = getCity(cityKey);
  const have = state.cityQuizCorrect[cityKey] || 0;
  let best = null;
  city.properties.forEach((p, i) => {
    if (p.unlock && !state.owned.has(propKey(cityKey, i))) {
      const remain = p.unlock - have;
      if (remain > 0 && (!best || remain < best.remain)) best = { prop: p, remain };
    }
  });
  return best;
}

function applyQuizReward() {
  const roll = Math.random();
  if (roll < 0.4) {
    const amt = Math.max(300, Math.round((state.cash * 0.15) / 10) * 10);
    state.cash += amt;
    return `💰 現金 +${fmtMoney(amt)} ゲット！`;
  } else if (roll < 0.7) {
    state.discountCoupons++;
    return `🎟️ 次に買う物件が3割引になるクーポンをゲット！`;
  } else {
    state.incomeBoost = { multiplier: 1.5, turnsLeft: 3 };
    return `📈 3か月間、収益が1.5倍になるブーストを獲得！`;
  }
}

function showQuizModal(cityKey, onDone) {
  quizOnDone = onDone;
  quizCityKey = cityKey;
  const q = pickQuiz(cityKey);
  currentQuizData = q;
  currentQuizAnswered = false;
  currentQuizOptions = shuffle(q.options.map((text, i) => ({ text, isCorrect: i === q.correct })));
  state.quizAskedTotal++;
  const hint = getUnlockHint(cityKey);
  const hintHtml = hint ? `<div class="hint-banner">🔓 あと${hint.remain}問正解で「${hint.prop.name}」がアンロック！</div>` : "";
  const optsHtml = currentQuizOptions
    .map((o, i) => `<button class="quiz-opt" data-action="quiz-opt" data-idx="${i}">${o.text}</button>`)
    .join("");
  setModalContent(`
    <div class="modal-title">❓ クイズ！</div>
    ${hintHtml}
    <p style="font-size:15px;font-weight:bold;line-height:1.6;">${q.q}</p>
    <div class="quiz-options" id="quizOptionsBox">${optsHtml}</div>
  `);
}

function onQuizOptionClick(idx) {
  if (currentQuizAnswered) return;
  currentQuizAnswered = true;
  const chosen = currentQuizOptions[idx];
  let rewardHtml = "";
  let unlockHtml = "";
  if (chosen.isCorrect) {
    state.quizCorrectTotal++;
    state.cityQuizCorrect[quizCityKey] = (state.cityQuizCorrect[quizCityKey] || 0) + 1;
    const rewardText = applyQuizReward();
    rewardHtml = `<div class="quiz-reward">${rewardText}</div>`;
    const city = getCity(quizCityKey);
    const have = state.cityQuizCorrect[quizCityKey];
    const justUnlocked = city.properties.filter((p, i) => p.unlock === have && !state.owned.has(propKey(quizCityKey, i)));
    if (justUnlocked.length) {
      unlockHtml = `<div class="quiz-unlock-note">🔓 「${justUnlocked.map((p) => p.name).join("」「")}」がアンロックされた！</div>`;
    }
  }
  document.querySelectorAll("#quizOptionsBox .quiz-opt").forEach((btn, i) => {
    btn.disabled = true;
    if (currentQuizOptions[i].isCorrect) btn.classList.add("correct");
    else if (i === idx) btn.classList.add("wrong");
  });
  renderHeader();
  const resultBox = document.createElement("div");
  resultBox.className = "quiz-result-box";
  resultBox.innerHTML = `<strong>${chosen.isCorrect ? "🎉 せいかい！" : "😵 ざんねん…"}</strong><br>${currentQuizData.explain}${rewardHtml}${unlockHtml}`;
  document.getElementById("quizOptionsBox").insertAdjacentElement("afterend", resultBox);
  const contBtn = document.createElement("button");
  contBtn.className = "modal-close-btn primary";
  contBtn.setAttribute("data-action", "quiz-continue");
  contBtn.textContent = "つぎへ";
  modalBox.appendChild(contBtn);
}

// ============================================================
// 都市の物件・購入
// ============================================================
function openCityShop(cityKey) {
  activeCityKey = cityKey;
  shopCloseCallback = afterTurnComplete;
  renderCityShopContent(cityKey);
  setAfterClose(shopCloseCallback);
}

function showShopStandalone() {
  if (state.busy) return;
  activeCityKey = state.currentCity;
  shopCloseCallback = null;
  renderCityShopContent(state.currentCity);
  setAfterClose(null);
}

function renderCityShopContent(cityKey) {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildCityShopHtml(cityKey);
}

function buildCityShopHtml(cityKey) {
  const city = getCity(cityKey);
  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(cityKey, i))).length;
  const isMonopoly = state.monopolyCities.has(cityKey);
  const remain = city.properties.length - ownedCount;
  const haveQuiz = state.cityQuizCorrect[cityKey] || 0;
  const banner = isMonopoly
    ? `<div class="city-monopoly-banner">👑 ${city.name}を完全制覇中！収益2倍でがっぽり！</div>`
    : remain === 1
      ? `<div class="hint-banner">🔥 あと1件で完全制覇！</div>`
      : "";
  const couponNote =
    state.discountCoupons > 0
      ? `<div class="modal-sub">🎟️ 割引クーポン ${state.discountCoupons}枚所持中（次の購入から自動適用）</div>`
      : "";
  const propsHtml = city.properties
    .map((p, i) => {
      const key = propKey(cityKey, i);
      const owned = state.owned.has(key);
      const locked = !owned && p.unlock && haveQuiz < p.unlock;
      const discounted = !owned && !locked && state.discountCoupons > 0;
      const price = discounted ? Math.round(p.price * 0.7) : p.price;
      const affordable = state.cash >= price;
      let badge, buyEl;
      if (owned) {
        badge = `<span class="prop-badge owned-badge">購入済み</span>`;
        buyEl = `<button class="prop-buy-btn" disabled>購入済み</button>`;
      } else if (locked) {
        badge = `<span class="prop-badge locked-badge">🔒 クイズ累計${haveQuiz}/${p.unlock}問正解で解禁</span>`;
        buyEl = `<span class="prop-lock-icon">🔒</span>`;
      } else {
        badge = `<span class="prop-badge">あと${remain}件で完全制覇</span>`;
        const label = discounted ? `割引 ${fmtMoney(price)}` : fmtMoney(price);
        buyEl = `<button class="prop-buy-btn ${discounted ? "discounted" : ""}" data-action="buy-prop" data-city="${cityKey}" data-idx="${i}" ${affordable ? "" : "disabled"}>${label}</button>`;
      }
      return `<div class="prop-card ${owned ? "owned" : ""} ${locked ? "locked" : ""}" data-prop-row="${i}">
        <div class="prop-icon">${p.icon}</div>
        <div class="prop-info">
          <div class="prop-name">${p.name}</div>
          <div class="prop-detail">${fmtMoney(p.price)} ／ 年利${p.yieldPct}%（年間収益 ${fmtMoney(p.revenue)}）</div>
          ${badge}
        </div>
        ${buyEl}
      </div>`;
    })
    .join("");
  return `
    <div class="modal-title">${city.icon} ${city.name}の物件（${ownedCount}/${city.properties.length}）</div>
    <div class="modal-sub">${city.catch}</div>
    ${banner}
    ${couponNote}
    <div class="prop-list">${propsHtml}</div>
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>
  `;
}

function refreshShopWithPulse(cityKey, idx) {
  renderCityShopContent(cityKey);
  const row = modalBox.querySelector(`.prop-card[data-prop-row="${idx}"]`);
  if (row) {
    row.classList.add("just-bought");
    setTimeout(() => row.classList.remove("just-bought"), 500);
  }
}

function buyProperty(cityKey, idx) {
  const city = getCity(cityKey);
  const p = city.properties[idx];
  const key = propKey(cityKey, idx);
  if (state.owned.has(key)) return;
  const haveQuiz = state.cityQuizCorrect[cityKey] || 0;
  if (p.unlock && haveQuiz < p.unlock) return;
  const discounted = state.discountCoupons > 0;
  const price = discounted ? Math.round(p.price * 0.7) : p.price;
  if (state.cash < price) return;
  state.cash -= price;
  if (discounted) state.discountCoupons--;
  state.owned.add(key);
  addLog(`🏠 ${city.name}の「${p.name}」を購入！（${fmtMoney(price)}）`, "good");

  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(cityKey, i))).length;
  let newlyMonopoly = false;
  if (ownedCount === city.properties.length && !state.monopolyCities.has(cityKey)) {
    state.monopolyCities.add(cityKey);
    newlyMonopoly = true;
    addLog(`👑 ${city.name}を完全制覇！収益が2倍に！`, "highlight");
  }
  renderHeader();
  renderMiniMap();
  handlePurchaseCelebration(city, p, idx, newlyMonopoly, cityKey);
}

// ============================================================
// 演出（購入・完全制覇・節目・トリリオネア達成）
// ============================================================
function returnToShop() {
  renderCityShopContent(activeCityKey);
  setAfterClose(shopCloseCallback);
}

function handlePurchaseCelebration(city, prop, idx, newlyMonopoly, cityKey) {
  const isFirst = !state.firstPurchaseDone;
  state.firstPurchaseDone = true;
  const annual = getBaseAnnualRevenue();
  let milestoneHit = null;
  MILESTONES.forEach((m) => {
    if (annual >= m.value && !state.milestonesHit.has(m.value)) {
      state.milestonesHit.add(m.value);
      milestoneHit = m;
    }
  });

  if (annual >= GOAL_REVENUE && !state.victoryAchieved) {
    state.victoryAchieved = true;
    addLog(`🏆 年間収益1兆円突破！トリリオネア達成！`, "highlight");
    renderHeader();
    showVictoryModal();
    return;
  }
  if (newlyMonopoly) {
    flashMonopolyCelebration(city, milestoneHit);
    return;
  }
  if (milestoneHit) {
    flashMilestoneCelebration(milestoneHit);
    return;
  }
  if (isFirst) {
    flashFirstPurchaseCelebration();
    return;
  }
  if (prop.price >= 100000) {
    flashBigPurchaseCelebration(prop);
    return;
  }
  refreshShopWithPulse(cityKey, idx);
}

function flashMonopolyCelebration(city, milestoneHit) {
  const milestoneExtra = milestoneHit ? `<div class="celebrate-sub">🎊 さらに${milestoneHit.label}を突破！</div>` : "";
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">👑</div>
      <div class="confetti-row">🎉🎊✨🎊🎉</div>
      <div class="celebrate-title">${city.name} 完全制覇！</div>
      <div class="celebrate-sub">これから${city.name}の収益が2倍になるよ！</div>
      ${milestoneExtra}
      <button class="modal-close-btn primary" data-action="close-modal">やった！</button>
    </div>`;
  setAfterClose(returnToShop);
}

function flashMilestoneCelebration(milestone) {
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">🎊</div>
      <div class="confetti-row">✨💰✨💰✨</div>
      <div class="celebrate-title">節目突破！</div>
      <div class="celebrate-sub">${milestone.label} を達成したよ！</div>
      <button class="modal-close-btn primary" data-action="close-modal">よし！</button>
    </div>`;
  setAfterClose(returnToShop);
}

function flashFirstPurchaseCelebration() {
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">🏠</div>
      <div class="confetti-row">🎉✨🎉</div>
      <div class="celebrate-title">はじめての物件購入！</div>
      <div class="celebrate-sub">ここから資産を増やしていこう！</div>
      <button class="modal-close-btn primary" data-action="close-modal">がんばるぞ！</button>
    </div>`;
  setAfterClose(returnToShop);
}

function flashBigPurchaseCelebration(prop) {
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">💎</div>
      <div class="confetti-row">✨💰✨</div>
      <div class="celebrate-title">高額物件を購入！</div>
      <div class="celebrate-sub">「${prop.name}」を手に入れた！</div>
      <button class="modal-close-btn primary" data-action="close-modal">よし！</button>
    </div>`;
  setAfterClose(returnToShop);
}

function showVictoryModal() {
  const assets = state.cash + getOwnedPropertyValueSum();
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="celebrate victory">
      <div class="big-emoji">🏆</div>
      <div class="confetti-row">🎉💰🎊💰🎉</div>
      <div class="celebrate-title">トリリオネア達成！</div>
      <div class="celebrate-sub">年間収益が1兆円を突破したよ！</div>
      <table style="width:100%;text-align:left;margin:14px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 4px;font-size:13px;">📅 かかった期間</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.year}年${state.month}月</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">📊 総資産</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${fmtMoney(assets)}</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">🏢 所有物件数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.owned.size} / ${getTotalPropertyCount()}件</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">👑 完全制覇都市数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.monopolyCities.size} / ${CITIES.length}都市</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">❓ クイズ正解数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.quizCorrectTotal} / ${state.quizAskedTotal}問</td></tr>
      </table>
      <button class="modal-close-btn primary" data-action="continue-play">🎉 続けてあそぶ</button>
      <button class="modal-close-btn secondary-outline" data-action="restart-game">🔄 最初から</button>
    </div>`;
}

// ============================================================
// ログ・全国マップ
// ============================================================
function showLogModal() {
  if (state.busy) return;
  const entries = state.logHistory.slice().reverse();
  const html = entries.length
    ? entries.map((e) => `<div class="log-entry ${e.cls ? "log-" + e.cls : ""}"><span class="log-when">${e.when}</span>${e.text}</div>`).join("")
    : `<div class="log-empty">まだ記録がありません。</div>`;
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `<div class="modal-title">📜 プレイログ</div>${html}<button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
  setAfterClose(null);
}

function showOverviewModal() {
  if (state.busy) return;
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildOverviewHtml();
  setAfterClose(null);
}

function buildOverviewHtml() {
  const citiesHtml = CITIES.map((city) => {
    const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
    const isMonopoly = state.monopolyCities.has(city.key);
    const haveQuiz = state.cityQuizCorrect[city.key] || 0;
    const chips = city.properties
      .map((p, i) => {
        const owned = state.owned.has(propKey(city.key, i));
        const locked = !owned && p.unlock && haveQuiz < p.unlock;
        return `<span class="mini-chip ${owned ? "owned" : ""} ${locked ? "locked" : ""}">${p.icon} ${p.name}${owned ? " ✓" : locked ? " 🔒" : ""}</span>`;
      })
      .join("");
    return `<div class="overview-city">
      <div class="overview-city-head">
        <span>${city.icon} ${city.name}</span>
        <span class="badge-mini ${isMonopoly ? "done" : ""}">${ownedCount}/${city.properties.length}件${isMonopoly ? " 👑完全制覇" : ""}</span>
      </div>
      <div class="overview-props-mini">${chips}</div>
    </div>`;
  }).join("");
  return `<div class="modal-title">🗺️ 全国マップ</div>
    <div class="modal-sub">現在地: ${getCity(state.currentCity).name}／全${getTotalPropertyCount()}件の物件</div>
    ${citiesHtml}
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
}

// ============================================================
// ゲーム開始
// ============================================================
function startNewGame() {
  state.currentCity = "tokyo";
  state.year = 1;
  state.month = 1;
  state.cash = START_CASH;
  state.owned = new Set();
  state.monopolyCities = new Set();
  state.cityQuizCorrect = {};
  state.quizCorrectTotal = 0;
  state.quizAskedTotal = 0;
  state.discountCoupons = 0;
  state.incomeBoost = { multiplier: 1, turnsLeft: 0 };
  state.milestonesHit = new Set();
  state.victoryAchieved = false;
  state.firstPurchaseDone = false;
  state.quizRecent = [];
  state.logHistory = [];
  state.busy = false;

  diceFace.textContent = "🎲";
  addLog("🎬 ゲームスタート！物件を買い占めてトリリオネアを目指そう！", "highlight");
  renderHeader();
  renderCityPanel();
  setControlsEnabled(false);
  handleCityArrival("tokyo");
}

// ============================================================
// 初期化・イベント配線
// ============================================================
function initRefs() {
  startScreen = document.getElementById("startScreen");
  gameScreen = document.getElementById("gameScreen");
  startBtn = document.getElementById("startBtn");

  statYear = document.getElementById("statYear");
  statMonth = document.getElementById("statMonth");
  victoryBadge = document.getElementById("victoryBadge");
  statAnnualRevenue = document.getElementById("statAnnualRevenue");
  goalBarFill = document.getElementById("goalBarFill");
  statCash = document.getElementById("statCash");
  statAssets = document.getElementById("statAssets");
  statProps = document.getElementById("statProps");
  statMonopoly = document.getElementById("statMonopoly");

  cityIcon = document.getElementById("cityIcon");
  cityName = document.getElementById("cityName");
  cityCatch = document.getElementById("cityCatch");
  miniMap = document.getElementById("miniMap");

  diceFace = document.getElementById("diceFace");
  directionButtons = document.getElementById("directionButtons");

  shopBtn = document.getElementById("shopBtn");
  logBtn = document.getElementById("logBtn");
  mapBtn = document.getElementById("mapBtn");

  modalRoot = document.getElementById("modalRoot");
  modalBox = document.getElementById("modalBox");
}

function wireEvents() {
  startBtn.addEventListener("click", () => {
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    startNewGame();
  });

  directionButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".dir-btn");
    if (!btn || btn.disabled) return;
    const neighbor = { cityKey: btn.dataset.cityKey, lineKey: btn.dataset.lineKey, dir: Number(btn.dataset.dir) };
    setControlsEnabled(false);
    rollDiceThenMove(neighbor);
  });

  shopBtn.addEventListener("click", showShopStandalone);
  logBtn.addEventListener("click", showLogModal);
  mapBtn.addEventListener("click", showOverviewModal);

  modalBox.addEventListener("click", (e) => {
    const optBtn = e.target.closest('[data-action="quiz-opt"]');
    if (optBtn) {
      onQuizOptionClick(Number(optBtn.dataset.idx));
      return;
    }
    const contBtn = e.target.closest('[data-action="quiz-continue"]');
    if (contBtn) {
      const fn = quizOnDone;
      quizOnDone = null;
      if (fn) fn();
      return;
    }
    const buyBtn = e.target.closest('[data-action="buy-prop"]');
    if (buyBtn && !buyBtn.disabled) {
      buyProperty(buyBtn.dataset.city, Number(buyBtn.dataset.idx));
      return;
    }
    const closeBtn = e.target.closest('[data-action="close-modal"]');
    if (closeBtn) {
      closeModal();
      return;
    }
    const continueBtn = e.target.closest('[data-action="continue-play"]');
    if (continueBtn) {
      returnToShop();
      return;
    }
    const restartBtn = e.target.closest('[data-action="restart-game"]');
    if (restartBtn) {
      modalRoot.classList.add("hidden");
      modalBox.innerHTML = "";
      startNewGame();
      return;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initRefs();
  wireEvents();
});
