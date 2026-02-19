#!/usr/bin/env node
// Project Pilot: PostToolUse change logger + critical path guard
// Triggers: Write, Edit, MultiEdit
//
// 1. Logs file edits to .pilot/internal/change-ledger.log for session synthesis
// 2. Checks if edited file matches a critical path pattern — if so, outputs
//    an immediate warning to Claude via stderr (exit code 2) so it can
//    self-correct mid-session without waiting for the Stop hook.

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';
const LEDGER = path.join(PILOT_DIR, 'internal', 'change-ledger.log');
const CRITICAL_PATHS = path.join(PILOT_DIR, 'internal', 'critical-paths.txt');

// Skip if pilot isn't set up yet or onboarding is in progress
if (!fs.existsSync(path.join(PILOT_DIR, 'internal'))) process.exit(0);
if (fs.existsSync(path.join(PILOT_DIR, 'internal', '.onboarding'))) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  // Extract file_path from hook JSON input.
  //
  // IMPORTANT — use JSON.parse, not regex, to extract the path.
  //
  // Why: Claude Code sends valid JSON. A Windows path like src\auth\handler.ts
  // is JSON-encoded as "src\\auth\\handler.ts" (double backslashes on the wire).
  // A naive regex capture grabs the raw JSON bytes (\\), and a subsequent
  // .replace(/\\/g, '/') turns each \\ into //, producing src//auth//handler.ts.
  // That breaks pattern matching: 'src//auth//handler.ts'.includes('src/auth/') === false.
  //
  // JSON.parse decodes \\ → \ correctly, so the actual path value is
  // src\auth\handler.ts (single backslashes), which then normalizes cleanly to
  // src/auth/handler.ts and matches the critical path pattern.
  let filePath;
  try {
    const parsed = JSON.parse(input);
    filePath = parsed.file_path
      || (parsed.tool_input && parsed.tool_input.file_path);
  } catch (_) {
    // Fallback if input is not valid JSON — apply manual JSON unescape of \\ -> \
    const match = input.match(/"file_path"\s*:\s*"([^"]*)"/);
    if (!match) process.exit(0);
    filePath = match[1].replace(/\\\\/g, '\\');
  }
  if (!filePath) process.exit(0);

  // Normalize separators: Windows backslash -> forward slash
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Skip logging changes to pilot internal files and Claude Code runtime files
  if (normalizedPath.includes('.pilot/internal/')) process.exit(0);
  if (normalizedPath.includes('.claude/')) process.exit(0);

  // Log the change (store normalized forward-slash path for consistency)
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.appendFileSync(LEDGER, `${timestamp} | EDIT | ${normalizedPath}\n`);

  // Critical path check — real-time safety net
  let criticalMatch = false;
  if (fs.existsSync(CRITICAL_PATHS)) {
    const lines = fs.readFileSync(CRITICAL_PATHS, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const sepIndex = line.indexOf('|');
      if (sepIndex === -1) continue;
      const pattern = line.substring(0, sepIndex).trim().replace(/\\/g, '/');
      const invariant = line.substring(sepIndex + 1).trim();
      if (pattern && normalizedPath.includes(pattern)) {
        process.stderr.write(
          `Critical path "${pattern}": ${invariant}\n`
        );
        criticalMatch = true;
      }
    }
  }

  // Exit 2 sends stderr to Claude. Exit 0 is silent.
  process.exit(criticalMatch ? 2 : 0);
});
