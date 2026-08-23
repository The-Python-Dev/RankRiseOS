/* Flipodoro core port — timer.py */
const SESSION_STUDY = 'study';
const SESSION_SHORT_BREAK = 'short_break';
const SESSION_LONG_BREAK = 'long_break';
const TimerState = { IDLE: 'IDLE', RUNNING: 'RUNNING', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED' };

function clamp(n, a, b) { return Math.min(b, Math.max(a, Number(n) || a)); }

class PomodoroTimer {
  constructor(opts = {}) {
    this._studyMinutes = opts.studyMinutes ?? 25;
    this._shortBreakMinutes = opts.shortBreakMinutes ?? 5;
    this._longBreakMinutes = opts.longBreakMinutes ?? 15;
    this._sessionsBeforeLongBreak = opts.sessionsBeforeLongBreak ?? 4;
    this._completedStudySessions = 0;
    this._currentSessionType = SESSION_STUDY;
    this._state = TimerState.IDLE;
    this._totalSeconds = this._durationFor(SESSION_STUDY);
    this._remainingSeconds = this._totalSeconds;
    this._startWallTime = null;
    this._remainingAtLastStart = this._totalSeconds;
    this._lastCompletedTotal = 0;
    this._onTick = null;
    this._onComplete = null;
    this._onStateChange = null;
  }
  updateDurations(study, shortB, longB, cycle) {
    this._studyMinutes = clamp(study, 1, 120);
    this._shortBreakMinutes = clamp(shortB, 1, 120);
    this._longBreakMinutes = clamp(longB, 1, 120);
    this._sessionsBeforeLongBreak = clamp(cycle, 1, 10);
    this._startWallTime = null;
    this._state = TimerState.IDLE;
    this._totalSeconds = this._durationFor(this._currentSessionType);
    this._remainingSeconds = this._totalSeconds;
    this._remainingAtLastStart = this._totalSeconds;
    this._notifyState(); this._notifyTick();
  }
  setOnTick(cb) { this._onTick = cb; }
  setOnComplete(cb) { this._onComplete = cb; }
  setOnStateChange(cb) { this._onStateChange = cb; }
  start() {
    if (this._state === TimerState.IDLE || this._state === TimerState.PAUSED) {
      this._startWallTime = performance.now();
      this._remainingAtLastStart = this._remainingSeconds;
      this._state = TimerState.RUNNING;
      this._notifyState();
    }
  }
  pause() {
    if (this._state === TimerState.RUNNING) {
      this._remainingSeconds = this._computeRemaining();
      this._startWallTime = null;
      this._state = TimerState.PAUSED;
      this._notifyState(); this._notifyTick();
    }
  }
  reset() {
    this._startWallTime = null;
    this._state = TimerState.IDLE;
    this._totalSeconds = this._durationFor(this._currentSessionType);
    this._remainingSeconds = this._totalSeconds;
    this._remainingAtLastStart = this._totalSeconds;
    this._notifyState(); this._notifyTick();
  }
  skip() { this._advanceSession(); }
  tick() {
    if (this._state !== TimerState.RUNNING) return;
    this._remainingSeconds = this._computeRemaining();
    this._notifyTick();
    if (this._remainingSeconds <= 0) {
      this._remainingSeconds = 0;
      this._completeSession();
    }
  }
  setSessionType(type) {
    if (![SESSION_STUDY, SESSION_SHORT_BREAK, SESSION_LONG_BREAK].includes(type)) return false;
    if (this._state !== TimerState.IDLE) return false;
    this._currentSessionType = type;
    this._totalSeconds = this._durationFor(type);
    this._remainingSeconds = this._totalSeconds;
    this._remainingAtLastStart = this._totalSeconds;
    this._notifyTick(); this._notifyState();
    return true;
  }
  get state() { return this._state; }
  get remainingSeconds() { return Math.max(0, this._remainingSeconds); }
  get totalSeconds() { return this._totalSeconds; }
  get currentSessionType() { return this._currentSessionType; }
  get completedStudySessions() { return this._completedStudySessions; }
  get sessionsBeforeLongBreak() { return this._sessionsBeforeLongBreak; }
  get studyMinutes() { return this._studyMinutes; }
  _computeRemaining() {
    if (this._startWallTime == null) return this._remainingSeconds;
    const elapsed = (performance.now() - this._startWallTime) / 1000;
    return Math.max(0, this._remainingAtLastStart - Math.floor(elapsed));
  }
  _completeSession() {
    const completedType = this._currentSessionType;
    this._lastCompletedTotal = this._totalSeconds;
    this._state = TimerState.COMPLETED;
    this._notifyState();
    if (this._onComplete) this._onComplete(completedType);
    this._advanceSession();
  }
  _advanceSession() {
    if (this._currentSessionType === SESSION_STUDY) {
      this._completedStudySessions += 1;
      this._currentSessionType =
        this._completedStudySessions % this._sessionsBeforeLongBreak === 0
          ? SESSION_LONG_BREAK : SESSION_SHORT_BREAK;
    } else {
      this._currentSessionType = SESSION_STUDY;
    }
    this._totalSeconds = this._durationFor(this._currentSessionType);
    this._remainingSeconds = this._totalSeconds;
    this._remainingAtLastStart = this._totalSeconds;
    this._startWallTime = null;
    this._state = TimerState.IDLE;
    this._notifyState(); this._notifyTick();
  }
  _durationFor(type) {
    return ({
      [SESSION_STUDY]: this._studyMinutes * 60,
      [SESSION_SHORT_BREAK]: this._shortBreakMinutes * 60,
      [SESSION_LONG_BREAK]: this._longBreakMinutes * 60,
    })[type] ?? this._studyMinutes * 60;
  }
  _notifyTick() { if (this._onTick) this._onTick(this.remainingSeconds, this._totalSeconds); }
  _notifyState() { if (this._onStateChange) this._onStateChange(this._state); }
}

class FlipClock {
  constructor(root) {
    this.root = root; this.digits = []; this.chars = ['0', '0', '0', '0'];
    root.innerHTML = '';
    for (let i = 0; i < 2; i++) this.digits.push(this._el());
    const c = document.createElement('div'); c.className = 'colon'; c.textContent = ':'; root.appendChild(c);
    for (let i = 0; i < 2; i++) this.digits.push(this._el());
  }
  _el() {
    const el = document.createElement('div');
    el.className = 'flip';
    el.innerHTML = `<div class="flip-upper"><span>0</span></div><div class="flip-lower"><span>0</span></div><div class="flip-gap"></div>`;
    this.root.appendChild(el);
    return el;
  }
  setFromSeconds(total) {
    total = Math.max(0, total | 0);
    const m = Math.min(99, Math.floor(total / 60)), s = total % 60;
    const next = [String(Math.floor(m / 10)), String(m % 10), String(Math.floor(s / 10)), String(s % 10)];
    next.forEach((ch, i) => {
      if (this.chars[i] === ch) return;
      this.chars[i] = ch;
      const d = this.digits[i];
      d.classList.remove('anim'); void d.offsetWidth; d.classList.add('anim');
      d.querySelectorAll('span').forEach(sp => { sp.textContent = ch; });
    });
  }
}

window.Flipodoro = { PomodoroTimer, FlipClock, TimerState, SESSION_STUDY, SESSION_SHORT_BREAK, SESSION_LONG_BREAK, clamp };