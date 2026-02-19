# Project Pilot

**Autonomous project intelligence for Claude Code.**

Project Pilot gives Claude a persistent, self-maintaining understanding of your project — decisions, patterns, architecture, and active context — that survives across sessions. Instead of re-explaining your codebase every time, Claude reads from a live intelligence layer it writes and maintains automatically.

---

## What it does

When you install Project Pilot, Claude gains:

- **Session memory** — A living `.pilot/` directory that tracks what was built, what decisions were made, and what's in progress. Updated automatically at the end of every session.
- **Convention enforcement** — Patterns are detected from your code, promoted to conventions, and enforced in every future edit. Claude won't silently deviate.
- **Decision logging** — Every architectural choice is recorded with reasoning and revisitation conditions. Future sessions don't repeat past debates.
- **File protection** — CLAUDE.md and `.pilot/` are guarded against accidental deletion. If a command would wipe them, they're automatically restored before Claude continues.
- **Crash recovery** — If a session ends unexpectedly, unsynthesized changes are detected and synthesized before new work begins.

---

## Install

### Step 1 — Add the marketplace

In Claude Code, run:

```
/plugin marketplace add David-Mazig/Project-Pilot
```

### Step 2 — Install the plugin

```
/plugin install project-pilot@project-pilot
```

### Step 3 — Initialize your project

Navigate to your project directory and run:

```
/project-pilot:init-pilot
```

That's it. Claude will scan your project, build the intelligence layer, and be ready to work.

---

## What gets created

```
your-project/
├── CLAUDE.md                        ← Claude's entry point (read on every session)
├── .pilot/
│   ├── project-brief.md             ← What the project is, scope, success criteria
│   ├── architecture.md              ← Tech stack, decisions, security invariants
│   ├── active-context.md            ← What's being worked on right now
│   ├── progress.md                  ← Feature states with verification status
│   ├── patterns.md                  ← Conventions: Seed → Harvest → Enforce lifecycle
│   ├── decisions.md                 ← Decision log with reasoning and revisit conditions
│   └── internal/
│       ├── change-ledger.log        ← Every file edit and bash command, timestamped
│       ├── dependency-map.md        ← Inter-module import graph
│       ├── critical-paths.txt       ← Security-sensitive paths that trigger warnings
│       └── synthesis-instructions.md
```

---

## How it works

**Every session**, Project Pilot:

1. Reads the intelligence layer into Claude's context via CLAUDE.md
2. Warns if files are stale (>48h) or if there are unsynthesized changes from a crash
3. Logs every file edit and bash command to the change ledger in real time
4. Alerts Claude when security-critical files are modified
5. Snapshots `.pilot/` and `CLAUDE.md` before every bash command
6. Restores them automatically if a command accidentally deletes them

**At the end of every session**, Claude synthesizes the change ledger into:
- Updated active context and progress states
- Promoted conventions (if a pattern appeared 3+ times)
- New decision log entries
- Module context files for complex directories

---

## Commands

| Command | What it does |
|---|---|
| `/project-pilot:init-pilot` | Initialize the intelligence layer for a new project |
| `/project-pilot:pilot-status` | Show current session context, unsynthesized changes, and file staleness |
| `/project-pilot:pilot-dashboard` | Full project overview: progress, active decisions, recent changes |

---

## Convention lifecycle

Patterns move through three stages automatically:

```
Seed  →  Harvest  →  Confirmed
```

- **Seed** — manually declared, authoritative, always enforced
- **Harvest** — detected from 3+ files, recommended, noted gently when deviated from
- **Confirmed** — 5 sessions with no overrides, locked in, strictly enforced

You never have to manage this manually.

---

## File protection

Project Pilot guards against accidental deletion of its intelligence files. If a bash command would delete `CLAUDE.md` or `.pilot/`, it snapshots before the command, detects the deletion after, restores automatically, and tells you what happened.

If **you intentionally want** to delete these files, just ask naturally. Claude handles the bypass protocol automatically.

---

## Requirements

- Claude Code
- Node.js 18+

---

## License

MIT
