/* ============================================================
   トリリオネアを目指せ！ - ゲームデータ
   都市・路線・物件・クイズのデータ定義。
   ここに都市やクイズを追加すれば、ロジック側の変更なしで
   ゲームに反映される（拡張しやすさを優先した構造）。
   ============================================================ */

// 路線データ（双方向・自由移動）。
// 将来「東北」「九州」「北海道」などの路線を追加する場合は、
// この配列に新しい路線オブジェクトを足すだけでよい。
// 複数の路線に同じ都市キーを含めれば、その都市が分岐点になる。
const LINES = [
  {
    key: "tokaido",
    name: "東海道ライン",
    cities: ["tokyo", "yokohama", "odawara", "shizuoka", "hamamatsu", "nagoya", "kyoto", "osaka"],
  },
];

// 都市データ。properties は都市ごとに8件、価格帯の異なる5段階（tier）を混在させている。
// tier: A=1000万〜9000万 / B=1億〜10億 / C=10億〜100億 / D=100億〜1000億 / E=1000億超
// unlock: その都市でクイズに累計n問正解すると購入可能になる（未設定なら常に購入可）
const CITIES = [
  {
    key: "tokyo", name: "東京", icon: "🗼", region: "kanto",
    catch: "日本の首都、大都会！",
    properties: [
      { name: "下町のたい焼き屋", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "神田神保町の古本屋", icon: "📚", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "秋葉原の電気街ショップ", icon: "🔌", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "築地の海鮮卸問屋", icon: "🍣", tier: "B", price: 50000, yieldPct: 13, revenue: 6500 },
      { name: "六本木ITオフィスタワー", icon: "💻", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "東京ベイ物流センター", icon: "🚚", tier: "C", price: 700000, yieldPct: 9, revenue: 63000 },
      { name: "大手町金融タワー", icon: "🏦", tier: "D", price: 9500000, yieldPct: 7, revenue: 665000, unlock: 3 },
      { name: "東京スカイツリー観光複合施設", icon: "🗼", tier: "E", price: 288000000, yieldPct: 4, revenue: 11520000, unlock: 5 },
    ],
  },
  {
    key: "yokohama", name: "横浜", icon: "⚓", region: "kanto",
    catch: "港とみなとみらいの街！",
    properties: [
      { name: "中華街の点心店", icon: "🥟", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "元町の洋菓子店", icon: "🍰", tier: "A", price: 1600, yieldPct: 16, revenue: 256 },
      { name: "赤レンガ倉庫の土産卸", icon: "🧱", tier: "B", price: 25000, yieldPct: 14, revenue: 3500 },
      { name: "中華街レストラン組合", icon: "🍜", tier: "B", price: 40000, yieldPct: 13, revenue: 5200 },
      { name: "横浜港コンテナターミナル", icon: "🚢", tier: "C", price: 350000, yieldPct: 10, revenue: 35000 },
      { name: "みなとみらいオフィスビル", icon: "🏢", tier: "C", price: 550000, yieldPct: 9, revenue: 49500 },
      { name: "横浜造船ドック", icon: "🛠️", tier: "D", price: 7000000, yieldPct: 7, revenue: 490000, unlock: 3 },
      { name: "横浜ベイブリッジ物流ハブ", icon: "🌉", tier: "E", price: 180000000, yieldPct: 4, revenue: 7200000, unlock: 5 },
    ],
  },
  {
    key: "odawara", name: "小田原", icon: "🏯", region: "kanto",
    catch: "お城とかまぼこの町！",
    properties: [
      { name: "かまぼこ専門店", icon: "🐟", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "小田原城下の梅干し屋", icon: "🍑", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "みかん農園グループ", icon: "🍊", tier: "B", price: 18000, yieldPct: 15, revenue: 2700 },
      { name: "干物加工センター", icon: "🐡", tier: "B", price: 30000, yieldPct: 13, revenue: 3900 },
      { name: "小田原漁港水産加工団地", icon: "🎣", tier: "C", price: 150000, yieldPct: 11, revenue: 16500 },
      { name: "西湘バイパス物流拠点", icon: "🚛", tier: "C", price: 250000, yieldPct: 10, revenue: 25000 },
      { name: "小田原城観光開発", icon: "🏯", tier: "D", price: 3000000, yieldPct: 7, revenue: 210000, unlock: 3 },
      { name: "小田原駅前メガ再開発", icon: "🏗️", tier: "E", price: 72000000, yieldPct: 4, revenue: 2880000, unlock: 5 },
    ],
  },
  {
    key: "shizuoka", name: "静岡", icon: "🍵", region: "tokai",
    catch: "お茶とわさびの名産地！",
    properties: [
      { name: "茶畑の直売所", icon: "🍵", tier: "A", price: 1100, yieldPct: 18, revenue: 198 },
      { name: "わさび漬け専門店", icon: "🌱", tier: "A", price: 1400, yieldPct: 17, revenue: 238 },
      { name: "プラモデル工房", icon: "🚗", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "焼津マグロ加工会社", icon: "🐟", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "静岡茶輸出商社", icon: "📦", tier: "C", price: 200000, yieldPct: 11, revenue: 22000 },
      { name: "富士山麓物流センター", icon: "🗻", tier: "C", price: 400000, yieldPct: 10, revenue: 40000 },
      { name: "静岡モビリティ産業団地", icon: "🏭", tier: "D", price: 4500000, yieldPct: 7, revenue: 315000, unlock: 3 },
      { name: "富士山観光グランドリゾート", icon: "🗻", tier: "E", price: 126000000, yieldPct: 4, revenue: 5040000, unlock: 5 },
    ],
  },
  {
    key: "hamamatsu", name: "浜松", icon: "🎵", region: "tokai",
    catch: "楽器とうなぎの町！",
    properties: [
      { name: "うなぎ専門店", icon: "🐍", tier: "A", price: 1200, yieldPct: 18, revenue: 216 },
      { name: "浜名湖のり養殖場", icon: "🌊", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "楽器工房", icon: "🎹", tier: "B", price: 40000, yieldPct: 14, revenue: 5600 },
      { name: "オートバイ部品メーカー", icon: "🏍️", tier: "B", price: 50000, yieldPct: 13, revenue: 6500 },
      { name: "浜松楽器輸出商社", icon: "🎶", tier: "C", price: 300000, yieldPct: 10, revenue: 30000 },
      { name: "浜名湖リゾートホテル", icon: "🏨", tier: "C", price: 450000, yieldPct: 9, revenue: 40500 },
      { name: "浜松オートバイ大工場", icon: "🏍️", tier: "D", price: 5000000, yieldPct: 7, revenue: 350000, unlock: 3 },
      { name: "浜松産業技術メガセンター", icon: "🏭", tier: "E", price: 108000000, yieldPct: 4, revenue: 4320000, unlock: 5 },
    ],
  },
  {
    key: "nagoya", name: "名古屋", icon: "🏯", region: "tokai",
    catch: "自動車と味噌の大都市！",
    properties: [
      { name: "八丁味噌の蔵", icon: "🍶", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "ひつまぶし店", icon: "🍚", tier: "A", price: 1600, yieldPct: 16, revenue: 256 },
      { name: "有松絞りの染物工房", icon: "🎨", tier: "B", price: 20000, yieldPct: 15, revenue: 3000 },
      { name: "名古屋城下の陶磁器店", icon: "🏺", tier: "B", price: 35000, yieldPct: 14, revenue: 4900 },
      { name: "名古屋港輸出ターミナル", icon: "⚓", tier: "C", price: 500000, yieldPct: 10, revenue: 50000 },
      { name: "自動車部品サプライヤー団地", icon: "🔧", tier: "C", price: 900000, yieldPct: 9, revenue: 81000 },
      { name: "自動車大工場", icon: "🚗", tier: "D", price: 9800000, yieldPct: 7, revenue: 686000, unlock: 3 },
      { name: "中部国際空港物流ハブ", icon: "✈️", tier: "E", price: 234000000, yieldPct: 4, revenue: 9360000, unlock: 5 },
    ],
  },
  {
    key: "kyoto", name: "京都", icon: "⛩️", region: "kansai",
    catch: "歴史あるみやこの町！",
    properties: [
      { name: "八つ橋の老舗", icon: "🍡", tier: "A", price: 1200, yieldPct: 17, revenue: 204 },
      { name: "清水焼の窯元", icon: "🏺", tier: "A", price: 1500, yieldPct: 16, revenue: 240 },
      { name: "宇治茶問屋", icon: "🍵", tier: "B", price: 25000, yieldPct: 15, revenue: 3750 },
      { name: "西陣織工房", icon: "🧵", tier: "B", price: 30000, yieldPct: 14, revenue: 4200 },
      { name: "京友禅染色工場", icon: "🎨", tier: "C", price: 250000, yieldPct: 10, revenue: 25000 },
      { name: "老舗旅館グループ", icon: "🏮", tier: "C", price: 450000, yieldPct: 9, revenue: 40500 },
      { name: "京都伝統工芸産業団地", icon: "🏛️", tier: "D", price: 6000000, yieldPct: 7, revenue: 420000, unlock: 3 },
      { name: "京都国際観光リゾート", icon: "🎎", tier: "E", price: 162000000, yieldPct: 4, revenue: 6480000, unlock: 5 },
    ],
  },
  {
    key: "osaka", name: "大阪", icon: "🐙", region: "kansai",
    catch: "食い倒れの商都、天下の台所！",
    properties: [
      { name: "たこ焼き屋", icon: "🐙", tier: "A", price: 1000, yieldPct: 18, revenue: 180 },
      { name: "お好み焼き店", icon: "🥞", tier: "A", price: 1300, yieldPct: 17, revenue: 221 },
      { name: "黒門市場の鮮魚店", icon: "🐟", tier: "B", price: 30000, yieldPct: 15, revenue: 4500 },
      { name: "道頓堀劇場", icon: "🎭", tier: "B", price: 50000, yieldPct: 14, revenue: 7000 },
      { name: "大阪商社ビル", icon: "🏢", tier: "C", price: 600000, yieldPct: 10, revenue: 60000 },
      { name: "大阪湾臨海コンビナート", icon: "⚗️", tier: "C", price: 1000000, yieldPct: 8, revenue: 80000 },
      { name: "大阪城下メガ再開発", icon: "🏯", tier: "D", price: 9200000, yieldPct: 7, revenue: 644000, unlock: 3 },
      { name: "大阪湾岸メガロジスティクス拠点", icon: "🌊", tier: "E", price: 252000000, yieldPct: 4, revenue: 10080000, unlock: 5 },
    ],
  },
];

// クイズバンク。tags に都市キーを入れると、その都市滞在中に優先的に出題される。
// tags が空の問題は「一般常識枠」として、どの都市でも一定確率で出題される。
const QUIZ_BANK = [
  { q: "日本で一番人口が多い都道府県はどこ？", options: ["東京都", "大阪府", "北海道", "愛知県"], correct: 0, explain: "東京都には日本の人口の約1割の人が住んでいるよ。", tags: ["tokyo"] },
  { q: "東京にある、多くの路線が集まる日本一利用者数の多い駅は？", options: ["新宿駅", "渋谷駅", "品川駅", "上野駅"], correct: 0, explain: "新宿駅は1日の乗降者数が世界一多い駅としても知られているよ。", tags: ["tokyo"] },
  { q: "東京のシンボルとしても知られる、赤い電波塔は？", options: ["東京タワー", "通天閣", "さっぽろテレビ塔", "福岡タワー"], correct: 0, explain: "東京タワーは1958年にできた、高さ333mの電波塔だよ。", tags: ["tokyo"] },
  { q: "日本の首都はどこ？", options: ["東京都", "大阪府", "京都府", "神奈川県"], correct: 0, explain: "東京都には国会議事堂など、日本の政治の中心となる建物が集まっているよ。", tags: ["tokyo"] },
  { q: "横浜にある、中国の文化が集まる有名な町は？", options: ["中華街", "秋葉原", "天神", "道頓堀"], correct: 0, explain: "横浜中華街は日本最大の中華街なんだ。", tags: ["yokohama"] },
  { q: "横浜市があるのは何県？", options: ["神奈川県", "東京都", "千葉県", "埼玉県"], correct: 0, explain: "横浜市は神奈川県の県庁所在地で、日本有数の大都市だよ。", tags: ["yokohama"] },
  { q: "横浜港が開かれ、外国との貿易が始まったのはいつごろ？", options: ["江戸時代の終わりごろ", "縄文時代", "鎌倉時代", "昭和時代"], correct: 0, explain: "横浜港は1859年に開かれて、日本と外国をつなぐ玄関口になったよ。", tags: ["yokohama"] },
  { q: "小田原の名物「かまぼこ」の主な材料は？", options: ["魚", "豆腐", "肉", "米"], correct: 0, explain: "新鮮な魚のすり身から、かまぼこは作られているよ。", tags: ["odawara"] },
  { q: "神奈川県で「みかん」の生産がさかんな町は？", options: ["小田原市", "横浜市", "鎌倉市", "川崎市"], correct: 0, explain: "小田原の周りの山の斜面は、みかんづくりにぴったりの場所なんだ。", tags: ["odawara"] },
  { q: "小田原市があるのは何県？", options: ["神奈川県", "静岡県", "山梨県", "東京都"], correct: 0, explain: "小田原市は神奈川県の西のはしにあり、昔から交通の要所として栄えたよ。", tags: ["odawara"] },
  { q: "静岡県の名産品として有名なのは？", options: ["お茶", "りんご", "明太子", "さくらんぼ"], correct: 0, explain: "静岡県は日本一のお茶の生産量をほこる県だよ。", tags: ["shizuoka"] },
  { q: "富士山は静岡県と何県にまたがっている？", options: ["山梨県", "長野県", "愛知県", "神奈川県"], correct: 0, explain: "富士山の頂上は静岡県と山梨県の境目にあるんだ。", tags: ["shizuoka"] },
  { q: "静岡県の焼津港であがる魚として有名なのは？", options: ["マグロ", "サケ", "ホタテ", "カニ"], correct: 0, explain: "焼津港は日本有数のマグロの水あげ量をほこる港だよ。", tags: ["shizuoka"] },
  { q: "わさびづくりがさかんな都道府県は？", options: ["静岡県", "青森県", "鹿児島県", "沖縄県"], correct: 0, explain: "静岡県はきれいな水が多く、わさびづくりに向いているんだ。", tags: ["shizuoka"] },
  { q: "日本で一番高い山は？", options: ["富士山", "北岳", "御嶽山", "浅間山"], correct: 0, explain: "富士山の高さは3776mで、日本一だよ。", tags: ["shizuoka"] },
  { q: "静岡が「模型の町」と呼ばれる理由になった工業製品は？", options: ["プラモデル", "ぬいぐるみ", "ゲーム機", "自転車"], correct: 0, explain: "静岡は日本のプラモデル生産の多くをしめる町なんだ。", tags: ["shizuoka"] },
  { q: "静岡県でお茶畑が多く見られる場所は？", options: ["山の斜面", "海の中", "砂浜", "田んぼのあと"], correct: 0, explain: "日光と水はけのよい山の斜面は、お茶づくりにぴったりなんだ。", tags: ["shizuoka"] },
  { q: "静岡県を通る、東京と大阪を結ぶ新幹線は？", options: ["東海道新幹線", "山陽新幹線", "東北新幹線", "上越新幹線"], correct: 0, explain: "東海道新幹線は静岡県内を通り、日本の大動脈と呼ばれているよ。", tags: ["shizuoka"] },
  { q: "浜松市があるのは何県？", options: ["静岡県", "愛知県", "神奈川県", "山梨県"], correct: 0, explain: "浜松市は静岡県の西のはしにある町だよ。", tags: ["hamamatsu"] },
  { q: "浜松で古くから作られている工業製品は？", options: ["ピアノ", "こけし", "陶器", "うちわ"], correct: 0, explain: "浜松には世界的な楽器メーカーが集まっているよ。", tags: ["hamamatsu"] },
  { q: "浜松市が面している湖の名前は？", options: ["浜名湖", "琵琶湖", "霞ヶ浦", "諏訪湖"], correct: 0, explain: "浜名湖はうなぎの養殖でも有名な湖だよ。", tags: ["hamamatsu"] },
  { q: "名古屋の近くでさかんな工業は？", options: ["自動車工業", "漁業", "林業", "畜産業"], correct: 0, explain: "名古屋の近くにはトヨタなど大きな自動車工場があるよ。", tags: ["nagoya"] },
  { q: "名古屋名物「ひつまぶし」の主な材料は？", options: ["うなぎ", "さんま", "ぶり", "たい"], correct: 0, explain: "ひつまぶしは、うなぎのかば焼きをごはんにのせた名古屋めしだよ。", tags: ["nagoya"] },
  { q: "名古屋の名物調味料、大豆から作る濃い色の味噌は？", options: ["八丁味噌", "白味噌", "合わせ味噌", "麦味噌"], correct: 0, explain: "八丁味噌は長い時間じっくり熟成させて作る、名古屋の名物だよ。", tags: ["nagoya"] },
  { q: "名古屋城の屋根にのっている金色の像は？", options: ["金のしゃちほこ", "金の龍", "金の鶴", "金の獅子"], correct: 0, explain: "金のしゃちほこは名古屋城のシンボルとして有名だよ。", tags: ["nagoya"] },
  { q: "名古屋市があるのは何県？", options: ["愛知県", "岐阜県", "三重県", "静岡県"], correct: 0, explain: "名古屋市は愛知県の県庁所在地で、中部地方最大の都市だよ。", tags: ["nagoya"] },
  { q: "京都に長いあいだ都（みやこ）が置かれていた時代は？", options: ["平安時代", "縄文時代", "明治時代", "昭和時代"], correct: 0, explain: "京都はおよそ千年ものあいだ日本の都だったんだ。", tags: ["kyoto"] },
  { q: "京都で1000年以上つづく、有名な絹織物は？", options: ["西陣織", "久留米絣", "加賀友禅", "小千谷ちぢみ"], correct: 0, explain: "西陣織は京都の伝統工芸品で、美しい絹の織物だよ。", tags: ["kyoto"] },
  { q: "京都で長いあいだ天皇が住んでいた場所は？", options: ["御所", "城", "神社", "寺"], correct: 0, explain: "京都御所は、長いあいだ天皇が住んでいた場所だよ。", tags: ["kyoto"] },
  { q: "京都にたくさん残っている、歴史的な建物は？", options: ["寺や神社", "工場", "港", "田んぼ"], correct: 0, explain: "京都には1000年以上の歴史を持つ寺や神社がたくさん残っているよ。", tags: ["kyoto"] },
  { q: "大阪の名物として知られる粉もの料理は？", options: ["たこ焼き", "讃岐うどん", "博多ラーメン", "信州そば"], correct: 0, explain: "大阪は「粉もん」の町と呼ばれるくらい、粉もの料理が人気だよ。", tags: ["osaka"] },
  { q: "大阪城を建てた戦国武将は？", options: ["豊臣秀吉", "徳川家康", "織田信長", "源頼朝"], correct: 0, explain: "大阪城は今から400年以上前に豊臣秀吉が建てたお城だよ。", tags: ["osaka"] },
  { q: "大阪府の府庁所在地はどこ？", options: ["大阪市", "堺市", "豊中市", "吹田市"], correct: 0, explain: "大阪市は西日本最大の都市で、昔から「天下の台所」と呼ばれてきたよ。", tags: ["osaka"] },
  { q: "日本で一番長い川は？", options: ["信濃川", "利根川", "石狩川", "淀川"], correct: 0, explain: "信濃川は長野県から新潟県へ流れる日本一長い川だよ。", tags: [] },
  { q: "北海道でたくさん作られている農作物は？", options: ["じゃがいも", "パイナップル", "さとうきび", "みかん"], correct: 0, explain: "北海道は広い畑でじゃがいもをたくさん育てているよ。", tags: [] },
  { q: "日本の都道府県の中でいちばん面積が広いのは？", options: ["北海道", "岩手県", "福島県", "長野県"], correct: 0, explain: "北海道の広さは、他のどの都道府県よりも広いよ。", tags: [] },
  { q: "米づくりがさかんな地方として有名なのは？", options: ["東北地方", "九州地方", "関東地方", "四国地方"], correct: 0, explain: "東北地方は広い平野と豊かな水で、お米づくりがとてもさかんだよ。", tags: [] },
  { q: "瀬戸内海がある地方は？", options: ["中国・四国地方", "東北地方", "九州地方", "関東地方"], correct: 0, explain: "瀬戸内海は、中国地方と四国地方にはさまれた穏やかな海だよ。", tags: [] },
  { q: "沖縄県で多く作られている農作物は？", options: ["さとうきび", "りんご", "じゃがいも", "そば"], correct: 0, explain: "沖縄はあたたかい気候をいかしてさとうきびをたくさん育てているよ。", tags: [] },
  { q: "日本で一番大きい湖は？", options: ["琵琶湖", "霞ヶ浦", "浜名湖", "猪苗代湖"], correct: 0, explain: "琵琶湖は滋賀県にある、日本でいちばん大きい湖だよ。", tags: ["kyoto", "osaka"] },
  { q: "東海道新幹線が開業したのは、どの大きなイベントに合わせて？", options: ["東京オリンピック", "大阪万博", "サッカーW杯", "冬季オリンピック"], correct: 0, explain: "東海道新幹線は1964年、東京オリンピックの直前に開業したよ。", tags: ["tokyo", "shizuoka", "nagoya", "osaka"] },
];
