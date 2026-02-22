---
name: Bug report
about: Something isn't working correctly
labels: bug
---

## What happened

<!-- Describe what went wrong. Be specific: what did you do, what did you expect, what actually happened? -->

## Environment

| Field | Value |
|---|---|
| OS | <!-- macOS 14 / Ubuntu 24 / Windows 11 --> |
| Node.js version | <!-- node --version --> |
| Claude Code version | <!-- shown in Claude Code settings or --version --> |
| Project Pilot version | <!-- check .claude-plugin/plugin.json → "version" --> |

## Which script or command failed

<!-- Which of these was involved? -->
- [ ] `/init-pilot`
- [ ] `/project-pilot:pilot-dashboard`
- [ ] `/project-pilot:pilot-status`
- [ ] `session-start.js` (fires on session start / clear / compact)
- [ ] `log-change.js` (fires when files are written/edited)
- [ ] `pre-bash.js` / `post-bash-guard.js` (snapshot guard)
- [ ] `post-test.js` (fires after test commands)
- [ ] Other: ___

## Error output

<!-- Paste the exact error message from Claude Code's output pane. Include 🔴 / 🟡 / ℹ️ prefix if present. -->

```
paste error here
```

## Hook payload (if known)

<!-- If a hook script failed, the payload is the JSON Claude Code sends on stdin.
     You can often reconstruct it from context — e.g. which file was being written,
     which bash command was run. -->

```json

```

## Steps to reproduce

1. 
2. 
3. 

## Additional context

<!-- Anything else: project type, number of files, whether .pilot/ exists, recent changes to the project. -->
