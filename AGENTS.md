# AGENTS Rules (map)

## Ultracite (Codex)
- Keep Biome aligned with Ultracite presets (`ultracite/biome/core` and `ultracite/biome/vue`).
- Before finishing changes, run `bun x ultracite fix` (or `bun run ultracite:fix`) and ensure checks pass with `bun x ultracite check`.

## Export Wrappers
- Do not create files whose only purpose is a one-line re-export (for example: `export * from "..."`).
- Prefer exporting from the nearest meaningful barrel (`index.ts`) or from the real module directly.
- Before adding any new file, verify it contains actual logic or type definitions, not only pass-through exports.
- Never add pass-through exports to deep module paths when the module is already available from a local domain barrel.
- If a file exists only to re-export symbols and adds no grouping value, remove it.

## File Naming
- Use kebab-case for filenames and directory names in this repository.
- Do not introduce PascalCase filenames (for example, use `app.vue`, not `App.vue`).
- When renaming or creating Vue components, keep the file path kebab-case even if component symbols are PascalCase in code.

## Frontend Feature Modules
- Keep feature entry files focused on orchestration (for example, `layer.ts`, `view.ts`, `composable.ts`).
- Put feature-specific type contracts in `*.types.ts` files colocated in the same feature folder.
- Put reusable pure feature helpers (mapping, normalization, formatting, bbox/math utilities) in `*.service.ts` files.
- If a feature file starts with multiple interfaces and helper functions before the main exported function, split those into `*.types.ts` and/or `*.service.ts`.

## Type Safety Conventions
- Avoid type assertions in source code (`as ...`, `as const`) unless there is no safe narrowing alternative.
- Prefer explicit type annotations, discriminated unions, and runtime guards over assertions.

## Immutability Defaults
- Prefer `const` bindings by default; use mutable state only when reassignment is required by lifecycle behavior.
- Prefer `readonly` properties for shared config, transport contracts, and feature options/types.
- Keep mutations localized in explicit state holders (`state` objects) instead of reassigning scattered `let` variables.

## No Fallbacks Or Legacy Paths
- Keep one real production path as the default implementation.
- Do not add runtime fixture fallbacks, legacy compatibility branches, or source-mode toggles unless the user explicitly requests a time-boxed migration path.
- Fail fast with clear errors when required infrastructure is unavailable instead of silently degrading behavior.
- Remove temporary migration or fallback code as soon as the real path is in place.

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
