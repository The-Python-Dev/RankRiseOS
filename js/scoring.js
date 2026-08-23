/* RankRise scoring + persistence */
const DIFF = { easy: 0.8, medium: 1.0, hard: 1.3 };
const URG = { low: 0.9, medium: 1.0, high: 1.1 };
const RANKS = [
  { name: 'Pawn', symbol: '♙', min: 0, max: 120, steps: ['I', 'II', 'III'] },
  { name: 'Knight', symbol: '♘', min: 120, max: 300, steps: ['I', 'II', 'III'] },
  { name: 'Bishop', symbol: '♗', min: 300, max: 520, steps: ['I', 'II', 'III'] },
  { name: 'Rook', symbol: '♖', min: 520, max: 780, steps: ['I', 'II', 'III'] },
  { name: 'Queen', symbol: '♕', min: 780, max: 1100, steps: ['I', 'II', 'III', 'IV', 'V'] },
  { name: 'Grandmaster', symbol: '♔', min: 1100, max: 1500, steps: ['I', 'II', 'III'] },
  { name: 'Super Grandmaster', symbol: '👑', min: 1500, max: 2000, steps: ['I', 'II', 'III'] },
  { name: 'Elite Legend', symbol: '⚔️', min: 2000, max: Infinity, steps: [] },
];

const RankDB = {
  tasks: [],
  streak: 0,
  lastActivityDate: null,
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function loadRankDB() {
  try {
    const r = JSON.parse(localStorage.getItem('rankrise_data_v2') || 'null');
    if (!r) return;
    if (Array.isArray(r.tasks)) RankDB.tasks = r.tasks;
    if (typeof r.streak === 'number') RankDB.streak = r.streak;
    if (r.lastActivityDate) RankDB.lastActivityDate = r.lastActivityDate;
    if (RankDB.lastActivityDate) {
      const d = Math.round((new Date(todayStr()) - new Date(RankDB.lastActivityDate)) / 86400000);
      if (d > 1) RankDB.streak = 0;
    }
  } catch (_) {}
}

function saveRankDB() {
  localStorage.setItem('rankrise_data_v2', JSON.stringify(RankDB));
}

function bumpStreak() {
  const t = todayStr();
  if (RankDB.lastActivityDate === t) return;
  if (RankDB.lastActivityDate) {
    const d = Math.round((new Date(t) - new Date(RankDB.lastActivityDate)) / 86400000);
    RankDB.streak = d === 1 ? RankDB.streak + 1 : 1;
  } else RankDB.streak = 1;
  RankDB.lastActivityDate = t;
}

function calcScore(mins, diff, comp, urg, bonus) {
  mins = Flipodoro.clamp(mins, 1, 240);
  comp = Flipodoro.clamp(comp, 0.1, 1);
  bonus = Flipodoro.clamp(bonus, 0, 0.75);
  return +(((mins / 25) * (DIFF[diff] ?? 1) * comp * (URG[urg] ?? 1)) + bonus).toFixed(2);
}

function resolveRank(total) {
  const score = Math.max(0, total);
  let tier = RANKS[RANKS.length - 1];
  for (const r of RANKS) if (score >= r.min && score < r.max) { tier = r; break; }
  if (tier.max === Infinity) {
    return { fullTitle: tier.name, symbol: tier.symbol, lo: tier.min, hi: tier.min + 500, pct: 100 };
  }
  const n = tier.steps.length, span = (tier.max - tier.min) / n;
  let idx = Math.floor((score - tier.min) / span);
  idx = Math.min(Math.max(idx, 0), n - 1);
  const lo = tier.min + idx * span, hi = lo + span;
  return {
    fullTitle: `${tier.name} ${tier.steps[idx]}`,
    symbol: tier.symbol,
    lo: Math.floor(lo),
    hi: Math.floor(hi),
    pct: Math.min(100, Math.max(0, ((score - lo) / span) * 100)),
  };
}

function strain(energy, comp) {
  if (energy === 'low' && comp >= 0.85) return { icon: '🚨', title: 'Burnout Risk', msg: 'High output on low energy.' };
  if (energy === 'high' && comp <= 0.5) return { icon: '⚠️', title: 'Attention Leak', msg: 'High energy, low completion.' };
  return { icon: '⚡', title: 'Balanced', msg: 'Energy and output look aligned.' };
}

window.Scoring = {
  RankDB, loadRankDB, saveRankDB, bumpStreak, calcScore, resolveRank, strain, todayStr, RANKS,
};