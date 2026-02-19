#!/usr/bin/env node
// Project Pilot: PreCompact hook — Pre-Compaction Snapshot

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';
const LEDGER = path.join(PILOT_DIR, 'internal', 'change-ledger.log');
const LAST_SYNTHESIS = path.join(PILOT_DIR, 'internal', '.last-synthesis');

if (!fs.existsSync(PILOT_DIR) || !fs.existsSync(LEDGER)) process.exit(0);
if (fs.existsSync(path.join(PILOT_DIR, 'internal', '.onboarding'))) process.exit(0);

const ledgerLines = fs.readFileSync(LEDGER, 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'));

let unsynthCount;
if (fs.existsSync(LAST_SYNTHESIS)) {
  const lastTime = fs.readFileSync(LAST_SYNTHESIS, 'utf8').trim();
  unsynthCount = ledgerLines.filter(l => {
    const lineTime = l.split(' | ')[0];
    return lineTime > lastTime;
  }).length;
} else {
  unsynthCount = ledgerLines.length;
}

if (unsynthCount > 0) {
  process.stderr.write(
    `Compacting with ${unsynthCount} unsynthesized change(s). Will recover after compaction.\n`
  );
}

process.exit(0);
