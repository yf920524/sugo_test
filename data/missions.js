/* ============================================================
   トリリオネアを目指せ！ - 産業ミッションデータ
   物件2〜3件の組み合わせを所有すると、一度きりの大きな現金報酬がもらえる
   短期目標。産業コンボ（継続的な収益ボーナス）とは違い、達成したその場で
   報酬をもらって終わり（同じ物件の組み合わせがコンボにもなっていれば、
   コンボの方は継続的に収益ボーナスが続く）。

   members: [{city, idx}]（idx は該当都市 properties 配列のインデックス）
   reward: 達成時に一度だけ得られる現金（万円）。物件価格帯に連動させ、
           序盤の2件ミッションは1〜2億円、3件ミッションは数億〜十数億円、
           中盤の産業チェーンは数十億円、終盤の大型ミッションは数百億円が目安。
   explain: 達成時に見せる「なぜこの組み合わせなのか」の一言（授業調にしない）
   unlockedBy: 指定すると、そのキーのミッションを達成するまでこのミッションは
               挑戦対象として表示・達成されない（連鎖ミッション）。
   ここに追記するだけで新しいミッションを追加できる。
   ============================================================ */
const MISSIONS = [
  {
    key: "tea_mission", name: "お茶産業を作ろう！", icon: "🍵",
    members: [{ city: "shizuoka", idx: 0 }, { city: "shizuoka", idx: 4 }],
    reward: 60000,
    explain: "茶畑で摘まれた葉が、商社を通じて世界へ輸出されるよ。",
  },
  {
    key: "tea_mission_2", name: "お茶産業を全国へ拡大！", icon: "🍵",
    members: [{ city: "shizuoka", idx: 4 }, { city: "kyoto", idx: 2 }],
    reward: 300000,
    unlockedBy: "tea_mission",
    explain: "静岡の輸出商社と京都の茶問屋がつながって、お茶産業がもっと大きくなったよ。",
  },
  {
    key: "seafood_mission", name: "海の幸を全国へ！", icon: "🐟",
    members: [{ city: "odawara", idx: 3 }, { city: "odawara", idx: 4 }],
    reward: 70000,
    explain: "港であがった魚が、加工場で干物になって全国に届けられるよ。",
  },
  {
    key: "auto_mission", name: "自動車産業を作ろう！", icon: "🚗",
    members: [{ city: "nagoya", idx: 5 }, { city: "nagoya", idx: 6 }],
    reward: 400000,
    explain: "部品工場で作られた部品が、自動車工場に運ばれて完成車になるよ。",
  },
  {
    key: "auto_mission_2", name: "自動車産業をメガ工業地帯へ！", icon: "🚗",
    members: [{ city: "nagoya", idx: 6 }, { city: "nagoya", idx: 7 }],
    reward: 4000000,
    unlockedBy: "auto_mission",
    explain: "部品サプライヤーと大工場がそろって、世界にクルマを送り出す一大産地になったよ。",
  },
  {
    key: "hamamatsu_mission", name: "浜名湖のめぐみミッション", icon: "🎵",
    members: [{ city: "hamamatsu", idx: 0 }, { city: "hamamatsu", idx: 2 }],
    reward: 12000,
    explain: "うなぎの町・浜松には世界的な楽器メーカーも集まっているよ。",
  },
  {
    key: "yokohama_mission", name: "港町の商いミッション", icon: "⚓",
    members: [{ city: "yokohama", idx: 0 }, { city: "yokohama", idx: 1 }],
    reward: 10000,
    explain: "横浜は外国とのつながりから、いろんな食文化が育った町だよ。",
  },
  {
    key: "kyoto_mission", name: "みやこの手仕事ミッション", icon: "🎨",
    members: [{ city: "kyoto", idx: 0 }, { city: "kyoto", idx: 1 }],
    reward: 10000,
    explain: "京都には長い歴史の中で育まれた伝統の技がたくさん残っているよ。",
  },
  {
    key: "osaka_mission", name: "天下の台所ミッション", icon: "🐙",
    members: [{ city: "osaka", idx: 0 }, { city: "osaka", idx: 1 }],
    reward: 10000,
    explain: "大阪は昔から商売が盛んで「天下の台所」と呼ばれてきたよ。",
  },
  {
    key: "sapporo_mission", name: "雪国のグルメミッション", icon: "❄️",
    members: [{ city: "sapporo", idx: 0 }, { city: "sapporo", idx: 1 }],
    reward: 10000,
    explain: "北海道の寒い気候が、おいしいラーメンやお菓子を育てたよ。",
  },
  {
    key: "fukuoka_mission", name: "博多の味ミッション", icon: "🍜",
    members: [{ city: "fukuoka", idx: 0 }, { city: "fukuoka", idx: 1 }],
    reward: 10000,
    explain: "博多は港町として栄え、独自のグルメ文化が育ったよ。",
  },
  {
    key: "kagoshima_mission", name: "南国の恵みミッション", icon: "🐷",
    members: [{ city: "kagoshima", idx: 0 }, { city: "kagoshima", idx: 1 }],
    reward: 15000,
    explain: "鹿児島の名産、黒豚とさつまいもから作る焼酎は名コンビだよ。",
  },
  {
    key: "craft_mission", name: "伝統工芸産業ミッション", icon: "✨",
    members: [{ city: "kanazawa", idx: 0 }, { city: "kyoto", idx: 3 }],
    reward: 25000,
    explain: "金沢の金箔と京都の西陣織、どちらも職人の技が光る伝統工芸品だよ。",
  },
  {
    key: "craft_mission_2", name: "伝統工芸産業を日本の顔へ！", icon: "✨",
    members: [{ city: "kanazawa", idx: 5 }, { city: "kyoto", idx: 6 }],
    reward: 3000000,
    unlockedBy: "craft_mission",
    explain: "金沢と京都、それぞれの伝統産業振興センターがそろい、日本の工芸を世界に発信する拠点になったよ。",
  },
  {
    key: "shipbuilding_mission", name: "造船産業ミッション", icon: "🚢",
    members: [{ city: "yokohama", idx: 6 }, { city: "kobe", idx: 4 }],
    reward: 3000000,
    explain: "全国の造船所がつながると、大きな船をたくさん作れるようになるよ。",
  },
  {
    key: "semiconductor_mission", name: "半導体産業ミッション", icon: "💾",
    members: [{ city: "kumamoto", idx: 1 }, { city: "sendai", idx: 4 }],
    reward: 250000,
    explain: "熊本と仙台、日本各地の半導体工場がつながると生産力がアップするよ。",
  },
  {
    key: "semiconductor_mission_2", name: "半導体産業を国産メガファブへ！", icon: "💾",
    members: [{ city: "kumamoto", idx: 6 }, { city: "sapporo", idx: 5 }],
    reward: 3500000,
    unlockedBy: "semiconductor_mission",
    explain: "熊本のメガファブと札幌のITタワーがつながり、日本の半導体産業がさらに厚くなったよ。",
  },
  {
    key: "onsen_mission", name: "温泉リゾートミッション", icon: "♨️",
    members: [{ city: "matsuyama", idx: 1 }, { city: "oita", idx: 1 }],
    reward: 20000,
    explain: "道後温泉と別府温泉、日本を代表する名湯どうしのつながりだよ。",
  },
  {
    key: "north_south_mission", name: "南北グルメ交流ミッション", icon: "🍎",
    members: [{ city: "aomori", idx: 0 }, { city: "kagoshima", idx: 0 }],
    reward: 12000,
    explain: "北のりんごと南の黒豚、日本は南北に長く、食べ物の種類も豊かだよ。",
  },
  {
    key: "petrochemical_mission", name: "石油化学コンビナートミッション", icon: "⚗️",
    members: [{ city: "yamaguchi", idx: 2 }, { city: "kitakyushu", idx: 3 }],
    reward: 180000,
    explain: "山口と北九州の工業地帯がつながると、化学製品づくりが盛んになるよ。",
  },
  {
    key: "castle_town_mission", name: "城下町観光ミッション", icon: "🏯",
    members: [{ city: "nagoya", idx: 3 }, { city: "kumamoto", idx: 3 }],
    reward: 150000,
    explain: "名古屋城と熊本城、日本各地に残るお城は今も観光の名所だよ。",
  },
  {
    key: "airport_mission", name: "空の玄関口ミッション", icon: "✈️",
    members: [{ city: "chiba", idx: 5 }, { city: "fukuoka", idx: 6 }],
    reward: 5000000,
    explain: "成田と福岡、日本各地の空港がつながって、人や荷物が全国へ運ばれるよ。",
  },
];
