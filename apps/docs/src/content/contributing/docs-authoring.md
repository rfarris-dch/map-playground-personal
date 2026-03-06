---
title: Docs Authoring
description: How to add or update docs content without breaking the information architecture or Tailwind Plus Syntax parity.
---

The docs app is a Vue surface, but the authoring model is content-first.

## Content model

### Primary authored content

Write new docs pages in `apps/docs/src/content/**/*.md` with frontmatter:

```md
---
title: Page Title
description: One sentence summary
---
```

### Migrated source material

Legacy materials in `docs/architecture`, `docs/research`, `docs/review`, and `docs/runbooks` are imported into the app as source documents instead of being left stranded outside the navigation tree.

## Supported authoring features

- headings
- tables
- fenced code blocks
- long-form prose
- callouts with `:::note` and `:::warning`

## Navigation and route rules

- Keep the route tree stable once pages are added to navigation.
- Put new pages in the nearest meaningful section instead of inventing a new top-level bucket.
- Update navigation, search coverage, and source references together.

## Tailwind Plus Syntax parity rules

- Preserve the existing visual system from `docs/tailwind-plus-syntax/syntax-ts`.
- Reuse the same fonts, spacing, gradients, prose treatment, and shell patterns.
- Treat visual drift as a bug, not as an opportunity to redesign the docs UI.

## Verification expectation

The PRD expects browser verification with `agent-browser` for touched docs routes at desktop and mobile breakpoints. When the tool is available, use it to validate:

- navigation flow
- search flow
- table of contents
- mobile navigation
- light and dark mode presentation

## Before finishing docs work

```bash
bun --cwd apps/docs lint
bun --cwd apps/docs typecheck
bun --cwd apps/docs build
bun x ultracite fix apps/docs docs
bun x ultracite check apps/docs docs
```
