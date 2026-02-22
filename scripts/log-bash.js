#!/usr/bin/env node
// Project Pilot: PostToolUse Bash logger
// Triggers: Bash
//
// Logs shell commands to the change ledger so synthesis knows about
// file creation via scaffolding, installs, deletions, moves, test runs, etc.

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';
const LEDGER = path.join(PILOT_DIR, 'internal', 'change-ledger.log');

// Skip if pilot isn't set up yet or onboarding is in progress
if (!fs.existsSync(path.join(PILOT_DIR, 'internal'))) process.exit(0);
if (fs.existsSync(path.join(PILOT_DIR, 'internal', '.onboarding'))) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  // Use JSON.parse for correct decoding of escape sequences (same rationale as log-change.js)
  let command;
  try {
    const parsed = JSON.parse(input);
    command = parsed.command
      || (parsed.tool_input && parsed.tool_input.command);
  } catch (_) {
    const match = input.match(/"command"\s*:\s*"([^"]*)"/);
    if (!match) process.exit(0);
    // Unescape JSON \\ -> \ and \" -> "
    command = match[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  }
  if (!command) process.exit(0);

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.appendFileSync(LEDGER, `${timestamp} | BASH | ${command}\n`);

  // Increment pending-count counter
  const COUNTER_FILE = path.join(PILOT_DIR, 'internal', '.pending-count');
  try {
    const current = fs.existsSync(COUNTER_FILE)
      ? parseInt(fs.readFileSync(COUNTER_FILE, 'utf8').trim(), 10) || 0
      : 0;
    fs.writeFileSync(COUNTER_FILE, String(current + 1) + '\n', 'utf8');
  } catch (_) {} // non-fatal

  process.exit(0);
});
