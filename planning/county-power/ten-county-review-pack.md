# Ten County Review Pack

Use this pack in the Ian session to review representative successes, seams, and intentional nulls from the live county-power publication `county-market-pressure-county-power-public-us-20260324t123500z`.

## How To Use This Pack

For each county, classify the result as one of:

- `correct`
- `incorrect`
- `ambiguous`
- `impossible_from_public_data`

Focus on:

1. region truth
2. subregion truth
3. queue siting realism
4. congestion plausibility
5. whether any null should stay null

## Review Counties

### 1. Santa Clara County, CA (`06085`)

- Operator: `CAISO`
- Market structure: `organized_market`
- Operator zone: `PGAE`
- Operator zone type: `queue_study_region`
- Operator zone confidence: `medium`
- Meteo zone: present
- Avg RT congestion: `3.8681`
- P95 shadow price: `646.5837`
- Active queue projects: `8`
- Active queue MW: `1018.00`

Review question: is `queue_study_region` acceptable as the county-facing CAISO subregion label, or do we need a richer Atlas reference layer before sales uses it?

### 2. Travis County, TX (`48453`)

- Operator: `ERCOT`
- Market structure: `organized_market`
- Operator zone: `South Central`
- Operator zone type: `weather_zone`
- Operator zone confidence: `high`
- Operator weather zone: `South Central`
- Meteo zone: `Travis (TX192)`
- Avg RT congestion: `13.4653`
- P95 shadow price: `640.1061`
- Active queue projects: `8`
- Active queue MW: `631.89`

Review question: do we formally bless ERCOT weather zones as the county-facing operator subregion until a different ERCOT county subregion source exists?

### 3. New York County, NY (`36061`)

- Operator: `NYISO`
- Market structure: `organized_market`
- Operator zone: `J`
- Operator zone type: `load_zone`
- Operator zone confidence: `medium`
- Meteo zone: `New York (Manhattan) (NY072)`
- Avg RT congestion: `-0.0998`
- P95 shadow price: `67.5500`
- Active queue projects: `2`
- Active queue MW: `0.00`

Review question: is the current `load_zone` mapping and queue assignment plausible for Manhattan, and are any seam adjustments needed around NYC borough counties?

### 4. Washington County, MN (`27163`)

- Operator: `MISO`
- Market structure: `organized_market`
- Operator zone: `LRZ 1`
- Operator zone type: `local_resource_zone`
- Operator zone confidence: `low`
- Meteo zone: `Washington (MN063)`
- Avg RT congestion: `-0.0434`
- P95 shadow price: `43.3600`
- Active queue projects: `1`
- Active queue MW: `0.00`

Review question: is `LRZ 1` acceptable as the county-facing MISO subregion, and should this county remain `low` confidence due to LRZ seam behavior?

### 5. St. Louis County, MO (`29189`)

- Operator: `MISO`
- Market structure: `organized_market`
- Operator zone: `LRZ 5`
- Operator zone type: `local_resource_zone`
- Operator zone confidence: `low`
- Meteo zone: `St. Louis (MO063)`
- Avg RT congestion: `0.1178`
- P95 shadow price: `43.3600`
- Active queue projects: `0`
- Active queue MW: `0.00`

Review question: does the county-level LRZ and congestion context look reasonable in a dense seam-heavy metro county without an active queue signal?

### 6. Oklahoma County, OK (`40109`)

- Operator: `SPP`
- Market structure: `organized_market`
- Operator zone: null
- Operator zone type: null
- Meteo zone: `Oklahoma (OK025)`
- Avg RT congestion: `0.0725`
- P95 shadow price: `0.0000`
- Active queue projects: `19`
- Active queue MW: `5206.93`

Review question: should the county stay null for operator subregion until a stronger SPP settlement-location bridge exists, or is there an official subregion we can safely use now?

### 7. Montgomery County, PA (`42091`)

- Operator: `PJM`
- Market structure: `organized_market`
- Operator zone: `PENELEC`
- Operator zone type: `utility_zone_proxy`
- Operator zone confidence: `low`
- Meteo zone: `Eastern Montgomery (PA104) / Western Montgomery (PA103)`
- Avg RT congestion: `-6.8188`
- P95 shadow price: `1000.0000`
- Active queue projects: `3`
- Active queue MW: `18.00`

Review question: is the current `utility_zone_proxy` acceptable as an interim county subregion, or do we need a PJM system-map alias layer before this should be shown broadly?

### 8. Alexandria city, VA (`51510`)

- Operator: `PJM`
- Market structure: `organized_market`
- Operator zone: `DOM`
- Operator zone type: `utility_zone_proxy`
- Operator zone confidence: `low`
- Meteo zone: `Arlington/Falls Church/Alexandria (VA054)`
- Avg RT congestion: `5.1382`
- P95 shadow price: `1000.0000`
- Active queue projects: `0`
- Active queue MW: `0.00`

Review question: should independent-city county-equivalents like Alexandria keep the current PJM proxy zone, or do they need a dedicated alias or seam treatment?

### 9. Fulton County, GA (`13121`)

- Operator: `Southern Company Services, Inc. - Trans`
- Market structure: `traditional_vertical`
- Operator zone: null
- Operator weather zone: null
- Meteo zone: `North Fulton (GA033) / South Fulton (GA044)`
- Avg RT congestion: null
- P95 shadow price: null
- Active queue projects: `0`
- Active queue MW: `0.00`

Review question: are these nulls the right outcome for a traditional vertically integrated county with no defensible public county congestion or subregion mapping?

### 10. Kalawao County, HI (`15005`)

- Operator: `Maui Electric Co Ltd`
- Market structure: `traditional_vertical`
- Operator zone: null
- Operator weather zone: null
- Meteo zone: null
- Avg RT congestion: null
- P95 shadow price: null
- Active queue projects: `0`
- Active queue MW: `0.00`

Review question: is `15005` truly a missing meteorology join we should fix, or should it remain a documented county-equivalent exception in the public layer?

## Additional Session Packs To Bring

1. `unresolved-queue-tail.csv` for source-level queue ambiguity.
2. `source-registry.csv` for authoritative source review.
3. `boundary-manifest-v1.json` for county-to-region and county-to-subregion semantics.
