#!/usr/bin/env node
// Project Pilot: Cross-platform finalize — replaces Step 3 bash
// Logs created files to the change ledger, stamps last-synthesis, removes .onboarding.
// Called by /init-pilot Phase 4 Step 3.
// Works on Windows (cmd/pwsh/git-bash), macOS, and Linux.

const fs   = require('fs');
const path = require('path');

const CWD = process.cwd();

function rel(p) { return path.join(CWD, p); }

// ISO timestamp without milliseconds
const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// Files that should have been created by sub-agents
const EXPECTED = [
  '.pilot/project-brief.md',
  '.pilot/architecture.md',
  '.pilot/active-context.md',
  '.pilot/progress.md',
  '.pilot/patterns.md',
  '.pilot/decisions.md',
  '.pilot/internal/critical-paths.txt',
  '.pilot/internal/dependency-map.md',
  'CLAUDE.md',
];

// Also log any module files created during Tier 2 onboarding
const modulesDir = rel('.pilot/modules');
if (fs.existsSync(modulesDir)) {
  fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('.md'))
    .forEach(f => EXPECTED.push(`.pilot/modules/${f}`));
}

// Log whichever exist
const entries = EXPECTED
  .filter(f => fs.existsSync(rel(f)))
  .map(f => `${ts} | CREATED | ${f}`)
  .join('\n');

if (entries) {
  const ledger = rel('.pilot/internal/change-ledger.log');
  fs.appendFileSync(ledger, entries + '\n', 'utf8');
}

// Stamp last-synthesis
fs.writeFileSync(rel('.pilot/internal/.last-synthesis'), ts + '\n', 'utf8');

// Remove onboarding flag — re-enables all hooks from this point forward
try { fs.unlinkSync(rel('.pilot/internal/.onboarding')); } catch (_) {}

// Update sentinel timestamp — marks the most recent completed initialization
const sentinelDir  = path.join(CWD, '.claude');
const sentinelFile = path.join(sentinelDir, 'project-pilot-initialized');
try {
  fs.mkdirSync(sentinelDir, { recursive: true });
  fs.writeFileSync(sentinelFile, ts + '\n', 'utf8');
} catch (_) {} // non-fatal

process.stdout.write('Project Pilot initialized.\n');
