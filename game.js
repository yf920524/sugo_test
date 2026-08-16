/* ============================================================
   トリリオネアを目指せ！ - ゲームロジック
   データ（都市・路線・クイズ・コンボ・イベント）は data/ 以下に、
   保存処理は save.js に分離してある。ここでは「動かし方」だけを扱う。
   ============================================================ */

const START_CASH = 10000; // 万円 = 1億円
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
const MODE_ICON = { rail: "🚄", highway: "🛣️", flight: "✈️" };
const START_DASH_TURNS = 6; // 序盤テンポ改善：最初の数ターンはクイズ報酬を厚くする
const START_DASH_CASH_FLOOR = 1500; // 万円
const NORMAL_CASH_FLOOR = 500; // 万円
const FIRST_VISIT_BONUS = 800; // 万円：はじめて訪れた都市でもらえるボーナス
const FIRST_PURCHASE_BONUS = 2000; // 万円：はじめての物件購入でもらえるボーナス
const RESCUE_GRANT = 1500; // 万円：どこも買えないときの臨時ビジネスチャンス

// ---- DOM 参照 ----
let startScreen, gameScreen, continueBtn, newGameBtn;
let statYear, statMonth, victoryBadge, menuBtn, statAnnualRevenue, goalBarFill;
let statCash, statAssets, statProps, statMonopoly;
let cityIcon, cityName, cityCatch, cityRegionBadge, routeProgressEl;
let diceFace, diceHintEl, directionButtons;
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
    discountCoupons: [], // 割引率（%）の配列。購入時にいちばんお得なものから使われる
    kessanBonusPct: 0,
    kessanFlatBonus: 0,
    milestonesHit: new Set(),
    victoryAchieved: false,
    firstPurchaseDone: false,
    quizRecent: [],
    quizAnsweredCorrectIds: [],
    logHistory: [],
    pendingKessan: false,
    turnCount: 0,
    visitedCities: new Set(),
    missionsAchieved: new Set(),
    onLine: null,
    triggeredEventTiles: [],
    tutorialSeen: false,
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
let quizExtraAttempts = 0;
let currentQuizIsExtra = false;
const MAX_EXTRA_QUIZ_PER_VISIT = 2;

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
// 割引クーポンは%の配列で保持し、購入時にいちばんお得な1枚から自動で使われる
function getBestDiscountPct() {
  return state.discountCoupons.length ? Math.max(...state.discountCoupons) : 0;
}
function consumeBestDiscount() {
  if (!state.discountCoupons.length) return 0;
  const best = Math.max(...state.discountCoupons);
  state.discountCoupons.splice(state.discountCoupons.indexOf(best), 1);
  return best;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function seededChance(s) {
  return (Math.abs(hashStr(s)) % 10000) / 10000;
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
// 路線・移動（すごろく方式：都市間に複数のマスを配置し、1マスずつ進む）
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

// 路線1本ぶんの「マス目」を生成する（都市マス＋都市間の空白・イベントマス）。
// 都市間のマス数は実際の地理座標の距離から算出するので、遠い都市ほどマスが多い＝すごろくとして距離が分かる。
// 出現するイベント・特別マスは路線キー＋インデックスから決定的に決まるので、再読み込みしても配置は変わらない。
const lineTilesCache = {};
function getLineTiles(line) {
  if (lineTilesCache[line.key]) return lineTilesCache[line.key];
  const tiles = [];
  for (let c = 0; c < line.cities.length; c++) {
    const cityKey = line.cities[c];
    const city = getCity(cityKey);
    tiles.push({ type: "city", cityKey, coord: city.coord });
    if (c < line.cities.length - 1) {
      const nextCity = getCity(line.cities[c + 1]);
      const dist = Math.hypot(nextCity.coord.x - city.coord.x, nextCity.coord.y - city.coord.y);
      const gapTiles = Math.max(1, Math.min(6, Math.round(dist / 14)));
      const isTwoCityLine = line.cities.length === 2;
      for (let g = 1; g <= gapTiles; g++) {
        const t = g / (gapTiles + 1);
        const coord = { x: city.coord.x + (nextCity.coord.x - city.coord.x) * t, y: city.coord.y + (nextCity.coord.y - city.coord.y) * t };
        const tileKey = `${line.key}#${tiles.length}`;
        let type = "blank";
        let tileDef = null;
        if (line.special && isTwoCityLine && g === Math.ceil(gapTiles / 2)) {
          type = "special";
          const pool = SPECIAL_TILES[line.special];
          tileDef = pool && pool.length ? pool[Math.abs(hashStr(tileKey)) % pool.length] : null;
        } else {
          const chance = TILE_DENSITY_CHANCE[line.density] || 0.1;
          if (seededChance(tileKey) < chance) {
            type = "event";
            tileDef = GENERIC_TILES[Math.abs(hashStr(tileKey + "x")) % GENERIC_TILES.length];
          }
        }
        tiles.push({ type, coord, key: tileKey, tileDef });
      }
    }
  }
  tiles.forEach((t, i) => (t.idx = i));
  lineTilesCache[line.key] = tiles;
  return tiles;
}

function tileIndexOfCity(line, cityKey) {
  return getLineTiles(line).findIndex((t) => t.type === "city" && t.cityKey === cityKey);
}

// tiles配列の fromIdx から dir 方向へ進み、最初に見つかる都市マスとそこまでのマス数を返す
function scanToNextCity(tiles, fromIdx, dir) {
  let i = fromIdx;
  let count = 0;
  while (i + dir >= 0 && i + dir < tiles.length) {
    i += dir;
    count++;
    if (tiles[i].type === "city") return { cityKey: tiles[i].cityKey, count };
  }
  return null;
}

function describeTilePosition(tile, line) {
  const tiles = getLineTiles(line);
  const back = scanToNextCity(tiles, tile.idx, -1);
  const fwd = scanToNextCity(tiles, tile.idx, 1);
  const backName = back ? getCity(back.cityKey).name : "?";
  const fwdName = fwd ? getCity(fwd.cityKey).name : "?";
  return `${backName}→${fwdName}の途中（${line.name}）`;
}

async function movePlayerAlongTiles(lineKey, dir, steps) {
  const line = LINES.find((l) => l.key === lineKey);
  const tiles = getLineTiles(line);
  const fromIdx = state.onLine && state.onLine.lineKey === lineKey ? state.onLine.tileIdx : tileIndexOfCity(line, state.currentCity);
  const targetIdx = Math.min(tiles.length - 1, Math.max(0, fromIdx + dir * steps));
  let cur = fromIdx;
  while (cur !== targetIdx) {
    cur += dir;
    renderTileStepProgress(tiles[cur], line, dir, Math.abs(cur - fromIdx), Math.abs(targetIdx - fromIdx));
    await delay(220);
  }
  animatingMove = null;
  const landed = tiles[cur];
  const justClosedFiscalYear = advanceMonth();
  state.pendingKessan = state.pendingKessan || justClosedFiscalYear;
  state.turnCount++;
  if (landed.type === "city") {
    state.onLine = null;
    state.currentCity = landed.cityKey;
    renderCityDisplayOnly();
    resolveCellArrival(landed.cityKey);
  } else {
    state.onLine = { lineKey, tileIdx: cur, dir };
    resolveTileStop(landed, line);
  }
}

function renderTileStepProgress(tile, line, dir, stepNum, totalSteps) {
  renderHeader();
  animatingMove = { lineKey: line.key, dir, stepIndex: stepNum };
  renderDirectionButtons();
  if (routeProgressEl) {
    routeProgressEl.classList.remove("hidden");
    routeProgressEl.textContent = `🚶 ${line.name} 移動中… (${stepNum}/${totalSteps}マス)`;
  }
}

// サイコロを振った後、まだ方向を選んでいない間だけ出目を保持する（振る前・移動確定後はnull）
let pendingDiceValue = null;

function updateDiceHint() {
  if (!diceHintEl) return;
  diceHintEl.textContent = pendingDiceValue == null ? "🎲 タップしてサイコロを振ろう！" : `🎯 ${pendingDiceValue}が出た！進む方向をタップ`;
}

// 桃鉄と同じ操作順：まずサイコロを振って出目を確定し、そのあとで進む方向を選ぶ
function rollDiceOnly() {
  if (pendingDiceValue !== null) return;
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
      diceFace.classList.add("dice-used");
      addLog(`🎲 ${value}が出た！進む方向を選ぼう`);
      pendingDiceValue = value;
      updateDiceHint();
      renderDirectionButtons();
    }
  }, 70);
}

// ============================================================
// 経済（年度・決算）
// ============================================================
function advanceMonth() {
  // すでに3月（monthIndex=11）の場合は決算待ち。4月への繰り上げ・年度番号の更新は
  // confirmKessan() で行うことで、決算が確定するまで表示が「3月」のまま保たれる
  // （「第1期3月」→（誤った）「第1期4月」→「第2期4月」という不自然な中間表示を防ぐ）。
  if (state.monthIndex >= 11) {
    return true;
  }
  state.monthIndex++;
  return false;
}

function showKessanModal() {
  const b = computeKessanBreakdown();
  const before = state.cash;
  const after = before + b.totalProfit;
  const line = (label, val, cls) =>
    val ? `<div class="kessan-line ${cls || ""}"><span>${label}</span><span>${val >= 0 ? "+" : ""}${fmtMoney(val)}</span></div>` : "";
  setModalContent(`
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
  `);
}

function confirmKessan() {
  const b = computeKessanBreakdown();
  state.cash += b.totalProfit;
  addLog(`📊 第${state.year}期決算：利益 ${fmtMoney(b.totalProfit)}（現金 ${fmtMoney(state.cash)}）`, "highlight");
  state.year++;
  state.monthIndex = 0; // 4月へ（表示上の繰り上げはここでまとめて行う）
  state.kessanBonusPct = 0;
  state.kessanFlatBonus = 0;
  state.pendingKessan = false;
  modalRoot.classList.add("hidden");
  modalBox.innerHTML = "";
  autoSave(); // 新年度の状態で保存する
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

function modeIcons(mode) {
  const modes = Array.isArray(mode) ? mode : [mode];
  return modes.map((m) => MODE_ICON[m] || "").join("");
}

// fromIdx から dir 方向に、次の都市マスまでの実際のマス列（盤面描画用）を返す
function getTileSequenceToCity(tiles, fromIdx, dir) {
  const seq = [];
  let i = fromIdx;
  while (i + dir >= 0 && i + dir < tiles.length) {
    i += dir;
    seq.push(tiles[i]);
    if (tiles[i].type === "city") break;
  }
  return seq;
}

// 現在地から選べる方向（都市にいるときは分岐先すべて、道中マスにいるときは進む／戻るの2択）
function getDirectionOptions() {
  let originCoord, options;
  if (state.onLine) {
    const line = LINES.find((l) => l.key === state.onLine.lineKey);
    const tiles = getLineTiles(line);
    originCoord = tiles[state.onLine.tileIdx].coord;
    options = [];
    [state.onLine.dir, -state.onLine.dir].forEach((dir) => {
      const found = scanToNextCity(tiles, state.onLine.tileIdx, dir);
      if (found) options.push({ lineKey: line.key, dir, cityKey: found.cityKey, mode: line.mode, tiles, fromIdx: state.onLine.tileIdx });
    });
  } else {
    originCoord = getCity(state.currentCity).coord;
    options = getNeighbors(state.currentCity).map((n) => {
      const line = LINES.find((l) => l.key === n.lineKey);
      const tiles = getLineTiles(line);
      const curIdx = tileIndexOfCity(line, state.currentCity);
      return { lineKey: n.lineKey, dir: n.dir, cityKey: n.cityKey, mode: line.mode, tiles, fromIdx: curIdx };
    });
  }
  return { originCoord, options };
}

// 1マスぶんのマーカー（都市／分岐点／通常／イベント／特殊）を描く
function buildTileMarkerSvg(t, cx, cy, r) {
  if (t.type === "city") {
    const c = getCity(t.cityKey);
    const st = getCityMapState(c);
    const color = MAP_STATE_COLOR[st.stateClass];
    const junction = isJunctionCity(c.key);
    const shape = junction
      ? `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="2.2" fill="${color}" stroke="#0f2540" stroke-width="1.3" transform="rotate(45 ${cx} ${cy})" />`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#0f2540" stroke-width="1.2" />`;
    const label = `<text x="${cx}" y="${cy - r - 4}" font-size="9" text-anchor="middle" fill="#e8eef5" font-weight="bold" paint-order="stroke" stroke="#0f2540" stroke-width="2.5">${c.name}</text>`;
    return `${shape}<text x="${cx}" y="${cy + r * 0.35}" font-size="${r}" text-anchor="middle">${c.icon}</text>${label}`;
  }
  if (t.type === "event") {
    const s = (r * 1.15) / 3;
    return `<path transform="translate(${cx},${cy}) scale(${s})" d="M0,-3 L0.9,-0.9 L3,-0.9 L1.3,0.5 L1.9,2.6 L0,1.3 L-1.9,2.6 L-1.3,0.5 L-3,-0.9 L-0.9,-0.9 Z" fill="#ffd166" stroke="#7a5200" stroke-width="0.6" />`;
  }
  if (t.type === "special") {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3a2c14" stroke="#ffb703" stroke-width="1.2" />`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#e8eef5" opacity="0.65" />`;
}

// 移動アニメーション中だけ設定される、今表示すべき進行方向とマス位置（現在の実座標ではなく盤面上の位置）
let animatingMove = null; // { lineKey, dir, stepIndex }

const LOCAL_TILE_MIN = 12; // 1マスの最小表示間隔（近すぎる都市同士のラベルが重ならないための下限）
const LOCAL_TILE_MAX = 20; // 1マスの最大表示間隔（遠い都市で盤面が間延びしすぎないための上限）
const LOCAL_MAX_VISIBLE = 6; // サイコロの最大目に合わせ、1画面に6マス先まで見せる

// 現在地からの本当の方角（ベアリング）はそのまま保ちつつ、マス間隔だけ一定範囲に収めて描画する。
// 実距離そのままだと関東など密集地のラベルが重なり、逆に長距離路線だと盤面が間延びしてしまうため。
function projectLocalPoint(originCoord, coord, stepIndex) {
  const dx = coord.x - originCoord.x;
  const dy = coord.y - originCoord.y;
  const realDist = Math.hypot(dx, dy) || 0.0001;
  const renderDist = Math.min(Math.max(realDist, stepIndex * LOCAL_TILE_MIN), stepIndex * LOCAL_TILE_MAX);
  const scale = renderDist / realDist;
  return { x: dx * scale, y: dy * scale };
}

// 到着予定の都市からさらに先へ進むと何があるか（次の分岐先）を一言プレビューする。
// マスの上限は6だが都市間の区間は最大でも6マス以内に収まる設計のため、
// 「その先」は主にこの＝到着都市のさらに先の分岐先プレビューで示す。
function getBeyondPreviewNames(cityKey) {
  const backKey = state.onLine ? null : state.currentCity;
  return getNeighbors(cityKey)
    .filter((n) => n.cityKey !== backKey)
    .slice(0, 2)
    .map((n) => getCity(n.cityKey).name);
}

// メイン画面用：現在地を中心に、実際の方角のまま近隣路線をたどる「地図ベースのローカルすごろく盤」。
// 全国マップ（buildMapSvg）と同じマス・都市の見た目を使うので、ズームインした状態として見える。
// サイコロは振ってから方向を選ぶ操作順（桃鉄式）：pendingDiceValue が立っている間だけ着地マスを光らせる。
function buildLocalBoardSvg() {
  const { originCoord, options } = getDirectionOptions();

  const rendered = options.map((opt) => {
    const fullSeq = getTileSequenceToCity(opt.tiles, opt.fromIdx, opt.dir);
    const visible = fullSeq.slice(0, LOCAL_MAX_VISIBLE);
    const pts = [{ x: 0, y: 0 }];
    visible.forEach((t, i) => pts.push(projectLocalPoint(originCoord, t.coord, i + 1)));
    let beyond = null;
    if (fullSeq.length > LOCAL_MAX_VISIBLE) {
      const last = pts[pts.length - 1];
      const ang = Math.atan2(last.y, last.x);
      const dist = LOCAL_MAX_VISIBLE * LOCAL_TILE_MIN + LOCAL_TILE_MIN * 0.85;
      const destCity = getCity(fullSeq[fullSeq.length - 1].cityKey);
      beyond = { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, cityName: destCity.name, cityIcon: destCity.icon, remain: fullSeq.length - LOCAL_MAX_VISIBLE };
    }
    return { ...opt, visible, pts, beyond };
  });

  let half = LOCAL_MAX_VISIBLE * LOCAL_TILE_MIN * 0.6 + 30;
  rendered.forEach((opt) => {
    opt.pts.forEach((p) => { half = Math.max(half, Math.abs(p.x) + 26, Math.abs(p.y) + 26); });
    if (opt.beyond) half = Math.max(half, Math.abs(opt.beyond.x) + 34, Math.abs(opt.beyond.y) + 18);
    const lastTile = opt.visible[opt.visible.length - 1];
    if (!opt.beyond && lastTile && lastTile.type === "city") {
      const lastPt = opt.pts[opt.pts.length - 1];
      half = Math.max(half, Math.abs(lastPt.x) + 26, Math.abs(lastPt.y) + 30);
    }
  });

  const landingStep = pendingDiceValue; // 振った後だけ、その歩数目のマスを着地マスとして光らせる

  const pathsHtml = rendered
    .map((opt) => {
      const pointsAttr = opt.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const markers = opt.visible
        .map((t, i) => {
          const p = opt.pts[i + 1];
          const r = t.type === "city" ? 9 : 4.2;
          const isLanding = landingStep != null && landingStep === i + 1;
          const ring = isLanding
            ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 5}" fill="none" stroke="#ffb703" stroke-width="2"><animate attributeName="r" values="${r + 5};${r + 8};${r + 5}" dur="1s" repeatCount="indefinite" /></circle>`
            : "";
          let preview = "";
          if (!opt.beyond && i === opt.visible.length - 1 && t.type === "city") {
            const names = getBeyondPreviewNames(t.cityKey);
            if (names.length) {
              preview = `<text x="${p.x}" y="${p.y + r + 13}" font-size="7.5" text-anchor="middle" fill="#7d93ac" paint-order="stroke" stroke="#0f2540" stroke-width="2">→${names.join("・")}</text>`;
            }
          }
          return `${ring}${buildTileMarkerSvg(t, p.x, p.y, r)}${preview}`;
        })
        .join("");
      const beyondHtml = opt.beyond
        ? `<g opacity="0.85">
            <line x1="${opt.pts[opt.pts.length - 1].x.toFixed(1)}" y1="${opt.pts[opt.pts.length - 1].y.toFixed(1)}" x2="${opt.beyond.x.toFixed(1)}" y2="${opt.beyond.y.toFixed(1)}" stroke="${PATH_COLOR}" stroke-width="2" stroke-dasharray="2,3" opacity="0.7" />
            <text x="${opt.beyond.x.toFixed(1)}" y="${opt.beyond.y.toFixed(1)}" font-size="8.5" text-anchor="middle" fill="#a9bdd4" paint-order="stroke" stroke="#0f2540" stroke-width="2.5">➡️あと${opt.beyond.remain}で${opt.beyond.cityIcon}${opt.beyond.cityName}</text>
          </g>`
        : "";
      return `<g class="local-dir-group" data-line-key="${opt.lineKey}" data-dir="${opt.dir}">
        <polyline points="${pointsAttr}" fill="none" stroke="transparent" stroke-width="22" stroke-linecap="round" />
        <polyline points="${pointsAttr}" fill="none" stroke="${PATH_COLOR}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
        ${markers}
        ${beyondHtml}
      </g>`;
    })
    .join("");

  let tokenPt = { x: 0, y: 0 };
  if (animatingMove) {
    const match = rendered.find((o) => o.lineKey === animatingMove.lineKey && o.dir === animatingMove.dir);
    if (match && match.pts[animatingMove.stepIndex]) tokenPt = match.pts[animatingMove.stepIndex];
  }
  const originHtml = `<g class="local-origin">
    <circle cx="${tokenPt.x}" cy="${tokenPt.y}" r="10" fill="none" stroke="#ffb703" stroke-width="1.8"><animate attributeName="r" values="10;13;10" dur="1.3s" repeatCount="indefinite" /></circle>
    <circle cx="${tokenPt.x}" cy="${tokenPt.y}" r="7.5" fill="#ffb703" stroke="#0f2540" stroke-width="1.3" />
    <text x="${tokenPt.x}" y="${tokenPt.y + 2.8}" font-size="8.5" text-anchor="middle">🚩</text>
  </g>`;

  const compassHtml = `<g class="local-compass" opacity="0.35" font-size="9" fill="#a9bdd4" text-anchor="middle">
    <text x="0" y="${(-half + 12).toFixed(1)}">北</text>
    <text x="0" y="${(half - 5).toFixed(1)}">南</text>
    <text x="${(half - 10).toFixed(1)}" y="4">東</text>
    <text x="${(-half + 10).toFixed(1)}" y="4">西</text>
  </g>`;

  return `<svg viewBox="${-half} ${-half} ${half * 2} ${half * 2}" class="local-board-svg" xmlns="http://www.w3.org/2000/svg">
    ${compassHtml}
    ${pathsHtml}
    ${originHtml}
  </svg>`;
}

function renderDirectionButtons() {
  if (!directionButtons) return;
  // controls-disabled は setControlsEnabled() が管理する状態なので、再描画のたびに消してしまわないよう保持する
  const wasDisabled = directionButtons.classList.contains("controls-disabled");
  directionButtons.className = "direction-buttons local-board-wrap" + (wasDisabled ? " controls-disabled" : "");
  const stageClass = pendingDiceValue == null ? "awaiting-roll" : "ready-to-move";
  directionButtons.innerHTML = `<div class="local-board-viewport ${stageClass}">${buildLocalBoardSvg()}</div>`;
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
  if (routeProgressEl) {
    if (state.onLine) {
      const line = LINES.find((l) => l.key === state.onLine.lineKey);
      const tiles = getLineTiles(line);
      routeProgressEl.textContent = `📍 ${describeTilePosition(tiles[state.onLine.tileIdx], line)}`;
      routeProgressEl.classList.remove("hidden");
    } else {
      routeProgressEl.classList.add("hidden");
    }
  }
}

function renderCityPanel() {
  renderCityDisplayOnly();
  pendingDiceValue = null;
  if (diceFace) {
    diceFace.textContent = "🎲";
    diceFace.classList.remove("dice-used");
  }
  updateDiceHint();
  renderDirectionButtons();
}

// ============================================================
// モーダル制御
// ============================================================
function setModalContent(html) {
  modalBox.innerHTML = html;
  modalRoot.classList.remove("hidden");
  modalBox.scrollTop = 0;
  requestAnimationFrame(() => {
    modalBox.scrollTop = 0;
  });
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
  if (directionButtons) directionButtons.classList.toggle("controls-disabled", !enabled);
  if (diceFace) diceFace.classList.toggle("dice-disabled", !enabled);
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
  if (routeProgressEl) routeProgressEl.classList.add("hidden");
  maybeTriggerEvent(cityKey, () => handleCityArrival(cityKey));
}

// 都市と都市の間のマス（空白 or イベントマス）に止まったときの処理。
// そのマスを「現在地」としてイベントを解決し、都市滞在時のクイズ・物件購入は発生しない。
function resolveTileStop(tile, line) {
  renderHeader();
  if (routeProgressEl) {
    routeProgressEl.classList.remove("hidden");
    routeProgressEl.textContent = `📍 ${describeTilePosition(tile, line)}`;
  }
  addLog(`📍 ${describeTilePosition(tile, line)}で止まった。`, "highlight");
  const alreadyTriggered = state.triggeredEventTiles.includes(tile.key);
  if ((tile.type === "event" || tile.type === "special") && tile.tileDef && !alreadyTriggered) {
    state.triggeredEventTiles.push(tile.key);
    const result = applyTileEffect(tile.tileDef);
    addLog(`${tile.tileDef.icon} ${tile.tileDef.name}${tile.tileDef.desc ? "：" + tile.tileDef.desc : ""}（${result.text}）`, result.good ? "good" : "bad");
    setModalContent(`
      <div class="toast-icon">${tile.tileDef.icon}</div>
      <div class="modal-title" style="justify-content:center;">${tile.tileDef.name}</div>
      ${tile.tileDef.desc ? `<div class="toast-text">${tile.tileDef.desc}</div>` : ""}
      <div class="toast-amount ${result.good ? "good" : "bad"}">${result.text}</div>
      <button class="modal-close-btn primary" data-action="close-modal">なるほど！</button>
    `);
    setAfterClose(() => afterTurnComplete());
  } else {
    afterTurnComplete();
  }
}

function getCheapestAvailablePriceNearby() {
  const candidates = [state.currentCity, ...getNeighbors(state.currentCity).map((n) => n.cityKey)];
  let min = Infinity;
  candidates.forEach((ck) => {
    const city = getCity(ck);
    city.properties.forEach((p, i) => {
      if (!state.owned.has(propKey(ck, i)) && !isPropertyLocked(ck, i) && p.price < min) min = p.price;
    });
  });
  return min;
}

function handleCityArrival(cityKey) {
  state.currentCity = cityKey;
  renderCityDisplayOnly();
  addLog(`📍 ${getCity(cityKey).name}に到着。`, "highlight");

  const extraBanners = [];
  if (!state.visitedCities.has(cityKey)) {
    state.visitedCities.add(cityKey);
    state.cash += FIRST_VISIT_BONUS;
    addLog(`🎁 ${getCity(cityKey).name}へはじめて訪問！+${fmtMoney(FIRST_VISIT_BONUS)}`, "good");
    extraBanners.push(`🎁 はじめて訪れた街！ 訪問ボーナス +${fmtMoney(FIRST_VISIT_BONUS)}`);
    renderHeader();
  }
  const nearbyMin = getCheapestAvailablePriceNearby();
  if (nearbyMin !== Infinity && state.cash < nearbyMin) {
    state.cash += RESCUE_GRANT;
    addLog(`🎁 臨時ビジネスチャンス！+${fmtMoney(RESCUE_GRANT)}`, "good");
    extraBanners.push(`🎁 臨時ビジネスチャンス！ +${fmtMoney(RESCUE_GRANT)}`);
    renderHeader();
  }

  quizExtraAttempts = 0;
  showQuizModal(cityKey, () => openCityShop(cityKey), false, extraBanners);
}

// ============================================================
// 道中イベント（タイル） - 主要幹線ほど少なく、地方路線・特別区間ほど起きやすい
// （どのマスがイベントマスかは getLineTiles() で決定的に配置される。ここでは効果の適用のみ）
// ============================================================
// 現在のゲーム経済規模の目安（現金＋所有物件の価値）。道中イベントの金額はこれに対する
// 小さな割合としてスケールさせるので、序盤も終盤も「桁がずれた金額」にならない。
function gameScaleUnit() {
  return Math.max(state.cash + getOwnedPropertyValueSum(), START_CASH);
}

function applyTileEffect(tile) {
  const eff = tile.effect;
  if (eff.type === "cash") {
    const pct = eff.min + Math.random() * (eff.max - eff.min);
    const amt = Math.max(300, Math.round(((gameScaleUnit() * pct) / 100 / 10)) * 10);
    state.cash += amt;
    return { text: `+${fmtMoney(amt)}`, good: true };
  }
  if (eff.type === "cashMinus") {
    const pct = eff.min + Math.random() * (eff.max - eff.min);
    const amt = Math.max(200, Math.round(((gameScaleUnit() * pct) / 100 / 10)) * 10);
    state.cash = Math.max(0, state.cash - amt);
    return { text: `-${fmtMoney(amt)}`, good: false };
  }
  if (eff.type === "discount") {
    const pct = randInt(5, 10); // 道中イベントの割引は「ちょっと嬉しい」common枠のみ
    state.discountCoupons.push(pct);
    return { text: `🎟️ 次の購入が${pct}%引きになるクーポンをゲット！`, good: true };
  }
  if (eff.type === "kessanBonus") {
    const pct = randInt(eff.min, eff.max);
    state.kessanBonusPct += pct;
    return { text: `📊 今期決算 +${pct}%`, good: true };
  }
  if (eff.type === "unlockPoint") {
    const ck = state.currentCity;
    state.cityQuizCorrect[ck] = (state.cityQuizCorrect[ck] || 0) + 1;
    return { text: `🔓 ${getCity(ck).name}のアンロック進捗 +1`, good: true };
  }
  return { text: "", good: true };
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
// 都市の累計正解数から、その都市で出す問題の目標難易度Lv1〜4を決める。
// 正解を積み重ねるほど難しい（＝報酬も大きい）問題が出るようになる。
function targetDifficultyForCity(cityKey) {
  const correct = state.cityQuizCorrect[cityKey] || 0;
  if (correct >= 9) return 4;
  if (correct >= 5) return 3;
  if (correct >= 2) return 2;
  return 1;
}

function getPrefMates(cityKey) {
  const group = PREF_GROUPS.find((g) => g.includes(cityKey));
  return group ? group.filter((k) => k !== cityKey) : [];
}

// 出題優先度：現在地の都市 → 同都道府県 → 同地方 → 全国共通（タグなし）、の順でフォールバック。
// 「全国」とは全都市のタグつき問題を指すのではなく、タグなしの一般問題のみを指す
// （＝現在地と無関係な他都市の専門問題が出ることは、地方問題が尽きない限り起きない）。
// 一度正解した問題は（プールが尽きるまで）二度と出題しない。
function pickQuiz(cityKey) {
  const targetDiff = targetDifficultyForCity(cityKey);
  const prefMates = getPrefMates(cityKey);
  const region = getCity(cityKey).region;
  const regionCities = CITIES.filter((c) => c.region === region).map((c) => c.key);
  const byDiff = (q) => q.difficulty <= targetDiff;
  const notAnsweredCorrect = (q) => !state.quizAnsweredCorrectIds.includes(QUIZ_BANK.indexOf(q));
  const hasTag = (q, keys) => q.tags && q.tags.some((t) => keys.includes(t));

  const tierCity = QUIZ_BANK.filter((q) => hasTag(q, [cityKey]));
  const tierPref = QUIZ_BANK.filter((q) => hasTag(q, prefMates));
  const tierRegion = QUIZ_BANK.filter((q) => hasTag(q, regionCities));
  const tierNational = QUIZ_BANK.filter((q) => !q.tags || q.tags.length === 0);
  // 地方の範囲内（現在地の地方タグ問題＋全国共通問題）。難易度を広げる際もこの範囲は超えない。
  const regionScope = QUIZ_BANK.filter((q) => hasTag(q, regionCities) || !q.tags || q.tags.length === 0);

  for (const tier of [tierCity, tierPref, tierRegion, tierNational]) {
    const fresh = tier.filter((q) => byDiff(q) && notAnsweredCorrect(q));
    if (fresh.length) return pickFromPool(fresh);
  }
  // その難易度以下は地方内で出尽くした → 地方の範囲内で難易度制限をゆるめる（他地方には広げない）
  const freshInRegion = regionScope.filter(notAnsweredCorrect);
  if (freshInRegion.length) return pickFromPool(freshInRegion);
  // 地方内は全問正解済み（コレクション上級者向け）→ 地方の範囲内で繰り返し出題を許可
  if (regionScope.length) return pickFromPool(regionScope);
  // 万一地方問題が皆無の場合のみ、全国のプールから出題する
  return pickFromPool(QUIZ_BANK);
}
function pickBonusQuiz(cityKey) {
  const prefMates = getPrefMates(cityKey);
  const region = getCity(cityKey).region;
  const regionCities = CITIES.filter((c) => c.region === region).map((c) => c.key);
  const hasTag = (q, keys) => q.tags && q.tags.some((t) => keys.includes(t));
  const notAnsweredCorrect = (q) => !state.quizAnsweredCorrectIds.includes(QUIZ_BANK.indexOf(q));
  const isHard = (q) => q.difficulty >= 3;

  const tierCity = QUIZ_BANK.filter((q) => isHard(q) && hasTag(q, [cityKey]));
  const tierPref = QUIZ_BANK.filter((q) => isHard(q) && hasTag(q, prefMates));
  const tierRegion = QUIZ_BANK.filter((q) => isHard(q) && hasTag(q, regionCities));
  const tierNational = QUIZ_BANK.filter((q) => isHard(q) && (!q.tags || q.tags.length === 0));
  for (const tier of [tierCity, tierPref, tierRegion, tierNational]) {
    const fresh = tier.filter(notAnsweredCorrect);
    if (fresh.length) return pickFromPool(fresh);
  }
  const regionScope = QUIZ_BANK.filter((q) => isHard(q) && (hasTag(q, regionCities) || !q.tags || q.tags.length === 0));
  const freshInRegion = regionScope.filter(notAnsweredCorrect);
  if (freshInRegion.length) return pickFromPool(freshInRegion);
  if (regionScope.length) return pickFromPool(regionScope);
  const anyHard = QUIZ_BANK.filter(isHard);
  return pickFromPool(anyHard.length ? anyHard : QUIZ_BANK);
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

// 割引クーポンの当選率：通常は5〜10%が基本、20%はややレア、30%はかなりレアな特別報酬。
// ボーナスチャレンジ（高難度クイズ）はレア枠の当選率が上がる。
function rollDiscountPct(isBonus) {
  const r = Math.random();
  if (isBonus) {
    if (r < 0.15) return 30;
    if (r < 0.45) return 20;
    return randInt(5, 10);
  }
  if (r < 0.03) return 30;
  if (r < 0.18) return 20;
  return randInt(5, 10);
}

function applyQuizReward(isBonus, isExtra, difficulty) {
  const diffMult = 1 + Math.max(0, (difficulty || 1) - 1) * 0.35; // Lv1=1.0 / Lv2=1.35 / Lv3=1.7 / Lv4=2.05
  let mult = diffMult;
  if (isBonus) mult *= 2.5;
  if (isExtra) mult *= 0.5; // 「もう1問挑戦」は解禁進捗メインなので報酬は控えめ
  const floor = (state.turnCount <= START_DASH_TURNS ? START_DASH_CASH_FLOOR : NORMAL_CASH_FLOOR) * mult;
  const roll = Math.random();
  if (roll < 0.4) {
    // 通常クイズは「少し嬉しい」投資資金くらいに抑え、高難度・ボーナスとの差をはっきりさせる
    const amt = Math.max(floor, Math.round(((state.cash * 0.08 * mult) / 10)) * 10);
    state.cash += amt;
    return `💰 現金 +${fmtMoney(amt)} ゲット！`;
  } else if (roll < 0.7) {
    const n = isBonus ? 2 : 1;
    const pcts = [];
    for (let i = 0; i < n; i++) {
      const pct = rollDiscountPct(isBonus);
      pcts.push(pct);
      state.discountCoupons.push(pct);
    }
    return `🎟️ 次に買う物件が${pcts.join("%・")}%引きになるクーポンを${n}枚ゲット！`;
  } else {
    const pct = Math.round((8 + Math.random() * 7) * mult);
    state.kessanBonusPct += pct;
    return `📊 今期決算ボーナス +${pct}%（累計${state.kessanBonusPct}%）を獲得！`;
  }
}

function showQuizModal(cityKey, onDone, isBonus, extraBanners, isExtra) {
  quizOnDone = onDone;
  quizCityKey = cityKey;
  quizIsBonus = !!isBonus;
  currentQuizIsExtra = !!isExtra;
  const q = quizIsBonus ? pickBonusQuiz(cityKey) : pickQuiz(cityKey);
  currentQuizData = q;
  currentQuizAnswered = false;
  currentQuizOptions = shuffle(q.options.map((text, i) => ({ text, isCorrect: i === q.correct })));
  state.quizAskedTotal++;
  const hint = !quizIsBonus ? getUnlockHint(cityKey) : null;
  const missionHint = !quizIsBonus ? getNearestMissionHint(cityKey) : null;
  const banners = [...(extraBanners || [])];
  if (hint && hint.quizRemain <= 2) banners.push(unlockHintText(hint));
  if (missionHint) banners.push(missionHint);
  const hintHtml = banners.map((b) => `<div class="hint-banner">${b}</div>`).join("");
  const optsHtml = currentQuizOptions
    .map((o, i) => `<button class="quiz-opt" data-action="quiz-opt" data-idx="${i}">${o.text}</button>`)
    .join("");
  const title = quizIsBonus ? "🌟 ボーナスチャレンジ！" : currentQuizIsExtra ? "❓ 追加クイズ！" : "❓ クイズ！";
  setModalContent(`
    <div class="modal-title">${title} <span style="font-size:11px;color:var(--text-dim);font-weight:normal;">Lv.${q.difficulty}</span></div>
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
    const qIdx = QUIZ_BANK.indexOf(currentQuizData);
    if (!state.quizAnsweredCorrectIds.includes(qIdx)) state.quizAnsweredCorrectIds.push(qIdx);
    const rewardText = applyQuizReward(quizIsBonus, currentQuizIsExtra, currentQuizData.difficulty);
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
  if (!quizIsBonus && quizExtraAttempts < MAX_EXTRA_QUIZ_PER_VISIT) {
    const extraBtn = document.createElement("button");
    extraBtn.className = "modal-close-btn secondary-outline";
    extraBtn.setAttribute("data-action", "quiz-extra");
    extraBtn.textContent = "🔥 もう1問挑戦する（ごほうび小・解禁進捗あり）";
    modalBox.appendChild(extraBtn);
  }
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
  shopTierFilter = "all";
  renderCityShopContent(cityKey);
  setAfterClose(shopCloseCallback);
}

function showShopStandalone() {
  activeCityKey = state.currentCity;
  shopCloseCallback = null;
  shopTierFilter = "all";
  renderCityShopContent(state.currentCity);
  setAfterClose(null);
}

let shopTierFilter = "all";

function renderCityShopContent(cityKey) {
  setModalContent(buildCityShopHtml(cityKey));
}

function isPropertyInAchievedCombo(cityKey, idx) {
  return COMBOS.some((combo) => state.comboAchieved.has(combo.key) && combo.members.some((m) => m.city === cityKey && m.idx === idx));
}

const TIER_LABEL = { A: "1000万〜", B: "1億〜", C: "10億〜", D: "100億〜", E: "1000億〜" };

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
  const bestDiscount = getBestDiscountPct();
  const couponNote =
    state.discountCoupons.length > 0
      ? `<div class="modal-sub">🎟️ 割引クーポン ${state.discountCoupons.length}枚所持中（最大${bestDiscount}%引き、次の購入から自動適用）</div>`
      : "";

  const tiersPresent = [...new Set(city.properties.map((p) => p.tier))];
  if (!tiersPresent.includes(shopTierFilter) && shopTierFilter !== "all") shopTierFilter = "all";
  const tabsHtml = `<div class="tier-tabs">
    <button class="tier-tab ${shopTierFilter === "all" ? "active" : ""}" data-action="shop-tier" data-tier="all">すべて</button>
    ${tiersPresent.map((t) => `<button class="tier-tab ${shopTierFilter === t ? "active" : ""}" data-action="shop-tier" data-tier="${t}">${t}（${TIER_LABEL[t]}）</button>`).join("")}
  </div>`;

  const visibleProps = city.properties
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => shopTierFilter === "all" || p.tier === shopTierFilter);

  const propsHtml = visibleProps
    .map(({ p, i }) => {
      const key = propKey(cityKey, i);
      const owned = state.owned.has(key);
      const locked = !owned && isPropertyLocked(cityKey, i);
      const discounted = !owned && !locked && bestDiscount > 0;
      const price = discounted ? Math.round(p.price * (1 - bestDiscount / 100)) : p.price;
      const affordable = state.cash >= price;
      let badge, buyEl, extraLine = "";
      if (owned) {
        const inCombo = isPropertyInAchievedCombo(cityKey, i);
        badge = `<span class="prop-badge owned-badge">購入済み</span>${inCombo ? '<span class="prop-badge combo-badge">🔗 コンボ成立中</span>' : ""}`;
        buyEl = `<button class="prop-buy-btn" disabled>購入済み</button>`;
      } else if (locked) {
        const have = state.cityQuizCorrect[cityKey] || 0;
        const parts = [];
        if (p.unlock.quiz) parts.push(`クイズあと${Math.max(0, p.unlock.quiz - have)}問`);
        if (p.unlock.ownRatio) {
          const r = getNonLandmarkOwnedRatio(cityKey);
          const need = Math.ceil(r.total * p.unlock.ownRatio);
          parts.push(`通常物件あと${Math.max(0, need - r.owned)}件`);
        }
        badge = `<span class="prop-badge locked-badge">🔒 ${parts.join("・")}で解禁</span>`;
        const quizCapped = quizExtraAttempts >= MAX_EXTRA_QUIZ_PER_VISIT;
        buyEl = quizCapped
          ? `<button class="prop-buy-btn" disabled>移動すると再挑戦可</button>`
          : `<button class="prop-buy-btn" data-action="launch-quiz" data-city="${cityKey}">🎯 クイズに挑戦</button>`;
      } else {
        badge = `<span class="prop-badge">あと${remain}件で完全制覇</span>`;
        const label = discounted ? `${bestDiscount}%引き ${fmtMoney(price)}` : fmtMoney(price);
        if (affordable) {
          buyEl = `<button class="prop-buy-btn ${discounted ? "discounted" : ""}" data-action="buy-prop" data-city="${cityKey}" data-idx="${i}">${label}で購入</button>`;
          extraLine = `<div class="prop-cashflow">所持金 ${fmtMoney(state.cash)} → ${fmtMoney(state.cash - price)}</div>`;
        } else {
          buyEl = `<button class="prop-buy-btn" disabled>${label}</button>`;
          extraLine = `<div class="prop-cashflow bad">資金不足（あと${fmtMoney(price - state.cash)}）</div>`;
        }
      }
      return `<div class="prop-card ${owned ? "owned" : ""} ${locked ? "locked" : ""}" data-prop-row="${i}">
        <div class="prop-icon">${p.icon}</div>
        <div class="prop-info">
          <div class="prop-name">${p.name}</div>
          <div class="prop-detail">${fmtMoney(p.price)} ／ 年利${p.yieldPct}%（年間収益 ${fmtMoney(p.revenue)}）</div>
          ${badge}
          ${extraLine}
        </div>
        ${buyEl}
      </div>`;
    })
    .join("");
  return `
    <div class="modal-title">${city.icon} ${city.name}の物件（${ownedCount}/${city.properties.length}）</div>
    <div class="shop-cash-bar">💴 所持金　<strong>${fmtMoney(state.cash)}</strong></div>
    <div class="modal-sub">${city.catch}</div>
    ${banner}
    ${couponNote}
    ${tabsHtml}
    <div class="prop-list">${propsHtml || '<div class="log-empty">このタブには物件がないよ。</div>'}</div>
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>
  `;
}

function buyProperty(cityKey, idx) {
  const city = getCity(cityKey);
  const p = city.properties[idx];
  const key = propKey(cityKey, idx);
  if (state.owned.has(key)) return;
  if (isPropertyLocked(cityKey, idx)) return;
  const bestDiscount = getBestDiscountPct();
  const discounted = bestDiscount > 0;
  const price = discounted ? Math.round(p.price * (1 - bestDiscount / 100)) : p.price;
  if (state.cash < price) return;

  const beforeLockedLandmarks = getLockedLandmarkIdxs(cityKey);

  state.cash -= price;
  if (discounted) consumeBestDiscount();
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
  const newMissions = checkNewMissions(cityKey, idx);
  newMissions.forEach((m) => addLog(`🎯 ミッション「${m.name}」達成！+${fmtMoney(m.reward)}`, "highlight"));
  const afterLockedLandmarks = getLockedLandmarkIdxs(cityKey);
  const newlyUnlockedLandmarks = beforeLockedLandmarks.filter((i) => !afterLockedLandmarks.includes(i)).map((i) => city.properties[i]);
  if (newlyUnlockedLandmarks.length) {
    addLog(`🔓 ${city.name}の「${newlyUnlockedLandmarks.map((lp) => lp.name).join("」「")}」がアンロックされた！`, "highlight");
  }

  renderHeader();
  autoSave();
  handlePurchaseCelebration(city, p, idx, newlyMonopoly, cityKey, newCombos, newlyUnlockedLandmarks, newMissions);
}

// 連鎖ミッション：unlockedBy が指定されている場合、先のミッションを達成するまで挑戦対象にならない
function isMissionUnlocked(mission) {
  return !mission.unlockedBy || state.missionsAchieved.has(mission.unlockedBy);
}

function checkNewMissions(propCityKey, propIdx) {
  const newlyCompleted = [];
  MISSIONS.forEach((mission) => {
    if (state.missionsAchieved.has(mission.key)) return;
    if (!isMissionUnlocked(mission)) return;
    const isMember = mission.members.some((m) => m.city === propCityKey && m.idx === propIdx);
    if (!isMember) return;
    const allOwned = mission.members.every((m) => state.owned.has(propKey(m.city, m.idx)));
    if (allOwned) {
      state.missionsAchieved.add(mission.key);
      state.cash += mission.reward;
      newlyCompleted.push(mission);
    }
  });
  return newlyCompleted;
}

function getMissionProgress(mission) {
  const owned = mission.members.filter((m) => state.owned.has(propKey(m.city, m.idx))).length;
  return { owned, total: mission.members.length, remain: mission.members.length - owned };
}

function getNearestMissionHint(cityKey) {
  let best = null;
  MISSIONS.forEach((mission) => {
    if (state.missionsAchieved.has(mission.key)) return;
    if (!isMissionUnlocked(mission)) return;
    if (!mission.members.some((m) => m.city === cityKey)) return;
    const prog = getMissionProgress(mission);
    if (prog.remain === 0) return;
    if (!best || prog.remain < best.prog.remain) best = { mission, prog };
  });
  if (!best || best.prog.remain > 2) return null;
  return `🎯 「${best.mission.name}」あと${best.prog.remain}件で達成！（+${fmtMoney(best.mission.reward)}）`;
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

function handlePurchaseCelebration(city, prop, idx, newlyMonopoly, cityKey, newCombos, newlyUnlockedLandmarks, newMissions) {
  const isFirst = !state.firstPurchaseDone;
  if (isFirst) {
    state.cash += FIRST_PURCHASE_BONUS;
    addLog(`🎁 はじめての物件購入ボーナス！+${fmtMoney(FIRST_PURCHASE_BONUS)}`, "good");
  }
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
    achievements.push({ icon: combo.icon, title: `${combo.name} 成立！`, sub: `関連物件の収益 +${combo.bonusPct}%！${combo.desc ? " " + combo.desc : ""}` });
  });
  (newMissions || []).forEach((mission) => {
    achievements.push({ icon: mission.icon, title: `ミッション「${mission.name}」達成！`, sub: `${mission.explain}（+${fmtMoney(mission.reward)}）` });
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
  modalBox.scrollTop = 0;
  setAfterClose(returnToShop);
}

function flashFirstPurchaseCelebration() {
  modalBox.innerHTML = `
    <div class="celebrate">
      <div class="big-emoji">🏠</div>
      <div class="confetti-row">🎉✨🎉</div>
      <div class="celebrate-title">はじめての物件購入！</div>
      <div class="celebrate-sub">お祝いに +${fmtMoney(FIRST_PURCHASE_BONUS)}！ここから資産を増やしていこう！</div>
      <button class="modal-close-btn primary" data-action="close-modal">がんばるぞ！</button>
    </div>`;
  modalBox.scrollTop = 0;
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
  modalBox.scrollTop = 0;
  setAfterClose(returnToShop);
}

function showVictoryModal() {
  const assets = state.cash + getOwnedPropertyValueSum();
  setModalContent(`
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
    </div>`);
}

// ============================================================
// ログ・マップ・コレクション
// ============================================================
function showLogModal() {
  const entries = state.logHistory.slice().reverse();
  const html = entries.length
    ? entries.map((e) => `<div class="log-entry ${e.cls ? "log-" + e.cls : ""}"><span class="log-when">${e.when}</span>${e.text}</div>`).join("")
    : `<div class="log-empty">まだ記録がありません。</div>`;
  setModalContent(`<div class="modal-title">📜 プレイログ</div>${html}<button class="modal-close-btn primary" data-action="close-modal">とじる</button>`);
  setAfterClose(null);
}

function showMapModal() {
  setModalContent(buildMapHtml());
  setAfterClose(null);
  requestAnimationFrame(() => {
    wireMapGestures();
    mapFitAll();
  });
}

// ============================================================
// 全国マップのズーム／パン操作（ピンチ・ドラッグ・ボタン）
// ============================================================
let mapView = { scale: 1, tx: 0, ty: 0 };
const MAP_SCALE_MIN = 0.3;
const MAP_SCALE_MAX = 4;
let mapPointers = new Map();
let mapDragLast = null;
let mapPinchStartDist = null;
let mapPinchStartScale = 1;

function clampMapScale(s) {
  return Math.min(MAP_SCALE_MAX, Math.max(MAP_SCALE_MIN, s));
}
function applyMapTransform() {
  const canvas = document.getElementById("mapCanvas");
  if (canvas) canvas.style.transform = `translate(${mapView.tx}px, ${mapView.ty}px) scale(${mapView.scale})`;
}
function mapWorldToCanvasPx(x, y) {
  return { x: (x - MAP_VIEWBOX.minX) * MAP_PX_PER_UNIT, y: (y - MAP_VIEWBOX.minY) * MAP_PX_PER_UNIT };
}
function mapZoom(factor) {
  mapView.scale = clampMapScale(mapView.scale * factor);
  applyMapTransform();
}
function mapFitAll() {
  const viewport = document.getElementById("mapViewport");
  if (!viewport) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const canvasW = MAP_VIEWBOX.w * MAP_PX_PER_UNIT, canvasH = MAP_VIEWBOX.h * MAP_PX_PER_UNIT;
  if (!vw || !vh) return;
  const scale = clampMapScale(Math.min(vw / canvasW, vh / canvasH) * 0.96);
  mapView.scale = scale;
  mapView.tx = (vw - canvasW * scale) / 2;
  mapView.ty = (vh - canvasH * scale) / 2;
  applyMapTransform();
}
function getCurrentMapWorldCoord() {
  if (state.onLine) {
    const line = LINES.find((l) => l.key === state.onLine.lineKey);
    const tile = line ? getLineTiles(line)[state.onLine.tileIdx] : null;
    if (tile) return tile.coord;
  }
  return getCity(state.currentCity).coord;
}
function mapGotoCurrent() {
  const viewport = document.getElementById("mapViewport");
  if (!viewport) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const pos = getCurrentMapWorldCoord();
  const target = mapWorldToCanvasPx(pos.x, pos.y);
  const scale = clampMapScale(2.2);
  mapView.scale = scale;
  mapView.tx = vw / 2 - target.x * scale;
  mapView.ty = vh / 2 - target.y * scale;
  applyMapTransform();
}
function wireMapGestures() {
  const viewport = document.getElementById("mapViewport");
  if (!viewport) return;
  mapPointers = new Map();
  mapDragLast = null;
  mapPinchStartDist = null;
  viewport.addEventListener("pointerdown", (e) => {
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch (err) {
      // 一部の環境（テスト用の合成イベント等）ではキャプチャが失敗することがあるが、
      // ポインター追跡自体は継続できるので無視してよい
    }
    mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mapPointers.size === 1) {
      mapDragLast = { x: e.clientX, y: e.clientY };
    } else if (mapPointers.size === 2) {
      const pts = [...mapPointers.values()];
      mapPinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      mapPinchStartScale = mapView.scale;
    }
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!mapPointers.has(e.pointerId)) return;
    mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mapPointers.size === 1 && mapDragLast) {
      const dx = e.clientX - mapDragLast.x;
      const dy = e.clientY - mapDragLast.y;
      mapView.tx += dx;
      mapView.ty += dy;
      mapDragLast = { x: e.clientX, y: e.clientY };
      applyMapTransform();
    } else if (mapPointers.size === 2 && mapPinchStartDist) {
      const pts = [...mapPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      mapView.scale = clampMapScale(mapPinchStartScale * (dist / mapPinchStartDist));
      applyMapTransform();
    }
  });
  const endPointer = (e) => {
    mapPointers.delete(e.pointerId);
    if (mapPointers.size < 2) mapPinchStartDist = null;
    if (mapPointers.size === 0) mapDragLast = null;
    else {
      const [only] = [...mapPointers.values()];
      mapDragLast = only;
    }
  };
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("pointerleave", endPointer);
}

// ---- 都市の地図上の状態（色分け）判定。マップ全体・SVGどちらからも使う ----
function getCityMapState(city) {
  const isCurrent = city.key === state.currentCity;
  const isMonopoly = state.monopolyCities.has(city.key);
  const ownedCount = city.properties.filter((_, i) => state.owned.has(propKey(city.key, i))).length;
  const remain = city.properties.length - ownedCount;
  const visited = state.visitedCities.has(city.key) || ownedCount > 0;
  const hasLandmark = city.properties.some((p, i) => p.tier === "E" && state.owned.has(propKey(city.key, i)));
  let stateClass = "unvisited";
  if (isMonopoly) stateClass = "monopoly";
  else if (hasLandmark) stateClass = "landmark";
  else if (remain === 1 && ownedCount > 0) stateClass = "near";
  else if (visited) stateClass = "visited";
  return { isCurrent, isMonopoly, hasLandmark, remain, ownedCount, visited, stateClass };
}

const MAP_STATE_COLOR = {
  unvisited: "#5c7185",
  visited: "#cfe0f0",
  near: "#ff6b6b",
  landmark: "#4cc9f0",
  monopoly: "#52c98a",
};
// すごろく盤としての統一路線カラー（鉄道／高速道路を厳密に描き分けない）。特殊区間だけ目立たせる。
const PATH_COLOR = "#d9c08a";
const SPECIAL_PATH_COLOR = "#ffb703";
const SPECIAL_ICON = { tunnel: "🚇", bridge: "🌉", strait: "🌊", flight: "✈️" };

// ---- 座標リストをなめらかな閉じた海岸線（カトマル・ロム曲線）に変換する ----
function smoothClosedPath(points) {
  const n = points.length;
  if (n < 3) return "";
  const p = (i) => points[((i % n) + n) % n];
  let d = `M ${p(0)[0]},${p(0)[1]} `;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]} `;
  }
  return d + "Z";
}

const MAP_VIEWBOX = { minX: -20, minY: -45, w: 300, h: 500 };
const MAP_PX_PER_UNIT = 1.4; // ズーム用キャンバスの基準サイズ（world単位 → CSSピクセル）

// 分岐点（複数の路線が交わる都市）かどうか。すごろく盤では「分岐マス」として区別して描く。
function isJunctionCity(cityKey) {
  return getNeighbors(cityKey).length > 2;
}

function buildMapSvg() {
  const { minX, minY, w: W, h: H } = MAP_VIEWBOX;
  const silhouettes = Object.entries(LANDMASS_OUTLINES)
    .map(([key, pts]) => `<path d="${smoothClosedPath(pts)}" fill="#284a68" stroke="#3a688f" stroke-width="1" opacity="0.9" />`)
    .join("");

  // 道（路線）は「鉄道／高速道路」を厳密に描き分けず、1本のすごろく街道として統一表現する。
  // 特殊区間（海峡・橋・トンネル・空路）だけ色とアイコンで目立たせる。
  const linesHtml = LINES.map((line) => {
    const color = line.special ? SPECIAL_PATH_COLOR : PATH_COLOR;
    const width = line.special ? 2.6 : 1.8;
    const pts = line.cities.map((ck) => getCity(ck).coord);
    const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(" ");
    return `<polyline points="${pointsAttr}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`;
  }).join("");

  // マス目：通常マス（小さい丸）／イベントマス（星）／特殊マス（アイコン）。都市マスは別レイヤーで描く。
  const tileMarksHtml = LINES.map((line) => {
    const tiles = getLineTiles(line);
    return tiles
      .filter((t) => t.type !== "city")
      .map((t) => {
        if (t.type === "special") {
          return `<g><circle cx="${t.coord.x}" cy="${t.coord.y}" r="4.2" fill="#3a2c14" stroke="${SPECIAL_PATH_COLOR}" stroke-width="1" /><text x="${t.coord.x}" y="${t.coord.y + 2.6}" font-size="6.5" text-anchor="middle">${SPECIAL_ICON[line.special] || "★"}</text></g>`;
        }
        if (t.type === "event") {
          return `<path transform="translate(${t.coord.x},${t.coord.y})" d="M0,-3.2 L1,-1 L3.2,-1 L1.4,0.5 L2,2.8 L0,1.4 L-2,2.8 L-1.4,0.5 L-3.2,-1 L-1,-1 Z" fill="#ffd166" stroke="#7a5200" stroke-width="0.5" />`;
        }
        return `<circle cx="${t.coord.x}" cy="${t.coord.y}" r="1.6" fill="#e8eef5" opacity="0.55" />`;
      })
      .join("");
  }).join("");

  const gapY = 400;
  const gapHtml = `<line x1="${minX}" y1="${gapY}" x2="${minX + W}" y2="${gapY}" stroke="#4cc9f0" stroke-width="1" stroke-dasharray="3,4" opacity="0.4" />
    <text x="${minX + W / 2}" y="${gapY + 12}" font-size="8.5" text-anchor="middle" fill="#a9bdd4">🌊 海（沖縄へは飛行機のみで移動）</text>`;

  // 都市マス：分岐点は角丸四角、それ以外は丸。現在地は大きく光らせる。
  const labelCities = CITIES.filter((c) => c.size === "metro" || c.size === "hub" || c.key === state.currentCity);
  const dotsHtml = CITIES.map((city) => {
    const st = getCityMapState(city);
    const color = MAP_STATE_COLOR[st.stateClass];
    const isPlayerHere = st.isCurrent && !state.onLine;
    const junction = isJunctionCity(city.key);
    const r = isPlayerHere ? 7 : city.size === "metro" ? 5 : city.size === "hub" ? 4.2 : 3.4;
    const ring = isPlayerHere ? `<circle cx="${city.coord.x}" cy="${city.coord.y}" r="${r + 3}" fill="none" stroke="#ffb703" stroke-width="1.6"><animate attributeName="r" values="${r + 3};${r + 5};${r + 3}" dur="1.6s" repeatCount="indefinite" /></circle>` : "";
    const badge = st.isMonopoly ? "👑" : st.hasLandmark ? "🏙️" : st.remain === 1 && st.ownedCount > 0 ? "🔥" : "";
    const showLabel = labelCities.includes(city);
    const label = showLabel
      ? `<text x="${city.coord.x}" y="${city.coord.y - r - 3}" font-size="${isPlayerHere ? 9 : 7}" text-anchor="middle" fill="${isPlayerHere ? "#ffb703" : "#e8eef5"}" font-weight="${isPlayerHere ? "bold" : "normal"}" paint-order="stroke" stroke="#0f2540" stroke-width="2.5">${city.name}${badge}</text>`
      : "";
    const shape = junction
      ? `<rect x="${city.coord.x - r}" y="${city.coord.y - r}" width="${r * 2}" height="${r * 2}" rx="2.5" fill="${color}" stroke="#0f2540" stroke-width="1.2" transform="rotate(45 ${city.coord.x} ${city.coord.y})" />`
      : `<circle cx="${city.coord.x}" cy="${city.coord.y}" r="${r}" fill="${color}" stroke="#0f2540" stroke-width="1" />`;
    return `<g>${ring}${shape}<title>${city.name}${badge}${junction ? "（分岐点）" : ""}</title>${label}</g>`;
  }).join("");

  let playerOnLineHtml = "";
  if (state.onLine) {
    const line = LINES.find((l) => l.key === state.onLine.lineKey);
    const tile = getLineTiles(line)[state.onLine.tileIdx];
    if (tile) {
      playerOnLineHtml = `<g>
        <circle cx="${tile.coord.x}" cy="${tile.coord.y}" r="8" fill="none" stroke="#ffb703" stroke-width="1.6"><animate attributeName="r" values="8;10;8" dur="1.6s" repeatCount="indefinite" /></circle>
        <circle cx="${tile.coord.x}" cy="${tile.coord.y}" r="5.5" fill="#ffb703" stroke="#0f2540" stroke-width="1" />
        <text x="${tile.coord.x}" y="${tile.coord.y - 11}" font-size="9" text-anchor="middle" fill="#ffb703" font-weight="bold" paint-order="stroke" stroke="#0f2540" stroke-width="2.5">📍現在地</text>
      </g>`;
    }
  }

  const canvasW = Math.round(W * MAP_PX_PER_UNIT);
  const canvasH = Math.round(H * MAP_PX_PER_UNIT);
  return `<svg viewBox="${minX} ${minY} ${W} ${H}" width="${canvasW}" height="${canvasH}" class="japan-map-svg" xmlns="http://www.w3.org/2000/svg">
    ${silhouettes}
    ${linesHtml}
    ${tileMarksHtml}
    ${gapHtml}
    ${dotsHtml}
    ${playerOnLineHtml}
  </svg>`;
}

function buildMapHtml() {
  const regionsHtml = REGIONS.map((region) => {
    const cities = CITIES.filter((c) => c.region === region.key);
    const conquered = state.regionConquered.has(region.key);
    const chips = cities
      .map((city) => {
        const st = getCityMapState(city);
        return `<span class="map-chip ${st.stateClass} ${st.isCurrent ? "current" : ""}">${city.icon} ${city.name}${st.isMonopoly ? " 👑" : st.hasLandmark ? " 🏙️" : st.remain === 1 && st.ownedCount > 0 ? " 🔥" : ""}${st.isCurrent ? " 📍" : ""}</span>`;
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

  return `<div class="modal-title">🗺️ 全国すごろくマップ</div>
    <div class="map-viewport" id="mapViewport">
      <div class="map-canvas" id="mapCanvas">${buildMapSvg()}</div>
    </div>
    <div class="map-zoom-controls">
      <button class="map-zoom-btn" data-action="map-zoom-out">－</button>
      <button class="map-zoom-btn" data-action="map-zoom-in">＋</button>
      <button class="map-zoom-btn wide" data-action="map-fit">🗾 全体表示</button>
      <button class="map-zoom-btn wide" data-action="map-goto-current">📍現在地へ</button>
    </div>
    <div class="map-tile-legend">
      <span class="tile-legend-item"><span class="tile-swatch tile-swatch-city"></span>街（都市）</span>
      <span class="tile-legend-item"><span class="tile-swatch tile-swatch-junction"></span>分岐点</span>
      <span class="tile-legend-item"><span class="tile-swatch tile-swatch-blank"></span>通常マス</span>
      <span class="tile-legend-item"><span class="tile-swatch tile-swatch-event"></span>イベントマス</span>
      <span class="tile-legend-item"><span class="tile-swatch tile-swatch-special"></span>特殊区間</span>
    </div>
    <div class="map-legend">
      <span class="map-chip current">📍現在地</span>
      <span class="map-chip unvisited">未訪問</span>
      <span class="map-chip visited">訪問済み</span>
      <span class="map-chip near">🔥完全制覇目前</span>
      <span class="map-chip landmark">🏙️ランドマーク解禁</span>
      <span class="map-chip monopoly">👑完全制覇</span>
    </div>
    <div class="modal-sub">指2本でつまんで拡大・縮小、指1本でドラッグして移動できます。ボタンでも操作できます。</div>
    ${regionsHtml}
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
}

function showCollectionModal() {
  missionDetailReturnTo = showCollectionModal;
  setModalContent(buildCollectionHtml());
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

  const pendingMissions = MISSIONS.filter((m) => !state.missionsAchieved.has(m.key) && isMissionUnlocked(m))
    .map((m) => ({ m, prog: getMissionProgress(m) }))
    .sort((a, b) => a.prog.remain - b.prog.remain)
    .slice(0, 3);
  const missionsHtml = pendingMissions.length
    ? pendingMissions.map(({ m, prog }) => buildMissionRowHtml(m, prog)).join("")
    : `<div class="log-empty" style="padding:8px 0;">未達成のミッションはこれで全部！</div>`;

  return `
    <div class="modal-title">🏆 コレクション</div>
    <div class="collection-overall">
      <div class="collection-overall-pct">${overallPct}%</div>
      <div class="collection-overall-label">全物件制覇率（${ownedProps}/${totalProps}件）</div>
    </div>
    <div class="modal-sub" style="margin-top:14px;">地方別 完全制覇状況</div>
    ${regionsHtml}
    <div class="modal-sub" style="margin-top:14px;">🎯 ねらい目のミッション（達成 ${state.missionsAchieved.size}/${MISSIONS.length}）タップで詳細</div>
    ${missionsHtml}
    <button class="modal-close-btn secondary-outline" data-action="mission-list" style="margin-top:2px;">🎯 ミッション一覧をすべて見る</button>
    <div class="modal-sub" style="margin-top:14px;">🏙️ ランドマーク物件（${landmarks.filter((l) => state.owned.has(propKey(l.city.key, l.i))).length}/${landmarks.length}）</div>
    <div class="overview-props-mini">${landmarksHtml}</div>
    <div class="modal-sub" style="margin-top:14px;">🔗 産業コンボ（${state.comboAchieved.size}/${COMBOS.length}）</div>
    <div class="overview-props-mini">${combosHtml}</div>
    <div class="modal-sub" style="margin-top:14px;">❓ クイズ正解数：${state.quizCorrectTotal} / ${state.quizAskedTotal}問</div>
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>
  `;
}

// ============================================================
// ミッション詳細（タップで達成条件・進捗・報酬を確認）
// ============================================================
let missionDetailReturnTo = null;

function buildMissionRowHtml(m, prog) {
  const achieved = state.missionsAchieved.has(m.key);
  return `<div class="mission-row" data-action="mission-detail" data-mission="${m.key}">
    <span>${achieved ? "✅" : m.icon} ${m.name}</span>
    <span class="mission-progress">${achieved ? "達成済み" : `${prog.owned}/${prog.total}件`}・${fmtMoney(m.reward)}</span>
  </div>`;
}

function showMissionListModal() {
  missionDetailReturnTo = showMissionListModal;
  setModalContent(buildMissionListHtml());
  setAfterClose(null);
}

function buildMissionListHtml() {
  const rows = MISSIONS.filter((m) => isMissionUnlocked(m))
    .map((m) => buildMissionRowHtml(m, getMissionProgress(m)))
    .join("");
  return `<div class="modal-title">🎯 ミッション一覧（${state.missionsAchieved.size}/${MISSIONS.length}達成）</div>
    <div class="modal-sub">タップすると達成条件・進捗・報酬を確認できるよ。</div>
    ${rows || '<div class="log-empty">ミッションがありません。</div>'}
    <button class="modal-close-btn primary" data-action="close-modal">とじる</button>`;
}

function showMissionDetailModal(missionKey) {
  const m = MISSIONS.find((x) => x.key === missionKey);
  if (!m) return;
  setModalContent(buildMissionDetailHtml(m));
  setAfterClose(null);
}

function buildMissionDetailHtml(m) {
  const achieved = state.missionsAchieved.has(m.key);
  const prog = getMissionProgress(m);
  const memberRows = m.members
    .map((mem) => {
      const city = getCity(mem.city);
      const p = city.properties[mem.idx];
      const owned = state.owned.has(propKey(mem.city, mem.idx));
      return `<div class="mission-detail-row ${owned ? "owned" : ""}">
        <span class="mission-detail-check">${owned ? "✅" : "⬜"}</span>
        <span class="mission-detail-name">${city.icon} ${city.name}：${p.icon} ${p.name}</span>
      </div>`;
    })
    .join("");
  const conditionLine = achieved
    ? "🎉 達成済み！"
    : `達成条件：下の物件をすべて所有する（進捗 ${prog.owned}/${prog.total}件）`;
  return `<div class="modal-title">${m.icon} ${m.name}</div>
    <div class="modal-sub">${m.explain}</div>
    <div class="hint-banner">${conditionLine}</div>
    <div class="mission-detail-list">${memberRows}</div>
    <div class="mission-detail-reward">報酬　<strong>${fmtMoney(m.reward)}</strong></div>
    <button class="modal-close-btn primary" data-action="mission-back">戻る</button>`;
}

function showMenuModal() {
  setModalContent(`
    <div class="modal-title">☰ メニュー</div>
    <div class="modal-sub">サイコロで移動して物件を買い占め、都市や地方の完全制覇を目指そう。クイズは毎ターン出題され、正解するとごほうびがもらえるよ。年間収益1兆円で「トリリオネア」達成！</div>
    <button class="modal-close-btn secondary-outline" data-action="close-modal">ゲームにもどる</button>
    <button class="modal-close-btn secondary-outline" data-action="show-tutorial" style="margin-top:8px;">📖 あそびかたを見る</button>
    <button class="modal-close-btn primary" data-action="menu-new-game" style="margin-top:8px;">🆕 はじめから始める</button>
  `);
  setAfterClose(null);
}

// ============================================================
// あそびかた（初回チュートリアル。メニューからいつでも見返せる）
// ============================================================
function buildTutorialHtml() {
  return `<div class="modal-title">📖 あそびかた</div>
    <div class="tutorial-list">
      <div class="tutorial-item"><span class="tutorial-emoji">🎯</span>目標は<strong>年間収益1兆円</strong>！日本一の大企業を作ろう。</div>
      <div class="tutorial-item"><span class="tutorial-emoji">🎲</span>サイコロを振って<strong>日本全国</strong>を旅しよう。</div>
      <div class="tutorial-item"><span class="tutorial-emoji">❓</span>着いた街では<strong>クイズ</strong>に答えてごほうびをゲット。</div>
      <div class="tutorial-item"><span class="tutorial-emoji">🏠</span>もらったお金で<strong>物件</strong>を買って収益を増やそう。</div>
      <div class="tutorial-item"><span class="tutorial-emoji">📊</span><strong>3月の決算</strong>で1年ぶんの利益がまとめて入るよ。</div>
      <div class="tutorial-item"><span class="tutorial-emoji">👑</span>街や地方を<strong>完全制覇</strong>すると収益がもっとアップ！</div>
    </div>
    <button class="modal-close-btn primary" data-action="close-modal">はじめる！</button>`;
}
function showTutorialModal(onDone) {
  if (!state.tutorialSeen) {
    state.tutorialSeen = true;
    autoSave();
  }
  setModalContent(buildTutorialHtml());
  setAfterClose(onDone || null);
}

function showConfirmNewGameModal() {
  setModalContent(`
    <div class="celebrate">
      <div class="big-emoji">⚠️</div>
      <div class="celebrate-title">はじめから始めますか？</div>
      <div class="celebrate-sub">今のセーブデータは消えてしまいます。</div>
      <button class="modal-close-btn primary" data-action="confirm-new-game">はじめから始める</button>
      <button class="modal-close-btn secondary-outline" data-action="close-modal">キャンセル</button>
    </div>`);
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
    quizAnsweredCorrectIds: state.quizAnsweredCorrectIds,
    logHistory: state.logHistory.slice(-150),
    pendingKessan: state.pendingKessan,
    turnCount: state.turnCount,
    visitedCities: [...state.visitedCities],
    missionsAchieved: [...state.missionsAchieved],
    onLine: state.onLine,
    triggeredEventTiles: state.triggeredEventTiles,
    tutorialSeen: state.tutorialSeen,
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
  // 旧セーブ互換：以前は枚数(数値)だったので、その場合は30%クーポンとして引き継ぐ
  if (Array.isArray(data.discountCoupons)) {
    s.discountCoupons = data.discountCoupons;
  } else if (typeof data.discountCoupons === "number" && data.discountCoupons > 0) {
    s.discountCoupons = new Array(data.discountCoupons).fill(30);
  } else {
    s.discountCoupons = [];
  }
  s.kessanBonusPct = data.kessanBonusPct || 0;
  s.kessanFlatBonus = data.kessanFlatBonus || 0;
  s.milestonesHit = new Set(data.milestonesHit || []);
  s.victoryAchieved = !!data.victoryAchieved;
  s.firstPurchaseDone = !!data.firstPurchaseDone;
  s.quizRecent = data.quizRecent || [];
  s.quizAnsweredCorrectIds = data.quizAnsweredCorrectIds || [];
  s.logHistory = data.logHistory || [];
  s.pendingKessan = !!data.pendingKessan;
  s.turnCount = data.turnCount || 0;
  if (data.visitedCities) {
    s.visitedCities = new Set(data.visitedCities);
  } else {
    // 旧セーブ互換: 訪問履歴がない場合、所有物件やクイズ履歴がある都市を「訪問済み」とみなす
    const inferred = new Set(Object.keys(s.cityQuizCorrect));
    s.owned.forEach((k) => inferred.add(k.split("#")[0]));
    if (s.currentCity) inferred.add(s.currentCity);
    s.visitedCities = inferred;
  }
  s.missionsAchieved = new Set(data.missionsAchieved || []);
  s.onLine = data.onLine || null;
  s.triggeredEventTiles = data.triggeredEventTiles || [];
  s.tutorialSeen = !!data.tutorialSeen;
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
  showTutorialModal(() => handleCityArrival("tokyo"));
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
  routeProgressEl = document.getElementById("routeProgress");

  diceFace = document.getElementById("diceFace");
  diceHintEl = document.getElementById("diceHint");
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

  diceFace.addEventListener("click", () => {
    if (diceFace.classList.contains("dice-disabled")) return;
    rollDiceOnly();
  });

  directionButtons.addEventListener("click", (e) => {
    if (directionButtons.classList.contains("controls-disabled")) return;
    if (pendingDiceValue == null) return; // 先にサイコロを振る必要がある
    const target = e.target.closest("[data-line-key]");
    if (!target) return;
    const steps = pendingDiceValue;
    pendingDiceValue = null;
    diceFace.classList.remove("dice-used");
    setControlsEnabled(false);
    movePlayerAlongTiles(target.dataset.lineKey, Number(target.dataset.dir), steps);
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
    const extraQuizBtn = e.target.closest('[data-action="quiz-extra"]');
    if (extraQuizBtn) {
      quizExtraAttempts++;
      showQuizModal(quizCityKey, quizOnDone, false, [], true);
      return;
    }
    const launchQuizBtn = e.target.closest('[data-action="launch-quiz"]');
    if (launchQuizBtn && !launchQuizBtn.disabled) {
      const ck = launchQuizBtn.dataset.city;
      if (quizExtraAttempts >= MAX_EXTRA_QUIZ_PER_VISIT) return;
      quizExtraAttempts++;
      showQuizModal(ck, () => renderCityShopContent(ck), false, [], true);
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
    const tierTab = e.target.closest('[data-action="shop-tier"]');
    if (tierTab) {
      shopTierFilter = tierTab.dataset.tier;
      renderCityShopContent(activeCityKey);
      return;
    }
    const kessanBtn = e.target.closest('[data-action="kessan-confirm"]');
    if (kessanBtn) {
      confirmKessan();
      return;
    }
    const missionRow = e.target.closest('[data-action="mission-detail"]');
    if (missionRow) {
      showMissionDetailModal(missionRow.dataset.mission);
      return;
    }
    const missionBack = e.target.closest('[data-action="mission-back"]');
    if (missionBack) {
      (missionDetailReturnTo || showCollectionModal)();
      return;
    }
    const missionListBtn = e.target.closest('[data-action="mission-list"]');
    if (missionListBtn) {
      showMissionListModal();
      return;
    }
    const tutorialBtn = e.target.closest('[data-action="show-tutorial"]');
    if (tutorialBtn) {
      showTutorialModal(null);
      return;
    }
    const mapZoomInBtn = e.target.closest('[data-action="map-zoom-in"]');
    if (mapZoomInBtn) {
      mapZoom(1.35);
      return;
    }
    const mapZoomOutBtn = e.target.closest('[data-action="map-zoom-out"]');
    if (mapZoomOutBtn) {
      mapZoom(1 / 1.35);
      return;
    }
    const mapFitBtn = e.target.closest('[data-action="map-fit"]');
    if (mapFitBtn) {
      mapFitAll();
      return;
    }
    const mapGotoBtn = e.target.closest('[data-action="map-goto-current"]');
    if (mapGotoBtn) {
      mapGotoCurrent();
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
