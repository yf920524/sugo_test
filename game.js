/* ============================================================
   トリリオネアを目指せ！ - ゲームロジック
   データ（都市・路線・クイズ・コンボ・イベント）は data/ 以下に、
   保存処理は save.js に分離してある。ここでは「動かし方」だけを扱う。
   ============================================================ */

const START_CASH = 3000; // 万円
const GOAL_REVENUE = 100000000; // 万円 = 1兆円
const MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // 4月始まり年度
const MILESTONES = [
  { value: 1000000, label: "年間収益100億円" },
  { value: 10000000, label: "年間収益1000億円" },
  { value: 50000000, label: "年間収益5000億円" },
];
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const REGION_BONUS_PCT = 25;
const EVENT_CHANCE = 0.22;
const BONUS_CHALLENGE_CHANCE = 0.25;

// ---- DOM 参照 ----
let startScreen, gameScreen, continueBtn, newGameBtn;
let statYear, statMonth, victoryBadge, menuBtn, statAnnualRevenue, goalBarFill;
let statCash, statAssets, statProps, statMonopoly;
let cityIcon, cityName, cityCatch, cityRegionBadge;
let diceFace, directionButtons;
let shopBtn, mapBtn, collectionBtn, logBtn;
let modalRoot, modalBox;

// ---- ゲーム状態 ----
function freshState() {
  return {
    currentCity: "tokyo",
    year: 1,
    monthIndex: 0, // MONTH_ORDER[0] = 4月
    cash: START_CASH,
    owned: new Set(),
    monopolyCities: new Set(),
    regionConquered: new Set(),
    comboAchieved: new Set(),
    cityQuizCorrect: {},
    quizCorrectTotal: 0,
    quizAskedTotal: 0,
    discountCoupons: 0,
    kessanBonusPct: 0,
    kessanFlatBonus: 0,
    milestonesHit: new Set(),
    victoryAchieved: false,
    firstPurchaseDone: false,
    quizRecent: [],
    logHistory: [],
    pendingKessan: false,
  };
}
let state = freshState();

let pendingAfterClose = null;
let quizOnDone = null;
let quizCityKey = null;
let quizIsBonus = false;
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
function getRegion(regionKey) {
  return REGIONS.find((r) => r.key === regionKey);
}
function trimNum(n) {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}
function fmtMoney(manEn) {
  const v = Math.round(manEn);
  const sign = v < 0 ? "-" : "";
  const av = Math.abs(v);
  if (av >= 1e8) return sign + trimNum(av / 1e8) + "兆円";
  if (av >= 10000) return sign + trimNum(av / 10000) + "億円";
  return sign + av.toLocaleString("ja-JP") + "万円";
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
function addLog(text, cls) {
  const displayMonth = MONTH_ORDER[state.monthIndex];
  state.logHistory.push({ text, cls, when: `${state.year}年${displayMonth}月` });
  if (state.logHistory.length > 200) state.logHistory.shift();
}

// ============================================================
// 収益計算（基本収益・完全制覇ボーナス・コンボ・地方ボーナス）
// ============================================================
function getCityRevenue(city) {
  let cityRev = 0;
  let ownedCount = 0;
  city.properties.forEach((p, i) => {
    if (state.owned.has(propKey(city.key, i))) {
      cityRev += p.revenue;
      ownedCount++;
    }
  });
  const isMonopoly = ownedCount === city.properties.length && ownedCount > 0;
  return { base: cityRev, isMonopoly, total: isMonopoly ? cityRev * 2 : cityRev };
}

function getComboBonusAmount() {
  let bonus = 0;
  COMBOS.forEach((combo) => {
    const allOwned = combo.members.every((m) => state.owned.has(propKey(m.city, m.idx)));
    if (!allOwned) return;
    let memberRevSum = 0;
    combo.members.forEach((m) => {
      const city = getCity(m.city);
      const p = city.properties[m.idx];
      memberRevSum += p.revenue * (state.monopolyCities.has(m.city) ? 2 : 1);
    });
    bonus += Math.round((memberRevSum * combo.bonusPct) / 100);
  });
  return bonus;
}

function getRegionBonusAmount() {
  let bonus = 0;
  state.regionConquered.forEach((regionKey) => {
    let regionRev = 0;
    CITIES.filter((c) => c.region === regionKey).forEach((city) => {
      regionRev += getCityRevenue(city).total;
    });
    bonus += Math.round((regionRev * REGION_BONUS_PCT) / 100);
  });
  return bonus;
}

function getBaseAnnualRevenue() {
  let total = 0;
  CITIES.forEach((city) => {
    total += getCityRevenue(city).total;
  });
  total += getComboBonusAmount();
  total += getRegionBonusAmount();
  return total;
}

function computeKessanBreakdown() {
  let base = 0;
  let monopolyBonus = 0;
  CITIES.forEach((city) => {
    const r = getCityRevenue(city);
    base += r.base;
    if (r.isMonopoly) monopolyBonus += r.base;
  });
  const comboBonus = getComboBonusAmount();
  const regionBonus = getRegionBonusAmount();
  const subtotal = base + monopolyBonus + comboBonus + regionBonus;
  const otherBonus = Math.round((subtotal * state.kessanBonusPct) / 100) + state.kessanFlatBonus;
  const totalProfit = subtotal + otherBonus;
  return { base, monopolyBonus, comboBonus, regionBonus, otherBonus, totalProfit };
}

// ============================================================
// アンロック判定（クイズ累計正解数 / 所有率）
// ============================================================
function getNonLandmarkOwnedRatio(cityKey) {
  const city = getCity(cityKey);
  let owned = 0;
  let total = 0;
  city.properties.forEach((p, i) => {
    if (p.tier === "E") return;
    total++;
    if (state.owned.has(propKey(cityKey, i))) owned++;
  });
  return { owned, total, ratio: total > 0 ? owned / total : 1 };
}

function isPropertyLocked(cityKey, idx) {
  const city = getCity(cityKey);
  const p = city.properties[idx];
  if (!p.unlock) return false;
  const have = state.cityQuizCorrect[cityKey] || 0;
  if (p.unlock.quiz && have < p.unlock.quiz) return true;
  if (p.unlock.ownRatio) {
    const r = getNonLandmarkOwnedRatio(cityKey);
    if (r.ratio < p.unlock.ownRatio) return true;
  }
  return false;
}

function getLockedLandmarkIdxs(cityKey) {
  const city = getCity(cityKey);
  const result = [];
  city.properties.forEach((p, i) => {
    if (p.tier === "E" && !state.owned.has(propKey(cityKey, i)) && isPropertyLocked(cityKey, i)) result.push(i);
  });
  return result;
}

function getUnlockHint(cityKey) {
  const city = getCity(cityKey);
  const have = state.cityQuizCorrect[cityKey] || 0;
  let best = null;
  city.properties.forEach((p, i) => {
    if (!p.unlock || state.owned.has(propKey(cityKey, i))) return;
    const quizRemain = p.unlock.quiz ? Math.max(0, p.unlock.quiz - have) : 0;
    let ownRemain = 0;
    if (p.unlock.ownRatio) {
      const r = getNonLandmarkOwnedRatio(cityKey);
      const need = Math.ceil(r.total * p.unlock.ownRatio);
      ownRemain = Math.max(0, need - r.owned);
    }
    const totalRemain = quizRemain + ownRemain;
    if (totalRemain > 0 && (!best || totalRemain < best.totalRemain)) {
      best = { prop: p, quizRemain, ownRemain, totalRemain };
    }
  });
  return best;
}

function unlockHintText(hint) {
  const parts = [];
  if (hint.quizRemain > 0) parts.push(`クイズあと${hint.quizRemain}問正解`);
  if (hint.ownRemain > 0) parts.push(`通常物件あと${hint.ownRemain}件所有`);
  return `🔓 ${parts.join("＆")}で「${hint.prop.name}」がアンロック！`;
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
    await delay(180);
  }
  const justClosedFiscalYear = advanceMonth();
  state.pendingKessan = state.pendingKessan || justClosedFiscalYear;
  resolveCellArrival(state.currentCity);
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
// 経済（年度・決算）
// ============================================================
function advanceMonth() {
  state.monthIndex++;
  if (state.monthIndex >= 12) {
    state.monthIndex = 0;
    return true; // 3月が終わり、決算のタイミング
  }
  return false;
}

function showKessanModal() {
  const b = computeKessanBreakdown();
  const before = state.cash;
  const after = before + b.totalProfit;
  const line = (label, val, cls) =>
    val ? `<div class="kessan-line ${cls || ""}"><span>${label}</span><span>${val >= 0 ? "+" : ""}${fmtMoney(val)}</span></div>` : "";
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-title" style="justify-content:center;">📊 第${state.year}期 決算発表</div>
    <div class="kessan-lines">
      <div class="kessan-line"><span>物件基本収益</span><span>+${fmtMoney(b.base)}</span></div>
      ${line("👑 完全制覇ボーナス", b.monopolyBonus, "good")}
      ${line("🔗 物件コンボ", b.comboBonus, "good")}
      ${line("🗾 地方制覇ボーナス", b.regionBonus, "good")}
      ${line("✨ その他ボーナス", b.otherBonus, b.otherBonus >= 0 ? "good" : "bad")}
    </div>
    <div class="kessan-total">今期利益　<strong>${b.totalProfit >= 0 ? "+" : ""}${fmtMoney(b.totalProfit)}</strong></div>
    <div class="kessan-cashflow">現金　${fmtMoney(before)} → <strong>${fmtMoney(after)}</strong></div>
    <button class="modal-close-btn primary" data-action="kessan-confirm">つぎの期へ！</button>
  `;
}

function confirmKessan() {
  const b = computeKessanBreakdown();
  state.cash += b.totalProfit;
  addLog(`📊 第${state.year}期決算：利益 ${fmtMoney(b.totalProfit)}（現金 ${fmtMoney(state.cash)}）`, "highlight");
  state.year++;
  state.kessanBonusPct = 0;
  state.kessanFlatBonus = 0;
  state.pendingKessan = false;
  modalRoot.classList.add("hidden");
  modalBox.innerHTML = "";
  autoSave();
  afterTurnComplete();
}

// ============================================================
// 描画
// ============================================================
function renderHeader() {
  statYear.textContent = state.year;
  statMonth.textContent = MONTH_ORDER[state.monthIndex];
  const annual = getBaseAnnualRevenue();
  statAnnualRevenue.textContent = fmtMoney(annual);
  goalBarFill.style.width = Math.min(100, (annual / GOAL_REVENUE) * 100) + "%";
  statCash.textContent = fmtMoney(state.cash);
  statAssets.textContent = fmtMoney(state.cash + getOwnedPropertyValueSum());
  statProps.textContent = `${state.owned.size}/${getTotalPropertyCount()}`;
  statMonopoly.textContent = `${state.monopolyCities.size}/${CITIES.length}`;
  victoryBadge.classList.toggle("hidden", !state.victoryAchieved);
}

function renderDirectionButtons() {
  const neighbors = getNeighbors(state.currentCity);
  const many = neighbors.length > 2;
  directionButtons.className = "direction-buttons" + (many ? " grid" : "");
  directionButtons.innerHTML = neighbors
    .map((n, i) => {
      const c = getCity(n.cityKey);
      const spanFull = many && neighbors.length % 2 === 1 && i === neighbors.length - 1 ? ' style="grid-column:1 / -1;"' : "";
      return `<button class="dir-btn ${neighbors.length === 1 ? "solo" : ""}" data-city-key="${n.cityKey}" data-line-key="${n.lineKey}" data-dir="${n.dir}"${spanFull}>
        <span class="dir-icon">${c.icon}</span>${c.name}方面へ 🎲
      </button>`;
    })
    .join("");
}

function renderCityDisplayOnly() {
  const city = getCity(state.currentCity);
  const region = getRegion(city.region);
  cityIcon.textContent = city.icon;
  cityName.textContent = city.name;
  cityCatch.textContent = city.catch;
  const isMonopoly = state.monopolyCities.has(city.key);
  cityRegionBadge.textContent = `${region.icon} ${region.name}${isMonopoly ? " ・ 👑完全制覇" : ""}`;
  cityRegionBadge.classList.toggle("monopoly", isMonopoly);
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
  mapBtn.disabled = !enabled;
  collectionBtn.disabled = !enabled;
  logBtn.disabled = !enabled;
  menuBtn.disabled = !enabled;
}

// ============================================================
// ターン進行
// ============================================================
function afterTurnComplete() {
  if (state.pendingKessan) {
    showKessanModal();
    return;
  }
  renderCityPanel();
  renderHeader();
  setControlsEnabled(true);
  autoSave();
}

function resolveCellArrival(cityKey) {
  renderHeader();
  maybeTriggerEvent(cityKey, () => {
    handleCityArrival(cityKey);
  });
}

function handleCityArrival(cityKey) {
  state.currentCity = cityKey;
  renderCityDisplayOnly();
  addLog(`📍 ${getCity(cityKey).name}に到着。`, "highlight");
  showQuizModal(cityKey, () => openCityShop(cityKey), false);
}

// ============================================================
// ランダムイベント
// ============================================================
function computeEventImpact(ev) {
  let affected = [];
  let sumRev = 0;
  ev.targetCities.forEach((cityKey) => {
    const city = getCity(cityKey);
    if (!city) return;
    city.properties.forEach((p, i) => {
      if (ev.targetTiers.includes(p.tier) && state.owned.has(propKey(cityKey, i))) {
        affected.push(p.name);
        sumRev += p.revenue * (state.monopolyCities.has(cityKey) ? 2 : 1);
      }
    });
  });
  const amount = Math.round((sumRev * ev.pct) / 100);
  return { affected, amount };
}

function maybeTriggerEvent(cityKey, cont) {
  if (Math.random() > EVENT_CHANCE) {
    cont();
    return;
  }
  const candidates = EVENTS.map((ev) => ({ ev, impact: computeEventImpact(ev) })).filter((x) => x.impact.affected.length > 0);
  if (!candidates.length) {
    cont();
    return;
  }
  const { ev, impact } = pick(candidates);
  state.kessanFlatBonus += impact.amount;
  addLog(`${ev.icon} ${ev.name}：${ev.desc}（今期決算 ${impact.amount >= 0 ? "+" : ""}${fmtMoney(impact.amount)}）`, ev.tone === "good" ? "good" : "bad");
  setModalContent(`
    <div class="toast-icon">${ev.icon}</div>
    <div class="modal-title" style="justify-content:center;">${ev.name}</div>
    <div class="toast-text">${ev.desc}</div>
    <div class="toast-amount ${impact.amount >= 0 ? "good" : "bad"}">今期決算 ${impact.amount >= 0 ? "+" : ""}${fmtMoney(impact.amount)}</div>
    <button class="modal-close-btn primary" data-action="close-modal">なるほど！</button>
  `);
  setAfterClose(cont);
}

// ============================================================
// クイズ
// ============================================================
function pickQuiz(cityKey) {
  const normalPool = QUIZ_BANK.filter((q) => q.difficulty <= 2);
  const tagged = normalPool.filter((q) => q.tags && q.tags.includes(cityKey));
  const pool = tagged.length && Math.random() < 0.7 ? tagged : normalPool;
  return pickFromPool(pool);
}
function pickBonusQuiz() {
  const hardPool = QUIZ_BANK.filter((q) => q.difficulty >= 3);
  return pickFromPool(hardPool.length ? hardPool : QUIZ_BANK);
}
function pickFromPool(pool) {
  let available = pool.filter((q) => !state.quizRecent.includes(QUIZ_BANK.indexOf(q)));
  if (!available.length) available = pool;
  const q = pick(available);
  const idx = QUIZ_BANK.indexOf(q);
  state.quizRecent.push(idx);
  if (state.quizRecent.length > 15) state.quizRecent.shift();
  return q;
}

function applyQuizReward(isBonus) {
  const mult = isBonus ? 2.5 : 1;
  const roll = Math.random();
  if (roll < 0.4) {
    const amt = Math.max(300, Math.round(((state.cash * 0.15 * mult) / 10)) * 10);
    state.cash += amt;
    return `💰 現金 +${fmtMoney(amt)} ゲット！`;
  } else if (roll < 0.7) {
    const n = isBonus ? 2 : 1;
    state.discountCoupons += n;
    return `🎟️ 次に買う物件が3割引になるクーポンを${n}枚ゲット！`;
  } else {
    const pct = Math.round((8 + Math.random() * 7) * mult);
    state.kessanBonusPct += pct;
    return `📊 今期決算ボーナス +${pct}%（累計${state.kessanBonusPct}%）を獲得！`;
  }
}

function showQuizModal(cityKey, onDone, isBonus) {
  quizOnDone = onDone;
  quizCityKey = cityKey;
  quizIsBonus = !!isBonus;
  const q = quizIsBonus ? pickBonusQuiz() : pickQuiz(cityKey);
  currentQuizData = q;
  currentQuizAnswered = false;
  currentQuizOptions = shuffle(q.options.map((text, i) => ({ text, isCorrect: i === q.correct })));
  state.quizAskedTotal++;
  const hint = !quizIsBonus ? getUnlockHint(cityKey) : null;
  const hintHtml = hint && hint.quizRemain <= 2 ? `<div class="hint-banner">${unlockHintText(hint)}</div>` : "";
  const optsHtml = currentQuizOptions
    .map((o, i) => `<button class="quiz-opt" data-action="quiz-opt" data-idx="${i}">${o.text}</button>`)
    .join("");
  const title = quizIsBonus ? "🌟 ボーナスチャレンジ！" : "❓ クイズ！";
  setModalContent(`
    <div class="modal-title">${title}</div>
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
    const beforeLocked = getLockedLandmarkIdxs(quizCityKey);
    state.cityQuizCorrect[quizCityKey] = (state.cityQuizCorrect[quizCityKey] || 0) + 1;
    const rewardText = applyQuizReward(quizIsBonus);
    rewardHtml = `<div class="quiz-reward">${rewardText}</div>`;
    const afterLocked = getLockedLandmarkIdxs(quizCityKey);
    const city = getCity(quizCityKey);
    const justUnlocked = beforeLocked.filter((i) => !afterLocked.includes(i)).map((i) => city.properties[i]);
    if (justUnlocked.length) {
      unlockHtml = `<div class="quiz-unlock-note">🔓 「${justUnlocked.map((p) => p.name).join("」「")}」がアンロックされた！</div>`;
      addLog(`🔓 ${city.name}の「${justUnlocked.map((p) => p.name).join("」「")}」がアンロックされた！`, "highlight");
    }
    autoSave();
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

function maybeOfferBonusChallenge(onDone) {
  if (Math.random() > BONUS_CHALLENGE_CHANCE || !QUIZ_BANK.some((q) => q.difficulty >= 3)) {
    onDone();
    return;
  }
  setModalContent(`
    <div class="celebrate">
      <div class="big-emoji">🌟</div>
      <div class="celebrate-title">ボーナスチャレンジ！</div>
      <div class="celebrate-sub">むずかしい問題に挑戦して、大きなごほうびを狙おう！<br>失敗してもペナルティはないよ。</div>
      <button class="modal-close-btn primary" data-action="bonus-accept">挑戦する</button>
      <button class="modal-close-btn secondary-outline" data-action="bonus-skip">スキップ</button>
    </div>
  `);
  pendingBonusOnDone = onDone;
}
let pendingBonusOnDone = null;

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
  activeCityKey = state.currentCity;
  shopCloseCallback = null;
  renderCityShopContent(state.currentCity);
  setAfterClose(null);
}

function renderCityShopContent(cityKey) {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildCityShopHtml(cityKey);
}

function isPropertyInAchievedCombo(cityKey, idx) {
  return COMBOS.some((combo) => state.comboAchieved.has(combo.key) && combo.members.some((m) => m.city === cityKey && m.idx === idx));
}

function buildCityShopHtml(cityKey) {
  const city = getCity(cityKey);
  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(cityKey, i))).length;
  const isMonopoly = state.monopolyCities.has(cityKey);
  const remain = city.properties.length - ownedCount;
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
      const locked = !owned && isPropertyLocked(cityKey, i);
      const discounted = !owned && !locked && state.discountCoupons > 0;
      const price = discounted ? Math.round(p.price * 0.7) : p.price;
      const affordable = state.cash >= price;
      let badge, buyEl;
      if (owned) {
        const inCombo = isPropertyInAchievedCombo(cityKey, i);
        badge = `<span class="prop-badge owned-badge">購入済み</span>${inCombo ? '<span class="prop-badge combo-badge">🔗 コンボ成立中</span>' : ""}`;
        buyEl = `<button class="prop-buy-btn" disabled>購入済み</button>`;
      } else if (locked) {
        const have = state.cityQuizCorrect[cityKey] || 0;
        const parts = [];
        if (p.unlock.quiz) parts.push(`クイズ累計${have}/${p.unlock.quiz}問正解`);
        if (p.unlock.ownRatio) {
          const r = getNonLandmarkOwnedRatio(cityKey);
          const need = Math.ceil(r.total * p.unlock.ownRatio);
          parts.push(`通常物件${r.owned}/${need}件所有`);
        }
        badge = `<span class="prop-badge locked-badge">🔒 ${parts.join("・")}で解禁</span>`;
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

function buyProperty(cityKey, idx) {
  const city = getCity(cityKey);
  const p = city.properties[idx];
  const key = propKey(cityKey, idx);
  if (state.owned.has(key)) return;
  if (isPropertyLocked(cityKey, idx)) return;
  const discounted = state.discountCoupons > 0;
  const price = discounted ? Math.round(p.price * 0.7) : p.price;
  if (state.cash < price) return;

  const beforeLockedLandmarks = getLockedLandmarkIdxs(cityKey);

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

  const newCombos = checkNewCombos(cityKey, idx);
  const afterLockedLandmarks = getLockedLandmarkIdxs(cityKey);
  const newlyUnlockedLandmarks = beforeLockedLandmarks.filter((i) => !afterLockedLandmarks.includes(i)).map((i) => city.properties[i]);
  if (newlyUnlockedLandmarks.length) {
    addLog(`🔓 ${city.name}の「${newlyUnlockedLandmarks.map((lp) => lp.name).join("」「")}」がアンロックされた！`, "highlight");
  }

  renderHeader();
  autoSave();
  handlePurchaseCelebration(city, p, idx, newlyMonopoly, cityKey, newCombos, newlyUnlockedLandmarks);
}

function checkNewCombos(propCityKey, propIdx) {
  const newlyCompleted = [];
  COMBOS.forEach((combo) => {
    if (state.comboAchieved.has(combo.key)) return;
    const isMember = combo.members.some((m) => m.city === propCityKey && m.idx === propIdx);
    if (!isMember) return;
    const allOwned = combo.members.every((m) => state.owned.has(propKey(m.city, m.idx)));
    if (allOwned) {
      state.comboAchieved.add(combo.key);
      newlyCompleted.push(combo);
    }
  });
  return newlyCompleted;
}

function checkRegionConquest(regionKey) {
  if (state.regionConquered.has(regionKey)) return false;
  const citiesInRegion = CITIES.filter((c) => c.region === regionKey);
  const allConquered = citiesInRegion.every((c) => state.monopolyCities.has(c.key));
  if (allConquered) {
    state.regionConquered.add(regionKey);
    return true;
  }
  return false;
}

// ============================================================
// 演出（購入・完全制覇・コンボ・地方制覇・節目・トリリオネア達成）
// ============================================================
function returnToShop() {
  renderCityShopContent(activeCityKey);
  setAfterClose(shopCloseCallback);
}

function handlePurchaseCelebration(city, prop, idx, newlyMonopoly, cityKey, newCombos, newlyUnlockedLandmarks) {
  const isFirst = !state.firstPurchaseDone;
  state.firstPurchaseDone = true;

  let newlyRegionConquered = null;
  if (newlyMonopoly && checkRegionConquest(city.region)) {
    newlyRegionConquered = getRegion(city.region);
    addLog(`🗾 ${newlyRegionConquered.name}地方を完全制覇！`, "highlight");
    autoSave();
  }

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
    autoSave();
    showVictoryModal();
    return;
  }

  const achievements = [];
  if (newlyRegionConquered) {
    achievements.push({ icon: "🗾", title: `${newlyRegionConquered.name}地方 完全制覇！`, sub: "地方全体に収益ボーナスがついたよ！" });
  }
  if (newlyMonopoly) {
    achievements.push({ icon: "👑", title: `${city.name} 完全制覇！`, sub: "収益が2倍になったよ！" });
  }
  newCombos.forEach((combo) => {
    achievements.push({ icon: combo.icon, title: `${combo.name} 成立！`, sub: `関連物件の収益 +${combo.bonusPct}%！` });
  });
  if (newlyUnlockedLandmarks && newlyUnlockedLandmarks.length) {
    achievements.push({ icon: "🔓", title: "ランドマークがアンロック！", sub: `「${newlyUnlockedLandmarks.map((p) => p.name).join("」「")}」が購入できるようになった！` });
  }
  if (milestoneHit) {
    achievements.push({ icon: "🎊", title: "節目突破！", sub: `${milestoneHit.label}を達成！` });
  }

  if (achievements.length) {
    flashAchievementCelebration(achievements);
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

function refreshShopWithPulse(cityKey, idx) {
  renderCityShopContent(cityKey);
  const row = modalBox.querySelector(`.prop-card[data-prop-row="${idx}"]`);
  if (row) {
    row.classList.add("just-bought");
    setTimeout(() => row.classList.remove("just-bought"), 500);
  }
}

function flashAchievementCelebration(achievements) {
  const primary = achievements[0];
  const extra = achievements.slice(1);
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">${primary.icon}</div>
      <div class="confetti-row">🎉🎊✨🎊🎉</div>
      <div class="celebrate-title">${primary.title}</div>
      <div class="celebrate-sub">${primary.sub}</div>
      ${extra.map((a) => `<div class="celebrate-sub">${a.icon} ${a.title}</div>`).join("")}
      <button class="modal-close-btn primary" data-action="close-modal">やった！</button>
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
        <tr><td style="padding:6px 4px;font-size:13px;">📅 かかった期間</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">第${state.year}期 ${MONTH_ORDER[state.monthIndex]}月</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">📊 総資産</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${fmtMoney(assets)}</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">🏢 所有物件数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.owned.size} / ${getTotalPropertyCount()}件</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">👑 完全制覇都市数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.monopolyCities.size} / ${CITIES.length}都市</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">🗾 地方完全制覇数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.regionConquered.size} / ${REGIONS.length}地方</td></tr>
        <tr><td style="padding:6px 4px;font-size:13px;">❓ クイズ正解数</td><td style="padding:6px 4px;text-align:right;color:var(--accent);font-weight:bold;">${state.quizCorrectTotal} / ${state.quizAskedTotal}問</td></tr>
      </table>
      <div class="celebrate-sub">この先も遊び続けて、全物件制覇・全地方制覇を目指せるよ！</div>
      <button class="modal-close-btn primary" data-action="continue-play">🎉 続けてあそぶ</button>
    </div>`;
}

// ============================================================
// ログ・マップ・コレクション
// ============================================================
function showLogModal() {
  const entries = state.logHistory.slice().reverse();
  const html = entries.length
    ? entries.map((e) => `<div class="log-entry ${e.cls ? "log-" + e.cls : ""}"><span class="log-when">${e.when}</span>${e.text}</div>`).join("")
    : `<div class="log-empty">まだ記録がありません。</div>`;
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `<div class="modal-title">📜 プレイログ</div>${html}<button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
  setAfterClose(null);
}

function showMapModal() {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildMapHtml();
  setAfterClose(null);
}

function buildMapHtml() {
  const regionsHtml = REGIONS.map((region) => {
    const cities = CITIES.filter((c) => c.region === region.key);
    const conquered = state.regionConquered.has(region.key);
    const chips = cities
      .map((city) => {
        const isCurrent = city.key === state.currentCity;
        const isMonopoly = state.monopolyCities.has(city.key);
        const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
        const visited = ownedCount > 0;
        return `<span class="map-chip ${isCurrent ? "current" : ""} ${isMonopoly ? "monopoly" : visited ? "visited" : ""}">${city.icon} ${city.name}${isMonopoly ? " 👑" : ""}${isCurrent ? " 📍" : ""}</span>`;
      })
      .join("");
    return `<div class="overview-city">
      <div class="overview-city-head">
        <span>${region.icon} ${region.name}</span>
        <span class="badge-mini ${conquered ? "done" : ""}">${conquered ? "👑 地方完全制覇" : cities.filter((c) => state.monopolyCities.has(c.key)).length + "/" + cities.length + "都市制覇"}</span>
      </div>
      <div class="overview-props-mini">${chips}</div>
    </div>`;
  }).join("");
  return `<div class="modal-title">🗺️ 本州マップ</div>
    <div class="modal-sub">📍が現在地。都市をタップして移動はできないよ（サイコロで移動しよう）。</div>
    ${regionsHtml}
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
}

function showCollectionModal() {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildCollectionHtml();
  setAfterClose(null);
}

function buildCollectionHtml() {
  const totalProps = getTotalPropertyCount();
  const ownedProps = state.owned.size;
  const overallPct = Math.round((ownedProps / totalProps) * 100);

  const regionsHtml = REGIONS.map((region) => {
    const cities = CITIES.filter((c) => c.region === region.key);
    const cityOwned = cities.reduce((s, c) => s + c.properties.filter((_, i) => state.owned.has(propKey(c.key, i))).length, 0);
    const cityTotal = cities.reduce((s, c) => s + c.properties.length, 0);
    const conquered = state.regionConquered.has(region.key);
    const pct = Math.round((cityOwned / cityTotal) * 100);
    return `<div class="collection-row">
      <span>${region.icon} ${region.name}${conquered ? " 👑" : ""}</span>
      <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
      <span class="collection-pct">${cityOwned}/${cityTotal}</span>
    </div>`;
  }).join("");

  const landmarks = [];
  CITIES.forEach((city) => {
    city.properties.forEach((p, i) => {
      if (p.tier === "E") landmarks.push({ city, p, i });
    });
  });
  const landmarksHtml = landmarks
    .map(({ city, p, i }) => {
      const owned = state.owned.has(propKey(city.key, i));
      return `<span class="mini-chip ${owned ? "owned" : "locked"}">${city.icon}${p.icon} ${city.name}：${p.name}${owned ? " ✓" : " 🔒"}</span>`;
    })
    .join("");

  const combosHtml = COMBOS.map((combo) => {
    const done = state.comboAchieved.has(combo.key);
    return `<span class="mini-chip ${done ? "owned" : ""}">${combo.icon} ${combo.name}${done ? " ✓" : ""}</span>`;
  }).join("");

  return `
    <div class="modal-title">🏆 コレクション</div>
    <div class="collection-overall">
      <div class="collection-overall-pct">${overallPct}%</div>
      <div class="collection-overall-label">全物件制覇率（${ownedProps}/${totalProps}件）</div>
    </div>
    <div class="modal-sub" style="margin-top:14px;">地方別 完全制覇状況</div>
    ${regionsHtml}
    <div class="modal-sub" style="margin-top:14px;">🏙️ ランドマーク物件（${landmarks.filter((l) => state.owned.has(propKey(l.city.key, l.i))).length}/${landmarks.length}）</div>
    <div class="overview-props-mini">${landmarksHtml}</div>
    <div class="modal-sub" style="margin-top:14px;">🔗 産業コンボ（${state.comboAchieved.size}/${COMBOS.length}）</div>
    <div class="overview-props-mini">${combosHtml}</div>
    <div class="modal-sub" style="margin-top:14px;">❓ クイズ正解数：${state.quizCorrectTotal} / ${state.quizAskedTotal}問</div>
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>
  `;
}

function showMenuModal() {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-title">☰ メニュー</div>
    <div class="modal-sub">サイコロで移動して物件を買い占め、都市や地方の完全制覇を目指そう。クイズは毎ターン出題され、正解するとごほうびがもらえるよ。年間収益1兆円で「トリリオネア」達成！</div>
    <button class="modal-close-btn secondary-outline" data-action="close-modal">ゲームにもどる</button>
    <button class="modal-close-btn primary" data-action="menu-new-game" style="margin-top:8px;">🆕 はじめから始める</button>
  `;
  setAfterClose(null);
}

function showConfirmNewGameModal() {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">⚠️</div>
      <div class="celebrate-title">はじめから始めますか？</div>
      <div class="celebrate-sub">今のセーブデータは消えてしまいます。</div>
      <button class="modal-close-btn primary" data-action="confirm-new-game">はじめから始める</button>
      <button class="modal-close-btn secondary-outline" data-action="close-modal">キャンセル</button>
    </div>`;
  setAfterClose(null);
}

// ============================================================
// セーブ / ロード
// ============================================================
function serializeState() {
  return {
    currentCity: state.currentCity,
    year: state.year,
    monthIndex: state.monthIndex,
    cash: state.cash,
    owned: [...state.owned],
    monopolyCities: [...state.monopolyCities],
    regionConquered: [...state.regionConquered],
    comboAchieved: [...state.comboAchieved],
    cityQuizCorrect: state.cityQuizCorrect,
    quizCorrectTotal: state.quizCorrectTotal,
    quizAskedTotal: state.quizAskedTotal,
    discountCoupons: state.discountCoupons,
    kessanBonusPct: state.kessanBonusPct,
    kessanFlatBonus: state.kessanFlatBonus,
    milestonesHit: [...state.milestonesHit],
    victoryAchieved: state.victoryAchieved,
    firstPurchaseDone: state.firstPurchaseDone,
    quizRecent: state.quizRecent,
    logHistory: state.logHistory.slice(-150),
    pendingKessan: state.pendingKessan,
  };
}

function deserializeState(data) {
  const s = freshState();
  s.currentCity = data.currentCity || "tokyo";
  s.year = data.year || 1;
  s.monthIndex = data.monthIndex || 0;
  s.cash = data.cash != null ? data.cash : START_CASH;
  s.owned = new Set(data.owned || []);
  s.monopolyCities = new Set(data.monopolyCities || []);
  s.regionConquered = new Set(data.regionConquered || []);
  s.comboAchieved = new Set(data.comboAchieved || []);
  s.cityQuizCorrect = data.cityQuizCorrect || {};
  s.quizCorrectTotal = data.quizCorrectTotal || 0;
  s.quizAskedTotal = data.quizAskedTotal || 0;
  s.discountCoupons = data.discountCoupons || 0;
  s.kessanBonusPct = data.kessanBonusPct || 0;
  s.kessanFlatBonus = data.kessanFlatBonus || 0;
  s.milestonesHit = new Set(data.milestonesHit || []);
  s.victoryAchieved = !!data.victoryAchieved;
  s.firstPurchaseDone = !!data.firstPurchaseDone;
  s.quizRecent = data.quizRecent || [];
  s.logHistory = data.logHistory || [];
  s.pendingKessan = !!data.pendingKessan;
  return s;
}

function autoSave() {
  SaveManager.save(serializeState());
}

// ============================================================
// ゲーム開始
// ============================================================
function startNewGame() {
  state = freshState();
  diceFace.textContent = "🎲";
  addLog("🎬 ゲームスタート！物件を買い占めてトリリオネアを目指そう！", "highlight");
  renderHeader();
  renderCityPanel();
  setControlsEnabled(false);
  autoSave();
  handleCityArrival("tokyo");
}

function continueGame() {
  const data = SaveManager.load();
  if (!data) {
    startNewGame();
    return;
  }
  state = deserializeState(data);
  diceFace.textContent = "🎲";
  renderHeader();
  renderCityPanel();
  setControlsEnabled(true);
}

// ============================================================
// 初期化・イベント配線
// ============================================================
function initRefs() {
  startScreen = document.getElementById("startScreen");
  gameScreen = document.getElementById("gameScreen");
  continueBtn = document.getElementById("continueBtn");
  newGameBtn = document.getElementById("newGameBtn");

  statYear = document.getElementById("statYear");
  statMonth = document.getElementById("statMonth");
  victoryBadge = document.getElementById("victoryBadge");
  menuBtn = document.getElementById("menuBtn");
  statAnnualRevenue = document.getElementById("statAnnualRevenue");
  goalBarFill = document.getElementById("goalBarFill");
  statCash = document.getElementById("statCash");
  statAssets = document.getElementById("statAssets");
  statProps = document.getElementById("statProps");
  statMonopoly = document.getElementById("statMonopoly");

  cityIcon = document.getElementById("cityIcon");
  cityName = document.getElementById("cityName");
  cityCatch = document.getElementById("cityCatch");
  cityRegionBadge = document.getElementById("cityRegionBadge");

  diceFace = document.getElementById("diceFace");
  directionButtons = document.getElementById("directionButtons");

  shopBtn = document.getElementById("shopBtn");
  mapBtn = document.getElementById("mapBtn");
  collectionBtn = document.getElementById("collectionBtn");
  logBtn = document.getElementById("logBtn");

  modalRoot = document.getElementById("modalRoot");
  modalBox = document.getElementById("modalBox");
}

function showTitleScreen() {
  const hasSave = SaveManager.hasSave();
  continueBtn.classList.toggle("hidden", !hasSave);
}

function wireEvents() {
  continueBtn.addEventListener("click", () => {
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    continueGame();
  });
  newGameBtn.addEventListener("click", () => {
    if (SaveManager.hasSave()) {
      showConfirmNewGameModal();
      return;
    }
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

  shopBtn.addEventListener("click", () => {
    if (shopBtn.disabled) return;
    showShopStandalone();
  });
  mapBtn.addEventListener("click", () => {
    if (mapBtn.disabled) return;
    showMapModal();
  });
  collectionBtn.addEventListener("click", () => {
    if (collectionBtn.disabled) return;
    showCollectionModal();
  });
  logBtn.addEventListener("click", () => {
    if (logBtn.disabled) return;
    showLogModal();
  });
  menuBtn.addEventListener("click", () => {
    if (menuBtn.disabled) return;
    showMenuModal();
  });

  modalBox.addEventListener("click", (e) => {
    const optBtn = e.target.closest('[data-action="quiz-opt"]');
    if (optBtn) {
      onQuizOptionClick(Number(optBtn.dataset.idx));
      return;
    }
    const contBtn = e.target.closest('[data-action="quiz-continue"]');
    if (contBtn) {
      const fn = quizOnDone;
      const wasBonus = quizIsBonus;
      quizOnDone = null;
      if (fn) {
        if (wasBonus) fn();
        else maybeOfferBonusChallenge(fn);
      }
      return;
    }
    const bonusAccept = e.target.closest('[data-action="bonus-accept"]');
    if (bonusAccept) {
      const fn = pendingBonusOnDone;
      pendingBonusOnDone = null;
      showQuizModal(quizCityKey, fn, true);
      return;
    }
    const bonusSkip = e.target.closest('[data-action="bonus-skip"]');
    if (bonusSkip) {
      const fn = pendingBonusOnDone;
      pendingBonusOnDone = null;
      modalRoot.classList.add("hidden");
      modalBox.innerHTML = "";
      if (fn) fn();
      return;
    }
    const buyBtn = e.target.closest('[data-action="buy-prop"]');
    if (buyBtn && !buyBtn.disabled) {
      buyProperty(buyBtn.dataset.city, Number(buyBtn.dataset.idx));
      return;
    }
    const kessanBtn = e.target.closest('[data-action="kessan-confirm"]');
    if (kessanBtn) {
      confirmKessan();
      return;
    }
    const closeBtn = e.target.closest('[data-action="close-modal"]');
    if (closeBtn) {
      closeModal();
      return;
    }
    const continueBtn2 = e.target.closest('[data-action="continue-play"]');
    if (continueBtn2) {
      returnToShop();
      return;
    }
    const menuNewGame = e.target.closest('[data-action="menu-new-game"]');
    if (menuNewGame) {
      showConfirmNewGameModal();
      return;
    }
    const confirmNewGame = e.target.closest('[data-action="confirm-new-game"]');
    if (confirmNewGame) {
      SaveManager.clear();
      modalRoot.classList.add("hidden");
      modalBox.innerHTML = "";
      startScreen.classList.add("hidden");
      gameScreen.classList.remove("hidden");
      startNewGame();
      return;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initRefs();
  wireEvents();
  showTitleScreen();
});
