/* ChronoForge — week planner, soft blueprint, multi-goal, outbox → RankRise (v3 Canonical IDs) */
(function () {
  const STORAGE = {
    blocks: 'chronoforge_blocks_v1',
    blueprint: 'chronoforge_blueprint_v1',
    days: 'chronoforge_days_v1',
    goals: 'chronoforge_goals_v1',
    outbox: 'rankrise_outbox_v1',
  };

  const CATEGORIES = {
    language: { label: 'Language', color: '#ff6b6b' },
    academics: { label: 'Academics', color: '#45b7d1' },
    creative: { label: 'Creative', color: '#96ceb4' },
    fitness: { label: 'Fitness', color: '#feca57' },
    portfolio: { label: 'Portfolio', color: '#a29bfe' },
    free: { label: 'Free', color: '#fd79a8' },
  };

  const DEFAULT_BLOCKS = [
    { id: 'b_de', title: 'German', category: 'language', durationMin: 45, color: '#ff6b6b', defaultDifficulty: 'medium', notes: 'Grammar + speaking' },
    { id: 'b_jp', title: 'Japanese', category: 'language', durationMin: 45, color: '#4ecdc4', defaultDifficulty: 'medium', notes: 'Kana / kanji + listening' },
    { id: 'b_ac', title: 'Academics', category: 'academics', durationMin: 120, color: '#45b7d1', defaultDifficulty: 'hard', notes: 'Class 11 board prep' },
    { id: 'b_gu', title: 'Guitar', category: 'creative', durationMin: 60, color: '#96ceb4', defaultDifficulty: 'easy', notes: '' },
    { id: 'b_gy', title: 'Gym', category: 'fitness', durationMin: 60, color: '#feca57', defaultDifficulty: 'easy', notes: '' },
    { id: 'b_po', title: 'Portfolio', category: 'portfolio', durationMin: 30, color: '#a29bfe', defaultDifficulty: 'medium', notes: 'GitHub / LinkedIn / projects' },
    { id: 'b_fr', title: 'Free Time', category: 'free', durationMin: 60, color: '#fd79a8', defaultDifficulty: 'easy', notes: '' },
  ];

  const DEFAULT_BLUEPRINT = {
    0: ['b_de', 'b_jp', 'b_ac', 'b_gy', 'b_po'],
    1: ['b_jp', 'b_de', 'b_ac', 'b_gy'],
    2: ['b_de', 'b_jp', 'b_ac', 'b_gu'],
    3: ['b_jp', 'b_de', 'b_ac', 'b_gy'],
    4: ['b_de', 'b_jp', 'b_ac', 'b_po'],
    5: ['b_ac', 'b_de', 'b_jp', 'b_fr'],
    6: ['b_gu', 'b_fr'],
  };

  const State = {
    blocks: [],
    blueprint: { ...DEFAULT_BLUEPRINT },
    days: {},
    goals: [],
    weekAnchor: null,
  };

  function uid() {
    if (typeof Scoring !== 'undefined' && Scoring.generateUUID) {
      return Scoring.generateUUID();
    }
    return 'cf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function weekDates(monday) {
    return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(monday, i));
  }

  function loadJSON(key, fallback) {
    try {
      const r = JSON.parse(localStorage.getItem(key) || 'null');
      return r == null ? fallback : r;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function loadAll() {
    State.blocks = loadJSON(STORAGE.blocks, null) || DEFAULT_BLOCKS.map(b => ({ ...b }));
    State.blueprint = loadJSON(STORAGE.blueprint, null) || { ...DEFAULT_BLUEPRINT };
    for (let i = 0; i < 7; i++) {
      if (!Array.isArray(State.blueprint[i])) State.blueprint[i] = [];
    }
    State.days = loadJSON(STORAGE.days, {}) || {};
    State.goals = loadJSON(STORAGE.goals, []) || [];
    State.weekAnchor = startOfWeek(new Date());
  }

  function saveBlocks() { saveJSON(STORAGE.blocks, State.blocks); }
  function saveBlueprint() { saveJSON(STORAGE.blueprint, State.blueprint); }
  function saveDays() { saveJSON(STORAGE.days, State.days); }
  function saveGoals() { saveJSON(STORAGE.goals, State.goals); }

  function getBlock(id) {
    return State.blocks.find(b => b.id === id) || null;
  }

  function ensureDay(dateStr) {
    if (!State.days[dateStr]) {
      State.days[dateStr] = { date: dateStr, chips: [] };
    }
    return State.days[dateStr];
  }

  function getDay(dateStr) {
    return State.days[dateStr] || { date: dateStr, chips: [] };
  }

  function applyBlueprintToWeek(monday) {
    const dates = weekDates(monday);
    let filled = 0;
    dates.forEach((d, dow) => {
      const ds = toDateStr(d);
      const day = ensureDay(ds);
      if (day.chips.length > 0) return;
      const ids = State.blueprint[dow] || [];
      day.chips = ids.map(bid => chipFromBlock(bid)).filter(Boolean);
      if (day.chips.length) filled++;
    });
    saveDays();
    return filled;
  }

  function chipFromBlock(blockId) {
    const b = getBlock(blockId);
    if (!b) return null;
    return {
      instanceId: uid(),
      blockId: b.id,
      title: b.title,
      durationMin: b.durationMin,
      category: b.category,
      color: b.color || (CATEGORIES[b.category] && CATEGORIES[b.category].color) || '#888',
      defaultDifficulty: b.defaultDifficulty || 'medium',
      status: 'planned',
    };
  }

  function addChipToDay(dateStr, blockId) {
    const day = ensureDay(dateStr);
    const chip = chipFromBlock(blockId);
    if (!chip) return null;
    day.chips.push(chip);
    saveDays();
    return chip;
  }

  function moveChip(fromDate, instanceId, toDate, toIndex) {
    const from = ensureDay(fromDate);
    const idx = from.chips.findIndex(c => c.instanceId === instanceId);
    if (idx < 0) return false;
    const [chip] = from.chips.splice(idx, 1);
    const to = ensureDay(toDate);
    if (typeof toIndex === 'number' && toIndex >= 0 && toIndex <= to.chips.length) {
      to.chips.splice(toIndex, 0, chip);
    } else {
      to.chips.push(chip);
    }
    saveDays();
    return true;
  }

  function removeChip(dateStr, instanceId) {
    const day = ensureDay(dateStr);
    day.chips = day.chips.filter(c => c.instanceId !== instanceId);
    saveDays();
  }

  function setChipStatus(dateStr, instanceId, status) {
    const day = ensureDay(dateStr);
    const chip = day.chips.find(c => c.instanceId === instanceId);
    if (!chip) return null;
    chip.status = status;
    saveDays();
    return chip;
  }

  function clearWeekChips(monday) {
    weekDates(monday).forEach(d => {
      const ds = toDateStr(d);
      if (State.days[ds]) {
        State.days[ds].chips = [];
      }
    });
    saveDays();
  }

  function createBlock(partial) {
    const b = {
      id: uid(),
      title: (partial.title || 'New block').trim(),
      category: partial.category || 'academics',
      durationMin: Math.max(5, parseInt(partial.durationMin, 10) || 45),
      color: partial.color || (CATEGORIES[partial.category] && CATEGORIES[partial.category].color) || '#74b9ff',
      defaultDifficulty: partial.defaultDifficulty || 'medium',
      notes: partial.notes || '',
    };
    State.blocks.push(b);
    saveBlocks();
    return b;
  }

  function updateBlock(id, partial) {
    const b = getBlock(id);
    if (!b) return null;
    Object.assign(b, partial);
    if (partial.durationMin != null) b.durationMin = Math.max(5, parseInt(partial.durationMin, 10) || b.durationMin);
    saveBlocks();
    return b;
  }

  function deleteBlock(id) {
    State.blocks = State.blocks.filter(b => b.id !== id);
    for (let i = 0; i < 7; i++) {
      State.blueprint[i] = (State.blueprint[i] || []).filter(bid => bid !== id);
    }
    saveBlocks();
    saveBlueprint();
  }

  function createGoal({ name, targetDate, startDate, color }) {
    const g = {
      id: uid(),
      name: (name || 'Goal').trim(),
      targetDate: targetDate,
      startDate: startDate || toDateStr(new Date()),
      color: color || '#74b9ff',
      milestones: [],
    };
    State.goals.push(g);
    saveGoals();
    return g;
  }

  function deleteGoal(id) {
    State.goals = State.goals.filter(g => g.id !== id);
    saveGoals();
  }

  function goalStats(g) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(g.targetDate + 'T00:00:00');
    const start = new Date((g.startDate || g.targetDate) + 'T00:00:00');
    const msDay = 86400000;
    const daysLeft = Math.ceil((target - now) / msDay);
    const total = Math.max(1, Math.ceil((target - start) / msDay));
    const elapsed = Math.min(total, Math.max(0, Math.ceil((now - start) / msDay)));
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    return { daysLeft, pct, total, elapsed };
  }

  function readOutbox() {
    return loadJSON(STORAGE.outbox, []) || [];
  }

  function writeOutbox(list) {
    saveJSON(STORAGE.outbox, list);
  }

  function queueChipToOutbox(dateStr, instanceId) {
    const day = ensureDay(dateStr);
    const chip = day.chips.find(c => c.instanceId === instanceId);
    if (!chip) return null;
    chip.status = 'done';
    saveDays();

    const box = readOutbox();
    if (box.some(x => x.instanceId === instanceId && x.status === 'queued')) {
      return box.find(x => x.instanceId === instanceId);
    }
    const item = {
      id: uid(),
      source: 'chronoforge',
      title: chip.title,
      durationMin: chip.durationMin,
      category: chip.category,
      difficulty: chip.defaultDifficulty || 'medium',
      plannedDate: dateStr,
      blockId: chip.blockId,
      instanceId: chip.instanceId,
      status: 'queued',
      createdAt: Date.now(),
    };
    box.unshift(item);
    writeOutbox(box);
    return item;
  }

  function dismissOutbox(id) {
    const box = readOutbox().map(x => x.id === id ? { ...x, status: 'dismissed' } : x);
    writeOutbox(box);
  }

  function markOutboxCommitted(id) {
    const box = readOutbox().map(x => x.id === id ? { ...x, status: 'committed' } : x);
    writeOutbox(box);
  }

  function queuedOutbox() {
    return readOutbox().filter(x => x.status === 'queued');
  }

  function hadVerifiedFocusOn(dateStr) {
    try {
      const raw = JSON.parse(localStorage.getItem('rankrise_data_v2') || 'null');
      if (!raw || !Array.isArray(raw.tasks)) return false;
      return raw.tasks.some(t => t.date === dateStr && t.verified === true);
    } catch (_) {
      return false;
    }
  }

  window.ChronoForge = {
    CATEGORIES,
    State,
    loadAll,
    toDateStr,
    startOfWeek,
    addDays,
    weekDates,
    getBlock,
    getDay,
    ensureDay,
    applyBlueprintToWeek,
    addChipToDay,
    moveChip,
    removeChip,
    setChipStatus,
    clearWeekChips,
    createBlock,
    updateBlock,
    deleteBlock,
    createGoal,
    deleteGoal,
    goalStats,
    queueChipToOutbox,
    dismissOutbox,
    markOutboxCommitted,
    queuedOutbox,
    hadVerifiedFocusOn,
    readOutbox,
    saveBlueprint,
    saveBlocks,
    saveDays,
    saveGoals,
  };
})();