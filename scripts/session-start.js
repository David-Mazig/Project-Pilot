#!/usr/bin/env node
// Project Pilot: SessionStart hook — Context Freshness, Module Awareness & Recovery
// Fires on: startup, resume, clear, compact
// 'resume' fires when Claude Code restarts after a crash — same recovery logic as clear/compact.

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';

if (fs.existsSync(path.join(PILOT_DIR, 'internal', '.onboarding'))) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const sourceMatch = input.match(/"source"\s*:\s*"([^"]*)"/);
  const source = sourceMatch ? sourceMatch[1] : 'startup';

  // Fresh project — .pilot doesn't exist yet
  if (!fs.existsSync(PILOT_DIR)) {
    // Nudge only on startup. On clear/compact, absence is handled elsewhere.
    if (source === 'startup') {
      process.stderr.write(
        '\n\u2139\uFE0F  Project Pilot is installed.\n' +
        '   Run /project-pilot:init-pilot to set up your project intelligence layer.\n\n'
      );
      process.exit(0); // informational only — not an error
    }
    process.exit(0);
  }

  const LEDGER = path.join(PILOT_DIR, 'internal', 'change-ledger.log');
  const LAST_SYNTHESIS = path.join(PILOT_DIR, 'internal', '.last-synthesis');

  const output = [];

  // --- RECOVERY CHECK (clear/compact/resume) ---
  if (source === 'clear' || source === 'compact' || source === 'resume') {
    if (fs.existsSync(LEDGER)) {
      const ledgerLines = fs.readFileSync(LEDGER, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'));

      let unsynthesized;
      if (fs.existsSync(LAST_SYNTHESIS)) {
        const lastTime = fs.readFileSync(LAST_SYNTHESIS, 'utf8').trim();
        unsynthesized = ledgerLines.filter(l => {
          const lineTime = l.split(' | ')[0];
          return lineTime > lastTime;
        });
      } else {
        unsynthesized = ledgerLines;
      }

      if (unsynthesized.length > 0) {
        output.push(
          `Recovery: ${unsynthesized.length} unsynthesized change(s) from before /${source}. ` +
          `Read .pilot/internal/synthesis-instructions.md and synthesize before resuming work.`
        );
      }
    }
  }

  // --- EXTENDED ABSENCE CHECK ---
  const activeCtx = path.join(PILOT_DIR, 'active-context.md');
  if (fs.existsSync(activeCtx)) {
    const mtime = fs.statSync(activeCtx).mtimeMs;
    const ageHours = Math.floor((Date.now() - mtime) / 3600000);

    if (ageHours > 336) { // > 14 days
      const ageDays = Math.floor(ageHours / 24);
      output.push(
        `Returning after ${ageDays} days away. Run /project-pilot:pilot-dashboard for a guided re-onboarding.`
      );
    } else if (ageHours > 48) {
      output.push(
        `Warning: active-context.md is ${ageHours}h old — verify before relying on it.`
      );
    }
  }

  // --- MODULE CONTEXT ---
  const modulesDir = path.join(PILOT_DIR, 'modules');
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir).filter(f => f.endsWith('.md'));
    if (modules.length > 0) {
      const names = modules.map(f => f.replace('.md', '')).sort().join(', ');
      output.push(
        `Modules available: ${names}. Read .pilot/modules/[name].md when working in a module directory.`
      );
    }
  }

  // --- DEPENDENCY MAP STALENESS ---
  const depMap = path.join(PILOT_DIR, 'internal', 'dependency-map.md');
  if (fs.existsSync(depMap)) {
    const depAge = Math.floor((Date.now() - fs.statSync(depMap).mtimeMs) / 3600000);
    if (depAge > 72) {
      output.push(`Warning: dependency-map.md is ${depAge}h old.`);
    }
  }

  // --- DECISION REVISITATION REMINDER ---
  const countFile = path.join(PILOT_DIR, 'internal', '.synthesis-count');
  if (fs.existsSync(countFile)) {
    const count = parseInt(fs.readFileSync(countFile, 'utf8').trim(), 10);
    if (count >= 10) {
      const decisionsFile = path.join(PILOT_DIR, 'decisions.md');
      if (fs.existsSync(decisionsFile)) {
        const content = fs.readFileSync(decisionsFile, 'utf8');
        const revisitCount = (content.match(/Revisit When/g) || []).length;
        if (revisitCount > 0) {
          output.push(
            `${count} sessions completed. Check ${revisitCount} decision revisitation condition(s) in .pilot/decisions.md.`
          );
        }
      }
    }
  }

  if (output.length > 0) {
    process.stderr.write(output.join('\n') + '\n');
    process.exit(2);
  }

  process.exit(0);
});
