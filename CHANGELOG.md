# Changelog

All notable changes to Project Pilot are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.4] — 2026-02-22

### Fixed
- **Parallel dispatch regression** (`init-pilot.md`) — sub-agents were being dispatched sequentially instead of in parallel. Root causes: a git strategy question was positioned mid-flow interrupting the batch, and tasks were numbered Task 1–5 (LLMs treat numbered steps as ordered sequences). Fixed by moving the git question to Phase 2 where all other questions live, renaming tasks to File A–E, and adding an explicit COMMON MISTAKE / Correct example block showing the exact dispatch pattern required.

### Added
- **Marketplace compliance** — added `.claude-plugin/marketplace.json`, `README.md` with installation instructions, and YAML frontmatter `description:` fields to all three command files. Required for `/plugin marketplace add` to function.
- **`plugin.json` improvements** — added `repository` and `keywords` fields for marketplace discoverability.

### Changed
- Bumped version from 1.4.3 → 1.4.4 in `plugin.json` and `marketplace.json`.

---

## [1.4.3] — 2026-02-22

### Fixed
- `hooks.json` had an undocumented top-level `description` field not in the Claude Code plugin spec — removed.
- `post-test.js` warning paths now emit `⚠️` and exit 0 (never blocking) when test output is empty or format is unrecognised.

### Added
- Synthesis weight routing: `session-start.js` now recommends `LIGHT`, `MEDIUM`, or `HEAVY` synthesis instructions based on pending change count, keeping token cost proportional to session size.
- Split synthesis templates: `synthesis-light.md`, `synthesis-medium.md`, `synthesis-heavy.md` — lighter sessions no longer load the full heavy instruction set.
- `.pending-count` O(1) counter in `log-change.js` and `log-bash.js` — avoids full ledger scan on every session start.

---

## [1.4.2] — Prior release

- Windows path normalisation in `log-change.js`: switched from regex to `JSON.parse` for `file_path` extraction, fixing backslash handling on Windows (`src\\auth\\handler.ts` → `src/auth/handler.ts` in ledger).
- Template hash-guarded sync in `session-start.js`: synthesis-instructions.md and task-execution.md are now updated from plugin templates only when the developer hasn't modified them, preserving customisations across upgrades.
- Dual-location snapshots in `pre-bash.js`: added `~/.cache/project-pilot/` as a secondary snapshot location that survives `rm -rf .` on the project directory.

---

## [1.3.x] — Earlier releases

Initial public versions. Core hook architecture, ledger system, synthesis instructions, critical path enforcement, session-start recovery detection.
