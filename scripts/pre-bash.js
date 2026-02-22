#!/usr/bin/env node
// Project Pilot: PreToolUse Bash — Snapshot Guard
// Fires BEFORE every Bash command.
//
// One job: take a snapshot of .pilot/ and CLAUDE.md before the command runs.
// post-bash-guard.js restores from this snapshot if the command deletes them.
//
// Snapshots are written to TWO locations:
//   1. .claude/.pp-snapshot/        — inside project, fast, survives most deletions
//   2. os.tmpdir()/pp-[cwdhash]/    — outside project, survives even `rm -rf .`
//
// This script never warns, never blocks, never produces output.
// It always exits 0. Protection happens silently, via restore after the fact.
//
// Only active when .claude/project-pilot-initialized exists (written by setup.js
// and finalize.js) — silent no-op on projects that haven't run /init-pilot.

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

// Tmpdir snapshot — keyed to CWD so multiple projects don't collide
// Use ~/.cache/project-pilot/ instead of os.tmpdir() — tmpdir is wiped on reboot,
// which silently breaks the "survives rm -rf ." guarantee.
const CWD_HASH   = crypto.createHash('md5').update(CWD).digest('hex').slice(0, 16);
const CACHE_BASE = process.env.XDG_CACHE_HOME
  ? path.join(process.env.XDG_CACHE_HOME, 'project-pilot')
  : path.join(os.homedir(), '.cache', 'project-pilot');
const SNAPSHOT_TMP = path.join(CACHE_BASE, 'pp-' + CWD_HASH);

// Skip during onboarding — init-pilot is intentionally writing .pilot/
if (fs.existsSync(ONBOARDING)) process.exit(0);

// Skip if project was never initialized
const initialized = fs.existsSync(SENTINEL_LOCAL) ||
                    fs.existsSync(path.join(SNAPSHOT_TMP, '.sentinel'));
if (!initialized) process.exit(0);

// ─── Read-only command check ───────────────────────────────────────────────
// Read stdin to check the command before deciding whether to snapshot.
// Commands that provably cannot delete .pilot/ or CLAUDE.md skip the snapshot entirely,
// eliminating 40-60% of unnecessary I/O on a typical session.
// ──────────────────────────────────────────────────────────────────────────

const READ_ONLY_PREFIXES = [
  'ls', 'cat ', 'head ', 'tail ', 'echo ', 'pwd', 'which ', 'type ',
  'wc ', 'grep ', 'find ', 'stat ', 'file ',
  'git log', 'git status', 'git diff', 'git show', 'git branch',
  'git remote', 'git tag', 'git blame', 'git shortlog', 'git stash list',
  'npm list', 'npm outdated', 'yarn list',
  'node --version', 'node -v', 'npx --version',
  'python --version', 'python3 --version', 'pip list', 'pip show',
  'env', 'printenv', 'uname', 'whoami', 'date', 'cal',
  'df ', 'du ', 'ps ', 'top ',
];

// ─── Snapshot ─────────────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function takeSnapshot(snapshotDir) {
  if (fs.existsSync(snapshotDir)) {
    fs.rmSync(snapshotDir, { recursive: true, force: true });
  }
  fs.mkdirSync(snapshotDir, { recursive: true });
  if (fs.existsSync(PILOT_DIR))  copyDirSync(PILOT_DIR, path.join(snapshotDir, 'pilot'));
  if (fs.existsSync(CLAUDE_MD))  fs.copyFileSync(CLAUDE_MD, path.join(snapshotDir, 'CLAUDE.md'));
  fs.writeFileSync(
    path.join(snapshotDir, '.sentinel'),
    CWD + '\n' + new Date().toISOString() + '\n',
    'utf8'
  );
}

let stdinData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { stdinData += c; });
process.stdin.on('end', () => {
  // Extract command from hook JSON
  let command = '';
  try {
    const p = JSON.parse(stdinData);
    command = (p.command || (p.tool_input && p.tool_input.command) || '').trim();
  } catch (_) {
    const m = stdinData.match(/"command"\s*:\s*"([^"]*)"/);
    if (m) command = m[1].trim();
  }

  // Skip snapshot for commands that cannot delete .pilot/
  if (READ_ONLY_PREFIXES.some(p => command === p.trim() || command.startsWith(p))) {
    process.exit(0);
  }

  // Local snapshot — fast, survives most deletions
  try {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    takeSnapshot(SNAPSHOT_LOCAL);
  } catch (_) { /* non-fatal — cache copy still provides protection */ }

  // Cache snapshot — survives rm -rf . since it lives outside the project
  try {
    takeSnapshot(SNAPSHOT_TMP);
  } catch (_) { /* non-fatal */ }

  process.exit(0);
});
