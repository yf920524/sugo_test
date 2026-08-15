/* ============================================================
   トリリオネアを目指せ！ - ランダムイベントデータ
   都市に到着したときに一定確率で発生する、その年度だけの収益増減。
   効果は「所有している対象物件の収益合計 × pct%」を、今年度の決算の
   「その他ボーナス」へ一度だけ加算する（一時的な効果。翌年度には残らない）。
   理不尽な大損失を避けるため、マイナス効果は控えめ・プラス効果は
   やや大きめに設定している。所有物件が対象に一つもない場合はそもそも発生しない。
   ============================================================ */
const EVENTS = [
  {
    key: "typhoon", icon: "🌀", name: "台風接近", tone: "bad",
    desc: "西日本に台風が接近中。農業・観光の小さな物件が少し影響を受けそう。",
    targetCities: ["kyoto", "nara", "hiroshima", "okayama", "kobe"],
    targetTiers: ["A", "B"],
    pct: -8,
  },
  {
    key: "tourism_boom", icon: "🎌", name: "観光ブーム", tone: "good",
    desc: "京都・奈良・金沢に観光客が急増中！観光関連の物件がにぎわっているよ。",
    targetCities: ["kyoto", "nara", "kanazawa", "kobe"],
    targetTiers: ["C", "D", "E"],
    pct: 15,
  },
  {
    key: "good_harvest", icon: "🌾", name: "豊作のたより", tone: "good",
    desc: "新潟・東北で今年はお米や果物が豊作！農業関連の物件がうるおっているよ。",
    targetCities: ["niigata", "sendai", "morioka", "fukushima", "aomori"],
    targetTiers: ["A", "B"],
    pct: 15,
  },
  {
    key: "export_boom", icon: "📈", name: "輸出好調", tone: "good",
    desc: "自動車や工業製品の輸出が好調！工業系の物件に追い風が吹いているよ。",
    targetCities: ["nagoya", "hamamatsu", "hiroshima", "yokohama"],
    targetTiers: ["C", "D", "E"],
    pct: 10,
  },
  {
    key: "fish_shortage", icon: "🐟", name: "不漁のたより", tone: "bad",
    desc: "一部の漁港で今年は少し不漁気味…水産系の物件はひかえめかも。",
    targetCities: ["odawara", "aomori", "tottori", "yamaguchi"],
    targetTiers: ["A", "B"],
    pct: -8,
  },
  {
    key: "snow_heavy", icon: "❄️", name: "大雪のたより", tone: "bad",
    desc: "北陸・東北で大雪！交通・物流の物件が少し影響を受けそう。",
    targetCities: ["niigata", "toyama", "kanazawa", "aomori", "morioka"],
    targetTiers: ["C", "D"],
    pct: -6,
  },
  {
    key: "festival_hit", icon: "🎉", name: "お祭りが大盛況！", tone: "good",
    desc: "各地のお祭りが大盛況！観光・商業関連の物件がにぎわっているよ。",
    targetCities: ["sendai", "aomori", "osaka", "kyoto"],
    targetTiers: ["A", "B"],
    pct: 12,
  },
  {
    key: "tech_boom", icon: "💻", name: "ハイテク需要拡大", tone: "good",
    desc: "半導体やIT関連の需要が拡大中！ハイテク系の物件に追い風だよ。",
    targetCities: ["tokyo", "sendai"],
    targetTiers: ["C", "D", "E"],
    pct: 10,
  },
  {
    key: "cold_summer", icon: "🌦️", name: "冷夏のたより", tone: "bad",
    desc: "今年は冷夏で、一部の農作物の生育が少しゆっくりめ…",
    targetCities: ["nagano", "kofu", "gifu"],
    targetTiers: ["A", "B"],
    pct: -6,
  },
  {
    key: "new_shinkansen", icon: "🚄", name: "新幹線ダイヤ増発", tone: "good",
    desc: "新幹線の本数が増えて、沿線の交通・物流関連がにぎわっているよ。",
    targetCities: ["takasaki", "sendai", "kanazawa", "niigata"],
    targetTiers: ["C", "D", "E"],
    pct: 10,
  },
];
