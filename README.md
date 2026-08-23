# ♔ RankRise OS

A modular, gamified study operating system — focus timer, second brain, weekly planner, and Elo progression in one local-first app.

**Version** · **Platform** · **Stack** · **License**  
v2.0 · Web (static) · Vanilla JS · GPL-3.0

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

No accounts. No cloud. Open `index.html` and go.

---

## Features

### 🍅 Flipodoro (Execution)
- Focus, Short Break, Long Break sessions
- Flip-clock display
- Session dots / cycle before long break
- Pause, resume, reset, skip
- Focus mode (fullscreen)
- Wall-clock style tick loop
- Keyboard shortcuts (Space, R, S, F, Esc)
- Settings for durations + cycle length
- **Verified Focus** unlocks full Elo bonus on commit

### 🧠 NeuronNotes (Knowledge)
- Clean markdown editor + preview
- Bidirectional `[[wiki-links]]` (click to jump / create)
- `#hashtag` system with sidebar filter
- Backlinks panel
- Linked study sessions per note
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
- Link commits to NeuronNotes
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
Project structure
text

RankRiseOS/
├── index.html              # Shell + all views
├── css/
│   └── app.css             # Themes + layout (light/dark)
├── js/
│   ├── flipodoro.js        # Timer engine + flip clock
│   ├── scoring.js          # Elo, ranks, RankDB
│   ├── notes.js            # Vault, wiki-links, tags, MD
│   ├── chronoforge.js      # Blocks, week, goals, outbox
│   └── app.js              # UI coordinator
├── README.md
└── LICENSE                 # GPL-3.0
Architecture highlights
100% separation of domains — timer, notes, forge, scoring don’t own each other’s rules; app.js only wires UI
Local-first — localStorage for RankDB, vault, forge, outbox, theme, timer config
Outbox bridge — ChronoForge → rankrise_outbox_v1 → Log commit (no instant free Elo)
Soft blueprints — empty days only; your manual week stays yours
Export-friendly notes — plain .md compatible with desktop NeuronNotes / Obsidian-style workflows
No dependencies — vanilla JS, runs from file://
Your data
Data	Where
Elo / ledger / streak	localStorage → rankrise_data_v2
Notes vault	localStorage → neuronnotes_vault_v1
ChronoForge blocks / days / goals	chronoforge_*_v1
Outbox queue	rankrise_outbox_v1
Theme / timer settings	rankrise_theme, rankrise_timer_cfg
Backup ledger: Log → Backup JSON
Backup notes: Notes → Export .md
Reset Elo: Log → Reset (does not wipe notes/forge unless you clear site data)
No cloud. No account. No tracking.

Related projects
Flipodoro — desktop flip-clock Pomodoro
NeuronNotes — desktop markdown second brain
RankRise OS ports their ideas into one browser OS and adds ChronoForge + Elo.

Known issues (v2.0)
Verification unlock (pendingVerified) is in-memory — refresh before commit can drop a finished Focus unlock
Outbox / commit not fully idempotent under extreme double-click races
Timer interval can drift if the tab is heavily background-throttled
Note↔session links still partly title-sensitive in older paths
No automated test suite yet
Month view for ChronoForge not shipped (week only)
All of the above are v3 targets (integrity, not feature spam).

Roadmap
v2.0 — Ecosystem (current)
 Flipodoro tab
 NeuronNotes tab
 ChronoForge tab (blocks, DnD week, goals, outbox)
 RankRise scoring + ledger
 Dark / light theme
 Modular multi-file layout
v3.0 — Integrity (“fewer ways for the system to lie”)
 Persistent verification state (survive refresh)
 Idempotent commits (no double Elo)
 Timestamp-based timer (anti-throttle)
 crypto.randomUUID() + canonical IDs everywhere
 Explicit lifecycles: planned → done → queued → committed
 Defensive loaders + schema version / v2 migration
 Attack checklist + regression tests
v4.0 — (ideas parked until v3 is solid)
Your call — month view, desktop vault sync, analytics, PWA, etc.
Built with
HTML5 / CSS3 (custom properties, light + dark)
Vanilla JavaScript (ES6+)
Web Audio API (completion / rank-up cues)
localStorage
No React. No build step. No npm required to run.

License
GNU General Public License v3.0 (GPL-3.0)

You can use, study, and modify this software. If you distribute a modified version, it must also be open source under GPL-3.0.
See LICENSE and https://www.gnu.org/licenses/gpl-3.0.html

Author
Made by Om Dautkhani (@The-Python-Dev)

Flipodoro · NeuronNotes · RankRise OS — one ecosystem, built in public.