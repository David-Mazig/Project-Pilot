![Project Pilot](Project%20Pilot.png)

# Project Pilot — User Manual
Version 1.4.4 | 2026-02-22

---

## Overview

Project Pilot is a Claude Code plugin that gives Claude a persistent memory layer for your project. It captures your architecture decisions, coding conventions, and current progress into a `.pilot/` folder. Every new session starts with full context — no re-explaining, no re-discovering.

It works silently in the background. You code normally. Project Pilot tracks what changes, updates its knowledge, and warns you before you accidentally break something important.

---

## Getting Started

### Requirements

- **Claude Code** — any recent version
- **Node.js ≥ 18** — must be available on your system PATH

### Installation

Run these two commands inside Claude Code:

```
/plugin marketplace add David-Mazig/Project-Pilot
/plugin install project-pilot@Project-Pilot
```

### Verify the Installation

1. Restart Claude Code after installation.
2. Run `/help`.
3. Confirm you see these three commands listed:
   - `/init-pilot`
   - `/project-pilot:pilot-dashboard`
   - `/project-pilot:pilot-status`


---

## Setting Up a Project

### Initializing Project Pilot

**What it does:** Runs a guided onboarding conversation, scans your project, and creates the `.pilot/` intelligence folder with all context files.

**How to use it:**
1. Open your project in Claude Code.
2. Run `/init-pilot`.
3. Answer the questions Claude asks — one at a time.
4. Confirm the summary when prompted.
5. Wait for all files to be generated.

📸 SCREENSHOT: Claude asking "What does this project do, who is it for, and what are you working on right now?"

> 💡 Tip: If you paste a description of your project (50+ words) before running `/init-pilot`, it activates **Fast Mode**. Claude scans the project, proposes everything in one message, and asks for a single confirmation instead of asking questions one by one.

#### What to expect

**Project size determines onboarding depth:**

- **Small projects** (fewer than 20 source files): 3 questions, roughly 2 minutes.
- **Standard projects** (20+ files, multiple concerns): 5 stages covering architecture, conventions, current state, and sensitive areas. Roughly 10–15 minutes.

After answering all questions, Claude generates your intelligence files in parallel. You will see a confirmation message when setup is complete.

**If something goes wrong:** Onboarding can be re-run. The `.onboarding` flag is automatically cleared when setup finishes. If setup was interrupted, run `/init-pilot` again.

---

## What Gets Created

After `/init-pilot` completes, your project contains:

```
.pilot/
├── project-brief.md        ← What the project is and who it's for
├── architecture.md         ← Tech stack, decisions, and invariants
├── decisions.md            ← Architectural decisions with reasoning
├── patterns.md             ← Your coding conventions
├── active-context.md       ← Current work and next steps
├── progress.md             ← Feature status tracking
├── modules/                ← Per-module context (larger projects)
└── internal/               ← System files (ledger, synthesis instructions)

CLAUDE.md                   ← Root rules file Claude reads automatically
```

These files are yours. Edit them freely. Project Pilot updates them automatically after sessions.

> 💡 Tip: During setup, you decide whether `.pilot/` is committed to git. **Yes** = the whole team shares context. **No** = the folder stays local to your machine.

---

## During a Session

### How Tracking Works

**What it does:** Hooks run silently after every file edit and bash command. They log changes to an internal ledger. No action required from you.

**What gets tracked automatically:**
1. Every file you edit or create (via Claude Code tools).
2. Every bash command Claude runs.
3. Test results from `npm test`, `pytest`, `go test`, and similar.
4. Snapshots before destructive commands (protection against accidental overwrites).

> 💡 Tip: You never interact with hooks directly. If a hook produces a warning, it appears inline in the Claude Code output. Hooks always exit without blocking, except when a **critical path invariant** is violated.

### Critical Path Protection

**What it does:** Guards specific files or directories you marked as sensitive during setup. Claude is warned the moment it touches a protected file.

**How to use it:**
1. During `/init-pilot` setup, name any files that require your approval before changes.
2. Project Pilot adds them to `.pilot/internal/critical-paths.txt`.
3. When Claude edits a protected file, a warning fires immediately.

#### What to expect

The warning is informational — it does not block the edit. It surfaces the invariant so Claude can decide whether to proceed or stop and consult you.

To add or edit critical paths after setup, open `.pilot/internal/critical-paths.txt` directly. Each line follows this format:

```
auth/ | All auth routes must validate credentials before proceeding
```

---

## Synthesis

### What Synthesis Does

**What it does:** After a meaningful block of work, Claude updates all `.pilot/` files to reflect what changed — new features, decisions made, conventions observed, test results verified.

**How to use it:**
1. Work normally in a session.
2. When a task is complete, ask Claude: *"synthesise the session"*.
3. Claude reads the change ledger, updates `.pilot/` files, and reports what changed.

📸 SCREENSHOT: Claude summarising synthesis: which features moved to "Verified", which conventions were promoted, which decisions were updated.

> 💡 Tip: Synthesis also triggers automatically after roughly 8 or more changes in a session. You can always trigger it manually at any point.

#### Synthesis weight

Project Pilot picks the right depth automatically:

| Label | When | What it does |
|---|---|---|
| **LIGHT** | Few changes | Updates active-context and progress only |
| **MEDIUM** | Moderate session | Includes convention and decision review |
| **HEAVY** | Large session | Full review — all files, all modules |

You will see the recommended weight at the start of each session.

### Test Result Integration

**What it does:** After test commands run, Project Pilot captures the results. Synthesis uses them to automatically promote or flag features in `progress.md`.

**How to use it:**
1. Run your tests normally (`npm test`, `pytest`, etc.).
2. Project Pilot captures the output automatically.
3. After synthesis, features that passed tests move to **Verified (tested DATE)**. Failing tests are flagged.

#### What to expect

No manual input required. If the test output format is unrecognised, a warning appears but nothing is blocked.

---

## Commands

### Quick Status: `/project-pilot:pilot-status`

**What it does:** Shows a concise snapshot of the project right now — current work, feature states, convention health, recent changes.

**How to use it:**
1. Run `/project-pilot:pilot-status` at any point in a session.
2. Read the summary.
3. No files are modified.

#### What to expect

The status report includes:

- **Currently Working On** — from `active-context.md`
- **Feature Status** — counts of Verified, Unverified, In Progress, and Issues
- **Convention Health** — how many conventions are established vs. still under observation
- **Next Up** — what to work on next, broken into sub-tasks if it spans multiple files
- **Recent Changes** — summary from the change ledger
- **Open Decisions** — decisions approaching their revisit conditions
- **Known Issues** — tech debt and blockers

If `.pilot/` does not exist, the command tells you to run `/init-pilot` first.

---

### Full Re-Orientation: `/project-pilot:pilot-dashboard`

**What it does:** Reads every `.pilot/` file and walks you through the full project state — ideal when returning after a break.

**How to use it:**
1. Run `/project-pilot:pilot-dashboard` at the start of a session.
2. Read through all seven sections of the dashboard.
3. Tell Claude where to dive deeper, or pick up where you left off.

#### Dashboard sections

| Section | What it shows |
|---|---|
| **Project Refresher** | What the project is, who it's for, what's out of scope |
| **Where You Left Off** | Last active work, recent completions, planned next steps |
| **Architecture & Key Decisions** | Active decisions with reasoning; any approaching revisit conditions |
| **The Rules You Set** | Established conventions with confidence levels; critical paths; module-specific rules |
| **The Danger Zones** | Past failures, abandoned approaches, fragile dependencies, known tech debt |
| **Current Health Check** | Comparison of pilot files against actual codebase; flags discrepancies |
| **Suggested Re-Entry Point** | Where to start — broken into sub-tasks if it spans multiple files |

> 💡 Tip: The "Danger Zones" section prevents the most expensive returning-developer mistake: re-attempting something that already failed. Do not skip it.

#### What to expect

If `active-context.md` is very old, the dashboard flags it as potentially stale and suggests verifying against the actual codebase. If `.pilot/` is missing, you are directed to run `/init-pilot` first.

---

## Settings & Configuration

### Editing Intelligence Files Directly

All `.pilot/` files are plain Markdown. You can open and edit them at any time. Changes you make are respected — Project Pilot does not overwrite manual edits during synthesis unless a template update is detected and your version is unchanged.

### Customising Synthesis Instructions

The synthesis behaviour is controlled by:

```
.pilot/internal/synthesis-instructions.md
.pilot/internal/synthesis-light.md
.pilot/internal/synthesis-medium.md
.pilot/internal/synthesis-heavy.md
```

Edit these to adjust what Claude focuses on during synthesis. Template updates from plugin upgrades only apply if your version matches the original template.

### Managing Critical Paths

Open `.pilot/internal/critical-paths.txt` and add or remove lines. Format:

```
PATTERN | INVARIANT
```

Example:

```
auth/ | All auth routes must validate credentials before proceeding
config.js | Never hardcode secrets — use environment variables
```

### Committing `.pilot/` to Git

This is decided during `/init-pilot`. To change it afterwards:

- **To stop tracking:** Add a `.pilot/.gitignore` that ignores everything except itself.
- **To start tracking:** Remove the `.pilot/.gitignore` and add `.pilot/` to git normally.

---

## Uninstalling

### Remove the Plugin

Run inside Claude Code:

```
/plugin uninstall project-pilot
```

### Clean Up the Snapshot Cache

The pre-bash snapshot cache is stored outside the project so it survives `rm -rf .`.

**macOS / Linux:**
```bash
rm -rf ~/.cache/project-pilot
```

**Windows:**
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\project-pilot"
```

### Remove Project Files

The `.pilot/` folder and `CLAUDE.md` in each project are **not removed automatically**. Delete them manually if you no longer want them:

```bash
rm -rf .pilot/ CLAUDE.md
```

> 💡 Tip: Before deleting `CLAUDE.md` or any `.pilot/` file through Claude, the guard requires you to first write `bypass` to `.claude/.pp-no-guard`. Without this step, the guard restores the file immediately and the deletion silently fails. Deleting files directly from your file system bypasses this guard entirely.

---

## Troubleshooting

### `/help` does not show Project Pilot commands

1. Confirm installation completed without errors.
2. Restart Claude Code fully.
3. Re-run the install commands:
   ```
   /plugin marketplace add David-Mazig/Project-Pilot
   /plugin install project-pilot@Project-Pilot
   ```

### Hooks produce unexpected warnings at session start

The session-start hook detects recovery needs, stale context, and pending unsynced changes. These are informational. If a warning refers to a large number of unsynced changes, run synthesis before continuing: ask Claude *"synthesise the session"*.

### Critical path warning fires on an unexpected file

Open `.pilot/internal/critical-paths.txt` and review the patterns. Patterns match by prefix — a pattern of `auth/` matches any file path containing `auth/`. Narrow the pattern if it is too broad.

### Synthesis marks a feature as "Implemented (Unverified)" instead of "Verified"

This means tests did not run, or the test output was not captured. Run your test suite after implementation, then trigger synthesis. Project Pilot updates the status automatically from the test results.

### `.pilot/` files are missing or empty after `/init-pilot`

If onboarding was interrupted, re-run `/init-pilot`. The command is safe to run again on an existing project — it detects the existing scaffold and guides you through filling gaps.

### Windows path issues in the change ledger

If you see backslash paths in `change-ledger.log` (e.g., `src\\auth\\handler.ts`), this is a display artefact from older versions. Version 1.4.2 and later normalise all paths to forward slashes automatically.

---