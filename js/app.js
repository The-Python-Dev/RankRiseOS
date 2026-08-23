/* App shell — wires Flipodoro + Scoring + NeuronNotes + ChronoForge */
(function () {
  const { PomodoroTimer, FlipClock, TimerState, SESSION_STUDY } = Flipodoro;
  const { RankDB, loadRankDB, saveRankDB, bumpStreak, calcScore, resolveRank, strain, todayStr } = Scoring;
  const NN = NeuronNotes;
  const CF = ChronoForge;

  const $ = (id) => document.getElementById(id);
  let pendingVerified = null;
  let activeOutboxItem = null;
  let previewOn = false;

  /* ==========================================================================
     1. THEMATIC & VIEW MANAGEMENT
     ========================================================================== */
  function loadTheme() {
    const saved = localStorage.getItem('rankrise_theme');
    const preferDark = matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (preferDark ? 'dark' : 'light'));
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('rankrise_theme', t);
    $('theme-btn').textContent = t === 'dark' ? '☀️' : '🌙';
  }

  function showView(name) {
    ['focus', 'notes', 'log', 'forge'].forEach(v => {
      $('view-' + v).classList.toggle('hidden', v !== name);
    });
    document.querySelectorAll('.main-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.view === name);
    });

    if (name === 'notes') NotesUI.refresh();
    if (name === 'log') {
      refreshNoteSelect();
      renderLogOutbox();
    }
    if (name === 'forge') ForgeUI.refresh();
  }

  /* ==========================================================================
     2. FLIPODORO TIMER CONTROLLER
     ========================================================================== */
  const timer = new PomodoroTimer();
  const clock = new FlipClock($('flip-row'));
  let tickJob = null;

  const labels = {
    study: 'Focus Session',
    short_break: 'Short Break',
    long_break: 'Long Break',
  };

  function paintSession() {
    const s = timer.currentSessionType;
    $('timer-card').dataset.mode = s;
    $('session-label').textContent = labels[s];
    document.querySelectorAll('.timer-card .tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.session === s);
      btn.disabled = timer.state !== TimerState.IDLE;
    });
    const box = $('dots'); box.innerHTML = '';
    const cycle = timer.sessionsBeforeLongBreak;
    const pos = timer.completedStudySessions % cycle;
    for (let i = 0; i < cycle; i++) {
      const d = document.createElement('div');
      d.className = 'dot' + (i < pos ? ' on' : '');
      box.appendChild(d);
    }
  }

  function paintStart() {
    const st = timer.state;
    $('btn-start').textContent = st === TimerState.RUNNING ? 'Pause' : st === TimerState.PAUSED ? 'Resume' : 'Start';
  }

  function updateGate() {
    const btn = $('commit-btn'), banner = $('lock-banner'), help = $('commit-help'), dur = $('f-duration');
    if (timer.state === TimerState.RUNNING) {
      btn.disabled = true; btn.textContent = '⏳ Timer running';
      banner.className = 'lock show';
      banner.innerHTML = '⏳ Finish Focus at 0:00 (not Skip) for Elo.';
      dur.disabled = true; return;
    }
    if (pendingVerified) {
      btn.disabled = false;
      btn.textContent = `✓ Commit Verified (+${pendingVerified.durationMin}m)`;
      banner.className = 'lock show ready';
      banner.innerHTML = `✅ Verified Focus — <strong>${pendingVerified.durationMin}m</strong>`;
      dur.value = pendingVerified.durationMin; dur.disabled = true; return;
    }
    if (activeOutboxItem) {
      btn.disabled = false;
      btn.textContent = `✓ Commit Outbox: ${activeOutboxItem.title} (+${activeOutboxItem.durationMin}m)`;
      banner.className = 'lock show ready';
      banner.innerHTML = `📋 Planned task from ChronoForge: <strong>${activeOutboxItem.title}</strong> (${activeOutboxItem.durationMin}m)`;
      dur.value = activeOutboxItem.durationMin; dur.disabled = false; return;
    }
    btn.disabled = true; btn.textContent = '🔒 Complete Focus or select Outbox item';
    banner.className = 'lock show';
    banner.innerHTML = '🔒 Finish a <strong>Focus</strong> session or queue a task from ChronoForge.';
    help.textContent = 'Flipodoro rules: skip = zero Elo.';
    dur.disabled = false;
  }

  timer.setOnTick(r => clock.setFromSeconds(r));
  timer.setOnStateChange(() => { paintStart(); paintSession(); updateGate(); });
  timer.setOnComplete(type => {
    SFX.done();
    if (type === SESSION_STUDY) {
      const durationMin = Math.max(1, Math.round((timer._lastCompletedTotal || 25 * 60) / 60));
      pendingVerified = { durationMin, completedAt: Date.now() };
      if (!$('f-title').value.trim()) $('f-title').value = `Verified Focus #${timer.completedStudySessions + 1}`;
      $('f-duration').value = durationMin;
      $('f-comp').value = 100; $('f-comp-val').textContent = '100%';
      toast('Focus complete', `${durationMin}m verified`, '🍅');
      showView('log');
    } else toast('Break complete', 'Back to focus when ready', '☕');
  });

  function startTicks() {
    clearInterval(tickJob);
    tickJob = setInterval(() => timer.tick(), 500);
  }

  /* ==========================================================================
     3. NEURONNOTES CONTROLLER
     ========================================================================== */
  const NotesUI = {
    refresh() {
      this.renderList();
      this.renderTags();
      this.renderEditor();
      this.renderBacklinks();
      this.renderSessions();
    },
    renderList() {
      const box = $('note-list');
      const list = NN.filteredNotes();
      if (!list.length) {
        box.innerHTML = '<p class="muted">No notes match.</p>';
        return;
      }
      box.innerHTML = list.map(n => `
        <button type="button" class="note-item ${n.id === NN.NotesVault.activeId ? 'active' : ''}" data-id="${n.id}">
          <span class="nt">${NN.esc(n.title)}</span>
          <span class="nm">${new Date(n.updatedAt).toLocaleString()}</span>
        </button>`).join('');
      box.querySelectorAll('.note-item').forEach(b => {
        b.onclick = () => {
          NN.NotesVault.activeId = b.dataset.id;
          NN.saveVault();
          this.refresh();
        };
      });
    },
    renderTags() {
      const box = $('tag-cloud');
      const tags = NN.allTags();
      if (!tags.length) { box.innerHTML = ''; return; }
      box.innerHTML = tags.map(([t, c]) =>
        `<button type="button" class="tag-pill ${NN.NotesVault.filterTag === t ? 'active' : ''}" data-tag="${t}">#${t} ${c}</button>`
      ).join('');
      box.querySelectorAll('.tag-pill').forEach(p => {
        p.onclick = () => {
          NN.NotesVault.filterTag = NN.NotesVault.filterTag === p.dataset.tag ? null : p.dataset.tag;
          this.renderList();
          this.renderTags();
        };
      });
    },
    renderEditor() {
      const n = NN.getActive();
      if (!n) return;
      $('note-title').value = n.title;
      $('note-body').value = n.body;
      if (previewOn) {
        $('note-body').classList.add('hidden');
        $('note-preview').classList.remove('hidden');
        $('note-preview').innerHTML = NN.renderMarkdown(n.body);
        $('btn-preview-toggle').textContent = 'Edit';
        $('note-preview').querySelectorAll('.wiki-link').forEach(el => {
          el.onclick = () => {
            NN.openByTitle(el.dataset.wiki);
            this.refresh();
          };
        });
      } else {
        $('note-body').classList.remove('hidden');
        $('note-preview').classList.add('hidden');
        $('btn-preview-toggle').textContent = 'Preview';
      }
    },
    renderBacklinks() {
      const n = NN.getActive();
      const box = $('backlinks-list');
      if (!n) return;
      const bl = NN.backlinksTo(n.title);
      if (!bl.length) { box.innerHTML = '<p class="muted">No backlinks yet.</p>'; return; }
      box.innerHTML = bl.map(b =>
        `<button type="button" class="blink" data-id="${b.id}">${NN.esc(b.title)}</button>`
      ).join('');
      box.querySelectorAll('.blink').forEach(b => {
        b.onclick = () => { NN.NotesVault.activeId = b.dataset.id; NN.saveVault(); this.refresh(); };
      });
    },
    renderSessions() {
      const n = NN.getActive();
      const box = $('note-sessions');
      if (!n) return;
      const linked = RankDB.tasks.filter(t => t.noteId === n.id || t.noteTitle === n.title);
      if (!linked.length) { box.innerHTML = '<p class="muted">No study sessions linked.</p>'; return; }
      box.innerHTML = linked.slice().reverse().map(t =>
        `<div class="blink">+${t.score.toFixed(2)} · ${NN.esc(t.title)} · ${t.duration}m</div>`
      ).join('');
    },
  };
  window.NotesUI = NotesUI;

  function refreshNoteSelect() {
    const sel = $('f-note');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— none —</option>' +
      NN.NotesVault.notes.map(n => `<option value="${n.id}">${NN.esc(n.title)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  /* ==========================================================================
     4. CHRONOFORGE CONTROLLER (Week Grid, Drag-Drop, Goals, Outbox)
     ========================================================================== */
  const ForgeUI = {
    refresh() {
      this.renderGoals();
      this.renderPalette();
      this.renderWeekGrid();
    },

    renderGoals() {
      const box = $('goals-bar-container');
      if (!CF.State.goals.length) {
        box.innerHTML = '<p class="muted" style="font-size:0.8rem">No target goals set yet. Click "+ New Goal" to add one!</p>';
        return;
      }
      box.innerHTML = CF.State.goals.map(g => {
        const stats = CF.goalStats(g);
        return `
          <div class="goal-card">
            <div class="goal-card-head">
              <span>🎯 ${NN.esc(g.name)}</span>
              <button type="button" class="del" onclick="ForgeUI.removeGoal('${g.id}')" title="Delete goal">×</button>
            </div>
            <div class="goal-card-meta">
              <span>${stats.daysLeft > 0 ? stats.daysLeft + ' days left' : 'Target reached / past!'}</span>
            </div>
            <div class="goal-track">
              <div class="goal-fill" style="width: ${stats.pct}%"></div>
            </div>
          </div>`;
      }).join('');
    },

    removeGoal(id) {
      if (confirm('Delete this goal?')) {
        CF.deleteGoal(id);
        this.renderGoals();
      }
    },

    renderPalette() {
      const box = $('palette-list');
      box.innerHTML = CF.State.blocks.map(b => `
        <div class="palette-chip" draggable="true" data-block-id="${b.id}" style="border-left-color: ${b.color}">
          <div>
            <span class="title">${NN.esc(b.title)}</span>
            <span class="dur"> (${b.durationMin}m)</span>
          </div>
          <button type="button" class="del" onclick="event.stopPropagation(); ForgeUI.removeBlock('${b.id}')" title="Delete block">×</button>
        </div>`).join('');

      // Dragstart event listeners for palette chips
      box.querySelectorAll('.palette-chip').forEach(chip => {
        chip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'palette',
            blockId: chip.dataset.blockId
          }));
        });
      });
    },

    removeBlock(id) {
      const b = CF.getBlock(id);
      if (b && confirm(`Delete block "${b.title}" from palette and blueprint template?`)) {
        CF.deleteBlock(id);
        this.renderPalette();
        toast('Block Deleted', `Removed "${b.title}"`, '🗑️');
      }
    },

    renderWeekGrid() {
      const monday = CF.State.weekAnchor || CF.startOfWeek(new Date());
      const dates = CF.weekDates(monday);
      const today = CF.toDateStr(new Date());

      const rangeLabel = `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      $('week-date-label').textContent = rangeLabel;

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const grid = $('week-grid-container');
      grid.innerHTML = '';

      dates.forEach((d, idx) => {
        const ds = CF.toDateStr(d);
        const dayData = CF.getDay(ds);
        const isToday = ds === today;

        const col = document.createElement('div');
        col.className = 'day-col' + (isToday ? ' is-today' : '');
        col.dataset.date = ds;

        col.innerHTML = `
          <div class="day-head">
            ${dayNames[idx]}
            <span class="num">${d.getDate()}</span>
          </div>
          <div class="chip-stack" data-date="${ds}"></div>
        `;

        const stack = col.querySelector('.chip-stack');

        // Render Day Chips
        dayData.chips.forEach(chip => {
          const card = document.createElement('div');
          card.className = `day-chip status-${chip.status}`;
          card.draggable = true;
          card.style.borderLeftColor = chip.color;
          card.dataset.instanceId = chip.instanceId;
          card.dataset.date = ds;

          card.innerHTML = `
            <div class="chip-head">
              <span>${NN.esc(chip.title)}</span>
            </div>
            <div class="chip-meta">
              <span>⏱ ${chip.durationMin}m</span>
              <span>🎯 ${chip.defaultDifficulty}</span>
            </div>
          `;

          // Chip click action menu
          card.addEventListener('click', () => {
            if (chip.status === 'done') {
              if (confirm(`Mark "${chip.title}" as planned again?`)) {
                CF.setChipStatus(ds, chip.instanceId, 'planned');
                this.renderWeekGrid();
              }
            } else {
              const act = prompt(`Action for "${chip.title}":\n1 = Mark Done & Send to Outbox\n2 = Skip\n3 = Delete`, '1');
              if (act === '1') {
                CF.queueChipToOutbox(ds, chip.instanceId);
                toast('Queued to Outbox', 'Head to Log tab to commit Elo', '📋');
                this.renderWeekGrid();
              } else if (act === '2') {
                CF.setChipStatus(ds, chip.instanceId, 'skipped');
                this.renderWeekGrid();
              } else if (act === '3') {
                CF.removeChip(ds, chip.instanceId);
                this.renderWeekGrid();
              }
            }
          });

          // Chip dragstart
          card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({
              type: 'chip',
              instanceId: chip.instanceId,
              fromDate: ds
            }));
          });

          card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
          });

          stack.appendChild(card);
        });

        // Drop target events for day columns
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', () => {
          col.classList.remove('drag-over');
        });

        col.addEventListener('drop', (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'palette') {
              CF.addChipToDay(ds, data.blockId);
              this.renderWeekGrid();
            } else if (data.type === 'chip') {
              CF.moveChip(data.fromDate, data.instanceId, ds);
              this.renderWeekGrid();
            }
          } catch (_) {}
        });

        grid.appendChild(col);
      });
    },
  };
  window.ForgeUI = ForgeUI;

  /* Render Log Tab Outbox List */
  function renderLogOutbox() {
    const box = $('log-outbox-list');
    const queued = CF.queuedOutbox();
    if (!queued.length) {
      box.innerHTML = '<p class="muted">No planned tasks queued from ChronoForge.</p>';
      return;
    }
    box.innerHTML = queued.map(item => `
      <div class="outbox-card">
        <div>
          <h5>${NN.esc(item.title)}</h5>
          <p>📅 Date: ${item.plannedDate} | ⏱ ${item.durationMin}m | 🎯 ${item.difficulty}</p>
        </div>
        <div class="outbox-actions">
          <button type="button" class="tbtn" onclick="useOutboxItem('${item.id}')">Select for Form</button>
          <button type="button" class="del" onclick="dismissOutboxItem('${item.id}')" title="Dismiss">×</button>
        </div>
      </div>`).join('');
  }

  window.useOutboxItem = function (id) {
    const item = CF.readOutbox().find(x => x.id === id);
    if (!item) return;
    activeOutboxItem = item;
    $('f-title').value = item.title;
    $('f-duration').value = item.durationMin;
    $('f-diff').value = item.difficulty;
    updateGate();
    toast('Outbox Task Loaded', 'Adjust energy/difficulty and click Commit', '📋');
  };

  window.dismissOutboxItem = function (id) {
    CF.dismissOutbox(id);
    renderLogOutbox();
    if (activeOutboxItem && activeOutboxItem.id === id) {
      activeOutboxItem = null;
      updateGate();
    }
  };

  /* ==========================================================================
     5. RANK & LEDGER CONTROLLER
     ========================================================================== */
  function refreshRankUI() {
    const total = RankDB.tasks.reduce((a, t) => a + t.score, 0);
    const t = todayStr();
    const today = RankDB.tasks.filter(x => x.date === t).reduce((a, x) => a + x.score, 0);
    $('total-score').textContent = total.toFixed(2);
    $('today-score').textContent = today.toFixed(2);
    $('verified-count').textContent = RankDB.tasks.filter(x => x.verified).length;
    $('streak-count').textContent = RankDB.streak;
    const rank = resolveRank(total);
    $('rank-text').textContent = rank.fullTitle;
    $('rank-icon').textContent = rank.symbol;
    $('rank-lo').textContent = rank.lo + ' Elo';
    $('rank-hi').textContent = rank.hi + ' Elo';
    $('rank-bar').style.width = rank.pct + '%';
    if (RankDB.tasks.length) {
      const last = RankDB.tasks[RankDB.tasks.length - 1];
      const d = strain(last.energy, last.completionRatio);
      $('diag-icon').textContent = d.icon;
      $('diag-title').textContent = d.title;
      $('diag-msg').textContent = d.msg;
    }
    renderLedger();
  }

  function renderLedger() {
    const box = $('ledger');
    if (!RankDB.tasks.length) {
      box.innerHTML = '<div class="empty">No sessions yet.</div>';
      return;
    }
    box.innerHTML = [...RankDB.tasks].reverse().map(t => `
      <div class="row">
        <div>
          <h4>${NN.esc(t.title)}</h4>
          <div class="tags">
            <span class="tag">⏱ ${t.duration}m</span>
            <span class="tag">🎯 ${t.difficulty}</span>
            ${t.verified ? '<span class="tag ok">✓ Verified</span>' : '<span class="tag">📋 Planned</span>'}
            ${t.noteTitle ? `<span class="tag coral">🧠 ${NN.esc(t.noteTitle)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <span class="score">+${t.score.toFixed(2)}</span>
          <button type="button" class="del" data-id="${t.id}">×</button>
        </div>
      </div>`).join('');
    box.querySelectorAll('.del').forEach(b => {
      b.onclick = () => {
        if (!confirm('Delete session?')) return;
        RankDB.tasks = RankDB.tasks.filter(t => t.id !== b.dataset.id);
        saveRankDB(); refreshRankUI();
      };
    });
  }

  /* ==========================================================================
     6. AUDIO & TOAST NOTIFICATIONS
     ========================================================================== */
  const SFX = {
    ctx: null,
    init() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    beep(f, d, type = 'sine', v = 0.06, when = 0) {
      this.init();
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d);
    },
    done() { this.beep(880, .15, 'triangle', .1, 0); this.beep(1047, .2, 'triangle', .1, .16); },
    rankUp() { [523, 659, 784, 1047].forEach((f, i) => this.beep(f, .4, 'sine', .09, i * .1)); },
  };

  function toast(title, body, ico = '🏆') {
    $('toast-title').textContent = title;
    $('toast-body').textContent = body;
    $('toast-ico').textContent = ico;
    const el = $('toast');
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3600);
  }

  /* ==========================================================================
     7. EVENT LISTENERS
     ========================================================================== */
  document.querySelectorAll('.main-tab').forEach(b => b.onclick = () => showView(b.dataset.view));
  $('theme-btn').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  /* Timer Controls */
  $('btn-start').onclick = () => {
    SFX.init();
    if (timer.state === TimerState.RUNNING) timer.pause(); else timer.start();
  };
  $('btn-reset').onclick = () => timer.reset();
  $('btn-skip').onclick = () => {
    timer.skip(); paintSession(); updateGate();
    toast('Skipped', 'Zero Elo', '⏭️');
  };
  $('btn-fs').onclick = () => document.body.classList.toggle('fs');
  document.querySelectorAll('.timer-card .tab').forEach(btn => {
    btn.onclick = () => {
      if (!timer.setSessionType(btn.dataset.session)) {
        toast('Locked', 'Only while idle', '🔒'); return;
      }
      paintSession(); clock.setFromSeconds(timer.remainingSeconds);
    };
  });

  /* Timer Settings Modal */
  $('btn-settings').onclick = () => {
    $('cfg-study').value = timer.studyMinutes;
    $('cfg-short').value = Math.round(timer._durationFor('short_break') / 60);
    $('cfg-long').value = Math.round(timer._durationFor('long_break') / 60);
    $('cfg-cycle').value = timer.sessionsBeforeLongBreak;
    $('settings-scrim').classList.add('open');
  };
  $('settings-cancel').onclick = () => $('settings-scrim').classList.remove('open');
  $('settings-scrim').onclick = e => { if (e.target === e.currentTarget) $('settings-scrim').classList.remove('open'); };
  $('settings-save').onclick = () => {
    timer.updateDurations($('cfg-study').value, $('cfg-short').value, $('cfg-long').value, $('cfg-cycle').value);
    localStorage.setItem('rankrise_timer_cfg', JSON.stringify({
      study: +$('cfg-study').value, short: +$('cfg-short').value,
      long: +$('cfg-long').value, cycle: +$('cfg-cycle').value,
    }));
    paintSession(); clock.setFromSeconds(timer.remainingSeconds);
    $('settings-scrim').classList.remove('open');
    toast('Saved', 'Durations updated', '⚙');
  };

  /* ChronoForge Week & Goals Listeners */
  $('btn-prev-week').onclick = () => {
    CF.State.weekAnchor = CF.addDays(CF.State.weekAnchor, -7);
    ForgeUI.renderWeekGrid();
  };
  $('btn-next-week').onclick = () => {
    CF.State.weekAnchor = CF.addDays(CF.State.weekAnchor, 7);
    ForgeUI.renderWeekGrid();
  };
  $('btn-today-week').onclick = () => {
    CF.State.weekAnchor = CF.startOfWeek(new Date());
    ForgeUI.renderWeekGrid();
  };
  $('btn-apply-blueprint').onclick = () => {
    const count = CF.applyBlueprintToWeek(CF.State.weekAnchor);
    ForgeUI.renderWeekGrid();
    toast('Blueprint Applied', `Soft filled ${count} empty days.`, '⚒️');
  };
  $('btn-clear-week').onclick = () => {
    if (confirm('Clear all chips for this visible week?')) {
      CF.clearWeekChips(CF.State.weekAnchor);
      ForgeUI.renderWeekGrid();
    }
  };
  $('btn-add-block').onclick = () => {
    const title = prompt('Block Name (e.g. Physics, Guitar):');
    if (!title) return;
    const dur = parseInt(prompt('Duration in minutes:', '45'), 10) || 45;
    CF.createBlock({ title, durationMin: dur });
    ForgeUI.renderPalette();
  };

  /* Goal Modal Handlers */
  $('btn-add-goal').onclick = () => $('goal-scrim').classList.add('open');
  $('goal-cancel').onclick = () => $('goal-scrim').classList.remove('open');
  $('goal-scrim').onclick = e => { if (e.target === e.currentTarget) $('goal-scrim').classList.remove('open'); };
  $('goal-save').onclick = () => {
    const name = $('goal-name-inp').value.trim();
    const date = $('goal-date-inp').value;
    if (!name || !date) return alert('Please enter both goal name and target date.');
    CF.createGoal({ name, targetDate: date });
    $('goal-name-inp').value = '';
    $('goal-date-inp').value = '';
    $('goal-scrim').classList.remove('open');
    ForgeUI.renderGoals();
    toast('Goal Set', 'Countdown active in ChronoForge', '🎯');
  };

  /* Notes Events */
  let saveTimer = null;
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      NN.upsertNote({ title: $('note-title').value, body: $('note-body').value });
      NotesUI.renderList();
      NotesUI.renderTags();
      NotesUI.renderBacklinks();
    }, 250);
  }
  $('note-title').oninput = queueSave;
  $('note-body').oninput = queueSave;
  $('note-body').addEventListener('paste', e => NN.handleImagePaste(e, $('note-body')));
  $('btn-new-note').onclick = () => { NN.createNote('Untitled', ''); NotesUI.refresh(); };
  $('btn-delete-note').onclick = () => {
    if (!confirm('Delete this note?')) return;
    if (!NN.deleteActive()) { toast('Nope', 'Keep at least one note', '⚠️'); return; }
    NotesUI.refresh();
  };
  $('btn-preview-toggle').onclick = () => {
    NN.upsertNote({ title: $('note-title').value, body: $('note-body').value });
    previewOn = !previewOn;
    NotesUI.renderEditor();
  };
  $('note-search').oninput = e => {
    NN.NotesVault.query = e.target.value;
    NotesUI.renderList();
  };
  $('btn-export-vault').onclick = () => {
    NN.exportAllMarkdown();
    toast('Exported', 'Each note downloaded as .md', '🧠');
  };
  $('btn-import-md').onclick = () => $('import-files').click();
  $('import-files').onchange = e => {
    NN.importMarkdownFiles(e.target.files);
    toast('Imported', 'Markdown added to vault', '📥');
    e.target.value = '';
  };

  /* ==========================================================================
     8. SESSION LOG COMMIT FORM (TRUST POLICY B ENFORCED)
     ========================================================================== */
  $('f-comp').oninput = e => { $('f-comp-val').textContent = e.target.value + '%'; };

  $('task-form').onsubmit = e => {
    e.preventDefault();
    if (timer.state === TimerState.RUNNING) return toast('Locked', 'Timer running', '🔒');
    if (!pendingVerified && !activeOutboxItem) return toast('Locked', 'Complete Focus or select an Outbox item first', '🔒');

    const noteId = $('f-note').value;
    const note = NN.NotesVault.notes.find(n => n.id === noteId);

    // TRUST POLICY B EVALUATION:
    // Standard base Elo is calculated. The +0.25 Verified bonus is ONLY granted if
    // a Flipodoro Focus session hit 0:00 or a verified focus occurred on the planned date.
    let isVerified = false;
    let bonus = 0;

    if (pendingVerified) {
      isVerified = true;
      bonus += 0.25; // Flipodoro Verified Focus bonus
    } else if (activeOutboxItem) {
      if (CF.hadVerifiedFocusOn(activeOutboxItem.plannedDate)) {
        isVerified = true;
        bonus += 0.25;
      }
    }

    if ($('f-early').checked) bonus += 0.15;
    if ($('f-extra').checked) bonus += 0.10;
    if ($('f-synthesis').checked || noteId) bonus += 0.20;

    const duration = pendingVerified ? pendingVerified.durationMin : activeOutboxItem.durationMin;

    const score = calcScore(
      duration,
      $('f-diff').value,
      parseInt($('f-comp').value, 10) / 100,
      $('f-urgency').value,
      bonus
    );

    const oldRank = resolveRank(RankDB.tasks.reduce((a, t) => a + t.score, 0)).fullTitle;

    RankDB.tasks.push({
      id: 'tsk_' + Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
      date: todayStr(),
      title: $('f-title').value.trim(),
      duration: duration,
      difficulty: $('f-diff').value,
      urgency: $('f-urgency').value,
      energy: $('f-energy').value,
      completionRatio: parseInt($('f-comp').value, 10) / 100,
      bonus,
      score,
      verified: isVerified,
      noteId: note ? note.id : null,
      noteTitle: note ? note.title : null,
    });

    if (activeOutboxItem) {
      CF.markOutboxCommitted(activeOutboxItem.id);
      activeOutboxItem = null;
    }

    pendingVerified = null;
    bumpStreak();
    saveRankDB();

    $('f-title').value = '';
    $('f-early').checked = $('f-extra').checked = $('f-synthesis').checked = false;

    const newRank = resolveRank(RankDB.tasks.reduce((a, t) => a + t.score, 0)).fullTitle;
    if (newRank !== oldRank) { SFX.rankUp(); toast('Promotion!', newRank, '👑'); }
    else toast('Logged to Ledger', `+${score.toFixed(2)} Elo ${isVerified ? '(Verified)' : '(Base)'}`, '✓');

    refreshRankUI();
    renderLogOutbox();
    updateGate();
  };

  $('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(RankDB, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rankrise_${todayStr()}.json`;
    a.click();
  };

  $('btn-wipe').onclick = () => {
    if (!confirm('Wipe all Elo progress?')) return;
    RankDB.tasks = []; RankDB.streak = 0; RankDB.lastActivityDate = null;
    pendingVerified = null; activeOutboxItem = null;
    saveRankDB(); refreshRankUI(); renderLogOutbox(); updateGate();
  };

  /* Keyboard Shortcuts */
  document.addEventListener('keydown', e => {
    if ($('settings-scrim').classList.contains('open') || $('goal-scrim').classList.contains('open')) {
      if (e.key === 'Escape') {
        $('settings-scrim').classList.remove('open');
        $('goal-scrim').classList.remove('open');
      }
      return;
    }
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.code === 'Space') { e.preventDefault(); $('btn-start').click(); }
    else if (e.key.toLowerCase() === 'r') $('btn-reset').click();
    else if (e.key.toLowerCase() === 's') $('btn-skip').click();
    else if (e.key.toLowerCase() === 'f') document.body.classList.toggle('fs');
    else if (e.key === 'Escape') document.body.classList.remove('fs');
  });

  /* ==========================================================================
     9. BOOT & INITIALIZATION
     ========================================================================== */
  loadTheme();
  loadRankDB();
  NN.loadVault();
  CF.loadAll();

  try {
    const cfg = JSON.parse(localStorage.getItem('rankrise_timer_cfg') || 'null');
    if (cfg) timer.updateDurations(cfg.study, cfg.short, cfg.long, cfg.cycle);
  } catch (_) {}

  paintSession();
  paintStart();
  clock.setFromSeconds(timer.remainingSeconds);
  refreshRankUI();
  updateGate();
  startTicks();
  showView('focus');
})();