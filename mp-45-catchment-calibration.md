# MP-45 Catchment Calibration Freeze

## Scope

This artifact freezes the launch policy for county catchment spillover under `MP-45`.
It is a calibration and audit contract, not the full pooling engine implementation.

The authoritative machine-readable launch config lives in:

- `packages/core-runtime/src/confidence/catchment-calibration.ts`

Config version:

- `county-catchment-spillover-v1`

## Locked decisions

### Formula

Catchment pooling applies at the raw-feature level for market-pressure families only:

```text
x_i_catchment = x_i_local + lambda_f * sum_j(w_ij_f * x_j)
```

Where:

- `i` is the focal county
- `j` is an adjacent county
- `w_ij_f` is normalized shared-boundary weighting with point-touch policy by family
- `lambda_f` is the family-specific spillover intensity

### Spillover scope

Eligible for catchment pooling:

- competition intensity
- absorption pressure
- development activity
- land pipeline
- facility counts
- transaction activity

Explicitly excluded from catchment pooling:

- policy / governance
- utility process posture
- seam friction
- supply timeline
- grid friction
- congestion context

### Launch lambdas

| Family | Spillover class | Launch lambda | Point-touch policy | Point-touch weight |
| --- | --- | ---: | --- | ---: |
| `competition-intensity` | high | 0.30 | weak inclusion | 0.05 |
| `absorption-pressure` | high | 0.25 | excluded | 0.00 |
| `development-activity` | high | 0.20 | excluded | 0.00 |
| `land-pipeline` | medium | 0.15 | excluded | 0.00 |
| `facility-counts` | medium | 0.10 | excluded | 0.00 |
| `transaction-activity` | medium | 0.10 | excluded | 0.00 |
| `policy-governance` | none | 0.00 | excluded | 0.00 |
| `utility-process` | none | 0.00 | excluded | 0.00 |
| `seam-friction` | none | 0.00 | excluded | 0.00 |

## Structural caps

These caps are frozen for launch and must apply regardless of family:

- no single neighbor may carry more than `50%` of spillover weight
- total spillover contribution may not exceed `35%` of the adjusted family signal
- if a family does not beat the local-only baseline stably across peer groups, its launch lambda is reset to `0`

## Point-touch policy

Launch default:

- shared-edge neighbors are eligible for all spillover-enabled families
- point-touch neighbors are excluded by default
- only `competition-intensity` may use weak point-touch inclusion at launch
- weak inclusion means `point_touch_weight = 0.05`, not parity with shared-edge neighbors

Current debug/API reference family:

- `competition-intensity`

That reference family is used only to make current county catchment debug output deterministic.
It does not imply that all catchment families use point-touch weighting.

## Reproducible backtest protocol

The launch config is justified by a bounded, reproducible backtest:

1. Calibrate one lambda per metric family, not market-specific lambdas.
2. Use rolling out-of-sample targets with only information available at time `t`.
3. Evaluate forward windows at `t+12m` and `t+24m`.
4. Search bounded lambda values in `[0, 0.35]`.
5. Compare local-only vs catchment-adjusted variants across peer groups:
   - priority vs non-priority markets
   - market-temperature quintiles
   - operator-region cohorts
6. Targets:
   - provider entry count
   - signed IA growth
   - under-construction MW
   - commissioned MW
   - transaction activity
7. Reject any family whose catchment variant fails stable lift after structural caps.

## Audit expectations

Any future change to launch lambdas, point-touch policy, or structural caps must:

- create a new config version
- document the comparison against `county-catchment-spillover-v1`
- preserve the peer-group backtest outputs and audit notes
- update any debug/reference-family outputs that rely on the launch config
