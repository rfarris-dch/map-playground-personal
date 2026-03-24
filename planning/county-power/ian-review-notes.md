# Ian Review Notes

Session purpose: capture truth corrections, seam cases, and impossible-from-public-data rules in a structured form that can be converted into code, overrides, and regression tests.

## Session Metadata

- Date:
- Participants:
- Recording approved:
- Publication reviewed:
- Boundary manifest reviewed:

## Boundary Truth Findings

| County or region | Current output | Ian classification | Correction needed | Evidence or source | Owner | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| Example | `PJM / utility_zone_proxy / low` | ambiguous | yes | public map plus internal review | Ian | add override |

## Seam And Border Cases

| Case | Current handling | Ian decision | Keep null | Add override | Promote consultant or Ian geometry | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Example seam county | `LRZ 1 / low confidence` | ambiguous | no | yes | yes | Needs explicit seam rule |

## Unresolved Queue Examples

| Source system | Project or label | Current reason | Ian classification | Action | Notes |
| --- | --- | --- | --- | --- | --- |
| `pjm_planning_queue` | `Solar Holler` | weak public siting detail | ambiguous | add public map alias | likely map-export candidate |

## Impossible From Public Data

List rows or classes of rows that should remain unresolved unless a purchased, consultant, or Ian-adjusted source is added.

- 
- 
- 

## Boundary Corrections To Implement

| Priority | Change | Table or code target | Confidence class | Owner | Target release |
| --- | --- | --- | --- | --- | --- |
| High | Example county-to-zone override | `bridge_county_operator_zone` | `ian_adjusted` | Robert | next publication |

## Queue Resolver Rules To Add

| Priority | Rule | Example label | Source system | Expected resolver type | Confidence |
| --- | --- | --- | --- | --- | --- |
| High | Example substation alias | `Grandview-Clifftop 138 kV` | `pjm_planning_queue` | `poi_lookup` | `medium` |

## Regression Tests To Freeze

| Test case | Expected output | Why it matters | Table or endpoint |
| --- | --- | --- | --- |
| Example county | `operatorZoneLabel stays null` | protects null policy | `/scores`, `/debug` |

## Decisions Captured During Session

1. 
2. 
3. 

## Post-Session Checklist

- Convert accepted corrections into `decision-log.md`
- Convert durable queue fixes into `fact_queue_resolution_override`
- Convert durable boundary fixes into the boundary manifest or bridge tables
- Add regression fixtures for every accepted seam or impossible-from-public-data case
