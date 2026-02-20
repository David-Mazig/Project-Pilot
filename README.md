# Project Pilot

**Autonomous project intelligence for Claude Code.**

Project Pilot gives Claude a persistent, self-maintaining understanding of your project — decisions, patterns, architecture, and active context — that survives across sessions. Instead of re-explaining your codebase every time, Claude reads from a live intelligence layer it writes and maintains automatically.

### This project is still under development.

---

## Install

In Claude Code, run:

```
/plugin marketplace add David-Mazig/Project-Pilot
/plugin install project-pilot@project-pilot
```

Then in your project:

```
/project-pilot:init-pilot
```

---

## What it does

- **Session memory** — A living `.pilot/` directory tracking what was built, what decisions were made, and what's in progress. Updated automatically at the end of every session.
- **Convention enforcement** — Patterns detected from your code are promoted to conventions and enforced in every future edit.
- **Decision logging** — Every architectural choice recorded with reasoning and revisitation conditions.
- **File protection** — CLAUDE.md and `.pilot/` are guarded against accidental deletion and auto-restored if a command wipes them.
- **Crash recovery** — Unsynthesized changes from crashed sessions are detected and recovered before new work begins.

---

## What gets created

```
your-project/
├── CLAUDE.md                        ← Claude's entry point
├── .pilot/
│   ├── project-brief.md
│   ├── architecture.md
│   ├── active-context.md
│   ├── progress.md
│   ├── patterns.md
│   ├── decisions.md
│   └── internal/
│       ├── change-ledger.log
│       ├── dependency-map.md
│       ├── critical-paths.txt
│       └── synthesis-instructions.md
```

---

## Commands

| Command | What it does |
|---|---|
| `/project-pilot:init-pilot` | Initialize the intelligence layer |
| `/project-pilot:pilot-status` | Current session context and unsynthesized changes |
| `/project-pilot:pilot-dashboard` | Full project overview |

---

## Requirements

- Claude Code
- Node.js 18+

---

## License

MIT
