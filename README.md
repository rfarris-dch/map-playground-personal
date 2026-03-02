# map-platform

Current state:

- Bun workspace + Turbo task graph at repo root.
- `apps/api` serves geo endpoints.
- `apps/web` renders map + feature overlays.
- Shared packages hold contracts, SQL specs, map engine adapter, and ops utilities.

Architecture docs:

- DDD baseline: `docs/architecture/ddd.qmd`
