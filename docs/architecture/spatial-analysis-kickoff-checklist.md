# Spatial Analysis Kickoff Checklist

## Program Tracks
- `api`: contracts, route handlers, envelope consistency, auth hooks.
- `data`: DDL migrations, seed/backfill, materialized views.
- `pipeline`: sync status/progress, tile publish, rollback tooling.
- `web`: map UX, coherency handling, saved views, analysis surfaces.
- `security`: RBAC, entitlement policy, audit controls.
- `sre`: SLOs, alerting, game day runbooks.

## Sprint Map (30/60/90)
| Item | Owner | Target Sprint | Gate |
|---|---|---|---|
| Publish OpenAPI baseline | api | S1 | Stage 1 |
| Add contract tests for analysis endpoints | api | S1 | Stage 1 |
| Apply spatial-analysis DDL in staging | data | S1 | Stage 1 |
| Enable parcels guardrails in production path | web | S1 | Stage 1 |
| Implement progress JSON emission and monitor preference | pipeline | S1 | Stage 1 |
| Build scoring endpoint MVP | api + data | S2 | Stage 2 |
| Build proximity endpoint MVP | api + data | S2 | Stage 2 |
| Add saved views create/load/share | web + api | S2 | Stage 2 |
| Add 409 coherency retry + UX banner | web | S2 | Stage 2 |
| MySQL write-of-record for saved views/entitlements | data + api | S3 | Stage 3 |
| CDC drift monitoring + alerting | data + sre | S3 | Stage 3 |
| Export policy enforcement + audit logging | security + api | S3 | Stage 3 |
| DR game day execution | sre | S3 | Stage 3 |

## Artifact Landing Checklist
- [x] `docs/architecture/spatial-analysis-openapi.yaml`
- [x] `scripts/sql/spatial-analysis-overhaul.ddl.sql`
- [x] `docs/runbooks/spatial-analysis-ops.md`
- [x] `docs/architecture/spatial-analysis-kickoff-checklist.md`

## Stage 1 Acceptance
- [ ] OpenAPI examples validated against contracts in CI.
- [ ] Staging migration executes cleanly with rollback notes.
- [ ] Parcels guardrails enabled with explicit override env flag for dev only.
- [ ] Pipeline monitor reads `run.progress` before parsing `run.summary`.

## Stage 2 Acceptance
- [ ] `/analysis/parcels/score` returns constraints, components, provenance.
- [ ] `/analysis/proximity` supports parcel/facility/geometry targets.
- [ ] Saved views can restore map state by `viewId`.
- [ ] 409 mismatch UX recovers automatically for most retries.

## Stage 3 Acceptance
- [ ] MySQL authoritative tables live for user artifacts.
- [ ] CDC lag and drift alerts wired to paging policy.
- [ ] Export entitlement checks enforced server-side.
- [ ] Audit records emitted for exports, sharing, model/boundary publishes.

## Blocking Decisions (Owner Assignment Required)
- Market metric formulas and time windows (`product` + `data science`).
- Pricing sensitivity policy and k-anonymity threshold (`legal` + `security`).
- Dataset licensing matrix (`legal` + `data`).
- Boundary set publish governance (`product` + `market admin`).
- MySQL scope boundary (`architecture`).
