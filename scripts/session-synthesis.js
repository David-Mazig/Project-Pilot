#!/usr/bin/env node
// Project Pilot: Stop hook — intentionally silent (v1.3.15+)
//
// Synthesis is now self-triggered by Claude after completing work that
// changed files, following .pilot/internal/synthesis-instructions.md.
//
// This hook exists only as a no-op to avoid errors if hooks.json still
// references it during upgrades. It will be removed in a future version.
//
// Recovery (crash/compact/clear) is handled by session-start.js.

process.exit(0);
