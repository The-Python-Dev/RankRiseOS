# ♔ RankRise OS

A modular, gamified study operating system — focus timer, second brain, weekly planner, and Elo progression in one local-first app.

![Version](https://img.shields.io/badge/version-3.0.0-ff6b6b)
![Platform](https://img.shields.io/badge/platform-Web-lightgrey)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS-3178c6)
![License](https://img.shields.io/badge/license-GPL--3.0-4c1)

🚀 **Live App:** [https://rankrise-os.netlify.app](https://rankrise-os.netlify.app) *(or your custom Netlify URL)*

---

## What is this?

RankRise OS is the web hub that ties together your productivity stack:

| Pillar | What it does |
|--------|----------------|
| 🍅 **Flipodoro** | Focus / short break / long break timer with flip-clock UI |
| 🧠 **NeuronNotes** | Markdown notes, `[[wiki-links]]`, `#tags`, backlinks |
| ⚒️ **ChronoForge** | Weekly drag-and-drop planner, blocks, goals, outbox |
| ♔ **RankRise** | Chess-rank Elo scoring, streaks, verified vs planned trust |

Plan in ChronoForge → prove it with Flipodoro → bank Elo in RankRise → capture knowledge in NeuronNotes.

No accounts. No cloud. Open `index.html` or visit the live link and go.

---

## Features

### 🍅 Flipodoro (Execution)
- Focus, Short Break, Long Break sessions
- Flip-clock display
- Session dots / cycle before long break
- Pause, resume, reset, skip
- Focus mode (fullscreen)
- Wall-clock timestamp tick loop (anti-throttle)
- Keyboard shortcuts (Space, R, S, F, Esc)
- Settings for durations + cycle length
- **Verified Focus** unlocks full Elo bonus on commit (persistent across page refresh)

### 🧠 NeuronNotes (Knowledge)
- Clean markdown editor + preview
- Bidirectional `[[wiki-links]]` (click to jump / create)
- `#hashtag` system with sidebar filter
- Backlinks panel
- Linked study sessions per note (canonical UUIDs)
- Clipboard image paste (inline base64)
- Search across vault
- Import / export plain `.md` (desktop-friendly)
- Auto-save

### ⚒️ ChronoForge (Planning)
- Reusable **blocks** (German, Japanese, Academics, Gym…)
- Create / **delete** blocks from palette
- **Drag-and-drop** week grid (Monday start)
- Soft **blueprint**: fill **empty days only** (never overwrites your edits)
- Chip states: planned · done · skipped
- Multi-goal countdowns with progress bars
- **Outbox**: mark done → queue → commit later in Log
- Trust Policy B: Verified (+0.25) only if Flipodoro Focus completed that day
- Clear week / apply blueprint controls

### ♔ RankRise (Calibration)
- Time-anchored scoring (duration × difficulty × completion × urgency + bonuses)
- Chess-inspired ranks + sub-ranks (Pawn → Elite Legend)
- Streak tracking
- Energy diagnostics (burnout / attention leak flags)
- Session ledger with delete + JSON backup
- Pure derived state (recalculated dynamically from canonical tasks)
- Dark / light theme

---

## How it works

### Daily loop
1. **ChronoForge** — drag blocks onto the week (or Apply Blueprint on empty days).
2. **Flipodoro** — run a Focus session to the end (don’t Skip if you want Verified).
3. **Log & Rank** — commit verified focus and/or Outbox items → Elo + rank.
4. **Notes** — write with `[[links]]` and `#tags`; optionally link the session to a note.

### Trust model (short version)
| Source | What you get |
|--------|----------------|
| Focus hits 0:00 | Verified path + full verified bonus on commit |
| ChronoForge Outbox only | Base Elo; verified bonus only if Focus was verified that day |
| Skip timer | Advances cycle, **zero** Elo |

Planning is not proof. The timer is the anti-cheat gate.

---

## System Integrity (V3 Hardening)

- **Persistent Verification Tokens:** Uncommitted verified sessions survive tab refreshes and crashes (`localStorage`).
- **Idempotent Commit Guard:** `commitTaskRecord()` blocks double-click Elo farming and token reuse.
- **Anti-Throttle Engine:** `Flipodoro` calculates remaining time via `Date.now()` timestamp deltas + `visibilitychange` focus recovery.
- **Defensive Schema Loader:** Startup migration auto-sanitizes stored JSON under `SCHEMA_VERSION = 3`.
- **Pure Derived State:** Rank, streaks, today's totals, and diagnostics are computed dynamically from `RankDB.tasks`.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause timer |
| `R` | Reset timer |
| `S` | Skip session |
| `F` | Toggle focus mode |
| `Esc` | Exit focus mode / close modals |

*(Ignored while typing in inputs.)*

---

## Quick start

No install. No build. No Python.

1. Clone or download this repo  
2. Open `index.html` in Chrome / Edge / Firefox  
3. Use it  

```bash
git clone https://github.com/The-Python-Dev/RankRiseOS.git
cd RankRiseOS
# then open index.html
```

---

## Project structure

```text
RankRiseOS/
├── index.html              # Shell + all views
├── css/
│   └── app.css             # Themes + layout (light/dark)
├── js/
│   ├── flipodoro.js        # Anti-throttle timer engine + flip clock
│   ├── scoring.js          # Elo, ranks, schema migrations, derived state
│   ├── notes.js            # Vault, wiki-links, tags, MD
│   ├── chronoforge.js      # Blocks, week, goals, outbox state machine
│   └── app.js              # UI coordinator
├── favicon.svg             # Vector tab icon
├── icon.svg                # 512x512 app mark
├── README.md
└── LICENSE                 # GPL-3.0
```

---

## License

**GNU General Public License v3.0 (GPL-3.0)** — See [LICENSE](./LICENSE) for details.

---

## Author

Made by **Om Dautkhani** ([@The-Python-Dev](https://github.com/The-Python-Dev))
```