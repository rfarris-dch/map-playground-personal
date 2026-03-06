---
title: Release Checklist
description: Final parity and integrity checks for the docs app before shipping changes.
---

Use this checklist before treating the docs app as releasable.

## UI and interaction parity

- Landing page preserves the Tailwind Plus Syntax hero, shell, and typography model.
- Desktop navigation matches the intended information architecture.
- Mobile navigation opens, closes, and routes correctly.
- Search modal opens from keyboard shortcut and returns the expected pages.
- Table of contents highlights the active section on long pages.
- Previous and next links follow the navigation order.
- Light and dark mode both render correctly.

## Content integrity

- Onboarding pages cover workspace layout, shared commands, and contributor starting points.
- Application pages cover `apps/web`, `apps/api`, and `apps/pipeline-monitor`.
- Package pages cover the current shared packages.
- Operations pages cover scripts, runbooks, and troubleshooting paths.
- Migrated artifact pages cover the existing docs corpus in `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks`.

## Safety checks

- Docs work is limited to docs surfaces plus minimal workspace wiring.
- No business behavior changed in `apps/web`, `apps/api`, `apps/pipeline-monitor`, `packages/*`, or production scripts.
- Source references still point to real files and real operational artifacts.

## Required commands

```bash
bun --cwd apps/docs lint
bun --cwd apps/docs typecheck
bun --cwd apps/docs build
bun x ultracite fix apps/docs docs
bun x ultracite check apps/docs docs
```
