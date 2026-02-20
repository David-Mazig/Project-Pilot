#!/usr/bin/env node
// Project Pilot: Cross-platform setup — replaces Step 1 bash heredoc
// Creates the .pilot/ directory scaffold and boilerplate files.
// Called by /init-pilot Phase 4 Step 1.
// Works on Windows (cmd/pwsh/git-bash), macOS, and Linux.
//
// Usage: node setup.js
// Requires: CLAUDE_PLUGIN_ROOT env var (set automatically by Claude Code)

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CWD         = process.cwd();
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

function write(relPath, content) {
  const full = path.join(CWD, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function mkdirp(relPath) {
  fs.mkdirSync(path.join(CWD, relPath), { recursive: true });
}

// ─── Directories ──────────────────────────────────────────────────────────────

mkdirp('.pilot/internal');
mkdirp('.pilot/modules');

// ─── Onboarding flag — silences all hooks during generation ──────────────────

write('.pilot/internal/.onboarding', 'in-progress\n');

// ─── Change ledger ────────────────────────────────────────────────────────────

write('.pilot/internal/change-ledger.log',
  '# Project Pilot Change Ledger\n' +
  '# Format: TIMESTAMP | ACTION | FILE_PATH_OR_COMMAND\n'
);

// ─── Internal .gitignore ──────────────────────────────────────────────────────

write('.pilot/internal/.gitignore',
  '.last-synthesis\n' +
  '.synthesis-count\n' +
  '.onboarding\n'
);

// ─── Synthesis instructions (copied from plugin template) ────────────────────

const synthSrc  = path.join(PLUGIN_ROOT, 'templates', 'synthesis-instructions.md');
const synthDest = path.join(CWD, '.pilot/internal/synthesis-instructions.md');
try {
  fs.copyFileSync(synthSrc, synthDest);
} catch (e) {
  // Fallback: write a minimal placeholder if template not found
  fs.writeFileSync(synthDest,
    '# Synthesis Instructions\n' +
    'Update .pilot/ files to reflect session changes. See plugin documentation.\n'
  );
}

// ─── Dependency map placeholder ───────────────────────────────────────────────

write('.pilot/internal/dependency-map.md',
  '# Dependency Map\n' +
  'Auto-maintained by Project Pilot.\n'
);

// ─── Active context placeholder (sub-agent Task 1 will populate fully) ────────

write('.pilot/active-context.md',
  '# Active Context\n' +
  '## Currently Working On\n' +
  '_Being generated..._\n' +
  '## Next Up\n' +
  '_Being generated..._\n' +
  '## Known Issues / Tech Debt\n' +
  '_Being generated..._\n'
);

// ─── Progress log placeholder (sub-agent Task 1 will populate fully) ──────────

write('.pilot/progress.md',
  '# Progress Log\n' +
  '## Verified\n\n' +
  '## Implemented (Unverified)\n\n' +
  '## Has Known Issues\n\n' +
  '## In Progress\n' +
  '_Being generated..._\n'
);

// ─── Sentinel file — written to .claude/ (survives .pilot/ deletion) ─────────
// post-bash-guard.js reads this file to know the project was initialized.
// .claude/ is Claude Code's own config dir and is rarely wiped.

const sentinelDir  = path.join(CWD, '.claude');
const sentinelFile = path.join(sentinelDir, 'project-pilot-initialized');
try {
  fs.mkdirSync(sentinelDir, { recursive: true });
  fs.writeFileSync(sentinelFile, new Date().toISOString() + '\n', 'utf8');
} catch (_) {} // non-fatal — guard degrades gracefully if .claude/ is read-only

// ─── .claude/.gitignore — keep Project Pilot runtime files out of git ────────
// .pp-snapshot/ changes on every bash command and is machine-local.
// project-pilot-initialized is also machine-local.
// Neither should ever be committed to the repo.

const claudeGitignore = path.join(sentinelDir, '.gitignore');
try {
  const REQUIRED_ENTRIES = [
    '.pp-snapshot/',
    'project-pilot-initialized',
    '.pp-no-guard',
  ];
  let existing = '';
  if (fs.existsSync(claudeGitignore)) {
    existing = fs.readFileSync(claudeGitignore, 'utf8');
  } else {
    existing = '# Project Pilot runtime files — machine-local, do not commit\n';
  }
  const missing = REQUIRED_ENTRIES.filter(e => !existing.includes(e));
  if (missing.length > 0) {
    fs.writeFileSync(claudeGitignore, existing + missing.join('\n') + '\n', 'utf8');
  }
} catch (_) {} // non-fatal

// ─── enabledPlugins self-heal ─────────────────────────────────────────────────
// The `/plugin install` command should persist "project-pilot" to enabledPlugins
// in Claude Code's global settings.json — but it only activates in-memory and
// the entry is never written to disk. This means the plugin works in the
// installation session but disappears for every subsequent project and restart.
//
// Fix: write it here, during /init-pilot (which already works in session one).
// After the first project is initialized, every future project gets the plugin
// automatically — zero extra steps for any user.
//
// Behaviour: read → add if absent → write. Fully idempotent and non-fatal.
// If the write fails for any reason (permissions, locked file, unexpected
// settings format), setup continues normally and a note is printed instead.

function getClaudeSettingsPath() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    return appData ? path.join(appData, 'Claude', 'settings.json') : null;
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'settings.json');
  }
  // Linux: prefer XDG, fall back to ~/.claude
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const xdgPath = path.join(xdg, 'Claude', 'settings.json');
  if (fs.existsSync(xdgPath)) return xdgPath;
  return path.join(os.homedir(), '.claude', 'settings.json');
}

try {
  const settingsPath = getClaudeSettingsPath();

  if (settingsPath) {
    let settings = {};

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {
        // Malformed JSON — don't touch it, just skip silently
        throw new Error('settings.json could not be parsed — skipping enabledPlugins write');
      }
    }

    if (!Array.isArray(settings.enabledPlugins)) {
      settings.enabledPlugins = [];
    }

    if (!settings.enabledPlugins.includes('project-pilot')) {
      settings.enabledPlugins.push('project-pilot');
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
      process.stdout.write(
        'Project Pilot registered in Claude Code settings.\n' +
        'Commands will appear automatically in all future projects after restart.\n'
      );
    }
    // Already present — nothing to do, no output needed
  }
} catch (e) {
  // Fully non-fatal — setup continues, project still initializes correctly
  process.stdout.write(
    'Note: Could not auto-register plugin in Claude Code settings (' + e.message + ').\n' +
    'If commands don\'t appear in other projects, restart Claude Code.\n'
  );
}

process.stdout.write('Setup complete.\n');
