/* ============================================================
   トリリオネアを目指せ！ - 都市・路線データ（全国編）
   ここに都市を追加すれば、ロジック側の変更なしでゲームに反映される。

   tier: A=1000万〜9000万 / B=1億〜10億 / C=10億〜100億 /
         D=100億〜1000億 / E=1000億超（ランドマーク級）
   unlock: { quiz: n } でその都市のクイズに累計n問正解すると購入可能。
            { quiz: n, ownRatio: r } はさらに「ランドマーク以外の物件をr以上所有」も必要
            （E=ランドマークは複数条件をあわせ持つ長期目標にしている）
   size: "metro"(大都市)/"hub"(地方拠点都市)/"town"(地方都市)
         ※表示・演出の参考情報。ゲームロジックの必須項目ではない。
   ============================================================ */

// 地方データ。全都市を完全制覇すると「地方完全制覇」になる。
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

// 路線データ（双方向・自由移動、一度通った都市にも何度でも戻れる）。
// 同じ都市キーが複数の路線に含まれると、その都市が分岐点（ジャンクション）になる。
// mode: "rail"(鉄道) / "highway"(高速道路) / 配列で両方 / "flight"(空路・沖縄のみの例外)
// density: 都市間で「道中イベント」が起きやすいかどうかの目安（0=幹線で少ない…3=特別区間で多い）
// special: true の区間は海峡・橋・トンネルなど特別な道中イベント演出を使う
// 将来、都市・路線を追加する場合はこの配列に新しい路線オブジェクトを足すだけでよい。
const LINES = [
  { key: "tokaido", name: "東海道ライン", mode: "rail", density: 0, cities: ["tokyo", "yokohama", "odawara", "shizuoka", "hamamatsu", "nagoya"] },
  { key: "tohoku_shinkansen", name: "東北ライン", mode: "rail", density: 0, cities: ["tokyo", "utsunomiya", "fukushima", "sendai", "morioka", "aomori"] },
  { key: "joetsu", name: "上越ライン", mode: "rail", density: 1, cities: ["tokyo", "saitama", "takasaki", "niigata"] },
  { key: "chuo", name: "中央ライン", mode: "rail", density: 2, cities: ["tokyo", "kofu", "nagano"] },
  { key: "hokuriku", name: "北陸ライン", mode: "rail", density: 1, cities: ["nagano", "toyama", "kanazawa", "kyoto"] },
  { key: "tokai_branch", name: "東海支線", mode: "rail", density: 1, cities: ["nagoya", "gifu"] },
  { key: "kinki", name: "近畿ライン", mode: "rail", density: 0, cities: ["nagoya", "kyoto", "osaka", "kobe"] },
  { key: "kinki_branch", name: "近畿支線", mode: "rail", density: 1, cities: ["osaka", "nara"] },
  { key: "sanyo", name: "山陽ライン", mode: "rail", density: 0, cities: ["osaka", "okayama", "hiroshima", "yamaguchi"] },
  { key: "sanin_branch", name: "山陰支線", mode: "rail", density: 2, cities: ["okayama", "tottori"] },
  { key: "chiba_branch", name: "総武支線", mode: "rail", density: 1, cities: ["tokyo", "chiba"] },

  { key: "hokkaido_main", name: "北海道本線", mode: "rail", density: 2, cities: ["hakodate", "sapporo", "asahikawa"] },
  { key: "hokkaido_east", name: "道東ライン", mode: "rail", density: 2, cities: ["sapporo", "kushiro"] },
  { key: "seikan", name: "青函トンネル", mode: "rail", density: 3, special: "tunnel", cities: ["aomori", "hakodate"] },

  { key: "shikoku_tokushima", name: "高徳ライン", mode: "rail", density: 1, cities: ["takamatsu", "tokushima"] },
  { key: "shikoku_matsuyama", name: "予讃ライン", mode: "rail", density: 2, cities: ["takamatsu", "matsuyama"] },
  { key: "shikoku_kochi", name: "土讃ライン", mode: "rail", density: 2, cities: ["takamatsu", "kochi"] },
  { key: "seto_bridge", name: "瀬戸大橋", mode: ["rail", "highway"], density: 3, special: "bridge", cities: ["okayama", "takamatsu"] },

  { key: "kyushu_shinkansen", name: "九州新幹線", mode: "rail", density: 0, cities: ["fukuoka", "kumamoto", "kagoshima"] },
  { key: "kyushu_kitakyushu", name: "鹿児島本線", mode: "rail", density: 1, cities: ["fukuoka", "kitakyushu"] },
  { key: "kyushu_nagasaki", name: "長崎ライン", mode: "rail", density: 1, cities: ["fukuoka", "nagasaki"] },
  { key: "kyushu_oita", name: "日豊ライン北", mode: "rail", density: 1, cities: ["fukuoka", "oita"] },
  { key: "kyushu_east", name: "日豊ライン南", mode: "rail", density: 2, cities: ["oita", "miyazaki", "kagoshima"] },
  { key: "kanmon", name: "関門海峡", mode: ["rail", "highway"], density: 3, special: "strait", cities: ["kitakyushu", "yamaguchi"] },

  { key: "okinawa_flight", name: "沖縄航空路", mode: "flight", density: 3, special: "flight", cities: ["kagoshima", "naha"] },
];

const CITIES = [
  // ================= 関東 =================
  {
    key: "tokyo", name: "東京", icon: "🗼", region: "kanto", size: "metro",
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
    key: "yokohama", name: "横浜", icon: "⚓", region: "kanto", size: "metro",
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
    key: "odawara", name: "小田原", icon: "🏯", region: "kanto", size: "town",
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
    key: "chiba", name: "千葉", icon: "🥜", region: "kanto", size: "town",
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
    key: "saitama", name: "さいたま", icon: "🚃", region: "kanto", size: "town",
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
    key: "utsunomiya", name: "宇都宮", icon: "🥟", region: "kanto", size: "town",
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
    key: "takasaki", name: "高崎", icon: "🪅", region: "kanto", size: "town",
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

  // ================= 東北 =================
  {
    key: "sendai", name: "仙台", icon: "🌲", region: "tohoku", size: "hub",
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
    key: "morioka", name: "盛岡", icon: "🍜", region: "tohoku", size: "town",
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
    key: "fukushima", name: "福島", icon: "🍑", region: "tohoku", size: "town",
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
    key: "aomori", name: "青森", icon: "🍎", region: "tohoku", size: "town",
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

  // ================= 甲信越・北陸 =================
  {
    key: "niigata", name: "新潟", icon: "🌾", region: "koshinetsu_hokuriku", size: "hub",
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
    key: "nagano", name: "長野", icon: "🍜", region: "koshinetsu_hokuriku", size: "town",
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
    key: "kofu", name: "甲府", icon: "🍇", region: "koshinetsu_hokuriku", size: "town",
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
    key: "toyama", name: "富山", icon: "🦑", region: "koshinetsu_hokuriku", size: "town",
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
    key: "kanazawa", name: "金沢", icon: "✨", region: "koshinetsu_hokuriku", size: "hub",
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

  // ================= 東海 =================
  {
    key: "shizuoka", name: "静岡", icon: "🍵", region: "tokai", size: "hub",
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
    key: "hamamatsu", name: "浜松", icon: "🎵", region: "tokai", size: "hub",
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
    key: "nagoya", name: "名古屋", icon: "🏯", region: "tokai", size: "metro",
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
    key: "gifu", name: "岐阜", icon: "🛶", region: "tokai", size: "town",
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

  // ================= 近畿 =================
  {
    key: "kyoto", name: "京都", icon: "⛩️", region: "kansai", size: "metro",
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
    key: "osaka", name: "大阪", icon: "🐙", region: "kansai", size: "metro",
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
    key: "kobe", name: "神戸", icon: "🌉", region: "kansai", size: "hub",
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
    key: "nara", name: "奈良", icon: "🦌", region: "kansai", size: "town",
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

  // ================= 中国 =================
  {
    key: "okayama", name: "岡山", icon: "🍑", region: "chugoku", size: "hub",
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
    key: "hiroshima", name: "広島", icon: "🦪", region: "chugoku", size: "hub",
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
    key: "tottori", name: "鳥取", icon: "🏜️", region: "chugoku", size: "town",
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
    key: "yamaguchi", name: "山口", icon: "🐡", region: "chugoku", size: "town",
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

  // ================= 北海道 =================
  {
    key: "sapporo", name: "札幌", icon: "❄️", region: "hokkaido", size: "metro",
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
    key: "hakodate", name: "函館", icon: "🌃", region: "hokkaido", size: "town",
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
    key: "asahikawa", name: "旭川", icon: "🪑", region: "hokkaido", size: "town",
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
    key: "kushiro", name: "釧路", icon: "🦢", region: "hokkaido", size: "town",
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
    key: "takamatsu", name: "高松", icon: "🍜", region: "shikoku", size: "hub",
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
    key: "matsuyama", name: "松山", icon: "♨️", region: "shikoku", size: "hub",
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
    key: "kochi", name: "高知", icon: "🐟", region: "shikoku", size: "town",
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
    key: "tokushima", name: "徳島", icon: "💃", region: "shikoku", size: "town",
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
    key: "fukuoka", name: "福岡", icon: "🍜", region: "kyushu", size: "metro",
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
    key: "kitakyushu", name: "北九州", icon: "🏭", region: "kyushu", size: "hub",
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
    key: "kumamoto", name: "熊本", icon: "🐴", region: "kyushu", size: "hub",
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
    key: "nagasaki", name: "長崎", icon: "🍰", region: "kyushu", size: "town",
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
    key: "oita", name: "大分", icon: "♨️", region: "kyushu", size: "town",
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
    key: "miyazaki", name: "宮崎", icon: "🥭", region: "kyushu", size: "town",
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
    key: "kagoshima", name: "鹿児島", icon: "🌋", region: "kyushu", size: "hub",
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
  // ================= 沖縄 =================
  {
    key: "naha", name: "那覇", icon: "🌺", region: "okinawa", size: "hub",
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
