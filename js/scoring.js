/* RankRise scoring + persistence (v3 Integrity, Schema Migrations & Pure Derived State) */
const SCHEMA_VERSION = 3;

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

const STORAGE_KEYS = {
  rankDB: 'rankrise_data_v2',
  verification: 'rankrise_verification_v3',
};

const RankDB = {
  version: SCHEMA_VERSION,
  tasks: [],
  streak: 0,
  lastActivityDate: null,
};

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

/* --- Defensive Loader & Schema Migration Engine --- */
function loadRankDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rankDB);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      // Defensive Task Sanitization
      if (Array.isArray(parsed.tasks)) {
        RankDB.tasks = parsed.tasks.map(t => ({
          id: t.id || generateUUID(),
          timestamp: typeof t.timestamp === 'number' ? t.timestamp : Date.now(),
          date: typeof t.date === 'string' ? t.date : todayStr(),
          title: typeof t.title === 'string' ? t.title : 'Untitled Session',
          duration: typeof t.duration === 'number' ? t.duration : 25,
          difficulty: DIFF[t.difficulty] ? t.difficulty : 'medium',
          urgency: URG[t.urgency] ? t.urgency : 'medium',
          energy: ['low', 'medium', 'high'].includes(t.energy) ? t.energy : 'medium',
          completionRatio: typeof t.completionRatio === 'number' ? Math.min(1, Math.max(0.1, t.completionRatio)) : 1,
          bonus: typeof t.bonus === 'number' ? t.bonus : 0,
          score: typeof t.score === 'number' ? t.score : 0,
          verified: Boolean(t.verified),
          verificationId: t.verificationId || null,
          outboxItemId: t.outboxItemId || null,
          noteId: t.noteId || null,
          noteTitle: t.noteTitle || null,
        }));
      }

      if (typeof parsed.streak === 'number') RankDB.streak = Math.max(0, parsed.streak);
      if (typeof parsed.lastActivityDate === 'string') RankDB.lastActivityDate = parsed.lastActivityDate;

      // Validate streak expiration
      if (RankDB.lastActivityDate) {
        const d = Math.round((new Date(todayStr()) - new Date(RankDB.lastActivityDate)) / 86400000);
        if (d > 1) RankDB.streak = 0;
      }
    }
  } catch (err) {
    console.warn('RankDB Defensive Loader: Recovered from malformed storage', err);
  }
}

function saveRankDB() {
  RankDB.version = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEYS.rankDB, JSON.stringify(RankDB));
}

/* --- Persistent Verification Tokens --- */
function saveVerificationToken(token) {
  localStorage.setItem(STORAGE_KEYS.verification, JSON.stringify(token));
}

function getVerificationToken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.verification) || 'null');
  } catch (_) {
    return null;
  }
}

function clearVerificationToken() {
  localStorage.removeItem(STORAGE_KEYS.verification);
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

/* --- Pure Derived State Calculations --- */
function deriveTotalScore() {
  return RankDB.tasks.reduce((sum, t) => sum + (t.score || 0), 0);
}

function deriveTodayScore() {
  const t = todayStr();
  return RankDB.tasks.filter(x => x.date === t).reduce((sum, x) => sum + (x.score || 0), 0);
}

function deriveVerifiedCount() {
  return RankDB.tasks.filter(x => x.verified).length;
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

/* --- Idempotent Task Commit --- */
function commitTaskRecord(taskData) {
  if (taskData.verificationId && RankDB.tasks.some(t => t.verificationId === taskData.verificationId)) {
    console.warn('IDEMPOTENCY GUARD: Rejected duplicate commit for verificationId', taskData.verificationId);
    return false;
  }
  if (taskData.outboxItemId && RankDB.tasks.some(t => t.outboxItemId === taskData.outboxItemId)) {
    console.warn('IDEMPOTENCY GUARD: Rejected duplicate commit for outboxItemId', taskData.outboxItemId);
    return false;
  }

  const record = {
    id: generateUUID(),
    timestamp: Date.now(),
    date: todayStr(),
    ...taskData,
  };

  RankDB.tasks.push(record);
  bumpStreak();
  saveRankDB();
  return record;
}

window.Scoring = {
  RankDB, loadRankDB, saveRankDB, saveVerificationToken, getVerificationToken,
  clearVerificationToken, bumpStreak, calcScore, resolveRank, strain, todayStr,
  generateUUID, commitTaskRecord, deriveTotalScore, deriveTodayScore, deriveVerifiedCount,
  RANKS, SCHEMA_VERSION,
};