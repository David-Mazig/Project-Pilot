#!/usr/bin/env node
// Project Pilot: Stop hook — Session Synthesis Trigger
// Outputs a short trigger message. Full instructions are in
// .pilot/internal/synthesis-instructions.md (Claude reads that file).

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';
const LEDGER = path.join(PILOT_DIR, 'internal', 'change-ledger.log');
const LAST_SYNTHESIS = path.join(PILOT_DIR, 'internal', '.last-synthesis');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  // Guard against infinite loops
  if (/"stop_hook_active"\s*:\s*true/.test(input)) process.exit(0);

  if (!fs.existsSync(PILOT_DIR)) process.exit(0);
  if (!fs.existsSync(LEDGER)) process.exit(0);

  // Guard: skip synthesis during onboarding
  const onboardingFlag = path.join(PILOT_DIR, 'internal', '.onboarding');
  if (fs.existsSync(onboardingFlag)) process.exit(0);

  // Get changes since last synthesis
  const ledgerLines = fs.readFileSync(LEDGER, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'));

  let newChanges;
  if (fs.existsSync(LAST_SYNTHESIS)) {
    const lastTime = fs.readFileSync(LAST_SYNTHESIS, 'utf8').trim();
    newChanges = ledgerLines.filter(l => {
      const lineTime = l.split(' | ')[0];
      return lineTime > lastTime;
    });
  } else {
    newChanges = ledgerLines;
  }

  if (newChanges.length === 0) process.exit(0);

  const changeCount = newChanges.length;

  // Determine session weight
  let sessionWeight = 'light';
  if (changeCount >= 6) sessionWeight = 'medium';
  if (changeCount >= 16) sessionWeight = 'heavy';

  // Track synthesis count
  const countFile = path.join(PILOT_DIR, 'internal', '.synthesis-count');
  let synthesisCount = 1;
  if (fs.existsSync(countFile)) {
    const parsed = parseInt(fs.readFileSync(countFile, 'utf8').trim(), 10);
    synthesisCount = isNaN(parsed) ? 1 : parsed + 1;
  }
  fs.writeFileSync(countFile, String(synthesisCount));

  if (synthesisCount % 5 === 0) sessionWeight = 'heavy';

  // Short trigger — Claude reads the full instructions from the file.
  // The .last-synthesis stamp instruction is included here (not just in synthesis-instructions.md)
  // so that existing projects upgrading from older versions also get the correct behaviour.
  process.stderr.write(
    `Session synthesis #${synthesisCount}: ${changeCount} change(s), weight: ${sessionWeight}. ` +
    `Read .pilot/internal/synthesis-instructions.md and update pilot files accordingly. ` +
    `IMPORTANT: as the absolute final step — after all files are written — write the current UTC timestamp ` +
    `(format: 2025-01-15T10:30:00Z) to .pilot/internal/.last-synthesis using the Write tool.\n`
  );

  process.exit(2);
});
