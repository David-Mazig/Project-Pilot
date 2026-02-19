#!/usr/bin/env node
// Project Pilot: PostToolUse Bash integrity guard + auto-restore
// Fires AFTER every Bash command.
//
// Checks whether .pilot/ and CLAUDE.md still exist.
// If either is missing, restores from the pre-command snapshot:
//   1. Try .claude/.pp-snapshot/         (local, fast)
//   2. Fall back to os.tmpdir()/pp-[hash]/ (survives rm -rf .)
//
// Sentinel detection also uses both locations — so even a full CWD wipe
// that deletes .claude/ is detected and recovered from.

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

const CWD            = process.cwd();
const PILOT_DIR      = path.join(CWD, '.pilot');
const CLAUDE_MD      = path.join(CWD, 'CLAUDE.md');
const CLAUDE_DIR     = path.join(CWD, '.claude');
const SNAPSHOT_LOCAL = path.join(CLAUDE_DIR, '.pp-snapshot');
const SENTINEL_LOCAL = path.join(CLAUDE_DIR, 'project-pilot-initialized');
const ONBOARDING     = path.join(PILOT_DIR, 'internal', '.onboarding');

const CWD_HASH     = crypto.createHash('md5').update(CWD).digest('hex').slice(0, 16);
const SNAPSHOT_TMP = path.join(os.tmpdir(), 'pp-' + CWD_HASH);
const SENTINEL_TMP = path.join(SNAPSHOT_TMP, '.sentinel');

// Skip during onboarding
if (fs.existsSync(ONBOARDING)) process.exit(0);

// Skip if user explicitly signalled intentional deletion — the .pp-no-guard flag
// is written by Claude before performing a user-requested deletion of pilot files.
// IMPORTANT: flag lives in .claude/, NOT .pilot/internal/ — if the user is deleting
// .pilot/, the flag must survive that deletion to be readable by this guard.
const NO_GUARD = path.join(CLAUDE_DIR, '.pp-no-guard');
if (fs.existsSync(NO_GUARD)) {
  try { fs.unlinkSync(NO_GUARD); } catch (_) {}  // consume the flag
  // Clear initialized state so the guard exits silently on every subsequent command.
  // Without this, initialized=true persists and the guard fires a misleading nudge
  // on every bash command until the developer runs /init-pilot again.
  try { fs.unlinkSync(SENTINEL_LOCAL); } catch (_) {}
  try { fs.rmSync(SNAPSHOT_TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}

// Check sentinel in EITHER location — survives .claude/ deletion
const initialized = fs.existsSync(SENTINEL_LOCAL) || fs.existsSync(SENTINEL_TMP);
if (!initialized) process.exit(0);

// ─── Check what is missing ─────────────────────────────────────────────────
const missingPilot  = !fs.existsSync(PILOT_DIR);
const missingClaude = !fs.existsSync(CLAUDE_MD);
if (!missingPilot && !missingClaude) process.exit(0);

// ─── Restore ───────────────────────────────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function tryRestore(snapshotDir, missingP, missingC) {
  const results = { restored: [], failed: [] };
  if (!fs.existsSync(snapshotDir)) return results;

  if (missingP) {
    const src = path.join(snapshotDir, 'pilot');
    if (fs.existsSync(src)) {
      try { copyDirSync(src, PILOT_DIR); results.restored.push('.pilot/'); }
      catch (e) { results.failed.push('.pilot/ (error: ' + e.message + ')'); }
    } else {
      results.failed.push('.pilot/ (not in this snapshot)');
    }
  }

  if (missingC) {
    const src = path.join(snapshotDir, 'CLAUDE.md');
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, CLAUDE_MD); results.restored.push('CLAUDE.md'); }
      catch (e) { results.failed.push('CLAUDE.md (error: ' + e.message + ')'); }
    } else {
      results.failed.push('CLAUDE.md (not in this snapshot)');
    }
  }

  return results;
}

// Returns true if a snapshot dir contained the SPECIFIC items that are now missing.
// This distinguishes "file was deleted mid-session" from "file was never there".
// e.g. if only CLAUDE.md is missing, we only check whether the snapshot had CLAUDE.md —
// the presence of .pilot/ in the snapshot is irrelevant and must not trigger a false alert.
function snapshotHadMissingContent(snapshotDir, checkPilot, checkClaude) {
  if (!fs.existsSync(snapshotDir)) return false;
  if (checkPilot  && fs.existsSync(path.join(snapshotDir, 'pilot')))     return true;
  if (checkClaude && fs.existsSync(path.join(snapshotDir, 'CLAUDE.md'))) return true;
  return false;
}

// Try local snapshot first, fall back to tmpdir
let restored = [];
let failed   = [];

const localResult = tryRestore(SNAPSHOT_LOCAL, missingPilot, missingClaude);
restored = localResult.restored;

// For anything not yet restored, try tmpdir
const stillMissingPilot  = missingPilot  && !restored.includes('.pilot/');
const stillMissingClaude = missingClaude && !restored.includes('CLAUDE.md');

if (stillMissingPilot || stillMissingClaude) {
  const tmpResult = tryRestore(SNAPSHOT_TMP, stillMissingPilot, stillMissingClaude);
  restored = restored.concat(tmpResult.restored);
  // Collect failures: items still missing after both snapshots tried
  const finalMissingPilot  = stillMissingPilot  && !tmpResult.restored.includes('.pilot/');
  const finalMissingClaude = stillMissingClaude && !tmpResult.restored.includes('CLAUDE.md');
  if (finalMissingPilot)  failed.push('.pilot/');
  if (finalMissingClaude) failed.push('CLAUDE.md');
} else {
  failed = localResult.failed;
}

// ─── Report ────────────────────────────────────────────────────────────────
const allRestored = restored.length > 0 && failed.length === 0;
const partialFail = restored.length > 0 && failed.length > 0;
const totalFail   = restored.length === 0;

// Did either snapshot contain the specific items that are now missing?
// If yes: accidental deletion — we attempted restore (results above).
// If no: snapshots were empty when those files went missing — unrecoverable loss.
const hadContent = snapshotHadMissingContent(SNAPSHOT_LOCAL, missingPilot, missingClaude) ||
                   snapshotHadMissingContent(SNAPSHOT_TMP,   missingPilot, missingClaude);

// totalFail + !hadContent: files missing, snapshots empty — unrecoverable.
// This is only reachable when initialized=true (we exit early above if !initialized),
// so this is never a "fresh install" — it's always a real data loss event.
if (totalFail && !hadContent) {
  const missing = [];
  if (missingPilot)  missing.push('.pilot/');
  if (missingClaude) missing.push('CLAUDE.md');
  process.stderr.write(
    '\n' +
    '\u2554' + '\u2550'.repeat(63) + '\u2557\n' +
    '\u2551  Project Pilot \u2014 Files Missing (Cannot Restore)         \u2551\n' +
    '\u255a' + '\u2550'.repeat(63) + '\u255d\n' +
    '\n' +
    '  Missing: ' + missing.join(', ') + '\n' +
    '  Snapshots were empty \u2014 automatic restore is not possible.\n' +
    '\n' +
    '  STOP. Tell the developer:\n' +
    '    "Project Pilot files are missing and could not be restored.\n' +
    '     Run /project-pilot:init-pilot to regenerate the intelligence layer.\n' +
    '     Your codebase is intact \u2014 only the intelligence layer was lost."\n' +
    '  Do NOT continue working until the developer confirms what to do.\n' +
    '\n'
  );
  process.exit(2); // blocking — requires developer action
}

const out = [
  '',
  '\u2554' + '\u2550'.repeat(63) + '\u2557',
];

if (allRestored) {
  out.push('\u2551  Project Pilot \u2014 Files Restored Automatically           \u2551');
} else {
  out.push('\u2551  Project Pilot \u2014 Integrity Alert (Action Required)       \u2551');
}
out.push('\u255a' + '\u2550'.repeat(63) + '\u255d');
out.push('');
out.push('  The last command deleted Project Pilot file(s).');
out.push('');

if (restored.length > 0) {
  out.push('  \u2705 Automatically restored:');
  restored.forEach(f => out.push('     \u2022 ' + f));
  out.push('');
  if (allRestored) {
    out.push('  The intelligence layer is intact. Your project data is safe.');
    out.push('  Tell the developer what happened. Suggest running any scaffolding');
    out.push('  tools in a clean, empty directory to avoid future conflicts.');
  }
}

if (failed.length > 0) {
  out.push('  \u26a0  Could not restore (both snapshots exhausted or missing):');
  failed.forEach(f => out.push('     \u2022 ' + f));
  out.push('');
  out.push('  STOP. Tell the developer:');
  out.push('    "Project Pilot data was deleted and could not be automatically');
  out.push('     restored. Run /project-pilot:init-pilot to regenerate it.');
  out.push('     Your codebase is intact \u2014 only the intelligence layer was lost."');
  out.push('  Do NOT continue working until the developer confirms what to do.');
}

out.push('');
process.stderr.write(out.join('\n'));
if (allRestored) {
  process.exit(0); // fully recovered — not an error, don't show "blocking error"
} else {
  process.exit(2); // partial or total failure — block and require developer action
}
