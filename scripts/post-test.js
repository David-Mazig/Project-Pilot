#!/usr/bin/env node
// Project Pilot: PostToolUse Bash — Test Result Capture
// Fires AFTER every Bash command. Checks whether the command was a test run.
// If so, parses the output for pass/fail/feature coverage and writes
// .pilot/internal/.test-results — a machine-readable file synthesis reads to
// auto-flip progress.md entries from "Implemented (Unverified)" to "Verified".
//
// Output format (.test-results):
//   TEST_RESULT=PASS|FAIL
//   COVERED_FEATURES=store,add,commands
//   FAILING_TESTS=auth.test.js > should reject invalid token
//   COMMAND=npm test
//   TIMESTAMP=2025-01-15T10:30:00Z
//
// This file is gitignored (.pilot/internal/.gitignore). It is overwritten on
// every test run and deleted when synthesis consumes it.

'use strict';

const fs   = require('fs');
const path = require('path');

const PILOT_DIR   = '.pilot';
const RESULTS_FILE = path.join(PILOT_DIR, 'internal', '.test-results');

// Skip if pilot not set up or onboarding in progress
if (!fs.existsSync(path.join(PILOT_DIR, 'internal'))) process.exit(0);
if (fs.existsSync(path.join(PILOT_DIR, 'internal', '.onboarding'))) process.exit(0);

// ─── Test command detection ────────────────────────────────────────────────────
// These prefixes/strings identify commands that run a test suite.
const TEST_COMMAND_PATTERNS = [
  /^npm test\b/,
  /^npm run test/,
  /^npx jest\b/,
  /\bnode\s+--test\b/,
  /\bjest\b/,
  /\bvitest\b/,
  /^pnpm test\b/,
  /^pnpm run test/,
  /^yarn test\b/,
  /^pytest\b/,
  /^python -m pytest\b/,
  /^python3 -m pytest\b/,
  /^go test\b/,
  /^cargo test\b/,
  /^rspec\b/,
  /^bundle exec rspec\b/,
  /^dotnet test\b/,
  /^mvn test\b/,
  /\bvitest run\b/,
];

function isTestCommand(cmd) {
  if (!cmd) return false;
  const trimmed = cmd.trim();
  return TEST_COMMAND_PATTERNS.some(p => p.test(trimmed));
}

// ─── Output parsers ────────────────────────────────────────────────────────────

// Node:test TAP format
// "# pass 16" / "# fail 0"
function parseNodeTest(output) {
  const passMatch = output.match(/^#\s+pass\s+(\d+)/m);
  const failMatch = output.match(/^#\s+fail\s+(\d+)/m);
  if (!passMatch && !failMatch) return null;
  const pass = parseInt(passMatch?.[1] ?? '0', 10);
  const fail = parseInt(failMatch?.[1] ?? '0', 10);
  return { pass, fail, runner: 'node:test' };
}

// Jest format
// "Tests: 3 passed, 0 failed" or "Tests: 3 passed"
function parseJest(output) {
  const match = output.match(/Tests:\s+(?:(\d+)\s+passed)?(?:,\s+)?(?:(\d+)\s+failed)?/);
  if (!match) return null;
  const pass = parseInt(match[1] ?? '0', 10);
  const fail = parseInt(match[2] ?? '0', 10);
  if (pass === 0 && fail === 0) return null;
  return { pass, fail, runner: 'jest' };
}

// Vitest format
// "✓ 3 tests passed" or "× 1 test failed"
function parseVitest(output) {
  const passMatch = output.match(/✓\s+(\d+)\s+tests?\s+passed/);
  const failMatch = output.match(/×\s+(\d+)\s+tests?\s+failed/);
  if (!passMatch && !failMatch) return null;
  return {
    pass: parseInt(passMatch?.[1] ?? '0', 10),
    fail: parseInt(failMatch?.[1] ?? '0', 10),
    runner: 'vitest',
  };
}

// Mocha/generic format
// "3 passing" / "1 failing"
function parseMocha(output) {
  const passMatch = output.match(/(\d+)\s+passing/);
  const failMatch = output.match(/(\d+)\s+failing/);
  if (!passMatch && !failMatch) return null;
  return {
    pass: parseInt(passMatch?.[1] ?? '0', 10),
    fail: parseInt(failMatch?.[1] ?? '0', 10),
    runner: 'mocha',
  };
}

// Pytest format
// "3 passed" or "2 failed, 1 passed"
function parsePytest(output) {
  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  if (!passMatch && !failMatch) return null;
  return {
    pass: parseInt(passMatch?.[1] ?? '0', 10),
    fail: parseInt(failMatch?.[1] ?? '0', 10),
    runner: 'pytest',
  };
}

// Go test format — ends with PASS or FAIL
function parseGoTest(output) {
  if (/^(ok\s+|PASS\b)/m.test(output) && !/^(FAIL\b|---\s+FAIL)/m.test(output)) {
    return { pass: 1, fail: 0, runner: 'go' };
  }
  if (/^FAIL\b/m.test(output)) {
    return { pass: 0, fail: 1, runner: 'go' };
  }
  return null;
}

function parseTestOutput(output) {
  return parseNodeTest(output)
    || parseJest(output)
    || parseVitest(output)
    || parseMocha(output)
    || parsePytest(output)
    || parseGoTest(output)
    || null;
}

// ─── Feature name extraction ───────────────────────────────────────────────────
// Extract feature names from test file paths and TAP subtest names.
// "tests/store.test.js" → "store"
// "tests/commands.test.js" → "commands"
// "# Subtest: addTask" → "addTask" (only top-level suite names, not leaf tests)

function extractFeatures(output, command) {
  const features = new Set();

  // From test file paths in the output (Jest PASS/FAIL lines, node:test file refs, pytest)
  const filePattern = /(?:PASS|FAIL|ok)\s+[\w./\\-]*?(\w[\w-]*)\.(?:test|spec)\.[jt]s/gi;
  let m;
  while ((m = filePattern.exec(output)) !== null) {
    features.add(m[1].toLowerCase());
  }

  // From node:test TAP top-level subtest names (# Subtest: <SuiteName>)
  // Only capture top-level (not indented)
  const subtestPattern = /^# Subtest: (.+)$/gm;
  while ((m = subtestPattern.exec(output)) !== null) {
    const name = m[1].trim();
    // Skip if it looks like a leaf test description (has spaces and looks sentence-like)
    if (name.length < 40 && !/\s/.test(name)) {
      features.add(name.toLowerCase());
    } else if (name.length < 40) {
      // camelCase or PascalCase suite names
      features.add(name.replace(/\s+/g, '-').toLowerCase());
    }
  }

  // From the command itself if test file paths are specified
  // e.g. "node --test tests/store.test.js tests/commands.test.js"
  const cmdFilePattern = /(\w[\w-]*)\.(?:test|spec)\.[jt]s/gi;
  while ((m = cmdFilePattern.exec(command || '')) !== null) {
    features.add(m[1].toLowerCase());
  }

  return [...features].filter(Boolean).sort();
}

// ─── Failing test name extraction ─────────────────────────────────────────────
function extractFailingTests(output) {
  const failing = [];

  // node:test: "not ok N - <name>" lines
  const notOkPattern = /^not ok \d+ - (.+)$/gm;
  let m;
  while ((m = notOkPattern.exec(output)) !== null) {
    failing.push(m[1].trim());
  }

  // Jest: "✕ <test name>" or "× <test name>"
  const jestFailPattern = /^\s+[✕×]\s+(.+)$/gm;
  while ((m = jestFailPattern.exec(output)) !== null) {
    failing.push(m[1].trim());
  }

  // Pytest: "FAILED tests/foo.py::test_name"
  const pytestPattern = /FAILED\s+[\w./]+::(\w+)/g;
  while ((m = pytestPattern.exec(output)) !== null) {
    failing.push(m[1]);
  }

  return failing.slice(0, 20); // cap at 20 to keep file small
}

// ─── Main ──────────────────────────────────────────────────────────────────────

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { stdin += c; });
process.stdin.on('end', () => {
  let command = '';
  let output  = '';

  try {
    const parsed = JSON.parse(stdin);
    // Extract command — Claude Code sends tool_input.command for PostToolUse Bash
    command = parsed.command
      || (parsed.tool_input && parsed.tool_input.command)
      || '';
    // Extract output — Claude Code may send it in several places
    output = parsed.output
      || (parsed.tool_response && (parsed.tool_response.output || parsed.tool_response.stdout))
      || parsed.stdout
      || parsed.stderr
      || '';
  } catch (_) {
    // Fallback regex extraction
    const cmdMatch = stdin.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (cmdMatch) command = cmdMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    const outMatch = stdin.match(/"output"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (outMatch) output = outMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  if (!isTestCommand(command)) process.exit(0);

  // Test command detected — from here, silent failure is no longer acceptable.
  // The developer needs to know if results couldn't be captured so they can
  // include the TEST_RESULT block in synthesis manually.

  if (!output || !output.trim()) {
    // Payload arrived but output field was empty or missing.
    // Most likely cause: Claude Code's PostToolUse hook payload doesn't include
    // command output in any of the expected fields (output, tool_response.output,
    // stdout, stderr). This is a payload shape issue, not a test failure.
    process.stderr.write(
      `⚠️  [post-test] Test command detected ("${command.slice(0, 60)}") but no output` +
      ` was found in the hook payload. Cannot capture results automatically.\n` +
      `   Add TEST_RESULT block manually when synthesizing, or check that your\n` +
      `   Claude Code version passes command output to PostToolUse hooks.\n`
    );
    process.exit(0);  // warning only — never block
  }

  const parsed = parseTestOutput(output);
  if (!parsed) {
    // Output was present but no parser matched any known test runner format.
    // Emit a warning so the developer knows auto-capture was attempted and failed.
    process.stderr.write(
      `⚠️  [post-test] Test command detected but output format wasn't recognised.\n` +
      `   Supported runners: node:test, Jest, Vitest, Mocha, Pytest, Go test.\n` +
      `   Add TEST_RESULT block manually when synthesizing.\n`
    );
    process.exit(0);  // warning only — never block
  }

  const result   = parsed.fail === 0 ? 'PASS' : 'FAIL';
  const features = extractFeatures(output, command);
  const failing  = result === 'FAIL' ? extractFailingTests(output) : [];
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const content = [
    `TEST_RESULT=${result}`,
    `COVERED_FEATURES=${features.join(',')}`,
    `FAILING_TESTS=${failing.join(' | ')}`,
    `PASS_COUNT=${parsed.pass}`,
    `FAIL_COUNT=${parsed.fail}`,
    `RUNNER=${parsed.runner}`,
    `COMMAND=${command.slice(0, 200)}`,
    `TIMESTAMP=${timestamp}`,
  ].join('\n') + '\n';

  try {
    fs.writeFileSync(RESULTS_FILE, content, 'utf8');
  } catch (_) { process.exit(0); }

  // Emit informational message so Claude knows results are available
  const summary = result === 'PASS'
    ? `Tests PASSED (${parsed.pass} passed). Features covered: ${features.join(', ') || 'unknown'}. Include TEST_RESULT block in synthesis.`
    : `Tests FAILED (${parsed.fail} failed, ${parsed.pass} passed). Check .pilot/internal/.test-results. Include TEST_RESULT block in synthesis.`;

  process.stderr.write(`ℹ️  [post-test] ${summary}\n`);
  process.exit(0);  // informational only — never block
});
