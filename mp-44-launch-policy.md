# SPIKE-01 — Freeze v1 Launch Scope and Feature-Flag Strategy

**Status:** Proposed for approval  
**Date:** 2026-03-26  
**Document type:** Authoritative launch policy and implementation-planning document  
**Applies to:** County surface, Corridor surface, Parcel surface, story modes, packet/export behavior  
**Primary owners:** Product, Engineering, Research/Analytics, GTM  
**Related source documents:** `next-phase.md`, `planning/specs/02-three-surfaces.yaml`, `planning/specs/03-county-scoring.yaml`, `planning/specs/04-corridor-supply.yaml`, `planning/specs/05-parcel-packet.yaml`, `planning/county-power/scoring-framework-v1.md`, `planning/county-power/decision-log.md`, `planning/county-power/metric-dictionary.md`, `planning/county-power/boundary-manifest-v1.json`, `packages/http-contracts/src/county-intelligence-http.ts`, `packages/http-contracts/src/county-power-story-http.ts`, `packages/http-contracts/src/analysis-policy-http.ts`, `packages/http-contracts/src/launch-policy-http.ts`.

## 1. Executive decision

This document freezes the **v1 launch scope** for the three-surface system so that engineering, product, and GTM ship a single truth-safe experience.

### 1.1 Launch policy in one sentence

Launch **County nationally**, launch **Corridor in two explicit modes** (validated-market mode for 5 priority markets and derived-market mode elsewhere), and launch **Parcel nationally** with corridor-based access treated as contextual screening input rather than a hard gate. Supply-timeline and policy-watch subfeatures remain separately gateable if their launch dependencies are not ready.

### 1.2 Binding launch rules

1. **County is the discovery unit.** County ranking remains market-pressure only.
2. **Corridor is the feasibility unit.** Raw transmission/fiber/gas context belongs here, not as a county ranking pillar.
3. **Parcel is the pre-diligence unit.** Parcel gating remains legal/physical/undersizing-first, not corridor-first.
4. **Outside validated markets, corridors are visible only as derived corridors with explicit confidence labels.** They are never presented as surveyed ROW truth.
5. **Tier B + Tier B corridor inputs are capped at Medium evidence confidence.**
6. **Any corridor that fails the parameter-stability requirement is suppressed.**
7. **Corridors do not drive hard parcel gating.** They feed access scoring, narrative, and analyst review only.
8. **Low-confidence, stale, or unsupported outputs are downgraded or suppressed, never silently asserted.**

### 1.3 What this document does and does not decide

This document **does decide** launch visibility, labeling, market allowlists, confidence presentation, and go/no-go rules.

This document **does not re-open** the locked product architecture, the corridor derivation algorithm, the county market-pressure design, or the parcel gate logic. Those remain fixed unless changed through a separate design review.

## 2. Definitions and controlled terms

### 2.1 Validated market

A market on the priority allowlist whose corridor derivation was empirically validated in the 5-site corridor study and is eligible for the **Validated market** treatment at launch.

### 2.2 Non-priority market

Any market not on the validated-market allowlist. In these markets, corridor outputs may be shown only as **Derived corridor** outputs with explicit confidence labeling and caveat language.

### 2.3 Derived corridor

A corridor polygon or ribbon created from multi-infrastructure overlap logic using the locked derivation spec. “Derived” means the geometry is analytically produced from source layers. It does **not** mean surveyed, utility-confirmed, or engineering-grade ROW truth.

### 2.4 Surveyed ROW truth

Any presentation that would reasonably imply official, utility-confirmed, surveyed, or engineering-grade route certainty. v1 does **not** claim this for Tier B-derived corridors.

### 2.5 Confidence vector

The per-object confidence representation required by the confidence DAG:

- `evidence_confidence`
- `method_confidence`
- `coverage_confidence`
- `freshness_state`
- `suppression_state`

A single summary badge may be rendered for UX convenience, but the vector remains authoritative.

### 2.6 Priority allowlist key

The authoritative launch allowlist must be stored against **canonical market IDs** from the market-boundary system. Free-text market names are not sufficient for production control.

## 3. Priority market allowlist

The following five markets are the only markets that receive **validated-market treatment** at v1 launch.

| Canonical market ID | Launch market     | Validation site label | Min separation | Pairs < 0.25 mi | HIFLD VAL_METHOD mix           | Validation verdict | Launch treatment |
| ------------------- | ----------------- | --------------------: | -------------: | --------------: | ------------------------------ | ------------------ | ---------------- |
| `318`               | Atlanta           |     Atlanta Northeast |          22 ft |              12 | 100% IMAGERY                   | Strong pass        | Validated market |
| `559`               | Phoenix           |          Phoenix West |          29 ft |               1 | 100% IMAGERY/OTHER             | Strong pass        | Validated market |
| `364`               | Chicago           |          Chicago West |         116 ft |              52 | 100% IMAGERY                   | Strong pass        | Validated market |
| `382`               | Dallas/Fort Worth |     Dallas-Fort Worth |         116 ft |               7 | 64% IMAGERY/OTHER, 36% IMAGERY | Strong pass        | Validated market |
| `649`               | Northern Virginia |     Northern Virginia |         917 ft |               2 | 100% IMAGERY                   | Strong pass        | Validated market |

### 3.1 Empirical interpretation

- Overall verdict: **STRONG PASS**.
- The `0.25 mi` half-buffer is supported for Tier B corridor-defining linework in the tested markets.
- The market allowlist grants **validated-market treatment**, not “surveyed truth” treatment.
- No market outside these five may inherit validated-market treatment until explicitly added to the allowlist by change control.

### 3.2 Required production configuration

Engineering must materialize the allowlist as a versioned configuration object with the following fields at minimum:

| Field                      | Required | Description                                        |
| -------------------------- | -------- | -------------------------------------------------- |
| `market_id`                | Yes      | Canonical market identifier from market boundaries |
| `display_name`             | Yes      | User-facing market name                            |
| `validation_status`        | Yes      | `validated_strong_pass` for these five entries     |
| `validation_site_label`    | Yes      | Human-readable study label                         |
| `min_separation_ft`        | Yes      | Stored empirical result                            |
| `pairs_under_quarter_mile` | Yes      | Stored empirical result                            |
| `notes`                    | Optional | Short operator/source note                         |
| `effective_from`           | Yes      | Policy effective date                              |
| `policy_version`           | Yes      | This document version                              |

### 3.3 Change-control rule

Changing the allowlist requires:

1. recorded validation evidence,
2. product sign-off,
3. engineering sign-off,
4. GTM copy review if messaging changes, and
5. a new policy version.

## 4. Launch scope by surface

### 4.1 County surface scope

County launches **nationally**.

County remains a **market-pressure triage surface**, not an electrical-feasibility surface. Supply-timeline and policy-watch context may be present only if their own launch gates pass.

County v1 includes:

- market-pressure ranking and tier,
- catchment-adjusted market-pressure logic,
- top drivers,
- change windows,
- county confidence badge,
- contextual feasibility badges for supply timeline and grid friction where available,
- policy posture and contextual flags.

County v1 excludes:

- corridor-derived geometry presented as county truth,
- supply timeline or grid friction as county ranking pillars,
- any implication that county rank equals deliverability.

### 4.2 Corridor surface scope

Corridor launches in **two production modes**:

1. **Validated-market mode** for the 5 priority markets.
2. **Derived-market mode** for all non-priority markets.

The corridor surface may be rolled back by feature flag, but the intended v1 production behavior is that non-priority markets still show corridor outputs **only** as derived outputs with explicit confidence labeling. Supply-timeline overlays and narratives may be independently disabled if queue-model launch gates are not yet met.

### 4.3 Parcel surface scope

Parcel launches **nationally**.

Parcel gating is not restricted to validated markets because its hard gates are not corridor-dependent. Parcel access and power narrative, however, are corridor-context-sensitive and must follow the market treatment rules in this document. Policy/governance and power-timeline sections may be independently disabled if their upstream launch gates are not met.

## 5. Feature-flag and launch-configuration strategy

### 5.1 Policy structure

v1 launch control uses **two layers**:

1. **Authoritative launch configuration**: stable configuration objects such as the priority-market allowlist and non-priority display mode.
2. **Operational feature flags**: kill switches and rollout controls for surface visibility and truth enforcement.

Flags are not a license to violate locked truths. Some flags are **availability flags**. Others are **truth-enforcement flags** and must remain on in production.

### 5.2 Authoritative launch configuration

| Config key                          | Type   | Production default      | Purpose                                 |
| ----------------------------------- | ------ | ----------------------- | --------------------------------------- |
| `priority_corridor_market_ids`      | list   | the 5 validated markets | Controls validated-market treatment     |
| `non_priority_corridor_mode`        | enum   | `derived_visible`       | Controls non-priority corridor behavior |
| `confidence_policy_version`         | string | `v1`                    | Pins confidence behavior                |
| `truth_policy_version`              | string | `v1`                    | Pins export and caveat rules            |
| `corridor_validation_program_state` | enum   | `5_market_complete`     | Records current validation scope        |

Allowed values for `non_priority_corridor_mode`:

- `derived_visible`: intended production state for v1.
- `hidden`: emergency rollback state.
- `internal_only`: pre-launch or incident triage state.

### 5.3 Availability flags

| Flag                                  | Default         | Surface                    | Purpose                                                        | If OFF                                                       |
| ------------------------------------- | --------------- | -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `FF_V1_COUNTY_SURFACE`                | ON              | County                     | Enables county triage surface                                  | County experience hidden                                     |
| `FF_V1_COUNTY_FEASIBILITY_CONTEXT`    | ON              | County                     | Shows supply timeline/grid friction as contextual badges only  | County still available; contextual feasibility badges hidden |
| `FF_V1_SUPPLY_TIMELINE_CONTEXT`       | OFF until ready | County / Corridor / Parcel | Enables supply-timeline bands, badges, and narratives          | Supply-timeline content hidden; core surfaces still launch   |
| `FF_V1_POLICY_WATCH_CONTEXT`          | OFF until ready | County / Corridor / Parcel | Enables policy-watch context once posture rules are ready      | Policy-watch content hidden or limited to current legacy context |
| `FF_V1_CORRIDOR_SURFACE`              | ON              | Corridor                   | Enables corridor surface entry points and map layers           | Corridor experience hidden everywhere                        |
| `FF_V1_CORRIDOR_VALIDATED_BADGE`      | ON              | Corridor                   | Shows “Validated market” treatment in allowlisted markets      | No validated badge shown, but market mode still active       |
| `FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE` | ON              | Corridor                   | Allows non-priority markets to show derived corridors          | Non-priority corridors hidden                                |
| `FF_V1_PARCEL_SURFACE`                | ON              | Parcel                     | Enables parcel pre-diligence surface                           | Parcel experience hidden                                     |
| `FF_V1_PARCEL_CORRIDOR_ACCESS`        | ON              | Parcel                     | Shows corridor and hub access metrics where corridor survives policy gates | Parcel still launches, but corridor access section omitted   |
| `FF_V1_EXTERNAL_PACKET_EXPORTS`       | ON              | Packet/export              | Enables derived external renderer                              | External exports disabled; analyst/internal only             |

### 5.4 Truth-enforcement flags

These are **not experimental**. They are launch-protection controls and must remain ON in production.

| Flag                                         | Default | Applies to    | Rule enforced                                                | Production OFF allowed? |
| -------------------------------------------- | ------- | ------------- | ------------------------------------------------------------ | ----------------------- |
| `FF_V1_COUNTY_MARKET_PRESSURE_ONLY`          | ON      | County        | County ranking excludes supply timeline and grid friction as pillars | No                      |
| `FF_V1_CORRIDOR_CONFIDENCE_LABELS_REQUIRED`  | ON      | Corridor      | Every displayed corridor or hub must carry explicit confidence labeling | No                      |
| `FF_V1_CORRIDOR_STABILITY_GATE_ENFORCED`     | ON      | Corridor      | Unstable corridors are suppressed                            | No                      |
| `FF_V1_CORRIDOR_B_TIER_CAP_ENFORCED`         | ON      | Corridor      | Tier B + Tier B cannot exceed Medium evidence confidence     | No                      |
| `FF_V1_CORRIDOR_TIER_C_NOT_DEFINING`         | ON      | Corridor      | Tier C sources remain context-only, never corridor-defining  | No                      |
| `FF_V1_PARCEL_CORRIDOR_NEVER_HARD_GATES`     | ON      | Parcel        | Corridors may not drive hard parcel fail/pass gates          | No                      |
| `FF_V1_MISSING_ZONING_FLOOD_NEVER_AUTO_PASS` | ON      | Parcel        | Missing zoning/flood data cannot silently pass               | No                      |
| `FF_V1_EXTERNAL_PACKET_TRUTH_MODE`           | ON      | Packet/export | External packet wording cannot exceed internal truthfulness  | No                      |
| `FF_V1_LOW_CONFIDENCE_OR_STALE_SUPPRESSION`  | ON      | All           | Low-confidence/stale outputs are downgraded or suppressed    | No                      |

### 5.5 Flag precedence

Flag precedence is fixed:

1. **Truth-enforcement flags win over availability flags.**
2. **Priority-market allowlist wins over free-text UI routing.**
3. **Suppression state wins over display flags.**
4. **External export truth mode wins over sales styling.**

## 6. Exact non-priority-market behavior

### 6.1 County surface outside validated markets

Users do see:

- full county market-pressure triage experience,
- county rank, tier, and confidence badge,
- catchment logic and neighbor contributions,
- contextual feasibility badges if those features are otherwise available,
- a corridor CTA or context callout that makes clear corridor context is derived.

Users do not see:

- county wording that implies validated corridor treatment,
- corridor confidence implied by county rank,
- county-level claims of deliverable power or surveyed infrastructure truth.

Required county copy:

> Corridor context in this market is derived from infrastructure-overlap screening and should be used directionally, not as surveyed ROW truth.

### 6.2 Corridor surface outside validated markets

Users do see, if corridor display is enabled and the corridor survives confidence and suppression rules:

- corridor ribbons and hubs,
- a mandatory **Derived corridor** label,
- explicit confidence labeling,
- caveat text stating the output is not surveyed ROW truth,
- confidence-aware legends, tooltips, and cards,
- contextual infrastructure composition and route logic,
- parcel drill-down and access context.

Users do not see:

- a **Validated market** badge,
- “surveyed,” “utility-confirmed,” or “ROW-confirmed” phrasing,
- corridor objects that fail stability or suppression rules,
- any upgrade of Tier B-derived geometry to High evidence confidence.

Empty-state rule:

- keep county surface live,
- keep parcel surface live,
- show a corridor empty state stating corridor context is unavailable or not yet production-visible in that market,
- never fabricate a low-confidence placeholder corridor merely to avoid an empty state.

### 6.3 Parcel surface outside validated markets

Users do see:

- full parcel gating,
- pass, fail, and review-required outcomes,
- acreage, zoning, flood, and protected-land logic,
- corridor or hub access metrics only if corridor context is available and policy-compliant,
- policy and governance flags,
- confidence and provenance appendix,
- packet/export labels that distinguish derived corridor access from hard gates.

Users do not see:

- corridor-derived distance or access metrics used as hard parcel gates,
- any packet language that turns non-priority derived access into engineering confirmation,
- silent pass-through of missing zoning or flood fields.

If corridor context is suppressed or unavailable in a non-priority market:

- the parcel packet still renders,
- the access section must either show `Unavailable` or be omitted and explicitly noted as unavailable,
- hard-gate logic remains unaffected,
- the power narrative must not infer corridor support from absence of data.

## 7. Confidence labeling policy

### 7.1 Confidence model

v1 adopts the locked confidence-DAG model.

Confidence is **not** a single scalar lineage score. Every meaningful level that estimates, aggregates, derives geometry, allocates, or depends on parameterized logic gets its own local confidence operator.

Required confidence vector per object:

| Component             | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `evidence_confidence` | trustworthiness of the source inputs       |
| `method_confidence`   | trustworthiness of the construction method |
| `coverage_confidence` | completeness of the input support          |
| `freshness_state`     | freshness or staleness of supporting data  |
| `suppression_state`   | display state after policy checks          |

The public summary vocabulary remains **High / Medium / Low** where a single badge is needed. The vector remains authoritative.

### 7.2 Binding corridor confidence rules

1. **Tier B + Tier B evidence cap:** `evidence_confidence <= Medium`
2. **Tier C cannot define corridors.**
3. **Validated market treatment does not erase derivation caveats.**
4. **No corridor may be displayed if the stability requirement has not run or has failed.**
5. **Method confidence may not exceed what the local corridor derivation support justifies.**

### 7.3 Parameter-stability requirement

The corridor stability harness must test the locked sweep space:

- buffer: `0.20 / 0.25 / 0.30 mi`
- minimum length: `1.5 / 2.0 / 2.5 mi`
- shape threshold: `2.5:1 / 3.0:1 / 3.5:1`

Production outcome:

- `pass`: eligible for display, subject to all other policy checks,
- `fail`: suppressed,
- `not_run`: suppressed.

## 8. Surface behavior matrix

| Surface       | Validated markets                                            | Non-priority markets                                         | Suppressed/stale behavior                                    |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| County        | National county triage plus validated-market corridor CTA where applicable | National county triage plus derived-corridor CTA and caveat  | Hide corridor-related contextual cues if stale or suppressed; county ranking remains |
| Corridor      | Show corridors and hubs with validated-market treatment, confidence labels, and caveats | Show only derived corridors and hubs with explicit confidence labels and non-survey caveat | Hide failed, unstable, or stale-suppressed objects; show empty state |
| Parcel        | Full gating plus corridor or hub access metrics and narrative where corridor allowed | Full gating plus derived access metrics only if corridor allowed; otherwise omit or mark unavailable | Never let missing or suppressed corridor context alter hard gates |
| Packet/export | Internal packet may include full confidence vector and caveats | External packet must preserve “derived” and “not surveyed” language | Disable or degrade external packet if truth mode cannot be enforced |

## 9. Required user-facing language

Required corridor phrases:

- `Derived corridor`
- `Validated market` (allowlisted markets only)
- `Not surveyed ROW truth`
- `Directional screening only`
- `Does not imply deliverable capacity`

Required parcel phrases where applicable:

- `Derived corridor access`
- `Review required`
- `Missing zoning or flood data reduces confidence`
- `Corridor access is contextual and not a hard parcel gate`

County phrasing rule:

County language may discuss market pressure, catchment spillover, and contextual feasibility, but may not imply that county rank itself represents electrical feasibility or deliverability.

## 10. Operational implementation sequence

### Phase 1 — Freeze policy objects

1. publish this document,
2. bind the 5 validated markets to canonical market IDs,
3. create the authoritative launch configuration,
4. assign owners for every feature flag and truth-enforcement flag.

### Phase 2 — Wire launch controls into surface behavior

1. County reads validated or non-priority state only for contextual corridor messaging.
2. Corridor reads allowlist, non-priority mode, stability state, confidence vector, and suppression state before render.
3. Parcel reads corridor availability only for access and narrative sections, never for hard gates.
4. Packet/export renderers read truth-mode requirements before generating external artifacts.

### Phase 3 — QA and message alignment

1. Run QA on all 5 validated markets.
2. Run QA on at least one non-priority market per morphology bucket currently in scope.
3. Verify that non-priority corridors always show required caveat language.
4. Verify that county ranking never changes when corridor flags change.
5. Verify that parcel fail/pass outcomes do not change when corridor access is disabled.

### Phase 4 — Launch

1. enable county nationally,
2. enable corridor surface in validated markets,
3. enable non-priority derived corridor mode,
4. enable parcel nationally,
5. enable supply-timeline and policy-watch only if their subfeature gates pass,
6. enable external exports only after truth-mode QA passes.

## 11. Go / no-go checklist

Any unchecked blocker is a **no-go** for the affected surface.

### 11.1 Data readiness gates

- HIFLD transmission availability verified for corridor launch.
- FiberLocator availability and refresh path verified for corridor launch.
- Regrid parcel availability and packet field mapping verified for parcel launch.
- County publication healthy and queryable for county launch.
- Census adjacency availability required only if catchment delta launches in v1.
- Interconnection.fyi readiness required before `FF_V1_SUPPLY_TIMELINE_CONTEXT` can turn ON.
- EQ Research readiness required before `FF_V1_POLICY_WATCH_CONTEXT` can turn ON.
- Source registry rows exist for launch-critical dependencies.
- Freshness states configured for launch-critical sources.
- Suppression rules configured for missing, stale, or low-precision outputs.

### 11.2 Validation and confidence gates

- Priority allowlist complete and bound to canonical market IDs.
- 5-site empirical results stored in launch config or release notes.
- Stability harness complete for every displayed corridor.
- Tier B + Tier B cap enforced.
- Tier C excluded as corridor-defining input.
- Parcel hard gates proven independent of corridor toggles.
- Missing zoning or flood rule enforced.

### 11.3 Product and GTM messaging gates

- Product and GTM agree on validated vs derived wording.
- Sales/demo copy avoids deliverable-capacity claims.
- External packet renderer preserves review and caveat states.
- Support and CS receive approved explanation language.
- Rollback plan documented with non-priority corridor mode disabled first.

### 11.4 Locked-truth preservation checklist

The following 13 truths are binding launch assertions:

1. County = discovery unit, not electrical feasibility.
2. Corridor, utility, operator, and seam = feasibility units.
3. Parcel = pre-diligence unit.
4. County ranking remains market-pressure only.
5. Queue data is probabilistic, never deliverable supply.
6. Raw infrastructure is corridor-primary; parcel owns access metrics.
7. Missing zoning and flood data must not silently pass.
8. Confidence is a DAG with local operators, not a single scalar.
9. External packet exports never exceed internal truthfulness.
10. Gas is context-only in v1.
11. Validated-market treatment does not remove confidence labeling.
12. Tier assignment is fixed by calibration peer group.
13. Low-confidence or stale outputs are downgraded or suppressed.

### 11.5 Sign-off requirement

Required sign-off roles before production enablement:

- Product owner
- Engineering owner
- Research/analytics owner
- GTM owner
- Legal/compliance owner for restricted or export-sensitive datasets

## 12. Emergency rollback posture

Rollback order:

1. Disable `FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE`.
2. If needed, disable `FF_V1_CORRIDOR_SURFACE` globally.
3. If needed, disable `FF_V1_PARCEL_CORRIDOR_ACCESS` while keeping parcel hard gates live.
4. Keep county surface live unless county publication itself is compromised.

These truths must remain even in degraded mode:

- County ranking remains market-pressure only.
- Missing zoning/flood still cannot silently pass.
- External exports still cannot exceed internal truthfulness.
- Low-confidence or stale outputs still suppress or downgrade rather than silently assert.

## 13. Ownership and change control

| Area                            | Primary owner      | Secondary owner |
| ------------------------------- | ------------------ | --------------- |
| Allowlist and validation record | Research/Analytics | Product         |
| Feature flags and launch config | Engineering        | Product         |
| Confidence labeling policy      | Product + Research | Engineering     |
| Packet/export truth mode        | Product            | GTM + Legal     |
| GTM wording and enablement      | GTM                | Product         |

A new version of this document is required if any of the following change:

- a new market is added to the validated allowlist,
- non-priority corridor mode changes from `derived_visible`,
- Tier B + Tier B confidence cap changes,
- parcel hard-gate semantics change,
- county ranking pillars change,
- external packet truth standard changes.

## Appendix A — Implementation touchpoints

- Reuse the existing county confidence vocabulary from `packages/http-contracts/src/county-intelligence-http.ts` (`high`, `medium`, `low`) for user-facing badges.
- Keep dataset licensing policy and product launch policy separate. The existing `analysis-policy` pattern is structural precedent for runtime gating, but launch visibility is not the same as licensing.
- County UI should surface corridor caveat text based on validated vs non-priority state, not by changing county rank semantics.
- Corridor overlays must read validated-market state, non-priority mode, stability state, and confidence labels before display.
- Parcel gating remains independent of corridor visibility.
- Packet renderers must read truth mode and confidence metadata before external export.

## Appendix B — Final launch posture summary

Intended production posture:

- **County:** on nationally.
- **Corridor:** on in validated markets; on elsewhere as derived with explicit confidence labels.
- **Parcel:** on nationally.
- **External packet:** on only if truth-mode checks pass.

Simplest GTM-safe explanation:

> County tells you where to look next. Corridor tells you what infrastructure and friction may actually matter there. Parcel tells you what survives first-pass diligence. Outside our validated corridor markets, corridor outputs remain visible but are explicitly labeled as derived screening outputs rather than surveyed route truth.
