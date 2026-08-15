/* ============================================================
   トリリオネアを目指せ！ - 道中イベント（タイル）データ
   都市間を移動しているとき、その区間の密度(density)に応じた確率で
   1つだけ「道中で何かが起きる」演出を出す。主要幹線(density0)ほど
   起きにくく、地方路線や特別区間(density2〜3)ほど起きやすい。
   実際の判定・適用ロジックは game.js 側にある。
   ============================================================ */

// 通常区間（rail/highway）で使う汎用タイル。
const GENERIC_TILES = [
  { key: "sa", icon: "🅿️", name: "サービスエリア", effect: { type: "cash", min: 150, max: 400 } },
  { key: "station", icon: "🚉", name: "乗換駅", effect: { type: "cash", min: 100, max: 300 } },
  { key: "mountain", icon: "⛰️", name: "山道", effect: { type: "cashMinus", min: 50, max: 150 } },
  { key: "port", icon: "⚓", name: "港町", effect: { type: "discount" } },
  { key: "scenic", icon: "🏞️", name: "観光スポット", effect: { type: "kessanBonus", min: 3, max: 8 } },
  { key: "factory_area", icon: "🏭", name: "工業地帯", effect: { type: "cash", min: 150, max: 350 } },
  { key: "farm_area", icon: "🌾", name: "農業地帯", effect: { type: "cash", min: 100, max: 300 } },
  { key: "unlock_point", icon: "🔓", name: "地域交流ポイント", effect: { type: "unlockPoint" } },
];

// 海峡・橋・トンネル・空路など、特別な区間専用のタイル（LINES の special キーで参照）。
const SPECIAL_TILES = {
  tunnel: [{ key: "seikan_tunnel", icon: "🚇", name: "青函トンネル", desc: "本州と北海道をつなぐ、海底54kmの大トンネル！", effect: { type: "kessanBonus", min: 5, max: 10 } }],
  bridge: [{ key: "seto_bridge_tile", icon: "🌉", name: "瀬戸大橋", desc: "本州と四国をつなぐ、鉄道と道路が通る大きな橋！", effect: { type: "cash", min: 300, max: 600 } }],
  strait: [{ key: "kanmon_strait_tile", icon: "🌊", name: "関門海峡", desc: "本州と九州の間の海峡。トンネルと橋でつながっているよ！", effect: { type: "cash", min: 250, max: 500 } }],
  flight: [{ key: "okinawa_flight_tile", icon: "✈️", name: "沖縄への空の旅", desc: "本土から沖縄までは飛行機で空の旅！", effect: { type: "kessanBonus", min: 8, max: 15 } }],
};

// density(0〜3) → 道中イベントが起きる確率。
const TILE_DENSITY_CHANCE = [0.05, 0.2, 0.35, 0.55];
