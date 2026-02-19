# Session Synthesis Instructions

When triggered by the Stop hook, follow these steps to update the Project Pilot intelligence files.

## Core Updates (always)
1. Read .pilot/internal/change-ledger.log for the recent changes
2. Update .pilot/active-context.md to reflect the current state of work
3. Update .pilot/progress.md — categorize features accurately:
   - **Verified**: ONLY if tests exist and passed during this session, or developer explicitly confirmed it works
   - **Implemented (Unverified)**: Code was written but no tests ran or no confirmation. Note what verification is missing.
   - **Has Known Issues**: If errors, failures, or TODO/FIXME comments were noted. Include specific issue descriptions.
   - **In Progress**: Work started but not finished.
   - **Never assume a feature works just because code was written.** Default to "Implemented (Unverified)" unless there's evidence.
4. If any NEW decisions were made (architectural choices, pattern selections, technology decisions), add them to the Active Decisions section of .pilot/decisions.md with full reasoning, alternatives, and revisit conditions. If a new decision contradicts or replaces an existing active decision, move the old one to the Superseded Decisions section. If an approach was tried and rejected, add it to Abandoned Approaches.

## Convention Lifecycle Management (always)

This is the system that prevents drift. Conventions in .pilot/patterns.md have three stages (Seed → Harvest → Enforce) and every synthesis must manage them.

### Step 5 — Enforce: Check Established Conventions

Read the `## Established Conventions` section of .pilot/patterns.md. For every file changed this session, check whether the code follows the established conventions for its scope.

Rules — convention headers use the format `### Name [confidence | scope | #N]`:
- If a convention's scope is a specific directory (e.g., `src/services/`), only enforce within that scope.
- If a convention's scope is `global`, it applies everywhere.
- `seed` or `confirmed` confidence — authoritative. Deviations are drift.
- `harvested` confidence — system recommendation. Deviations are noted gently, not flagged as violations.

**When drift is detected**, do NOT ask the developer. Handle it:
1. **If you're already editing that file** — fix the drift silently as part of your current work.
2. **If the file isn't part of current work** — add it to `## Alignment Candidates` at the bottom of patterns.md for future sessions.

At the end of your synthesis output, include a one-line note for any drift found:
> "Drift: `paymentService.ts` returns raw string on error. Convention (error-handling, seed): throw AppError. Flagged for alignment."

### Step 6 — Harvest: Detect and Codify Emerging Patterns

Read the `## Emerging Patterns (Under Observation)` section of .pilot/patterns.md. For each TBD slot listed there:

**6a. Scan.** Look at files changed this session AND the broader codebase for approaches matching the TBD category.

**6b. Threshold.** If 3+ files use the same approach for a given TBD slot, it's a candidate for promotion.

**6c. Check for conflicts.** Before promoting, check if different approaches exist for the same concern:

- **Conflicts align to directory/module boundaries** → these are scoped conventions. Codify BOTH with scope qualifiers. Example:
  > Error handling in `src/services/` uses AppError (5 files). Error handling in `src/workers/` uses Result tuples (3 files). Both valid — codify as two scoped conventions.

- **Conflicts are mixed within the same scope** → genuine inconsistency. Proceed to evaluation.

**6d. Evaluate and decide autonomously.** Do NOT ask the developer. Apply:
1. **Count** — which approach is most common? Majority is cheaper to standardize around.
2. **Evaluate** — which approach is best for THIS project? Consider: framework conventions, existing architecture, active decisions in decisions.md, error handling strategy, testing approach. Use project-specific reasoning, not generic best practices.
3. **Decide** — pick the winner:
   - One approach is more common AND better suited → pick it.
   - A less common approach is clearly superior → pick it, note migration cost.
   - Genuine toss-up → pick the one with fewer files to migrate.

**6e. Promote.** Move from "Emerging Patterns" to "Established Conventions" using the compact format:
```markdown
### [Category Name] [harvested | scope | #N]
[Specific, actionable rule with examples]
_Why: [Project-specific reasoning]. Seen in: [3+ files]._
```

**6f. Flag outliers.** Files not conforming to the new convention go under `## Alignment Candidates`. Do not change them — just list them.

**6g. Log the decision.** Add to .pilot/decisions.md under Active Decisions:
```markdown
### [DATE] Convention: [Category Name] [harvested]
**What:** [One-line convention statement]
**Why:** [Project-specific reasoning] | **Evidence:** [files, count]
**Alternatives seen:** [Other approaches with counts]
**Revisit when:** [Trigger condition]
```

### Step 7 — Observe: Update TBD Counters

For TBD slots that didn't reach the threshold yet, update the observation count:
```
- **Error handling:** `TBD` (2 occurrences: userService.ts, authService.ts). 1 more triggers promotion.
```

If no occurrences have been found after 5+ sessions, note that too — the developer may need to make an explicit choice here.

### Step 8 — Promote: Implicit Confirmation

Check conventions with `harvested` in their header bracket. If `current_synthesis_count - established_at_synthesis >= 5` AND no drift incidents or developer overrides occurred for that convention during those sessions, promote to `confirmed`. Update the bracket: `[harvested | scope | #N]` → `[confirmed | scope | #N]`.

When promoting, update the entry in patterns.md and add a note to decisions.md:
> "Convention [name] promoted from harvested → confirmed after 5 sessions with no overrides."

## Module Context Maintenance (always)
9. Check which directories the changed files belong to. For each directory with 3+ source files that does NOT yet have a .pilot/modules/[name].md file, create one.
10. If a module context file already exists for an affected directory, check whether the changes affect any documented contracts. Flag if a contract may have been violated or changed.
11. If you created a new module context file, also create a cascade CLAUDE.md in that module's directory referencing the module context file. Keep cascade files under 10 lines.
12. Update .pilot/internal/dependency-map.md if any imports or dependencies between modules changed.
13. If any new security-critical files or invariants were identified, add them to .pilot/internal/critical-paths.txt.

## Impact Check (always)
14. For each changed file, briefly note if the change could affect other modules based on the dependency map.

## Current-Session Validation (always — safety net)
15. If any NEW decisions were captured in step 4, check each one against:
    - Security invariants in .pilot/architecture.md
    - Existing active decisions in .pilot/decisions.md (flag contradictions)
    - Established conventions in .pilot/patterns.md (flag deviations)
    - Critical paths in .pilot/internal/critical-paths.txt
16. If any checks find a conflict, output a clear summary with: what conflicts, what the options are, and a recommendation.

## Deep Analysis (medium + heavy sessions only)

### Pattern Discovery (medium + heavy)
17. Beyond the existing TBD slots, scan for entirely NEW pattern categories that aren't tracked yet. If you notice a repeated approach that doesn't fit any existing convention category, add a new TBD slot to "Emerging Patterns."
18. Check for anti-patterns — inconsistencies where the same problem is solved differently without a scoped justification.

### Decision Revisitation (heavy sessions only)
19. Read .pilot/decisions.md and check each decision's "Revisit When" conditions. Flag any that are now true.
20. Check .pilot/architecture.md for architectural assumptions that no longer hold.

### Complexity-Adaptive Restructuring (heavy sessions only)
21. Assess whether the .pilot/ structure still fits:
    - Module directories with 10+ source files missing .pilot/modules/ entries → create them.
    - patterns.md past ~60 lines → consider splitting by category.
    - decisions.md with 15+ active decisions → check for Superseded candidates.
    - Project grown from Tier 1 to Tier 2 → suggest structural upgrades.
22. Check if any module's Gotchas section should be updated.

## Output Format

Keep synthesis output to the developer short — at most a few lines:
- What was updated
- Any conventions promoted (one-line: name + reasoning)
- Any drift detected (one-line: file + convention)
- Any decision revisitation conditions triggered

Everything else happens silently in the files. The goal is zero developer effort.

## Final Step — Always (do this last, after all files are written)

Write the current UTC timestamp to `.pilot/internal/.last-synthesis` using the Write tool.
Format: `2025-01-15T10:30:00Z` (ISO 8601, no milliseconds).

This must be the absolute last action of synthesis. Writing it early would cause the next session
to miss any changes that occurred after the timestamp but before synthesis completed.
