/* ============================================================
   トリリオネアを目指せ！ - 都市・路線データ（全国編 / Map・Route Network v2）
   ここに都市を追加すれば、ロジック側の変更なしでゲームに反映される。

   tier: A=1000万〜9000万 / B=1億〜10億 / C=10億〜100億 /
         D=100億〜1000億 / E=1000億超（ランドマーク級）
   unlock: { quiz: n } でその都市のクイズに累計n問正解すると購入可能。
            { quiz: n, ownRatio: r } はさらに「ランドマーク以外の物件をr以上所有」も必要
            （E=ランドマークは複数条件をあわせ持つ長期目標にしている）
   size: "metro"(大都市)/"hub"(地方拠点都市)/"town"(地方都市)
         ※表示・演出の参考情報。ゲームロジックの必須項目ではない。

   ---- v2での再設計方針 ----
   都市の画面座標(coord)は手作業の相対配置をやめ、各都市の実際の緯度経度(lat/lng)を
   1つの投影関数 projectLatLng() に通して機械的に算出する。海岸線(LANDMASS_OUTLINES)も
   同じ関数を使うため、都市と地図の位置関係が実際の地理と自然に一致する。
   都市間の道（CONNECTIONS）も現実の主要交通回廊を基準にゼロから再監査し、
   全都市が孤立・行き止まりにならない（degree>=2）ネットワークに再構築した。
   ゲームエンジン（game.js）が使う LINES は CONNECTIONS から自動生成する
   （経路データを二重管理しないため。1本のLINE=必ず2都市間の1区間）。
   ============================================================ */

// ---- 実緯度経度 → ゲーム盤面座標への投影 ----
// 単純な正距円筒図法（基準緯度でのcos補正つき）。精密な地図投影ではないが、
// 日本列島程度の範囲であれば形・位置関係が自然に見える簡易近似として十分。
const MAP_PROJECTION = { lngRef: 136, latTop: 44, scale: 28, cosLatRef: Math.cos((36 * Math.PI) / 180) };
function projectLatLng(lat, lng) {
  return {
    x: Math.round((lng - MAP_PROJECTION.lngRef) * MAP_PROJECTION.cosLatRef * MAP_PROJECTION.scale * 100) / 100,
    y: Math.round((MAP_PROJECTION.latTop - lat) * MAP_PROJECTION.scale * 100) / 100,
  };
}

// 地方データ。全都市を完全制覇すると「地方完全制覇」になる。
// 同じ都道府県に属する都市どうしのグループ（クイズの「同都道府県」優先度に使用）。
// 載っていない都市は都道府県内で1都市のみ扱い（＝都市優先度と都道府県優先度が実質同じ）。
const PREF_GROUPS = [
  ["yokohama", "odawara"], // 神奈川県
  ["shizuoka", "hamamatsu"], // 静岡県
  ["fukuoka", "kitakyushu"], // 福岡県
];

// 日本地図のシルエット表現用のおおよその海岸線ポイント（緯度経度→投影）。
// 精密な海岸線データではないが、北海道・本州（房総・伊豆・能登・紀伊などの半島を含む）・
// 四国・九州・沖縄の輪郭・向き・位置関係が一目で「日本地図」とわかることを優先している。
const LANDMASS_OUTLINES_LATLNG = {
  hokkaido: [
    [45.52, 141.94], // 宗谷岬
    [44.3, 144.5], // オホーツク海岸
    [43.3, 145.82], // 納沙布岬
    [42.9, 144.4], // 釧路沿岸
    [41.95, 143.15], // 襟裳岬
    [42.3, 141.0], // 噴火湾
    [41.43, 140.1], // 渡島半島先端
    [41.77, 140.73], // 函館
    [42.6, 140.1], // 渡島半島西岸
    [43.2, 141.0], // 小樽
    [43.35, 140.2], // 積丹半島
    [43.9, 141.6], // 留萌
    [45.4, 141.7], // 稚内
  ],
  honshu: [
    [41.0, 140.9], // 津軽半島東岸
    [41.5, 141.3], // 下北半島東
    [41.3, 141.55], // 下北半島先端
    [40.5, 141.9], // 八戸沿岸
    [39.64, 141.98], // 宮古（三陸海岸）
    [38.4, 141.3], // 石巻・仙台湾
    [36.95, 140.9], // いわき
    [36.4, 140.75], // 日立
    [35.73, 140.87], // 銚子（房総半島東端）
    [34.98, 139.85], // 館山（房総半島南端）
    [35.18, 139.67], // 三浦半島
    [35.0, 139.07], // 熱海（伊豆半島東の付け根）
    [34.67, 138.95], // 下田（伊豆半島先端）
    [35.0, 138.85], // 沼津（伊豆半島西の付け根）
    [34.6, 138.23], // 御前崎
    [34.6, 137.2], // 渥美半島（伊勢湾口東）
    [34.3, 136.85], // 志摩半島（伊勢湾口西）
    [34.07, 136.2], // 尾鷲
    [33.45, 135.77], // 潮岬（紀伊半島先端）
    [33.7, 135.3], // 田辺
    [34.23, 135.17], // 和歌山沿岸
    [34.65, 135.18], // 大阪湾北岸
    [34.65, 135.0], // 明石海峡
    [34.5, 133.9], // 岡山沿岸
    [34.35, 132.45], // 広島沿岸
    [33.95, 130.93], // 下関（本州西端）
    [34.42, 131.4], // 萩
    [35.55, 133.05], // 島根半島
    [35.62, 134.24], // 鳥取沿岸
    [35.6, 135.7], // 若狭湾
    [35.65, 136.05], // 敦賀
    [36.6, 136.6], // 能登半島の付け根
    [37.45, 137.25], // 能登半島先端
    [36.95, 137.2], // 富山湾東
    [36.8, 137.4], // 富山沿岸
    [37.95, 139.05], // 新潟沿岸
    [38.9, 139.85], // 酒田
    [39.72, 139.9], // 秋田沿岸
    [40.6, 140.3], // 津軽半島西岸
  ],
  shikoku: [
    [34.4, 134.1], // 高松沿岸
    [34.25, 134.65], // 徳島北東
    [33.25, 134.18], // 室戸岬
    [33.5, 133.55], // 高知沿岸
    [32.73, 133.02], // 足摺岬
    [33.22, 132.56], // 宇和島
    [33.84, 132.6], // 松山西岸
    [34.07, 133.0], // 今治
  ],
  kyushu: [
    [33.9, 130.85], // 北九州
    [33.28, 131.5], // 別府
    [31.9, 131.55], // 宮崎沿岸
    [31.35, 131.33], // 都井岬
    [31.0, 130.66], // 佐多岬（九州最南端）
    [31.4, 130.2], // 薩摩半島西岸
    [31.6, 130.0], // 鹿児島西岸
    [32.5, 130.0], // 天草
    [32.7, 129.7], // 長崎半島
    [33.45, 129.9], // 唐津
    [33.65, 130.4], // 福岡北岸
  ],
  okinawa: [
    [26.5, 127.9],
    [26.35, 128.05],
    [26.05, 128.0],
    [25.85, 127.85],
    [26.0, 127.6],
    [26.3, 127.55],
  ],
};
const LANDMASS_OUTLINES = Object.fromEntries(
  Object.entries(LANDMASS_OUTLINES_LATLNG).map(([key, pts]) => [key, pts.map(([lat, lng]) => { const p = projectLatLng(lat, lng); return [p.x, p.y]; })])
);

const REGIONS = [
  { key: "hokkaido", name: "北海道", icon: "❄️" },
  { key: "tohoku", name: "東北", icon: "🌲" },
  { key: "kanto", name: "関東", icon: "🗼" },
  { key: "koshinetsu_hokuriku", name: "甲信越・北陸", icon: "🏔️" },
  { key: "tokai", name: "東海", icon: "🍵" },
  { key: "kansai", name: "近畿", icon: "⛩️" },
  { key: "chugoku", name: "中国", icon: "🦪" },
  { key: "shikoku", name: "四国", icon: "🍊" },
  { key: "kyushu", name: "九州", icon: "🌋" },
  { key: "okinawa", name: "沖縄", icon: "🌺" },
];

const CITIES = [
  // ================= 関東 =================
  {
    key: "tokyo", name: "東京", icon: "🗼", region: "kanto", size: "metro", lat: 35.68, lng: 139.77,
    catch: "日本の首都、大都会！",
    properties: [
      { name: "下町のたい焼き屋", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "神田神保町の古本屋", icon: "📚", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "秋葉原の電気街ショップ", icon: "🔌", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "築地の海鮮卸問屋", icon: "🍣", tier: "B", price: 50000, yieldPct: 13, revenue: 6500 },
      { name: "六本木ITオフィスタワー", icon: "💻", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "東京ベイ物流センター", icon: "🚚", tier: "C", price: 700000, yieldPct: 9, revenue: 63000 },
      { name: "大手町金融タワー", icon: "🏦", tier: "D", price: 9500000, yieldPct: 7, revenue: 665000, unlock: { quiz: 3 } },
      { name: "東京スカイツリー観光複合施設", icon: "🗼", tier: "E", price: 288000000, yieldPct: 4, revenue: 11520000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "yokohama", name: "横浜", icon: "⚓", region: "kanto", size: "metro", lat: 35.44, lng: 139.64,
    catch: "港とみなとみらいの街！",
    properties: [
      { name: "中華街の点心店", icon: "🥟", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "元町の洋菓子店", icon: "🍰", tier: "A", price: 1600, yieldPct: 16, revenue: 256 },
      { name: "赤レンガ倉庫の土産卸", icon: "🧱", tier: "B", price: 25000, yieldPct: 14, revenue: 3500 },
      { name: "中華街レストラン組合", icon: "🍜", tier: "B", price: 40000, yieldPct: 13, revenue: 5200 },
      { name: "横浜港コンテナターミナル", icon: "🚢", tier: "C", price: 350000, yieldPct: 10, revenue: 35000 },
      { name: "みなとみらいオフィスビル", icon: "🏢", tier: "C", price: 550000, yieldPct: 9, revenue: 49500 },
      { name: "横浜造船ドック", icon: "🛠️", tier: "D", price: 7000000, yieldPct: 7, revenue: 490000, unlock: { quiz: 3 } },
      { name: "横浜ベイブリッジ物流ハブ", icon: "🌉", tier: "E", price: 180000000, yieldPct: 4, revenue: 7200000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "odawara", name: "小田原", icon: "🏯", region: "kanto", size: "town", lat: 35.26, lng: 139.15,
    catch: "お城とかまぼこの町！",
    properties: [
      { name: "かまぼこ専門店", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "小田原城下の梅干し屋", icon: "🍑", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "みかん農園グループ", icon: "🍊", tier: "B", price: 18000, yieldPct: 15, revenue: 2700 },
      { name: "干物加工センター", icon: "🐡", tier: "B", price: 30000, yieldPct: 13, revenue: 3900 },
      { name: "小田原漁港水産加工団地", icon: "🎣", tier: "C", price: 150000, yieldPct: 11, revenue: 16500 },
      { name: "西湘バイパス物流拠点", icon: "🚛", tier: "C", price: 250000, yieldPct: 10, revenue: 25000 },
      { name: "小田原城観光開発", icon: "🏯", tier: "D", price: 3000000, yieldPct: 7, revenue: 210000, unlock: { quiz: 3 } },
      { name: "小田原駅前メガ再開発", icon: "🏗️", tier: "E", price: 72000000, yieldPct: 4, revenue: 2880000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "chiba", name: "千葉", icon: "🥜", region: "kanto", size: "town", lat: 35.61, lng: 140.12,
    catch: "落花生と漁業、幕張の展示都市！",
    properties: [
      { name: "落花生農園", icon: "🥜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "九十九里漁港の干物店", icon: "🐟", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "幕張国際展示場", icon: "🏢", tier: "B", price: 40000, yieldPct: 13, revenue: 5200 },
      { name: "房総テーマパーク", icon: "🎡", tier: "B", price: 45000, yieldPct: 14, revenue: 6300 },
      { name: "千葉臨海コンビナート", icon: "⚗️", tier: "C", price: 300000, yieldPct: 9, revenue: 27000 },
      { name: "成田国際空港物流拠点", icon: "✈️", tier: "D", price: 4500000, yieldPct: 7, revenue: 315000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "saitama", name: "さいたま", icon: "🚃", region: "kanto", size: "town", lat: 35.86, lng: 139.65,
    catch: "鉄道と盆栽の街、交通の要衝！",
    properties: [
      { name: "大宮盆栽園", icon: "🌳", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "鉄道模型ショップ", icon: "🚃", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "大宮鉄道車両工場", icon: "🚆", tier: "B", price: 38000, yieldPct: 14, revenue: 5320 },
      { name: "スーパーアリーナ興行", icon: "🏟️", tier: "B", price: 42000, yieldPct: 13, revenue: 5460 },
      { name: "埼玉物流ターミナル", icon: "🚛", tier: "C", price: 280000, yieldPct: 10, revenue: 28000 },
      { name: "大宮新都心オフィス開発", icon: "🏙️", tier: "D", price: 2800000, yieldPct: 7, revenue: 196000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "utsunomiya", name: "宇都宮", icon: "🥟", region: "kanto", size: "town", lat: 36.57, lng: 139.88,
    catch: "餃子といちご、関東平野の農業拠点！",
    properties: [
      { name: "餃子専門店", icon: "🥟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "いちご農園", icon: "🍓", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "宇都宮LRT関連事業", icon: "🚋", tier: "B", price: 18000, yieldPct: 15, revenue: 2700 },
      { name: "大谷石採石場", icon: "🪨", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "関東平野農産物流センター", icon: "🚜", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
      { name: "宇都宮工業団地", icon: "🏭", tier: "D", price: 1700000, yieldPct: 7, revenue: 119000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "takasaki", name: "高崎", icon: "🪅", region: "kanto", size: "town", lat: 36.32, lng: 139.0,
    catch: "だるまとこんにゃく、新幹線分岐点！",
    properties: [
      { name: "高崎だるま工房", icon: "🪅", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "こんにゃく農園・工場", icon: "🍢", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "高崎新幹線分岐ターミナル", icon: "🚄", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "群馬絹織物工房", icon: "🧵", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "上信越物流拠点", icon: "🚛", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "高崎駅前再開発ビル", icon: "🏙️", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "mito", name: "水戸", icon: "🍡", region: "kanto", size: "town", lat: 36.37, lng: 140.47,
    catch: "納豆と偕楽園、茨城の県庁所在地！",
    properties: [
      { name: "納豆専門店", icon: "🍡", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "干し芋農園", icon: "🍠", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "偕楽園梅林観光組合", icon: "🌸", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "筑波山観光開発", icon: "⛰️", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "鹿島臨海工業地帯コンビナート", icon: "🏭", tier: "C", price: 160000, yieldPct: 10, revenue: 16000 },
    ],
  },

  // ================= 東北 =================
  {
    key: "sendai", name: "仙台", icon: "🌲", region: "tohoku", size: "hub", lat: 38.27, lng: 140.87,
    catch: "杜の都、東北一の商都！",
    properties: [
      { name: "牛タン専門店", icon: "🐮", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "笹かまぼこ工場", icon: "🐟", tier: "B", price: 35000, yieldPct: 14, revenue: 4900 },
      { name: "七夕まつり観光組合", icon: "🎋", tier: "B", price: 45000, yieldPct: 13, revenue: 5850 },
      { name: "野球スタジアム興行", icon: "⚾", tier: "C", price: 350000, yieldPct: 10, revenue: 35000 },
      { name: "仙台半導体工場", icon: "💾", tier: "C", price: 500000, yieldPct: 9, revenue: 45000 },
      { name: "東北新幹線ターミナルビル", icon: "🚄", tier: "D", price: 4000000, yieldPct: 7, revenue: 280000, unlock: { quiz: 3 } },
      { name: "杜の都メガタワー", icon: "🏙️", tier: "E", price: 90000000, yieldPct: 4, revenue: 3600000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "morioka", name: "盛岡", icon: "🍜", region: "tohoku", size: "town", lat: 39.7, lng: 141.15,
    catch: "わんこそばと南部鉄器の町！",
    properties: [
      { name: "わんこそば屋", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "南部鉄器工房", icon: "🫖", tier: "A", price: 1400, yieldPct: 16, revenue: 224 },
      { name: "りんご農園グループ", icon: "🍎", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "岩手木工家具メーカー", icon: "🪑", tier: "B", price: 28000, yieldPct: 13, revenue: 3640 },
      { name: "盛岡冷麺食品工場", icon: "🍲", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "北上川流域物流センター", icon: "🚚", tier: "D", price: 2200000, yieldPct: 7, revenue: 154000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "fukushima", name: "福島", icon: "🍑", region: "tohoku", size: "town", lat: 37.75, lng: 140.47,
    catch: "桃と果樹園、新幹線の交通拠点！",
    properties: [
      { name: "桃農園", icon: "🍑", tier: "A", price: 1100, yieldPct: 18, revenue: 198 },
      { name: "会津漆器工房", icon: "🍶", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "果樹園グループ", icon: "🍐", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "福島酒造", icon: "🍶", tier: "B", price: 30000, yieldPct: 13, revenue: 3900 },
      { name: "郡山物流ターミナル", icon: "🚛", tier: "C", price: 180000, yieldPct: 10, revenue: 18000 },
      { name: "福島新幹線交通拠点開発", icon: "🚄", tier: "D", price: 2000000, yieldPct: 7, revenue: 140000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "aomori", name: "青森", icon: "🍎", region: "tohoku", size: "town", lat: 40.82, lng: 140.74,
    catch: "りんごとねぶた祭り、津軽海峡の玄関口！",
    properties: [
      { name: "りんご農園", icon: "🍎", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "ねぶた祭り屋台組合", icon: "🏮", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "ホタテ漁業組合", icon: "🐚", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "津軽塗工房", icon: "🎨", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "青函連絡港湾施設", icon: "🚢", tier: "C", price: 160000, yieldPct: 10, revenue: 16000 },
      { name: "津軽海峡物流ハブ", icon: "⚓", tier: "D", price: 1900000, yieldPct: 7, revenue: 133000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "akita", name: "秋田", icon: "🐕", region: "tohoku", size: "town", lat: 39.72, lng: 140.1,
    catch: "きりたんぽと秋田犬、日本海側の米どころ！",
    properties: [
      { name: "きりたんぽ屋", icon: "🍢", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "なまはげ民芸品店", icon: "👹", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "秋田犬グッズショップ", icon: "🐕", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "米どころ農業協同組合", icon: "🌾", tier: "B", price: 25000, yieldPct: 14, revenue: 3500 },
      { name: "秋田港木材輸出基地", icon: "🪵", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
    ],
  },
  {
    key: "yamagata", name: "山形", icon: "🍒", region: "tohoku", size: "town", lat: 38.24, lng: 140.36,
    catch: "さくらんぼと将棋の駒、蔵王温泉の町！",
    properties: [
      { name: "さくらんぼ農園", icon: "🍒", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "将棋駒工房", icon: "♟️", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "蔵王温泉旅館組合", icon: "♨️", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "米沢牛畜産組合", icon: "🐄", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "山形花笠観光開発", icon: "🎎", tier: "C", price: 130000, yieldPct: 10, revenue: 13000 },
    ],
  },

  // ================= 甲信越・北陸 =================
  {
    key: "niigata", name: "新潟", icon: "🌾", region: "koshinetsu_hokuriku", size: "hub", lat: 37.92, lng: 139.04,
    catch: "コシヒカリと日本酒、日本海の港町！",
    properties: [
      { name: "コシヒカリ農園", icon: "🌾", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "新潟酒蔵", icon: "🍶", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "新潟漁港の鮮魚卸", icon: "🐟", tier: "B", price: 35000, yieldPct: 13, revenue: 4550 },
      { name: "新潟港湾物流センター", icon: "⚓", tier: "C", price: 320000, yieldPct: 10, revenue: 32000 },
      { name: "米菓工場グループ", icon: "🍘", tier: "C", price: 400000, yieldPct: 9, revenue: 36000 },
      { name: "新潟平野農業コンビナート", icon: "🏭", tier: "D", price: 3200000, yieldPct: 7, revenue: 224000, unlock: { quiz: 3 } },
      { name: "日本海物流メガハブ", icon: "🌊", tier: "E", price: 65000000, yieldPct: 4, revenue: 2600000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "nagano", name: "長野", icon: "🍜", region: "koshinetsu_hokuriku", size: "town", lat: 36.65, lng: 138.18,
    catch: "そばと高原野菜、精密機械の街！",
    properties: [
      { name: "信州そば屋", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "りんご農園", icon: "🍎", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "高原野菜農業組合", icon: "🥬", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "精密機械部品メーカー", icon: "⚙️", tier: "B", price: 32000, yieldPct: 13, revenue: 4160 },
      { name: "五輪記念施設運営", icon: "🏟️", tier: "C", price: 170000, yieldPct: 10, revenue: 17000 },
      { name: "諏訪湖精密工業団地", icon: "🔬", tier: "D", price: 2100000, yieldPct: 7, revenue: 147000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "kofu", name: "甲府", icon: "🍇", region: "koshinetsu_hokuriku", size: "town", lat: 35.66, lng: 138.57,
    catch: "ぶどうとワイン、武田信玄の城下町！",
    properties: [
      { name: "ぶどう農園", icon: "🍇", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "甲州ワイナリー", icon: "🍷", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "宝石研磨・貴金属工房", icon: "💎", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "桃・さくらんぼ果樹園", icon: "🍒", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "ワイナリー街道観光開発", icon: "🏞️", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "富士北麓リゾート開発", icon: "🗻", tier: "D", price: 1800000, yieldPct: 7, revenue: 126000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "toyama", name: "富山", icon: "🦑", region: "koshinetsu_hokuriku", size: "town", lat: 36.7, lng: 137.21,
    catch: "配置薬とホタルイカ、黒部立山の玄関口！",
    properties: [
      { name: "配置薬の老舗", icon: "💊", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "ホタルイカ漁業組合", icon: "🦑", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "製薬工場", icon: "💊", tier: "B", price: 36000, yieldPct: 14, revenue: 5040 },
      { name: "アルミ加工工場", icon: "🔩", tier: "B", price: 30000, yieldPct: 13, revenue: 3900 },
      { name: "黒部立山観光開発", icon: "🏔️", tier: "C", price: 160000, yieldPct: 10, revenue: 16000 },
      { name: "富山湾漁業・物流コンビナート", icon: "🐟", tier: "D", price: 1900000, yieldPct: 7, revenue: 133000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "kanazawa", name: "金沢", icon: "✨", region: "koshinetsu_hokuriku", size: "hub", lat: 36.59, lng: 136.63,
    catch: "金箔と加賀友禅、伝統工芸の町！",
    properties: [
      { name: "金箔工房", icon: "✨", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "加賀友禅染色工房", icon: "🎨", tier: "B", price: 28000, yieldPct: 14, revenue: 3920 },
      { name: "金沢和菓子の老舗", icon: "🍡", tier: "B", price: 24000, yieldPct: 15, revenue: 3600 },
      { name: "兼六園周辺の老舗旅館グループ", icon: "🏮", tier: "C", price: 220000, yieldPct: 10, revenue: 22000 },
      { name: "加賀伝統工芸品輸出商社", icon: "📦", tier: "C", price: 280000, yieldPct: 9, revenue: 25200 },
      { name: "金沢伝統産業振興センター", icon: "🏛️", tier: "D", price: 2600000, yieldPct: 7, revenue: 182000, unlock: { quiz: 3 } },
      { name: "北陸新幹線ターミナル開発", icon: "🚄", tier: "E", price: 55000000, yieldPct: 4, revenue: 2200000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "fukui", name: "福井", icon: "🦖", region: "koshinetsu_hokuriku", size: "town", lat: 36.06, lng: 136.22,
    catch: "恐竜化石とめがね産業、伝統工芸の町！",
    properties: [
      { name: "恐竜グッズショップ", icon: "🦖", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "越前そば店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "めがねフレーム工場", icon: "👓", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "越前和紙工房", icon: "📜", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "福井県立恐竜博物館観光開発", icon: "🦕", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
    ],
  },

  // ================= 東海 =================
  {
    key: "shizuoka", name: "静岡", icon: "🍵", region: "tokai", size: "hub", lat: 34.98, lng: 138.38,
    catch: "お茶とわさびの名産地！",
    properties: [
      { name: "茶畑の直売所", icon: "🍵", tier: "A", price: 1100, yieldPct: 18, revenue: 198 },
      { name: "わさび漬け専門店", icon: "🌱", tier: "A", price: 1400, yieldPct: 17, revenue: 238 },
      { name: "プラモデル工房", icon: "🚗", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "焼津マグロ加工会社", icon: "🐟", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "静岡茶輸出商社", icon: "📦", tier: "C", price: 200000, yieldPct: 11, revenue: 22000 },
      { name: "富士山麓物流センター", icon: "🗻", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "静岡モビリティ産業団地", icon: "🏭", tier: "D", price: 4500000, yieldPct: 7, revenue: 315000, unlock: { quiz: 3 } },
      { name: "富士山観光グランドリゾート", icon: "🗻", tier: "E", price: 126000000, yieldPct: 4, revenue: 5040000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "hamamatsu", name: "浜松", icon: "🎵", region: "tokai", size: "hub", lat: 34.71, lng: 137.73,
    catch: "楽器とうなぎの町！",
    properties: [
      { name: "うなぎ専門店", icon: "🐍", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "浜名湖のり養殖場", icon: "🌊", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "楽器工房", icon: "🎹", tier: "B", price: 40000, yieldPct: 14, revenue: 5600 },
      { name: "オートバイ部品メーカー", icon: "🏍️", tier: "B", price: 50000, yieldPct: 13, revenue: 6500 },
      { name: "浜松楽器輸出商社", icon: "🎶", tier: "C", price: 300000, yieldPct: 10, revenue: 30000 },
      { name: "浜名湖リゾートホテル", icon: "🏨", tier: "C", price: 450000, yieldPct: 9, revenue: 40500 },
      { name: "浜松オートバイ大工場", icon: "🏍️", tier: "D", price: 5000000, yieldPct: 7, revenue: 350000, unlock: { quiz: 3 } },
      { name: "浜松産業技術メガセンター", icon: "🏭", tier: "E", price: 108000000, yieldPct: 4, revenue: 4320000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "nagoya", name: "名古屋", icon: "🏯", region: "tokai", size: "metro", lat: 35.18, lng: 136.91,
    catch: "自動車と味噌の大都市！",
    properties: [
      { name: "八丁味噌の蔵", icon: "🍶", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "ひつまぶし店", icon: "🍚", tier: "A", price: 1600, yieldPct: 16, revenue: 256 },
      { name: "有松絞りの染物工房", icon: "🎨", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "名古屋城下の陶磁器店", icon: "🏺", tier: "B", price: 35000, yieldPct: 14, revenue: 4900 },
      { name: "名古屋港輸出ターミナル", icon: "⚓", tier: "C", price: 500000, yieldPct: 10, revenue: 50000 },
      { name: "自動車部品サプライヤー団地", icon: "🔧", tier: "C", price: 900000, yieldPct: 9, revenue: 81000 },
      { name: "自動車大工場", icon: "🚗", tier: "D", price: 9800000, yieldPct: 7, revenue: 686000, unlock: { quiz: 3 } },
      { name: "中部国際空港物流ハブ", icon: "✈️", tier: "E", price: 234000000, yieldPct: 4, revenue: 9360000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "gifu", name: "岐阜", icon: "🛶", region: "tokai", size: "town", lat: 35.42, lng: 136.76,
    catch: "鵜飼いと和傘、長良川の町！",
    properties: [
      { name: "鵜飼い観光船", icon: "🛶", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "岐阜提灯工房", icon: "🏮", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "岐阜アパレル卸団地", icon: "👕", tier: "B", price: 28000, yieldPct: 14, revenue: 3920 },
      { name: "美濃和紙工房", icon: "📜", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "長良川流域観光開発", icon: "🏞️", tier: "C", price: 160000, yieldPct: 10, revenue: 16000 },
      { name: "岐阜繊維産業団地", icon: "🧵", tier: "D", price: 1900000, yieldPct: 7, revenue: 133000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "ise", name: "伊勢", icon: "⛩️", region: "tokai", size: "town", lat: 34.49, lng: 136.71,
    catch: "伊勢神宮と真珠、三重の歴史の町！",
    properties: [
      { name: "伊勢うどん店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "赤福餅の老舗", icon: "🍡", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "真珠養殖組合", icon: "📿", tier: "B", price: 28000, yieldPct: 14, revenue: 3920 },
      { name: "伊勢神宮参道土産物街", icon: "⛩️", tier: "B", price: 24000, yieldPct: 15, revenue: 3600 },
      { name: "松阪牛畜産センター", icon: "🐄", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
    ],
  },

  // ================= 近畿 =================
  {
    key: "kyoto", name: "京都", icon: "⛩️", region: "kansai", size: "metro", lat: 35.01, lng: 135.77,
    catch: "歴史あるみやこの町！",
    properties: [
      { name: "八つ橋の老舗", icon: "🍡", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "清水焼の窯元", icon: "🏺", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "宇治茶問屋", icon: "🍵", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "西陣織工房", icon: "🧵", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "京友禅染色工場", icon: "🎨", tier: "C", price: 250000, yieldPct: 10, revenue: 25000 },
      { name: "老舗旅館グループ", icon: "🏮", tier: "C", price: 450000, yieldPct: 9, revenue: 40500 },
      { name: "京都伝統工芸産業団地", icon: "🏛️", tier: "D", price: 6000000, yieldPct: 7, revenue: 420000, unlock: { quiz: 3 } },
      { name: "京都国際観光リゾート", icon: "🎎", tier: "E", price: 162000000, yieldPct: 4, revenue: 6480000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "osaka", name: "大阪", icon: "🐙", region: "kansai", size: "metro", lat: 34.69, lng: 135.5,
    catch: "食い倒れの商都、天下の台所！",
    properties: [
      { name: "たこ焼き屋", icon: "🐙", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "お好み焼き店", icon: "🥞", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "黒門市場の鮮魚店", icon: "🐟", tier: "B", price: 30000, yieldPct: 15, revenue: 4500 },
      { name: "道頓堀劇場", icon: "🎭", tier: "B", price: 50000, yieldPct: 14, revenue: 7000 },
      { name: "大阪商社ビル", icon: "🏢", tier: "C", price: 600000, yieldPct: 10, revenue: 60000 },
      { name: "大阪湾臨海コンビナート", icon: "⚗️", tier: "C", price: 1000000, yieldPct: 8, revenue: 80000 },
      { name: "大阪城下メガ再開発", icon: "🏯", tier: "D", price: 9200000, yieldPct: 7, revenue: 644000, unlock: { quiz: 3 } },
      { name: "大阪湾岸メガロジスティクス拠点", icon: "🌊", tier: "E", price: 252000000, yieldPct: 4, revenue: 10080000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "kobe", name: "神戸", icon: "🌉", region: "kansai", size: "hub", lat: 34.69, lng: 135.2,
    catch: "港とファッション、洋菓子の異人館通り！",
    properties: [
      { name: "神戸洋菓子店", icon: "🍰", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "神戸真珠加工組合", icon: "📿", tier: "B", price: 32000, yieldPct: 14, revenue: 4480 },
      { name: "神戸ファッション卸問屋", icon: "👗", tier: "B", price: 38000, yieldPct: 13, revenue: 4940 },
      { name: "神戸港コンテナターミナル", icon: "⚓", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "神戸造船所", icon: "🚢", tier: "C", price: 480000, yieldPct: 9, revenue: 43200 },
      { name: "神戸医療産業都市", icon: "🏥", tier: "D", price: 3800000, yieldPct: 7, revenue: 266000, unlock: { quiz: 3 } },
      { name: "神戸ベイエリア複合開発", icon: "🌉", tier: "E", price: 80000000, yieldPct: 4, revenue: 3200000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "nara", name: "奈良", icon: "🦌", region: "kansai", size: "town", lat: 34.69, lng: 135.83,
    catch: "鹿と大仏、古都の観光地！",
    properties: [
      { name: "鹿せんべい店", icon: "🦌", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "奈良墨の工房", icon: "🖌️", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "靴下工場", icon: "🧦", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "大仏門前の土産物街", icon: "🏯", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "奈良観光旅館グループ", icon: "🏮", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "古都文化財修復事業", icon: "🛕", tier: "D", price: 1700000, yieldPct: 7, revenue: 119000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "otsu", name: "大津", icon: "🌊", region: "kansai", size: "town", lat: 35.0, lng: 135.87,
    catch: "琵琶湖と忍者の里、滋賀の県庁所在地！",
    properties: [
      { name: "鮒ずし専門店", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "近江牛精肉店", icon: "🐄", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "琵琶湖遊覧船", icon: "🚢", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "信楽焼陶器工房", icon: "🏺", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "琵琶湖畔リゾート開発", icon: "🏖️", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
    ],
  },
  {
    key: "wakayama", name: "和歌山", icon: "🍊", region: "kansai", size: "town", lat: 34.23, lng: 135.17,
    catch: "みかんとパンダ、紀州梅の南の玄関口！",
    properties: [
      { name: "有田みかん農園", icon: "🍊", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "紀州南高梅干し工房", icon: "🍈", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "パンダ観光牧場", icon: "🐼", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "黒潮漁業組合", icon: "🎣", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "紀州漆器伝統工芸団地", icon: "🍶", tier: "C", price: 130000, yieldPct: 10, revenue: 13000 },
    ],
  },

  // ================= 中国 =================
  {
    key: "okayama", name: "岡山", icon: "🍑", region: "chugoku", size: "hub", lat: 34.66, lng: 133.93,
    catch: "白桃とマスカット、デニムの街！",
    properties: [
      { name: "白桃農園", icon: "🍑", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "マスカット農園", icon: "🍇", tier: "B", price: 28000, yieldPct: 14, revenue: 3920 },
      { name: "児島デニム工場", icon: "👖", tier: "B", price: 34000, yieldPct: 13, revenue: 4420 },
      { name: "瀬戸内海運グループ", icon: "⛴️", tier: "C", price: 220000, yieldPct: 10, revenue: 22000 },
      { name: "学生服メーカー", icon: "👔", tier: "C", price: 260000, yieldPct: 9, revenue: 23400 },
      { name: "瀬戸大橋物流拠点", icon: "🌉", tier: "D", price: 2400000, yieldPct: 7, revenue: 168000, unlock: { quiz: 3 } },
      { name: "岡山臨海コンビナート", icon: "🏭", tier: "E", price: 48000000, yieldPct: 4, revenue: 1920000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "hiroshima", name: "広島", icon: "🦪", region: "chugoku", size: "hub", lat: 34.4, lng: 132.46,
    catch: "牡蠣とお好み焼き、自動車と平和の街！",
    properties: [
      { name: "牡蠣養殖場", icon: "🦪", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "広島風お好み焼き店グループ", icon: "🥞", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "熊野筆工房", icon: "🖌️", tier: "B", price: 26000, yieldPct: 15, revenue: 3900 },
      { name: "広島自動車部品工場", icon: "🚗", tier: "C", price: 350000, yieldPct: 10, revenue: 35000 },
      { name: "広島造船所", icon: "🚢", tier: "C", price: 420000, yieldPct: 9, revenue: 37800 },
      { name: "瀬戸内自動車産業団地", icon: "🏭", tier: "D", price: 3400000, yieldPct: 7, revenue: 238000, unlock: { quiz: 3 } },
      { name: "平和記念観光開発", icon: "🕊️", tier: "E", price: 70000000, yieldPct: 4, revenue: 2800000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "tottori", name: "鳥取", icon: "🏜️", region: "chugoku", size: "town", lat: 35.5, lng: 134.24,
    catch: "砂丘となし、松葉ガニの漁港！",
    properties: [
      { name: "二十世紀梨農園", icon: "🍐", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "松葉ガニ漁業組合", icon: "🦀", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "鳥取砂丘観光開発", icon: "🏜️", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "妖怪グッズ工房", icon: "👻", tier: "B", price: 18000, yieldPct: 16, revenue: 2880 },
      { name: "山陰漁港水産加工団地", icon: "🐟", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
      { name: "鳥取砂丘メガリゾート", icon: "🏖️", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "yamaguchi", name: "山口", icon: "🐡", region: "chugoku", size: "town", lat: 34.19, lng: 131.47,
    catch: "ふぐと石油化学、関門海峡の玄関口！",
    properties: [
      { name: "ふぐ料理店", icon: "🐡", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "萩焼の窯元", icon: "🏺", tier: "A", price: 1400, yieldPct: 16, revenue: 224 },
      { name: "石油化学コンビナート関連工場", icon: "⚗️", tier: "B", price: 34000, yieldPct: 13, revenue: 4420 },
      { name: "秋吉台観光開発", icon: "⛰️", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "関門海峡物流拠点", icon: "🌉", tier: "C", price: 170000, yieldPct: 10, revenue: 17000 },
      { name: "瀬戸内石油化学メガコンビナート", icon: "🏭", tier: "D", price: 2000000, yieldPct: 7, revenue: 140000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "matsue", name: "松江", icon: "⛩️", region: "chugoku", size: "town", lat: 35.47, lng: 133.05,
    catch: "出雲大社としじみ、神々の国・島根！",
    properties: [
      { name: "出雲そば店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "しじみ漁業組合", icon: "🐚", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "出雲大社門前土産物街", icon: "⛩️", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "松江和菓子の老舗", icon: "🍡", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "宍道湖観光開発", icon: "🌅", tier: "C", price: 130000, yieldPct: 10, revenue: 13000 },
    ],
  },

  // ================= 北海道 =================
  {
    key: "sapporo", name: "札幌", icon: "❄️", region: "hokkaido", size: "metro", lat: 43.06, lng: 141.35,
    catch: "雪まつりとビール、北海道の中心都市！",
    properties: [
      { name: "味噌ラーメン店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "お土産洋菓子店", icon: "🍬", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "雪まつり観光公社", icon: "⛄", tier: "B", price: 35000, yieldPct: 14, revenue: 4900 },
      { name: "乳製品加工工場", icon: "🥛", tier: "B", price: 45000, yieldPct: 13, revenue: 5850 },
      { name: "札幌ビール工場", icon: "🍺", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "札幌ITタワー", icon: "💻", tier: "C", price: 550000, yieldPct: 9, revenue: 49500 },
      { name: "新千歳空港物流拠点", icon: "✈️", tier: "D", price: 6000000, yieldPct: 7, revenue: 420000, unlock: { quiz: 3 } },
      { name: "大通公園メガ観光複合施設", icon: "🎪", tier: "E", price: 150000000, yieldPct: 4, revenue: 6000000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "hakodate", name: "函館", icon: "🌃", region: "hokkaido", size: "town", lat: 41.77, lng: 140.73,
    catch: "夜景とイカ漁、五稜郭の港町！",
    properties: [
      { name: "イカ漁業組合", icon: "🦑", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "函館朝市の海鮮店", icon: "🐟", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "夜景観光ロープウェイ", icon: "🌃", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "五稜郭土産物街", icon: "⭐", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "函館漁港水産加工団地", icon: "🏭", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "青函連絡船記念物流拠点", icon: "🚢", tier: "D", price: 1700000, yieldPct: 7, revenue: 119000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "asahikawa", name: "旭川", icon: "🪑", region: "hokkaido", size: "town", lat: 43.77, lng: 142.37,
    catch: "家具と動物園、雪の町！",
    properties: [
      { name: "しょうゆラーメン店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "動物園グッズショップ", icon: "🐻‍❄️", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "旭川家具工房", icon: "🪑", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "雪氷冷熱利用工場", icon: "❄️", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "旭川木工産業団地", icon: "🏭", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
      { name: "大雪山観光リゾート開発", icon: "🏔️", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "kushiro", name: "釧路", icon: "🦢", region: "hokkaido", size: "town", lat: 42.98, lng: 144.38,
    catch: "漁業と湿原、酪農の町！",
    properties: [
      { name: "毛ガニ漁業組合", icon: "🦀", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "釧路湿原観光船", icon: "🛶", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "酪農牧場グループ", icon: "🐄", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "サンマ加工工場", icon: "🐟", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "釧路漁港水産コンビナート", icon: "🏭", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "釧路湿原メガリゾート", icon: "🦢", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  // ================= 四国 =================
  {
    key: "takamatsu", name: "高松", icon: "🍜", region: "shikoku", size: "hub", lat: 34.34, lng: 134.05,
    catch: "うどんと瀬戸内海、四国の玄関口！",
    properties: [
      { name: "讃岐うどん店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "盆栽輸出組合", icon: "🌳", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "高松港フェリーターミナル", icon: "⛴️", tier: "B", price: 35000, yieldPct: 13, revenue: 4550 },
      { name: "瀬戸内オリーブ農園グループ", icon: "🫒", tier: "C", price: 200000, yieldPct: 11, revenue: 22000 },
      { name: "高松港湾物流センター", icon: "🚚", tier: "C", price: 300000, yieldPct: 10, revenue: 30000 },
      { name: "瀬戸大橋物流ハブ", icon: "🌉", tier: "D", price: 3000000, yieldPct: 7, revenue: 210000, unlock: { quiz: 3 } },
      { name: "瀬戸内海リゾート開発", icon: "🏝️", tier: "E", price: 60000000, yieldPct: 4, revenue: 2400000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "matsuyama", name: "松山", icon: "♨️", region: "shikoku", size: "hub", lat: 33.84, lng: 132.77,
    catch: "みかんと道後温泉、四国最大の城下町！",
    properties: [
      { name: "みかん農園", icon: "🍊", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "道後温泉旅館組合", icon: "♨️", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "今治タオル工房", icon: "🧺", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "みかんジュース加工工場", icon: "🍊", tier: "C", price: 180000, yieldPct: 11, revenue: 19800 },
      { name: "松山城下観光開発", icon: "🏯", tier: "C", price: 250000, yieldPct: 10, revenue: 25000 },
      { name: "瀬戸内造船産業団地", icon: "🚢", tier: "D", price: 2600000, yieldPct: 7, revenue: 182000, unlock: { quiz: 3 } },
      { name: "道後温泉メガリゾート", icon: "♨️", tier: "E", price: 55000000, yieldPct: 4, revenue: 2200000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "kochi", name: "高知", icon: "🐟", region: "shikoku", size: "town", lat: 33.56, lng: 133.53,
    catch: "カツオと坂本龍馬、太平洋の町！",
    properties: [
      { name: "カツオのたたき専門店", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "ユズ農園", icon: "🍋", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "高知漁港漁業組合", icon: "🎣", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "土佐林業組合", icon: "🌲", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "桂浜観光開発", icon: "🌊", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
      { name: "高知県産業振興センター", icon: "🏭", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "tokushima", name: "徳島", icon: "💃", region: "shikoku", size: "town", lat: 34.07, lng: 134.56,
    catch: "阿波おどりとすだち、渦潮の町！",
    properties: [
      { name: "すだち農園", icon: "🍈", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "阿波おどり観光組合", icon: "💃", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "藍染工房", icon: "🎨", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "LED関連工場", icon: "💡", tier: "B", price: 30000, yieldPct: 13, revenue: 3900 },
      { name: "鳴門海峡観光開発", icon: "🌀", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "徳島LED産業団地", icon: "🏭", tier: "D", price: 1700000, yieldPct: 7, revenue: 119000, unlock: { quiz: 3 } },
    ],
  },
  // ================= 九州 =================
  {
    key: "fukuoka", name: "福岡", icon: "🍜", region: "kyushu", size: "metro", lat: 33.59, lng: 130.4,
    catch: "とんこつラーメンと明太子、九州最大の商都！",
    properties: [
      { name: "とんこつラーメン店", icon: "🍜", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "明太子専門店", icon: "🌶️", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "中洲屋台グループ", icon: "🏮", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "博多織工房", icon: "🧵", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "福岡ITベンチャー団地", icon: "💻", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "博多港コンテナターミナル", icon: "⚓", tier: "C", price: 550000, yieldPct: 9, revenue: 49500 },
      { name: "福岡空港物流ハブ", icon: "✈️", tier: "D", price: 6500000, yieldPct: 7, revenue: 455000, unlock: { quiz: 3 } },
      { name: "博多メガシティ開発", icon: "🏙️", tier: "E", price: 160000000, yieldPct: 4, revenue: 6400000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "kitakyushu", name: "北九州", icon: "🏭", region: "kyushu", size: "hub", lat: 33.88, lng: 130.88,
    catch: "製鉄と関門海峡、工業の町！",
    properties: [
      { name: "門司港レトロ土産店", icon: "🏮", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "製鉄関連工場", icon: "🏭", tier: "B", price: 32000, yieldPct: 14, revenue: 4480 },
      { name: "若松エコタウン事業", icon: "♻️", tier: "B", price: 28000, yieldPct: 15, revenue: 4200 },
      { name: "北九州工業地帯コンビナート", icon: "⚗️", tier: "C", price: 350000, yieldPct: 10, revenue: 35000 },
      { name: "関門海峡物流拠点", icon: "🌉", tier: "C", price: 280000, yieldPct: 10, revenue: 28000 },
      { name: "北九州製鉄メガ工場", icon: "🏭", tier: "D", price: 3500000, yieldPct: 7, revenue: 245000, unlock: { quiz: 3 } },
      { name: "北九州臨海メガ産業団地", icon: "🏭", tier: "E", price: 65000000, yieldPct: 4, revenue: 2600000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "kumamoto", name: "熊本", icon: "🐴", region: "kyushu", size: "hub", lat: 32.79, lng: 130.74,
    catch: "馬肉と半導体、阿蘇の城下町！",
    properties: [
      { name: "馬肉料理店", icon: "🐴", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "半導体部品工場", icon: "💾", tier: "B", price: 34000, yieldPct: 14, revenue: 4760 },
      { name: "阿蘇観光牧場", icon: "🐄", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "熊本城下観光開発", icon: "🏯", tier: "C", price: 220000, yieldPct: 10, revenue: 22000 },
      { name: "熊本半導体産業団地", icon: "💾", tier: "C", price: 300000, yieldPct: 9, revenue: 27000 },
      { name: "阿蘇メガリゾート開発", icon: "🌋", tier: "D", price: 2800000, yieldPct: 7, revenue: 196000, unlock: { quiz: 3 } },
      { name: "熊本半導体メガファブ", icon: "💻", tier: "E", price: 58000000, yieldPct: 4, revenue: 2320000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "nagasaki", name: "長崎", icon: "🍰", region: "kyushu", size: "town", lat: 32.75, lng: 129.87,
    catch: "カステラと造船、異国情緒の港町！",
    properties: [
      { name: "カステラ専門店", icon: "🍰", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "ちゃんぽん店", icon: "🍜", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "長崎造船所関連工場", icon: "🚢", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "五島漁業組合", icon: "🐟", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "異国情緒観光開発", icon: "⛪", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "長崎造船産業団地", icon: "🚢", tier: "D", price: 1800000, yieldPct: 7, revenue: 126000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "oita", name: "大分", icon: "♨️", region: "kyushu", size: "town", lat: 33.24, lng: 131.61,
    catch: "別府温泉とかぼす、一村一品の町！",
    properties: [
      { name: "かぼす農園", icon: "🍋", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "別府温泉旅館", icon: "♨️", tier: "A", price: 1400, yieldPct: 16, revenue: 224 },
      { name: "一村一品産業組合", icon: "🏘️", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "関アジ関サバ漁業組合", icon: "🐟", tier: "B", price: 24000, yieldPct: 14, revenue: 3360 },
      { name: "別府温泉観光開発", icon: "♨️", tier: "C", price: 150000, yieldPct: 10, revenue: 15000 },
      { name: "大分臨海工業団地", icon: "🏭", tier: "D", price: 1700000, yieldPct: 7, revenue: 119000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "miyazaki", name: "宮崎", icon: "🥭", region: "kyushu", size: "town", lat: 31.91, lng: 131.42,
    catch: "マンゴーと肉牛、南国リゾートの町！",
    properties: [
      { name: "マンゴー農園", icon: "🥭", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "宮崎牛牧場", icon: "🐄", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "南国フルーツ加工工場", icon: "🍍", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "神話観光開発", icon: "⛩️", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "宮崎リゾート開発", icon: "🏖️", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
      { name: "宮崎農業メガコンビナート", icon: "🌾", tier: "D", price: 1600000, yieldPct: 7, revenue: 112000, unlock: { quiz: 3 } },
    ],
  },
  {
    key: "kagoshima", name: "鹿児島", icon: "🌋", region: "kyushu", size: "hub", lat: 31.6, lng: 130.56,
    catch: "桜島と黒豚、焼酎の町！",
    properties: [
      { name: "黒豚料理店", icon: "🐷", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "焼酎蔵元", icon: "🍶", tier: "B", price: 28000, yieldPct: 14, revenue: 3920 },
      { name: "さつまいも農園グループ", icon: "🍠", tier: "B", price: 24000, yieldPct: 15, revenue: 3600 },
      { name: "桜島観光開発", icon: "🌋", tier: "C", price: 200000, yieldPct: 10, revenue: 20000 },
      { name: "鹿児島港フェリーターミナル", icon: "⛴️", tier: "C", price: 260000, yieldPct: 9, revenue: 23400 },
      { name: "鹿児島畜産メガコンビナート", icon: "🐷", tier: "D", price: 2600000, yieldPct: 7, revenue: 182000, unlock: { quiz: 3 } },
      { name: "桜島・霧島メガリゾート", icon: "🌋", tier: "E", price: 52000000, yieldPct: 4, revenue: 2080000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
  {
    key: "saga", name: "佐賀", icon: "🏺", region: "kyushu", size: "town", lat: 33.25, lng: 130.3,
    catch: "有田焼と吉野ヶ里遺跡、九州の焼き物どころ！",
    properties: [
      { name: "佐賀牛焼肉店", icon: "🥩", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "吉野ヶ里遺跡土産物店", icon: "🏺", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "有田焼窯元組合", icon: "🏺", tier: "B", price: 26000, yieldPct: 14, revenue: 3640 },
      { name: "佐賀海苔養殖組合", icon: "🌊", tier: "B", price: 22000, yieldPct: 15, revenue: 3300 },
      { name: "有田焼伝統産業団地", icon: "🏛️", tier: "C", price: 140000, yieldPct: 10, revenue: 14000 },
    ],
  },
  // ================= 沖縄 =================
  {
    key: "naha", name: "那覇", icon: "🌺", region: "okinawa", size: "hub", lat: 26.21, lng: 127.68,
    catch: "南国リゾートと琉球文化の島！",
    properties: [
      { name: "シーサー工房", icon: "🦁", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "泡盛蔵元", icon: "🍶", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "サトウキビ農園グループ", icon: "🎋", tier: "B", price: 24000, yieldPct: 15, revenue: 3600 },
      { name: "国際通り土産物街", icon: "🌺", tier: "C", price: 220000, yieldPct: 10, revenue: 22000 },
      { name: "那覇港クルーズターミナル", icon: "🚢", tier: "C", price: 280000, yieldPct: 9, revenue: 25200 },
      { name: "沖縄リゾートホテル開発", icon: "🏖️", tier: "D", price: 3000000, yieldPct: 7, revenue: 210000, unlock: { quiz: 3 } },
      { name: "沖縄メガリゾートアイランド開発", icon: "🏝️", tier: "E", price: 62000000, yieldPct: 4, revenue: 2480000, unlock: { quiz: 10, ownRatio: 0.7 } },
    ],
  },
];

// 都市の緯度経度からゲーム盤面座標(coord)を確定する（すべての都市で共通の投影を使う）。
CITIES.forEach((c) => {
  c.coord = projectLatLng(c.lat, c.lng);
});

// ============================================================
// 都市間の接続網（Map / Route Network v2）
// 現実の主要交通回廊を基準にゼロから監査・再構築した。全都市 degree>=2（行き止まりなし）、
// 各地方に複数ルート・周回ルートを持たせている。name/岐阜⇔京都のような「中間都市を飛ばす」
// 直結は作らず、実際に経由する都市を通す（名古屋→京都は 岐阜→大津 を経由する）。
// type: "road"(通常の幹線)/"tunnel"(海底トンネル)/"bridge"(橋)/"strait"(海峡・橋+トンネル)/
//       "sea"(海路・フェリー)/"air"(空路)
// steps: 実距離をもとに正規化した都市間マス数（短距離2〜3・中距離4〜6・長距離7〜10が目安）。
// ============================================================
const CONNECTIONS = [
  // ---- 北海道（周回あり：札幌-旭川-釧路-札幌） ----
  { from: "sapporo", to: "hakodate", type: "road", steps: 5 },
  { from: "sapporo", to: "asahikawa", type: "road", steps: 4 },
  { from: "sapporo", to: "kushiro", type: "road", steps: 8 },
  { from: "asahikawa", to: "kushiro", type: "road", steps: 6 },
  { from: "aomori", to: "hakodate", type: "tunnel", steps: 4 },

  // ---- 東北（内陸・太平洋側・日本海側の複数ルート） ----
  { from: "aomori", to: "morioka", type: "road", steps: 5 },
  { from: "aomori", to: "akita", type: "road", steps: 5 },
  { from: "morioka", to: "akita", type: "road", steps: 3 },
  { from: "morioka", to: "sendai", type: "road", steps: 5 },
  { from: "akita", to: "yamagata", type: "road", steps: 6 },
  { from: "sendai", to: "yamagata", type: "road", steps: 2 },
  { from: "sendai", to: "fukushima", type: "road", steps: 3 },
  { from: "yamagata", to: "fukushima", type: "road", steps: 2 },
  { from: "yamagata", to: "niigata", type: "road", steps: 4 },
  { from: "fukushima", to: "niigata", type: "road", steps: 4 },
  { from: "fukushima", to: "utsunomiya", type: "road", steps: 5 },

  // ---- 関東（東京一極の放射状だけにせず、北関東の横方向ルートを持たせる） ----
  { from: "tokyo", to: "yokohama", type: "road", steps: 2 },
  { from: "tokyo", to: "saitama", type: "road", steps: 2 },
  { from: "tokyo", to: "chiba", type: "road", steps: 2 },
  { from: "tokyo", to: "mito", type: "road", steps: 3 },
  { from: "tokyo", to: "kofu", type: "road", steps: 4 },
  { from: "yokohama", to: "odawara", type: "road", steps: 2 },
  { from: "chiba", to: "saitama", type: "road", steps: 2 },
  { from: "chiba", to: "mito", type: "road", steps: 3 },
  { from: "saitama", to: "utsunomiya", type: "road", steps: 3 },
  { from: "saitama", to: "takasaki", type: "road", steps: 3 },
  { from: "utsunomiya", to: "takasaki", type: "road", steps: 3 },
  { from: "utsunomiya", to: "mito", type: "road", steps: 2 },
  { from: "takasaki", to: "nagano", type: "road", steps: 3 },
  { from: "takasaki", to: "niigata", type: "road", steps: 6 },

  // ---- 甲信越・北陸（新潟・長野・富山の内陸ネットワーク） ----
  { from: "niigata", to: "nagano", type: "road", steps: 5 },
  { from: "niigata", to: "toyama", type: "road", steps: 7 },
  { from: "nagano", to: "toyama", type: "road", steps: 3 },
  { from: "nagano", to: "kofu", type: "road", steps: 4 },
  { from: "kofu", to: "shizuoka", type: "road", steps: 3 },
  { from: "toyama", to: "kanazawa", type: "road", steps: 2 },
  { from: "toyama", to: "gifu", type: "road", steps: 5 },
  { from: "kanazawa", to: "fukui", type: "road", steps: 3 },
  { from: "fukui", to: "otsu", type: "road", steps: 4 },

  // ---- 東海（岐阜を行き止まりにしない。名古屋→京都は岐阜・大津経由） ----
  { from: "odawara", to: "shizuoka", type: "road", steps: 3 },
  { from: "shizuoka", to: "hamamatsu", type: "road", steps: 3 },
  { from: "hamamatsu", to: "nagoya", type: "road", steps: 3 },
  { from: "nagoya", to: "gifu", type: "road", steps: 2 },
  { from: "nagoya", to: "ise", type: "road", steps: 3 },
  { from: "gifu", to: "otsu", type: "road", steps: 3 },
  { from: "ise", to: "nara", type: "road", steps: 3 },

  // ---- 近畿（密度高め・周回あり） ----
  { from: "otsu", to: "kyoto", type: "road", steps: 2 },
  { from: "otsu", to: "nara", type: "road", steps: 2 },
  { from: "kyoto", to: "osaka", type: "road", steps: 2 },
  { from: "kyoto", to: "nara", type: "road", steps: 2 },
  { from: "osaka", to: "kobe", type: "road", steps: 2 },
  { from: "osaka", to: "nara", type: "road", steps: 2 },
  { from: "osaka", to: "wakayama", type: "road", steps: 2 },
  { from: "nara", to: "wakayama", type: "road", steps: 3 },

  // ---- 中国（山陽側・山陰側どちらにもルート、周回あり） ----
  { from: "kobe", to: "okayama", type: "road", steps: 4 },
  { from: "kobe", to: "tottori", type: "road", steps: 4 },
  { from: "okayama", to: "tottori", type: "road", steps: 3 },
  { from: "okayama", to: "hiroshima", type: "road", steps: 5 },
  { from: "tottori", to: "matsue", type: "road", steps: 4 },
  { from: "matsue", to: "hiroshima", type: "road", steps: 4 },
  { from: "matsue", to: "yamaguchi", type: "road", steps: 7 },
  { from: "hiroshima", to: "yamaguchi", type: "road", steps: 3 },

  // ---- 四国（高松・徳島・松山・高知の周回） ----
  { from: "takamatsu", to: "tokushima", type: "road", steps: 2 },
  { from: "takamatsu", to: "matsuyama", type: "road", steps: 5 },
  { from: "takamatsu", to: "kochi", type: "road", steps: 3 },
  { from: "tokushima", to: "kochi", type: "road", steps: 4 },
  { from: "kochi", to: "matsuyama", type: "road", steps: 3 },

  // ---- 九州（北九州・西九州・東九州・南九州を複数経路で） ----
  { from: "fukuoka", to: "kitakyushu", type: "road", steps: 2 },
  { from: "fukuoka", to: "saga", type: "road", steps: 2 },
  { from: "fukuoka", to: "kumamoto", type: "road", steps: 3 },
  { from: "kitakyushu", to: "oita", type: "road", steps: 3 },
  { from: "saga", to: "nagasaki", type: "road", steps: 3 },
  { from: "saga", to: "kumamoto", type: "road", steps: 3 },
  { from: "nagasaki", to: "kumamoto", type: "road", steps: 3 },
  { from: "kumamoto", to: "oita", type: "road", steps: 3 },
  { from: "kumamoto", to: "kagoshima", type: "road", steps: 5 },
  { from: "oita", to: "miyazaki", type: "road", steps: 5 },
  { from: "miyazaki", to: "kagoshima", type: "road", steps: 3 },

  // ---- 海路・橋・海峡・空路（通常の道と描き分ける特別区間） ----
  { from: "okayama", to: "takamatsu", type: "bridge", steps: 2 }, // 瀬戸大橋
  { from: "kobe", to: "tokushima", type: "bridge", steps: 4 }, // 明石海峡大橋・大鳴門橋（淡路島経由）
  { from: "yamaguchi", to: "kitakyushu", type: "strait", steps: 3 }, // 関門海峡
  { from: "hiroshima", to: "matsuyama", type: "sea", steps: 3 }, // 瀬戸内海フェリー
  { from: "wakayama", to: "tokushima", type: "sea", steps: 2 }, // 南海フェリー
  { from: "kagoshima", to: "naha", type: "sea", steps: 10 }, // 鹿児島⇔那覇フェリー（長距離）
  { from: "fukuoka", to: "naha", type: "air", steps: 3 }, // 那覇への空路
];

// ゲームエンジンは「1路線=2都市間の1区間」というLINES形式で移動を扱うため、
// CONNECTIONSから自動生成する（経路データを二重管理しないため）。
const CONNECTION_MODE = { road: "rail", tunnel: "rail", bridge: ["rail", "highway"], strait: ["rail", "highway"], sea: "ferry", air: "flight" };
const CONNECTION_SPECIAL = { tunnel: "tunnel", bridge: "bridge", strait: "strait", sea: "sea", air: "flight" };
const CONNECTION_DENSITY = { road: 0, tunnel: 3, bridge: 3, strait: 3, sea: 3, air: 3 };
function cityNameOf(key) {
  const c = CITIES.find((x) => x.key === key);
  return c ? c.name : key;
}
const LINES = CONNECTIONS.map((c) => ({
  key: `${c.from}_${c.to}`,
  name: `${cityNameOf(c.from)}―${cityNameOf(c.to)}`,
  mode: CONNECTION_MODE[c.type] || "rail",
  density: CONNECTION_DENSITY[c.type] != null ? CONNECTION_DENSITY[c.type] : 0,
  special: CONNECTION_SPECIAL[c.type],
  steps: c.steps,
  cities: [c.from, c.to],
}));

// ============================================================
// 起動時の自動バリデーション（開発用）。ネットワークが壊れていたらすぐ分かるようにする。
// ============================================================
function validateCityNetwork() {
  const errors = [];
  if (CITIES.length !== 53) errors.push(`都市数が53ではありません: ${CITIES.length}`);

  const degree = new Map(CITIES.map((c) => [c.key, 0]));
  const seenPairs = new Set();
  CONNECTIONS.forEach((c) => {
    if (c.from === c.to) errors.push(`自己接続があります: ${c.from}`);
    const pairKey = [c.from, c.to].sort().join("-");
    if (seenPairs.has(pairKey)) errors.push(`接続が重複しています: ${c.from}-${c.to}`);
    seenPairs.add(pairKey);
    if (!degree.has(c.from)) errors.push(`未知の都市キーです: ${c.from}`);
    if (!degree.has(c.to)) errors.push(`未知の都市キーです: ${c.to}`);
    degree.set(c.from, (degree.get(c.from) || 0) + 1);
    degree.set(c.to, (degree.get(c.to) || 0) + 1);
  });

  const isolated = [];
  const deadEnd = [];
  degree.forEach((d, key) => {
    if (d === 0) isolated.push(key);
    else if (d === 1) deadEnd.push(key);
  });
  if (isolated.length) errors.push(`孤立した都市があります: ${isolated.join(", ")}`);
  if (deadEnd.length) errors.push(`行き止まりの都市があります(degree=1): ${deadEnd.join(", ")}`);

  // 連結性チェック（BFS）
  const adj = new Map(CITIES.map((c) => [c.key, []]));
  CONNECTIONS.forEach((c) => {
    if (adj.has(c.from)) adj.get(c.from).push(c.to);
    if (adj.has(c.to)) adj.get(c.to).push(c.from);
  });
  const visited = new Set();
  const queue = [CITIES[0].key];
  visited.add(CITIES[0].key);
  while (queue.length) {
    const cur = queue.shift();
    (adj.get(cur) || []).forEach((n) => {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    });
  }
  const unreachable = CITIES.map((c) => c.key).filter((k) => !visited.has(k));
  if (unreachable.length) errors.push(`メインのネットワークから孤立した都市があります: ${unreachable.join(", ")}`);

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error("[都市ネットワーク検証エラー]\n" + errors.join("\n"));
  } else if (typeof console !== "undefined" && console.info) {
    console.info(`[都市ネットワーク検証] OK: 53都市 / ${CONNECTIONS.length}接続 / 孤立なし / 行き止まりなし / 連結`);
  }
  return { errors, degree };
}
if (typeof window !== "undefined") {
  validateCityNetwork();
}
