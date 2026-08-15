/* ============================================================
   にっぽん物件王 - ゲームロジック
   ============================================================ */

const CITY_SPACING = 6; // 都市と都市の間のマス数
const START_CASH = 2500;

// ---- DOM 参照 ----
let startScreen, gameScreen, startBtn;
let statusBar, statLocation, statCash, statAssets, statProps, statMonopoly, statDistance, goalBarFill;
let overviewBtn, boardStrip, messageLog, incomeFloat, diceFace, diceBtn;
let modalRoot, modalBox;

// ---- ゲーム状態 ----
let state = {
  board: [],
  pos: 0,
  cash: START_CASH,
  cumulativeIncome: 0,
  quizCorrect: 0,
  quizAskedCount: 0,
  owned: new Set(),
  monopolyCities: new Set(),
  discountCoupons: 0,
  skipNextTurn: false,
  extraTurnPending: false,
  forceCityCheck: false,
  gameOver: false,
  quizPool: [],
  quizPoolPtr: 0,
  visitedCityKeys: new Set(),
};

let pendingAfterClose = null;
let quizOnDone = null;
let currentQuizData = null;
let currentQuizOptions = [];
let currentQuizAnswered = false;
let incomeFloatTimer = null;

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
function fmt(n) {
  return Math.round(n).toLocaleString("ja-JP");
}
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function propKey(cityKey, idx) {
  return cityKey + "#" + idx;
}
function lastIndex() {
  return state.board.length - 1;
}
function weightedPick(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [key, w] of pairs) {
    if (r < w) return key;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
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

// ============================================================
// 盤面生成
// ============================================================
function buildBoard() {
  const weights = [
    ["quiz", 30],
    ["money_plus", 20],
    ["money_minus", 15],
    ["card", 25],
    ["blank", 10],
  ];
  const cells = [];
  for (let i = 0; i < CITIES.length; i++) {
    if (i > 0) {
      for (let f = 0; f < CITY_SPACING - 1; f++) {
        cells.push({ type: weightedPick(weights) });
      }
    }
    cells.push({ type: "city", cityIdx: i });
  }
  state.board = cells;
}

function advanceWithCityStop(fromPos, steps) {
  let target = fromPos;
  for (let s = 1; s <= steps; s++) {
    const cand = fromPos + s;
    if (cand >= lastIndex()) {
      target = lastIndex();
      break;
    }
    target = cand;
    if (state.board[cand].type === "city") break;
  }
  return target;
}

// ============================================================
// 描画
// ============================================================
function getLocationLabel() {
  const cell = state.board[state.pos];
  if (cell.type === "city") return CITIES[cell.cityIdx].name;
  let prevCity = null,
    nextCity = null;
  for (let i = state.pos - 1; i >= 0; i--) {
    if (state.board[i].type === "city") {
      prevCity = CITIES[state.board[i].cityIdx].name;
      break;
    }
  }
  for (let i = state.pos + 1; i < state.board.length; i++) {
    if (state.board[i].type === "city") {
      nextCity = CITIES[state.board[i].cityIdx].name;
      break;
    }
  }
  return `${prevCity || ""}→${nextCity || ""} 移動中`;
}

function renderHeader() {
  const distance = lastIndex() - state.pos;
  const propertyValueSum = getOwnedPropertyValueSum();
  const totalAssets = state.cash + propertyValueSum;
  statCash.textContent = fmt(state.cash);
  statAssets.textContent = fmt(totalAssets);
  statProps.textContent = state.owned.size;
  statMonopoly.textContent = state.monopolyCities.size;
  statDistance.textContent = state.pos >= lastIndex() ? "ゴール！" : `${distance}マス`;
  goalBarFill.style.width = Math.min(100, (state.pos / lastIndex()) * 100) + "%";
  statLocation.textContent = getLocationLabel();
}

const CELL_TYPE_ICON = { quiz: "❓", money_plus: "💰", money_minus: "💸", card: "🎴", blank: "・" };

function renderBoardStripDOM() {
  boardStrip.innerHTML = "";
  state.board.forEach((cell, idx) => {
    const div = document.createElement("div");
    div.className = "cell" + (cell.type === "city" ? " city" : "");
    div.dataset.index = idx;
    div.textContent = cell.type === "city" ? CITIES[cell.cityIdx].icon : CELL_TYPE_ICON[cell.type];
    boardStrip.appendChild(div);
  });
  renderBoardMarker();
}

function renderBoardMarker() {
  const cellEls = boardStrip.querySelectorAll(".cell");
  cellEls.forEach((el) => {
    const idx = Number(el.dataset.index);
    el.classList.toggle("visited", idx < state.pos);
    const marker = el.querySelector(".player-marker");
    if (marker) marker.remove();
    const cell = state.board[idx];
    if (cell.type === "city") {
      const city = CITIES[cell.cityIdx];
      const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
      el.classList.toggle("owned-city", ownedCount > 0 && ownedCount < city.properties.length);
      el.classList.toggle("monopoly-city", state.monopolyCities.has(city.key));
    }
  });
  const curEl = boardStrip.querySelector(`.cell[data-index="${state.pos}"]`);
  if (curEl) {
    const marker = document.createElement("span");
    marker.className = "player-marker";
    marker.textContent = "🚗";
    curEl.appendChild(marker);
    curEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function log(text, cls) {
  const div = document.createElement("div");
  div.className = "log-line" + (cls ? ` log-${cls}` : "");
  div.textContent = text;
  messageLog.appendChild(div);
  messageLog.scrollTop = messageLog.scrollHeight;
  while (messageLog.children.length > 50) messageLog.removeChild(messageLog.firstChild);
}

function showIncomeFloat(amount) {
  incomeFloat.classList.add("hidden");
  incomeFloat.textContent = `📈 収益 +${fmt(amount)}万円`;
  void incomeFloat.offsetWidth;
  incomeFloat.classList.remove("hidden");
  clearTimeout(incomeFloatTimer);
  incomeFloatTimer = setTimeout(() => incomeFloat.classList.add("hidden"), 1400);
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
  diceBtn.disabled = !enabled;
  overviewBtn.disabled = !enabled;
}

// ============================================================
// ターン進行の中心フロー
// ============================================================
function afterEventResolved() {
  if (state.forceCityCheck) {
    state.forceCityCheck = false;
    const cell = state.board[state.pos];
    handleCityArrival(cell.cityIdx);
    return;
  }
  if (state.pos >= lastIndex()) {
    showResult();
    return;
  }
  if (state.extraTurnPending) {
    state.extraTurnPending = false;
    log("🎁 もう一度サイコロをふれる！", "highlight");
    setTimeout(() => rollDice(), 500);
    return;
  }
  setControlsEnabled(true);
}

function tickTurnIncome() {
  let total = 0;
  CITIES.forEach((city) => {
    let cityIncome = 0;
    let ownedCount = 0;
    city.properties.forEach((p, i) => {
      if (state.owned.has(propKey(city.key, i))) {
        cityIncome += p.revenue;
        ownedCount++;
      }
    });
    if (ownedCount === city.properties.length && ownedCount > 0) cityIncome *= 2;
    total += cityIncome;
  });
  if (total > 0) {
    state.cash += total;
    state.cumulativeIncome += total;
    renderHeader();
    showIncomeFloat(total);
  }
}

async function movePlayer(steps) {
  const from = state.pos;
  const target = advanceWithCityStop(from, steps);
  let cur = from;
  while (cur < target) {
    cur++;
    state.pos = cur;
    renderBoardMarker();
    renderHeader();
    await delay(150);
  }
  tickTurnIncome();
  resolveCellEvent(target);
}

function resolveCellEvent(pos) {
  const cell = state.board[pos];
  if (cell.type === "city") handleCityArrival(cell.cityIdx);
  else if (cell.type === "quiz") handleQuizCell();
  else if (cell.type === "money_plus") handleMoneyEvent(true);
  else if (cell.type === "money_minus") handleMoneyEvent(false);
  else if (cell.type === "card") handleCardCell();
  else handleBlankCell();
}

// ============================================================
// サイコロ
// ============================================================
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function rollDice() {
  if (state.gameOver) return;
  if (state.skipNextTurn) {
    state.skipNextTurn = false;
    setControlsEnabled(false);
    diceFace.textContent = "😴";
    log("😴 今回はお休み…（スキップ）", "bad");
    setTimeout(() => setControlsEnabled(true), 700);
    return;
  }
  setControlsEnabled(false);
  diceFace.classList.add("rolling");
  let cycles = 0;
  const spin = setInterval(() => {
    diceFace.textContent = DICE_FACES[randInt(0, 5)];
    cycles++;
    if (cycles > 7) {
      clearInterval(spin);
      finishRoll();
    }
  }, 70);
}

function finishRoll() {
  diceFace.classList.remove("rolling");
  const value = randInt(1, 6);
  diceFace.textContent = DICE_FACES[value - 1];
  log(`🎲 ${value}が出た！`);
  movePlayer(value);
}

// ============================================================
// クイズ
// ============================================================
function getNextQuiz() {
  if (state.quizPoolPtr >= state.quizPool.length) {
    state.quizPool = shuffle(QUIZ_BANK.map((_, i) => i));
    state.quizPoolPtr = 0;
  }
  const idx = state.quizPool[state.quizPoolPtr++];
  return QUIZ_BANK[idx];
}

function applyQuizReward() {
  const roll = Math.random();
  if (roll < 0.4) {
    const amt = Math.round(randInt(100, 300) / 10) * 10;
    state.cash += amt;
    return `💰 購入資金 +${amt}万円 ゲット！`;
  } else if (roll < 0.7) {
    state.discountCoupons++;
    return `🎟️ 次に買う物件が3割引になるクーポンをゲット！`;
  } else {
    const amt = Math.round(randInt(80, 200) / 10) * 10;
    state.cash += amt;
    state.cumulativeIncome += amt;
    return `📈 収益ボーナス +${amt}万円 ゲット！`;
  }
}

function showQuizModal(onDone) {
  quizOnDone = onDone;
  const q = getNextQuiz();
  currentQuizData = q;
  currentQuizAnswered = false;
  currentQuizOptions = shuffle(q.options.map((text, i) => ({ text, isCorrect: i === q.correct })));
  state.quizAskedCount++;
  const optsHtml = currentQuizOptions
    .map((o, i) => `<button class="quiz-opt" data-action="quiz-opt" data-idx="${i}">${o.text}</button>`)
    .join("");
  setModalContent(`
    <div class="modal-title">❓ 社会科クイズ</div>
    <div class="modal-sub">正解すると物件購入に役立つごほうびがもらえるよ！</div>
    <p style="font-size:15px;font-weight:bold;line-height:1.6;">${q.q}</p>
    <div class="quiz-options" id="quizOptionsBox">${optsHtml}</div>
  `);
}

function onQuizOptionClick(idx) {
  if (currentQuizAnswered) return;
  currentQuizAnswered = true;
  const chosen = currentQuizOptions[idx];
  let rewardHtml = "";
  if (chosen.isCorrect) {
    state.quizCorrect++;
    const rewardText = applyQuizReward();
    rewardHtml = `<div class="quiz-reward">${rewardText}</div>`;
  }
  document.querySelectorAll("#quizOptionsBox .quiz-opt").forEach((btn, i) => {
    btn.disabled = true;
    if (currentQuizOptions[i].isCorrect) btn.classList.add("correct");
    else if (i === idx) btn.classList.add("wrong");
  });
  renderHeader();
  const resultBox = document.createElement("div");
  resultBox.className = "quiz-result-box";
  resultBox.innerHTML = `<strong>${chosen.isCorrect ? "🎉 せいかい！" : "😵 ざんねん…"}</strong><br>${currentQuizData.explain}${rewardHtml}`;
  document.getElementById("quizOptionsBox").insertAdjacentElement("afterend", resultBox);
  const contBtn = document.createElement("button");
  contBtn.className = "modal-close-btn primary";
  contBtn.setAttribute("data-action", "quiz-continue");
  contBtn.textContent = "つぎへ";
  modalBox.appendChild(contBtn);
}

// ============================================================
// マスイベント: クイズマス / 収入 / 出費 / カード / 何もなし
// ============================================================
function handleQuizCell() {
  log("❓ クイズマスに止まった！");
  showQuizModal(() => {
    modalRoot.classList.add("hidden");
    modalBox.innerHTML = "";
    afterEventResolved();
  });
}

function handleMoneyEvent(isPositive) {
  const amount = isPositive ? Math.round(randInt(100, 300) / 10) * 10 : Math.round(randInt(50, 200) / 10) * 10;
  const text = isPositive ? pick(INCOME_TEXTS) : pick(EXPENSE_TEXTS);
  if (isPositive) state.cash += amount;
  else state.cash = Math.max(0, state.cash - amount);
  renderHeader();
  log(`${isPositive ? "💰" : "💸"} ${text}（${isPositive ? "+" : "-"}${amount}万円）`, isPositive ? "good" : "bad");
  setModalContent(`
    <div class="toast-icon">${isPositive ? "💰" : "💸"}</div>
    <div class="toast-text">${text}</div>
    <div class="toast-amount ${isPositive ? "good" : "bad"}">${isPositive ? "+" : "-"}${amount}万円</div>
    <button class="modal-close-btn primary" data-action="close-modal">OK</button>
  `);
  setAfterClose(afterEventResolved);
}

function handleCardCell() {
  const card = pick(CARD_EVENTS);
  const eff = card.effect;
  let resultText = "";
  if (eff.type === "cash") {
    state.cash = Math.max(0, state.cash + eff.amount);
    resultText = `${eff.amount > 0 ? "+" : ""}${eff.amount}万円`;
  } else if (eff.type === "move") {
    let newPos;
    if (eff.amount > 0) {
      newPos = advanceWithCityStop(state.pos, eff.amount);
    } else {
      newPos = Math.max(0, state.pos + eff.amount);
    }
    state.pos = newPos;
    renderBoardMarker();
    if (state.board[newPos].type === "city") state.forceCityCheck = true;
    resultText = eff.amount > 0 ? `${eff.amount}マス進んだ！` : `${Math.abs(eff.amount)}マス戻った…`;
  } else if (eff.type === "discount") {
    state.discountCoupons++;
    resultText = "次の購入が3割引！";
  } else if (eff.type === "incomeBonus") {
    state.cash += eff.amount;
    state.cumulativeIncome += eff.amount;
    resultText = `収益+${eff.amount}万円`;
  } else if (eff.type === "extraTurn") {
    state.extraTurnPending = true;
    resultText = "もう一度サイコロをふれる！";
  } else if (eff.type === "skipNextTurn") {
    state.skipNextTurn = true;
    resultText = "次のターンはお休み…";
  }
  renderHeader();
  log(`🎴 ${card.text}`, "highlight");
  setModalContent(`
    <div class="toast-icon">🎴</div>
    <div class="toast-text">${card.text}</div>
    <div class="toast-amount">${resultText}</div>
    <button class="modal-close-btn primary" data-action="close-modal">OK</button>
  `);
  setAfterClose(afterEventResolved);
}

function handleBlankCell() {
  const text = pick(BLANK_TEXTS);
  log(`🚶 ${text}`);
  setModalContent(`
    <div class="toast-icon">🚶</div>
    <div class="toast-text">${text}</div>
    <button class="modal-close-btn primary" data-action="close-modal">OK</button>
  `);
  setAfterClose(afterEventResolved);
}

// ============================================================
// 都市到着・物件購入
// ============================================================
function handleCityArrival(cityIdx) {
  const city = CITIES[cityIdx];
  state.visitedCityKeys.add(city.key);
  renderHeader();
  log(`📍 ${city.name}に到着！${city.catch}`, "highlight");
  showQuizModal(() => openCityShop(cityIdx));
}

function openCityShop(cityIdx) {
  renderCityShopContent(cityIdx);
  setAfterClose(afterEventResolved);
}

function renderCityShopContent(cityIdx) {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildCityShopHtml(cityIdx);
}

function buildCityShopHtml(cityIdx) {
  const city = CITIES[cityIdx];
  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
  const isMonopoly = state.monopolyCities.has(city.key);
  const remain = city.properties.length - ownedCount;
  const banner = isMonopoly
    ? `<div class="city-monopoly-banner">👑 ${city.name}を独占中！収益2倍でがっぽり！</div>`
    : "";
  const couponNote =
    state.discountCoupons > 0
      ? `<div class="modal-sub">🎟️ 割引クーポン ${state.discountCoupons}枚所持中（次の購入から自動適用）</div>`
      : "";
  const propsHtml = city.properties
    .map((p, i) => {
      const key = propKey(city.key, i);
      const owned = state.owned.has(key);
      const discounted = !owned && state.discountCoupons > 0;
      const price = discounted ? Math.round(p.price * 0.7) : p.price;
      const affordable = state.cash >= price;
      let badge;
      if (owned) badge = `<span class="prop-badge owned-badge">購入済み</span>`;
      else badge = `<span class="prop-badge">独占まであと${remain}件</span>`;
      const buyLabel = owned ? "購入済み" : discounted ? `割引 ${price}万円で買う` : `${price}万円で買う`;
      return `
      <div class="prop-card ${owned ? "owned" : ""}">
        <div class="prop-icon">${p.icon}</div>
        <div class="prop-info">
          <div class="prop-name">${p.name}</div>
          <div class="prop-detail">購入価格 ${p.price}万円 ／ 収益 ${p.revenue}万円・ターン</div>
          ${badge}
        </div>
        <button class="prop-buy-btn ${discounted ? "discounted" : ""}" data-action="buy-prop" data-city="${cityIdx}" data-prop="${i}" ${owned || !affordable ? "disabled" : ""}>${buyLabel}</button>
      </div>`;
    })
    .join("");
  return `
    <div class="modal-title">${city.icon} ${city.name}の物件</div>
    <div class="modal-sub">${city.catch}</div>
    ${banner}
    ${couponNote}
    <div class="prop-list">${propsHtml}</div>
    <button class="modal-close-btn primary" data-action="close-modal">サイコロにもどる</button>
  `;
}

function buyProperty(cityIdx, propIdx) {
  const city = CITIES[cityIdx];
  const p = city.properties[propIdx];
  const key = propKey(city.key, propIdx);
  if (state.owned.has(key)) return;
  const discounted = state.discountCoupons > 0;
  const price = discounted ? Math.round(p.price * 0.7) : p.price;
  if (state.cash < price) return;
  state.cash -= price;
  if (discounted) state.discountCoupons--;
  state.owned.add(key);
  log(`🏠 ${city.name}の「${p.name}」を購入！（${price}万円）`, "good");

  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
  let newlyMonopoly = false;
  if (ownedCount === city.properties.length && !state.monopolyCities.has(city.key)) {
    state.monopolyCities.add(city.key);
    newlyMonopoly = true;
    log(`👑 ${city.name}を独占した！これから収益が2倍になるよ！`, "highlight");
  }
  renderHeader();
  renderBoardMarker();

  if (newlyMonopoly) {
    flashMonopolyCelebration(city, cityIdx);
  } else {
    renderCityShopContent(cityIdx);
  }
}

function flashMonopolyCelebration(city, cityIdx) {
  modalBox.innerHTML = `
    <div class="monopoly-celebrate">
      <div class="big-emoji">👑</div>
      <div class="confetti-row">🎉🎊✨🎊🎉</div>
      <div class="modal-title" style="justify-content:center;">${city.name} 独占達成！</div>
      <div class="modal-sub">これから${city.name}の収益が2倍になるよ！</div>
      <button class="modal-close-btn primary" data-action="close-modal">やった！</button>
    </div>
  `;
  setAfterClose(() => {
    setAfterClose(afterEventResolved);
    renderCityShopContent(cityIdx);
  });
}

// ============================================================
// 全国物件マップ
// ============================================================
function showOverviewModal() {
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = buildOverviewHtml();
  setAfterClose(null);
}

function buildOverviewHtml() {
  const citiesHtml = CITIES.map((city) => {
    const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
    const isMonopoly = state.monopolyCities.has(city.key);
    const chips = city.properties
      .map((p, i) => {
        const owned = state.owned.has(propKey(city.key, i));
        return `<span class="mini-chip ${owned ? "owned" : ""}">${p.icon} ${p.name}${owned ? " ✓" : ""}</span>`;
      })
      .join("");
    return `
    <div class="overview-city">
      <div class="overview-city-head">
        <span>${city.icon} ${city.name}</span>
        <span class="badge-mini ${isMonopoly ? "done" : ""}">${ownedCount}/${city.properties.length}件${isMonopoly ? " 👑独占" : ""}</span>
      </div>
      <div class="overview-props-mini">${chips}</div>
    </div>`;
  }).join("");
  return `
    <div class="modal-title">🗺️ 全国物件マップ</div>
    <div class="modal-sub">東京から大阪まで、全${getTotalPropertyCount()}件の物件だよ。</div>
    ${citiesHtml}
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>
  `;
}

// ============================================================
// 結果発表
// ============================================================
function getRank(score) {
  if (score >= 9000) return "🏆 SS 伝説の大富豪";
  if (score >= 6500) return "🥇 S 敏腕実業家";
  if (score >= 4500) return "🥈 A 一人前の投資家";
  if (score >= 2800) return "🥉 B 見習い実業家";
  return "🌱 C 駆け出し旅人";
}

function showResult() {
  state.gameOver = true;
  setControlsEnabled(false);
  const propertyValueSum = getOwnedPropertyValueSum();
  const totalAssets = state.cash + propertyValueSum;
  const score = Math.round(
    state.cash + propertyValueSum * 1.2 + state.cumulativeIncome * 1.5 + state.monopolyCities.size * 800 + state.quizCorrect * 80
  );
  const rank = getRank(score);
  modalRoot.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-title" style="justify-content:center;">🏁 大阪ゴール！ 結果発表</div>
    <div class="result-score">${fmt(score)}<span style="font-size:16px;">点</span></div>
    <div class="result-rank">${rank}</div>
    <table class="result-table">
      <tr><td>💰 現金</td><td>${fmt(state.cash)}万円</td></tr>
      <tr><td>🏢 所有物件総額</td><td>${fmt(propertyValueSum)}万円</td></tr>
      <tr><td>📈 総資産</td><td>${fmt(totalAssets)}万円</td></tr>
      <tr><td>🔁 累計収益</td><td>${fmt(state.cumulativeIncome)}万円</td></tr>
      <tr><td>👑 独占都市数</td><td>${state.monopolyCities.size} / ${CITIES.length}都市</td></tr>
      <tr><td>🏠 所有物件数</td><td>${state.owned.size} / ${getTotalPropertyCount()}件</td></tr>
      <tr><td>❓ クイズ正解数</td><td>${state.quizCorrect} / ${state.quizAskedCount}問</td></tr>
    </table>
    <button class="modal-close-btn primary" data-action="play-again">もう一度あそぶ</button>
  `;
}

// ============================================================
// ゲーム開始
// ============================================================
function startNewGame() {
  buildBoard();
  state.pos = 0;
  state.cash = START_CASH;
  state.cumulativeIncome = 0;
  state.quizCorrect = 0;
  state.quizAskedCount = 0;
  state.owned = new Set();
  state.monopolyCities = new Set();
  state.discountCoupons = 0;
  state.skipNextTurn = false;
  state.extraTurnPending = false;
  state.forceCityCheck = false;
  state.gameOver = false;
  state.quizPool = [];
  state.quizPoolPtr = 0;
  state.visitedCityKeys = new Set();

  messageLog.innerHTML = "";
  log("🎬 ゲームスタート！東京から大阪をめざそう！", "highlight");
  diceFace.textContent = "🎲";
  renderBoardStripDOM();
  renderHeader();
  setControlsEnabled(false);
  handleCityArrival(0);
}

// ============================================================
// 初期化・イベント配線
// ============================================================
function initRefs() {
  startScreen = document.getElementById("startScreen");
  gameScreen = document.getElementById("gameScreen");
  startBtn = document.getElementById("startBtn");

  statLocation = document.getElementById("statLocation");
  statCash = document.getElementById("statCash");
  statAssets = document.getElementById("statAssets");
  statProps = document.getElementById("statProps");
  statMonopoly = document.getElementById("statMonopoly");
  statDistance = document.getElementById("statDistance");
  goalBarFill = document.getElementById("goalBarFill");
  overviewBtn = document.getElementById("overviewBtn");

  boardStrip = document.getElementById("boardStrip");
  messageLog = document.getElementById("messageLog");
  incomeFloat = document.getElementById("incomeFloat");
  diceFace = document.getElementById("diceFace");
  diceBtn = document.getElementById("diceBtn");

  modalRoot = document.getElementById("modalRoot");
  modalBox = document.getElementById("modalBox");
}

function wireEvents() {
  startBtn.addEventListener("click", () => {
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    startNewGame();
  });

  diceBtn.addEventListener("click", () => rollDice());
  overviewBtn.addEventListener("click", () => {
    if (overviewBtn.disabled) return;
    showOverviewModal();
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
      quizOnDone = null;
      if (fn) fn();
      return;
    }
    const buyBtn = e.target.closest('[data-action="buy-prop"]');
    if (buyBtn && !buyBtn.disabled) {
      buyProperty(Number(buyBtn.dataset.city), Number(buyBtn.dataset.prop));
      return;
    }
    const closeBtn = e.target.closest('[data-action="close-modal"]');
    if (closeBtn) {
      closeModal();
      return;
    }
    const againBtn = e.target.closest('[data-action="play-again"]');
    if (againBtn) {
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
