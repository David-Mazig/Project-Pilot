# Task Execution Protocol

When asked to implement, build, create, or refactor work that spans multiple files or constitutes a system, module, or feature set — follow this three-phase protocol. Never attempt to generate everything in a single response.

## When This Protocol Applies

Apply when the task involves ANY of:
- Building a new system, module, or feature set
- Refactoring or migrating across multiple files
- Keywords in the request: "build", "implement", "create", "refactor", "migrate", "redesign"
- Work that would realistically produce output across 3+ files

Single-file changes or small targeted fixes do NOT require this protocol.

---

## Phase 1 — Plan (always first, costs almost nothing)

Before writing a single line of code, do this silently:

1. Read `.pilot/patterns.md` — established conventions all sub-agents must follow
2. Read `.pilot/architecture.md` — decisions and invariants that constrain the design
3. Read relevant `.pilot/modules/[name].md` files for affected areas
4. Read `.pilot/internal/critical-paths.txt` — files that need extra care

Then decompose the task:
- Identify natural seams: module boundaries, independent concerns, distinct responsibilities
- Define shared contracts (interfaces, types, APIs) that all parts must agree on BEFORE any code is written
- Determine what is safely parallel: tasks that write to different files and depend only on shared contracts
- Determine what must be sequential: Task B genuinely depends on Task A's output

**Present the plan to the developer before dispatching anything:**

```
Building [task name] — decomposed into [N] tasks:

  Task 1 — [file(s)]: [one-line description]
  Task 2 — [file(s)]: [one-line description]
  Task 3 — [file(s)]: [one-line description]

Shared contracts:
  [Specific interface, type signature, or API shape that all tasks must agree on]

Parallel: Tasks [X, Y] run simultaneously. Task [Z] runs after (depends on [reason]).
Proceed?
```

Wait for developer confirmation. One word ("yes" or "go") is enough — don't require elaborate responses.

---

## Phase 2 — Build (sub-agent dispatch)

After the developer confirms:

**Pass to EVERY sub-agent — explicitly, not by reference:**
- The shared contracts defined in Phase 1 (paste them directly)
- The specific conventions from `.pilot/patterns.md` that apply to their scope (copy only the relevant rules — not the whole file)
- Which files they own exclusively (no file overlap between agents)
- The interface their output must satisfy so Phase 3 can verify it

**Dispatch rules:**
- Set `permissionMode: "bypassPermissions"` on every Task call
- Issue ALL parallel Task calls in a single response — Claude Code only executes sub-agents concurrently when dispatched in the same turn
- Sequential tasks get dispatched after their dependency completes

**Sub-agent instruction template:**
> You are implementing [specific part] for [project name].
> Write to these files only: [list]
>
> **TOOL RESTRICTION — CRITICAL:**
> Use the **Write tool ONLY**. Do NOT Read files, Bash, Glob, Search, or use any other tool.
> Do not explore the codebase. Everything you need is in this prompt.
> If you think you need to read a file first — you don't. Write directly from the contracts below.
>
> **DO NOT run tests, linters, or any build commands.** Running `npm test`, `vitest`, or
> any shell command is strictly forbidden. Testing is the orchestrating agent's job in Phase 3,
> after ALL sub-agents complete. If you run tests, you will spawn duplicate test processes.
>
> Shared contracts you must satisfy:
> [paste contracts]
>
> Conventions to follow (from .pilot/patterns.md):
> [paste only the relevant rules]
>
> Do NOT import from other agents' output files — depend only on the shared contracts above.
> When done writing, report: "Done. Files written: [list]." Nothing else.

**File count rule:** Assign at most **2 files per sub-agent** (1 source file + 1 test file). If a task produces more files, split it into additional agents. A 3-file agent is a common cause of runaway tool use.

---

## Phase 3 — Verify (ORCHESTRATOR ONLY — run ONCE after ALL sub-agents complete)

**This phase is run by you — the orchestrating agent — exactly once, after every sub-agent has finished.**
Sub-agents do not verify. Sub-agents do not run tests. They write files and stop.
If you run any part of Phase 3 before all sub-agents are done, you will get duplicate processes.

Before reporting "done" to the developer, run these checks:

1. **Interface check** — do exports, function signatures, and APIs match the contracts defined in Phase 1? Read the key export points of each created file.

2. **Convention check** — open each created file briefly. Does it follow the established conventions from `.pilot/patterns.md`? Flag any drift (don't silently accept it).

3. **Integration check** — do the pieces connect? Check that imports reference real files, types are consistent across boundaries, no naming mismatches.

4. **Test check** — run the test command **once** (from CLAUDE.md or package.json). One run, not one per sub-agent. Capture the output.

   **Extract and record these values from the test output:**
   - `TEST_RESULT`: `PASS` (all tests passed) or `FAIL` (any test failed)
   - `COVERED_FEATURES`: list of feature/module names inferred from the test file names that ran (e.g. if `auth.test.ts` ran, `auth` is covered)
   - `FAILING_TESTS`: exact names of any failing tests (empty if PASS)

   **Include this block verbatim in your synthesis trigger message** (the message that tells Claude to synthesize):
   ```
   TEST_RESULT = PASS|FAIL
   COVERED_FEATURES = [feature1, feature2]
   FAILING_TESTS = [exact failing test name(s), or empty]
   ```

   Do not mark anything Verified if tests weren't run or TEST_RESULT is not PASS.

5. **Critical path check** — did any sub-agent touch a file listed in `.pilot/internal/critical-paths.txt`? If yes, verify the documented invariant still holds.

**If a check fails:**
- Fix it directly if it's a small deviation (wrong naming convention, missing export)
- Note it clearly if it required a real decision
- Never silently accept broken interfaces or convention violations

**Report to developer after verification:**
```
Built [task name]:
  ✅ [file or task]: done
  ✅ [file or task]: done

Verified: interfaces match contracts, conventions followed.
Tests: [passed / no test command found — mark as Implemented (Unverified)].
[One line per issue fixed or flagged, if any]
```

---

## Token Efficiency Rules

These keep the Plan→Build→Verify cycle from being expensive:

- **Surgical context per sub-agent.** Each agent gets only the conventions relevant to its scope — not all of `patterns.md`. A renderer sub-agent doesn't need auth conventions.
- **Sub-agents don't need history.** Pass contracts and conventions explicitly. Sub-agents are stateless — give them what they need, nothing more.
- **Verification is targeted.** Read key export lines and test results — not every line of every generated file.
- **Skip this protocol for small tasks.** A single-file change with a clear scope does not need decomposition. Use judgment.
- **Sub-agents do NOT need:** `.pilot/decisions.md`, `.pilot/progress.md`, `change-ledger.log`, or the full content of any file they're not writing to.
- **1 source + 1 test per agent max.** More than 2 files per agent dramatically increases the chance of runaway tool use. Split further if needed.

---

## Runaway Agent Detection

A sub-agent has gone rogue if it is:
- Still running after **~5 minutes** on a single file pair
- Showing **10+ tool uses** for a Write-only task
- Displaying activity like "Searching for patterns", "Reading N files", or "Globbing"
- Running `npm test`, `vitest`, or any shell command (sub-agents must never do this)

**Multiple instances of `npm run test` / Vitest / Tinypool workers appearing simultaneously is a sure sign sub-agents are running Phase 3 themselves instead of leaving it to the orchestrator.**

**What to do:**

1. **Press Ctrl+C** to kill the runaway agent immediately. Do not wait for it to finish — it won't recover on its own.
2. Tell the developer: _"The [filename] agent went rogue — it started reading the codebase instead of writing from context. Killed it. Re-running with tighter instructions."_
3. Re-dispatch **only the failed agent** as a new single Task call, with the Write-only tool restriction explicitly stated.
4. If it happens again on the same file, it usually means the contracts in Phase 1 were too vague. Strengthen them before re-dispatching: add explicit function signatures, type shapes, or return value examples.

