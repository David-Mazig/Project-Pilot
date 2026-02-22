#!/usr/bin/env node
// Project Pilot: SessionStart hook — Context Freshness, Module Awareness & Recovery
// Fires on: startup, resume, clear, compact
// 'resume' fires when Claude Code restarts after a crash — same recovery logic as clear/compact.

const fs = require('fs');
const path = require('path');

const PILOT_DIR = '.pilot';
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

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

  // --- TEMPLATE SYNC (hash-guarded — preserves developer customisations) ---
  // Only overwrites a project file if the developer hasn't modified it since our last sync.
  // Hash of last-synced content is stored in .pilot/internal/.template-hashes/
  const crypto = require('crypto');

  function hashFile(filePath) {
    try { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
    catch (_) { return null; }
  }

  function syncTemplate(templatePath, projectPath, hashCachePath) {
    if (!fs.existsSync(templatePath) || !fs.existsSync(projectPath)) return;
    const templateHash = hashFile(templatePath);
    if (!templateHash) return;
    const knownHash = fs.existsSync(hashCachePath)
      ? fs.readFileSync(hashCachePath, 'utf8').trim()
      : null;
    const currentProjectHash = hashFile(projectPath);
    // If project file was modified by the developer, leave it alone
    if (knownHash && currentProjectHash && currentProjectHash !== knownHash) return;
    // Safe to sync: first time, or project file is still the canonical version
    try {
      fs.copyFileSync(templatePath, projectPath);
      const HASH_DIR = path.dirname(hashCachePath);
      fs.mkdirSync(HASH_DIR, { recursive: true });
      fs.writeFileSync(hashCachePath, hashFile(projectPath) + '\n', 'utf8');
    } catch (_) {} // non-fatal
  }

  const HASH_DIR = path.join(PILOT_DIR, 'internal', '.template-hashes');
  const synthTemplate = path.join(PLUGIN_ROOT, 'templates', 'synthesis-instructions.md');
  const synthProject  = path.join(PILOT_DIR, 'internal', 'synthesis-instructions.md');
  syncTemplate(synthTemplate, synthProject, path.join(HASH_DIR, 'synthesis-instructions.sha'));

  const taskTemplate = path.join(PLUGIN_ROOT, 'templates', 'task-execution.md');
  const taskProject  = path.join(PILOT_DIR, 'internal', 'task-execution.md');
  syncTemplate(taskTemplate, taskProject, path.join(HASH_DIR, 'task-execution.sha'));

  // --- CLAUDE.md PATCH (one-time — adds ## Session Synthesis if missing) ---
  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
  try {
    if (fs.existsSync(claudeMdPath)) {
      let claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
      if (!claudeContent.includes('## Session Synthesis')) {
        const synthesisBlock =
          '\n## Session Synthesis\n' +
          'Synthesis is self-triggered, not automatic. After completing work that changed files (a finished\n' +
          'build, fix, refactor, or implementation), read .pilot/internal/synthesis-instructions.md and run\n' +
          'synthesis. Do NOT synthesize after conversational turns, plan presentations, clarifications, or\n' +
          'while waiting for input. If unsure: did files change as the result of completed work? Yes →\n' +
          'synthesize. No → don\'t.\n';

        // Try to insert after ## Communication Style section
        const anchor = '## Communication Style';
        const anchorIdx = claudeContent.indexOf(anchor);
        if (anchorIdx !== -1) {
          // Find the next ## heading after the anchor (or end of file)
          const afterAnchor = claudeContent.indexOf('\n## ', anchorIdx + anchor.length);
          const insertAt = afterAnchor !== -1 ? afterAnchor : claudeContent.length;
          claudeContent = claudeContent.slice(0, insertAt) + synthesisBlock + claudeContent.slice(insertAt);
        } else {
          // No anchor found — append at end
          claudeContent = claudeContent + synthesisBlock;
        }
        fs.writeFileSync(claudeMdPath, claudeContent, 'utf8');
      }
    }
  } catch (_) {} // non-fatal — synthesis still works via instructions file

  const BLOCKING = [];  // 🔴 must be resolved before work continues (exit 2)
  const WARNINGS = [];  // 🟡 degraded state, work can continue with caution
  const INFO     = [];  // ℹ️  informational only (exit 0)

  // --- SYNTHESIS LOCK DETECTION ---
  const LOCK_FILE = path.join(PILOT_DIR, 'internal', '.synthesis-lock');
  if (fs.existsSync(LOCK_FILE)) {
    BLOCKING.push(
      'Previous synthesis was interrupted before completing. The intelligence layer may be ' +
      'partially updated. Read .pilot/internal/synthesis-instructions.md and run a full ' +
      'synthesis now before resuming work.'
    );
  }

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
        BLOCKING.push(
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
      WARNINGS.push(
        `Returning after ${ageDays} days away. Run /project-pilot:pilot-dashboard for a guided re-onboarding.`
      );
    } else if (ageHours > 48) {
      WARNINGS.push(
        `active-context.md is ${ageHours}h old — verify before relying on it.`
      );
    }
  }

  // --- MODULE CONTEXT ---
  const modulesDir = path.join(PILOT_DIR, 'modules');
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir).filter(f => f.endsWith('.md'));
    if (modules.length > 0) {
      const names = modules.map(f => f.replace('.md', '')).sort().join(', ');
      INFO.push(
        `Modules available: ${names}. Read .pilot/modules/[name].md when working in a module directory.`
      );
    }
  }

  // --- DEPENDENCY MAP STALENESS ---
  const depMap = path.join(PILOT_DIR, 'internal', 'dependency-map.md');
  if (fs.existsSync(depMap)) {
    const depAge = Math.floor((Date.now() - fs.statSync(depMap).mtimeMs) / 3600000);
    if (depAge > 72) {
      WARNINGS.push(`dependency-map.md is ${depAge}h old — update it during next synthesis.`);
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
        const revisitCount = (content.match(/Revisit When/gi) || []).length;
        if (revisitCount > 0) {
          INFO.push(
            `${count} sessions completed. Check ${revisitCount} decision revisitation condition(s) in .pilot/decisions.md.`
          );
        }
      }
    }
  }

  // --- SYNTHESIS WEIGHT HINT ---
  // Tell Claude which synthesis file to load so it only reads what the session needs.
  // Gracefully skips if split files don't exist (backward compat with old installs).
  const synthLightPath = path.join(PLUGIN_ROOT, 'templates', 'synthesis-light.md');
  const synthMedPath   = path.join(PLUGIN_ROOT, 'templates', 'synthesis-medium.md');
  const synthHeavyPath = path.join(PLUGIN_ROOT, 'templates', 'synthesis-heavy.md');
  const hasSplitFiles  = fs.existsSync(synthLightPath) && fs.existsSync(synthMedPath) && fs.existsSync(synthHeavyPath);

  if (hasSplitFiles && fs.existsSync(LEDGER)) {
    try {
      const allLines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
      let pendingCount = allLines.length;
      if (fs.existsSync(LAST_SYNTHESIS)) {
        const lastTs = fs.readFileSync(LAST_SYNTHESIS, 'utf8').trim();
        pendingCount = allLines.filter(l => l.split(' | ')[0] > lastTs).length;
      }
      const synthCountVal = fs.existsSync(path.join(PILOT_DIR, 'internal', '.synthesis-count'))
        ? parseInt(fs.readFileSync(path.join(PILOT_DIR, 'internal', '.synthesis-count'), 'utf8').trim(), 10) || 0
        : 0;
      const isHeavy  = pendingCount >= 16 || (synthCountVal > 0 && synthCountVal % 5 === 0);
      const isMedium = !isHeavy && pendingCount >= 6;
      let synthFile  = synthLightPath;
      if (isHeavy)  synthFile = synthHeavyPath;
      else if (isMedium) synthFile = synthMedPath;
      const weight = isHeavy ? 'HEAVY' : isMedium ? 'MEDIUM' : 'LIGHT';
      INFO.push(`Synthesis weight: ${weight}. When synthesizing, read: ${synthFile}`);
    } catch (_) {} // non-fatal
  }

  // --- TEST RESULTS REMINDER ---
  // If a .test-results file exists from a recent test run, remind Claude to use it in synthesis.
  const TEST_RESULTS_FILE = path.join(PILOT_DIR, 'internal', '.test-results');
  if (fs.existsSync(TEST_RESULTS_FILE)) {
    try {
      const tr = fs.readFileSync(TEST_RESULTS_FILE, 'utf8');
      const resultLine  = tr.match(/^TEST_RESULT=(.+)$/m)?.[1] || '?';
      const featuresLine = tr.match(/^COVERED_FEATURES=(.+)$/m)?.[1] || '';
      const tsLine      = tr.match(/^TIMESTAMP=(.+)$/m)?.[1] || '';
      const age = tsLine ? Math.round((Date.now() - new Date(tsLine).getTime()) / 60000) : null;
      const ageStr = age !== null ? ` (${age}m ago)` : '';
      INFO.push(
        `Test results available${ageStr}: ${resultLine}` +
        (featuresLine ? ` — covered: ${featuresLine}` : '') +
        `. Include TEST_RESULT block when synthesizing. File: ${TEST_RESULTS_FILE}`
      );
    } catch (_) {} // non-fatal
  }

  // --- ASSEMBLE OUTPUT WITH SEVERITY HIERARCHY ---
  const lines = [];
  if (BLOCKING.length > 0) {
    BLOCKING.forEach(m => lines.push('🔴 ' + m));
  }
  if (WARNINGS.length > 0) {
    if (lines.length > 0) lines.push('');
    WARNINGS.forEach(m => lines.push('🟡 ' + m));
  }
  if (INFO.length > 0) {
    if (lines.length > 0) lines.push('');
    INFO.forEach(m => lines.push('ℹ️  ' + m));
  }

  if (lines.length > 0) {
    process.stderr.write(lines.join('\n') + '\n');
    process.exit(BLOCKING.length > 0 ? 2 : 0);
  }

  process.exit(0);
});
