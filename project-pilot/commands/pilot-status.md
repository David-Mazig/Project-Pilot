# /project-pilot:pilot-status — Project Intelligence Status

You are providing a concise status report of the project's current state using the Project Pilot intelligence files.

## What To Do

1. Read the following files (skip any that don't exist):
   - `.pilot/active-context.md`
   - `.pilot/progress.md`
   - `.pilot/patterns.md`
   - `.pilot/decisions.md`
   - `.pilot/internal/change-ledger.log` (last 20 lines only)
   - `.pilot/internal/dependency-map.md`
   - List files in `.pilot/modules/` to see available module context

2. Present a concise status report in this format:

**Currently Working On:** [From active-context.md]

**Feature Status:** [From progress.md — summarize counts per state]
- Verified: [count and names]
- Implemented (Unverified): [count and names — flag these, they're risk areas]
- Has Known Issues: [count and names with brief issue descriptions]
- In Progress: [count and names]

**Convention Health:** [From patterns.md — quick summary]
- Established: [count] ([count] seed, [count] harvested, [count] confirmed)
- Under Observation: [count] TBD slots remaining
- Alignment Candidates: [count] files flagged for convention alignment, or "None"

**Next Up:** [From active-context.md]

**Recent Changes This Session:** [From change-ledger.log — summarize, don't list every line]

**Module Context Available:** [List modules that have .pilot/modules/[name].md files, or "None yet" if empty]

**Open Decisions:** [Any active decisions with revisit conditions that may be approaching, or gaps noted in architecture.md]

**Known Issues:** [From active-context.md and progress.md "Has Known Issues" — tech debt, bugs, blockers]

3. If you notice anything concerning — stale active context that doesn't match the codebase, decisions that might need revisiting based on recent changes, unverified features being built upon, TBD convention slots that have been under observation for 10+ sessions without resolution, or many alignment candidates accumulating — mention it briefly at the end.

## Rules

- This is a READ-ONLY operation. Do not modify any files.
- Keep the report concise — the developer wants a quick snapshot, not a document.
- If `.pilot/` doesn't exist, tell the developer to run `/project-pilot:init-pilot` first.
