/* ============================================================
   トリリオネアを目指せ！ - 産業コンボデータ
   同じ産業でつながる物件を複数の都市にまたがって集めると、
   関連する物件の収益にボーナスがつく。
   「産業は単独ではなく、複数の仕事がつながって成立している」
   ことを自然に体験できるようにする仕組み。
   members: [{city, idx}] （idx は該当都市 properties 配列のインデックス）
   bonusPct: 成立時に members の合計収益へ加算されるボーナス率(%)
   ここに追記するだけで新しいコンボを追加できる。
   ============================================================ */
const COMBOS = [
  {
    key: "tea_industry", name: "お茶産業コンボ", icon: "🍵",
    desc: "茶畑から輸出商社、京都の茶問屋までがつながった！",
    members: [
      { city: "shizuoka", idx: 0 }, // 茶畑の直売所
      { city: "shizuoka", idx: 4 }, // 静岡茶輸出商社
      { city: "kyoto", idx: 2 },    // 宇治茶問屋
    ],
    bonusPct: 25,
  },
  {
    key: "auto_industry", name: "自動車産業コンボ", icon: "🚗",
    desc: "部品工場から完成車工場、他地域の部品工場までがつながった！",
    members: [
      { city: "nagoya", idx: 5 },    // 自動車部品サプライヤー団地
      { city: "nagoya", idx: 6 },    // 自動車大工場
      { city: "hiroshima", idx: 3 }, // 広島自動車部品工場
      { city: "hiroshima", idx: 5 }, // 瀬戸内自動車産業団地
    ],
    bonusPct: 25,
  },
  {
    key: "shipbuilding", name: "造船・港湾コンボ", icon: "🚢",
    desc: "全国の造船所どうしがつながって技術と受注が集まった！",
    members: [
      { city: "yokohama", idx: 6 }, // 横浜造船ドック
      { city: "kobe", idx: 4 },     // 神戸造船所
      { city: "hiroshima", idx: 4 }, // 広島造船所
    ],
    bonusPct: 20,
  },
  {
    key: "rice_industry", name: "お米産業コンボ", icon: "🌾",
    desc: "田んぼから米菓工場まで、お米のサイクルがつながった！",
    members: [
      { city: "niigata", idx: 0 }, // コシヒカリ農園
      { city: "niigata", idx: 4 }, // 米菓工場グループ
    ],
    bonusPct: 20,
  },
  {
    key: "traditional_crafts", name: "伝統工芸コンボ", icon: "🎨",
    desc: "京都と金沢、伝統工芸の名工たちがつながった！",
    members: [
      { city: "kyoto", idx: 3 },     // 西陣織工房
      { city: "kanazawa", idx: 0 },  // 金箔工房
      { city: "kanazawa", idx: 1 },  // 加賀友禅染色工房
    ],
    bonusPct: 25,
  },
  {
    key: "logistics_network", name: "港湾物流コンボ", icon: "🚚",
    desc: "首都圏の物流拠点どうしがつながり、輸送効率がアップ！",
    members: [
      { city: "tokyo", idx: 5 },     // 東京ベイ物流センター
      { city: "yokohama", idx: 4 }, // 横浜港コンテナターミナル
      { city: "chiba", idx: 5 },    // 成田国際空港物流拠点
    ],
    bonusPct: 20,
  },
  {
    key: "fuji_resort", name: "富士リゾートコンボ", icon: "🗻",
    desc: "富士山まわりのリゾート施設がつながり、観光客が周遊するように！",
    members: [
      { city: "hamamatsu", idx: 5 }, // 浜名湖リゾートホテル
      { city: "kofu", idx: 5 },      // 富士北麓リゾート開発
      { city: "shizuoka", idx: 7 },  // 富士山観光グランドリゾート
    ],
    bonusPct: 20,
  },
  {
    key: "seafood_processing", name: "水産加工コンボ", icon: "🐟",
    desc: "各地の漁港と加工場がつながり、全国に新鮮な海の幸を届ける！",
    members: [
      { city: "odawara", idx: 0 },  // かまぼこ専門店
      { city: "odawara", idx: 3 },  // 干物加工センター
      { city: "aomori", idx: 2 },   // ホタテ漁業組合
      { city: "tottori", idx: 4 },  // 山陰漁港水産加工団地
    ],
    bonusPct: 20,
  },
  {
    key: "shinkansen_terminal", name: "新幹線ターミナルコンボ", icon: "🚄",
    desc: "全国の新幹線ターミナル開発がつながり、人と物の流れが加速！",
    members: [
      { city: "takasaki", idx: 2 },  // 高崎新幹線分岐ターミナル
      { city: "sendai", idx: 5 },    // 東北新幹線ターミナルビル
      { city: "kanazawa", idx: 6 },  // 北陸新幹線ターミナル開発
    ],
    bonusPct: 20,
  },
];
