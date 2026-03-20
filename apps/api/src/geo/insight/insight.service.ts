import { runQuery } from "@/db/postgres";
import type {
  ForecastPoint,
  ForecastRow,
  MarketCapacityPoint,
  MarketInsightResponse,
  MarketSizeHistoryPoint,
  MarketSizeHistoryRow,
  MarketSizeReportRow,
  PreleasingPercentageResponse,
  PreleasingRow,
  PricingAveragePoint,
  PricingCategoryRange,
  PricingForecastRow,
  PricingHistoryRow,
  PricingPoint,
  PricingRatioResponse,
  PricingRatioRow,
  RawMarketQuarterRow,
  SubmarketCapacityPoint,
  SubmarketInsightRecord,
  SubmarketQuarterRow,
  SubmarketTtmRecord,
  TtmGrowthResponse,
  TtmGrowthRow,
} from "./insight.types";

const REQUESTED_MARKET_CTE = `
WITH requested_market AS (
  SELECT
    source_rows.market_id::text AS source_market_id,
    source_rows.name AS market_name,
    source_rows.region AS region_name,
    xwalk.market_id AS canonical_market_id
  FROM market_source.markets AS source_rows
  INNER JOIN canon.xwalk_market_source AS xwalk
    ON xwalk.source_table = 'HAWK_MARKET'
   AND xwalk.source_pk = source_rows.market_id::text
  WHERE source_rows.payload->>'EXTERNAL_ID' = $1
  LIMIT 1
)
`;

function readNullableNumber(value: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readNumber(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundKwFromMw(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Math.round(value * 1000);
}

function midpoint(args: {
  readonly max: number | null;
  readonly min: number | null;
}): number | null {
  if (args.min === null || args.max === null) {
    return null;
  }

  return (args.min + args.max) / 2;
}

function buildVacancyRatio(args: {
  readonly availableMw: number | null;
  readonly commissionedMw: number | null;
  readonly reportedVacancyPct: number | null;
}): number | null {
  if (args.reportedVacancyPct !== null) {
    return args.reportedVacancyPct / 100;
  }

  if (args.availableMw === null || args.commissionedMw === null || args.commissionedMw === 0) {
    return null;
  }

  return args.availableMw / args.commissionedMw;
}

function buildDerivedAbsorptionMw(args: {
  readonly availableMw: number | null;
  readonly commissionedMw: number | null;
  readonly previousAvailableMw: number | null;
  readonly previousCommissionedMw: number | null;
  readonly reportedAbsorptionMw: number | null;
}): number | null {
  if (args.reportedAbsorptionMw !== null) {
    return args.reportedAbsorptionMw;
  }

  if (
    args.availableMw === null ||
    args.commissionedMw === null ||
    args.previousAvailableMw === null ||
    args.previousCommissionedMw === null
  ) {
    return null;
  }

  return (
    args.commissionedMw - args.previousCommissionedMw + args.previousAvailableMw - args.availableMw
  );
}

function buildCapacityPoint(
  row: RawMarketQuarterRow,
  previousRow: RawMarketQuarterRow | null
): MarketCapacityPoint {
  const commissionedMw = readNullableNumber(row.commissioned_mw);
  const availableMw = readNullableNumber(row.available_mw);
  const underConstructionMw = readNullableNumber(row.under_construction_mw);
  const plannedMw = readNullableNumber(row.planned_mw);
  const operatorPlannedMw = readNullableNumber(row.operator_planned_mw);
  const siteDeveloperPlannedMw = readNullableNumber(row.site_developer_planned_mw);
  const preleasingMw = readNullableNumber(row.preleasing_mw);
  const previousAvailableMw =
    previousRow === null ? null : readNullableNumber(previousRow.available_mw);
  const previousCommissionedMw =
    previousRow === null ? null : readNullableNumber(previousRow.commissioned_mw);
  const quarter = Math.trunc(readNumber(row.quarter_num));
  const year = Math.trunc(readNumber(row.year_num));

  return {
    absorption: roundKwFromMw(
      buildDerivedAbsorptionMw({
        availableMw,
        commissionedMw,
        previousAvailableMw,
        previousCommissionedMw,
        reportedAbsorptionMw: readNullableNumber(row.absorption_override_mw),
      })
    ),
    availablePower: roundKwFromMw(availableMw),
    commissionedPower: roundKwFromMw(commissionedMw),
    fullQy: `${quarter}Q ${year}`,
    operatorPlannedPower: roundKwFromMw(operatorPlannedMw),
    plannedPower: roundKwFromMw(plannedMw),
    powerUnits: "kW",
    preleasing: roundKwFromMw(preleasingMw),
    quarter,
    siteDeveloperPlannedPower: roundKwFromMw(siteDeveloperPlannedMw),
    status: "Live",
    underConstructionPower: roundKwFromMw(underConstructionMw),
    vacancy: buildVacancyRatio({
      availableMw,
      commissionedMw,
      reportedVacancyPct: readNullableNumber(row.vacancy_pct_reported),
    }),
    year,
  };
}

function buildSubmarketCapacityPoint(
  row: SubmarketQuarterRow,
  previousRow: SubmarketQuarterRow | null
): SubmarketCapacityPoint {
  const commissionedMw = readNullableNumber(row.commissioned_mw);
  const availableMw = readNullableNumber(row.available_mw);
  const quarter = Math.trunc(readNumber(row.quarter_num));
  const year = Math.trunc(readNumber(row.year_num));

  return {
    absorption: buildDerivedAbsorptionMw({
      availableMw,
      commissionedMw,
      previousAvailableMw:
        previousRow === null ? null : readNullableNumber(previousRow.available_mw),
      previousCommissionedMw:
        previousRow === null ? null : readNullableNumber(previousRow.commissioned_mw),
      reportedAbsorptionMw: null,
    }),
    commissioned: commissionedMw,
    live: true,
    planned: readNullableNumber(row.planned_mw),
    quarter,
    submarketId: row.submarket_id,
    submarketName: row.submarket_name,
    underConstruction: readNullableNumber(row.under_construction_mw),
    vacancy: buildVacancyRatio({
      availableMw,
      commissionedMw,
      reportedVacancyPct: null,
    }),
    year,
  };
}

function buildPricingRange(args: {
  readonly max: number | null;
  readonly min: number | null;
}): PricingCategoryRange {
  return {
    max: args.max,
    min: args.min,
  };
}

function readPricingCurrencyCode(): string {
  return "USD";
}

function buildPricingPoint(args: {
  readonly highRangeMax: number | null;
  readonly highRangeMin: number | null;
  readonly hyperMax: number | null;
  readonly hyperMin: number | null;
  readonly lowRangeMax: number | null;
  readonly lowRangeMin: number | null;
  readonly year: string;
}): PricingPoint {
  return {
    currency: readPricingCurrencyCode(),
    hyperscaleMidRange: null,
    hyperscaleRange: buildPricingRange({
      max: args.hyperMax,
      min: args.hyperMin,
    }),
    hyperscaleUpperRange: null,
    retailRange: buildPricingRange({
      max: args.lowRangeMax,
      min: args.lowRangeMin,
    }),
    wholesaleRange: buildPricingRange({
      max: args.highRangeMax,
      min: args.highRangeMin,
    }),
    year: args.year,
  };
}

function buildPricingAveragePoint(args: {
  readonly highRangeMax: number | null;
  readonly highRangeMin: number | null;
  readonly hyperMax: number | null;
  readonly hyperMin: number | null;
  readonly lowRangeMax: number | null;
  readonly lowRangeMin: number | null;
  readonly year: number;
}): PricingAveragePoint {
  return {
    currency: readPricingCurrencyCode(),
    hyperscaleMidRange: null,
    hyperscaleRange: midpoint({
      max: args.hyperMax,
      min: args.hyperMin,
    }),
    hyperscaleUpperRange: null,
    retailRange: midpoint({
      max: args.lowRangeMax,
      min: args.lowRangeMin,
    }),
    wholesaleRange: midpoint({
      max: args.highRangeMax,
      min: args.highRangeMin,
    }),
    year: args.year,
  };
}

export async function getMarketInsight(marketId: string): Promise<MarketInsightResponse | null> {
  const rows = await runQuery<RawMarketQuarterRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  requested_market.market_name,
  market_rows.year_num,
  market_rows.quarter_num,
  market_rows.period_label,
  market_rows.commissioned_mw,
  market_rows.available_mw,
  market_rows.under_construction_mw,
  market_rows.planned_mw,
  market_rows.operator_planned_mw,
  market_rows.site_developer_planned_mw,
  market_rows.preleasing_mw,
  market_rows.absorption_override_mw,
  market_rows.vacancy_pct_reported
FROM requested_market
INNER JOIN serve.market_quarterly_live AS market_rows
  ON market_rows.market_id = requested_market.canonical_market_id
ORDER BY market_rows.year_num ASC, market_rows.quarter_num ASC;
`,
    [marketId]
  );

  const firstRow = rows[0];
  if (firstRow === undefined) {
    return null;
  }

  const capacity: MarketCapacityPoint[] = [];
  let previousRow: RawMarketQuarterRow | null = null;
  for (const row of rows) {
    capacity.push(buildCapacityPoint(row, previousRow));
    previousRow = row;
  }

  return {
    capacity,
    marketId,
    marketName: firstRow.market_name,
  };
}

export async function getPreleasingPercentage(
  marketId: string
): Promise<PreleasingPercentageResponse | null> {
  const rows = await runQuery<PreleasingRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  preleasing_rows.year_num,
  preleasing_rows.quarter_num,
  preleasing_rows.preleasing_pct_of_absorption
FROM requested_market
INNER JOIN serve.market_preleasing_percentage_live AS preleasing_rows
  ON preleasing_rows.market_id = requested_market.canonical_market_id;
`,
    [marketId]
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  return {
    percent: readNullableNumber(row.preleasing_pct_of_absorption),
    quarter: Math.trunc(readNumber(row.quarter_num)),
    year: Math.trunc(readNumber(row.year_num)),
  };
}

export async function getMarketSizeReport(marketId: string): Promise<number | null> {
  const rows = await runQuery<MarketSizeReportRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT size_rows.total_market_size_mw
FROM requested_market
INNER JOIN serve.market_size_report_live AS size_rows
  ON size_rows.market_id = requested_market.canonical_market_id;
`,
    [marketId]
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  return roundKwFromMw(readNullableNumber(row.total_market_size_mw));
}

export async function getTtmGrowth(marketId: string): Promise<TtmGrowthResponse> {
  const rows = await runQuery<TtmGrowthRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT growth_rows.year_num, growth_rows.growth_ratio
FROM requested_market
INNER JOIN serve.market_ttm_growth_live AS growth_rows
  ON growth_rows.market_id = requested_market.canonical_market_id;
`,
    [marketId]
  );

  const row = rows[0];
  if (row === undefined) {
    return {
      growth: null,
      year: null,
    };
  }

  return {
    growth: readNullableNumber(row.growth_ratio),
    year: row.year_num === null ? null : Math.trunc(readNumber(row.year_num)),
  };
}

export async function getSubmarketCapacity(
  marketId: string
): Promise<readonly SubmarketInsightRecord[]> {
  const rows = await runQuery<SubmarketQuarterRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  submarket_rows.submarket_id::text AS submarket_id,
  submarket_rows.submarket_name,
  submarket_rows.year_num,
  submarket_rows.quarter_num,
  submarket_rows.commissioned_mw,
  submarket_rows.available_mw,
  submarket_rows.under_construction_mw,
  submarket_rows.planned_mw
FROM requested_market
INNER JOIN serve.submarket_quarterly_live AS submarket_rows
  ON submarket_rows.market_id = requested_market.canonical_market_id
ORDER BY submarket_rows.submarket_name ASC, submarket_rows.year_num ASC, submarket_rows.quarter_num ASC;
`,
    [marketId]
  );

  const recordsBySubmarket = new Map<string, SubmarketCapacityPoint[]>();
  const previousRowBySubmarket = new Map<string, SubmarketQuarterRow>();
  const submarketOrder: string[] = [];

  for (const row of rows) {
    if (!recordsBySubmarket.has(row.submarket_id)) {
      submarketOrder.push(row.submarket_id);
    }

    const nextRecord = buildSubmarketCapacityPoint(
      row,
      previousRowBySubmarket.get(row.submarket_id) ?? null
    );
    const existing = recordsBySubmarket.get(row.submarket_id) ?? [];
    existing.push(nextRecord);
    recordsBySubmarket.set(row.submarket_id, existing);
    previousRowBySubmarket.set(row.submarket_id, row);
  }

  return submarketOrder.map((submarketId) => ({
    data: recordsBySubmarket.get(submarketId) ?? [],
    submarketId,
  }));
}

export async function getSubmarketTtm(marketId: string): Promise<readonly SubmarketTtmRecord[]> {
  const submarkets = await getSubmarketCapacity(marketId);

  return submarkets.map((submarket) => {
    const latest = submarket.data.at(-1) ?? null;
    const ttmAbsorption = submarket.data
      .slice(-4)
      .reduce((sum, point) => sum + (point.absorption ?? 0), 0);

    return {
      commissioned: latest?.commissioned ?? null,
      submarketId: submarket.submarketId,
      submarketName: latest?.submarketName ?? submarket.submarketId,
      ttmAbsorption,
      vacancy: latest?.vacancy ?? null,
    };
  });
}

export async function getMarketForecast(marketId: string): Promise<readonly ForecastPoint[]> {
  const rows = await runQuery<ForecastRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT forecast_rows.year_num, forecast_rows.value_numeric
FROM requested_market
INNER JOIN serve.market_forecast_current AS forecast_rows
  ON forecast_rows.market_id = requested_market.canonical_market_id
WHERE forecast_rows.metric_code = 'commissioned_power'
ORDER BY forecast_rows.year_num ASC;
`,
    [marketId]
  );

  return rows.map((row) => ({
    commissionedPower: readNumber(row.value_numeric),
    year: Math.trunc(readNumber(row.year_num)),
  }));
}

export async function getMarketSizeHistory(
  marketId: string
): Promise<readonly MarketSizeHistoryPoint[]> {
  const rows = await runQuery<MarketSizeHistoryRow>(
    `
${REQUESTED_MARKET_CTE}
,
colo_yearly AS (
  SELECT DISTINCT ON (market_rows.year_num)
    market_rows.year_num,
    market_rows.commissioned_mw
  FROM requested_market
  INNER JOIN serve.market_quarterly_live AS market_rows
    ON market_rows.market_id = requested_market.canonical_market_id
  ORDER BY market_rows.year_num ASC, market_rows.quarter_num DESC
),
hyperscale_yearly AS (
  SELECT DISTINCT ON (history_rows.year_num)
    history_rows.year_num,
    SUM(history_rows.commissioned_mw) OVER (PARTITION BY history_rows.year_num) AS hyperscale_owned_mw
  FROM requested_market
  INNER JOIN serve.facility_capacity_quarterly_live AS history_rows
    ON history_rows.market_id = requested_market.canonical_market_id
  WHERE history_rows.perspective = 'hyperscale'
  ORDER BY history_rows.year_num ASC, history_rows.quarter_num DESC
),
years AS (
  SELECT year_num FROM colo_yearly
  UNION
  SELECT year_num FROM hyperscale_yearly
)
SELECT
  years.year_num,
  COALESCE(colo_yearly.commissioned_mw, 0) + COALESCE(hyperscale_yearly.hyperscale_owned_mw, 0) AS market_size_mw
FROM years
LEFT JOIN colo_yearly
  ON colo_yearly.year_num = years.year_num
LEFT JOIN hyperscale_yearly
  ON hyperscale_yearly.year_num = years.year_num
ORDER BY years.year_num ASC;
`,
    [marketId]
  );

  return rows
    .map((row) => ({
      inactive: false,
      marketSize: readNullableNumber(row.market_size_mw) ?? 0,
      year: Math.trunc(readNumber(row.year_num)),
    }))
    .slice(-3);
}

export async function getMarketPricing(marketId: string): Promise<readonly PricingPoint[]> {
  const rows = await runQuery<PricingHistoryRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  yearly_rows.year AS year_num,
  yearly_rows.high_range_min,
  yearly_rows.high_range_max,
  yearly_rows.low_range_min,
  yearly_rows.low_range_max,
  yearly_rows.hyper_min,
  yearly_rows.hyper_max
FROM requested_market
INNER JOIN market_source.market_yearly_data AS yearly_rows
  ON yearly_rows.market_id::text = requested_market.source_market_id
WHERE COALESCE(yearly_rows.payload->>'ARCHIVED', 'N') <> 'Y'
ORDER BY yearly_rows.year ASC;
`,
    [marketId]
  );

  return rows.map((row) =>
    buildPricingPoint({
      highRangeMax: readNullableNumber(row.high_range_max),
      highRangeMin: readNullableNumber(row.high_range_min),
      hyperMax: readNullableNumber(row.hyper_max),
      hyperMin: readNullableNumber(row.hyper_min),
      lowRangeMax: readNullableNumber(row.low_range_max),
      lowRangeMin: readNullableNumber(row.low_range_min),
      year: String(Math.trunc(readNumber(row.year_num))),
    })
  );
}

export async function getMarketPricingAverage(
  marketId: string
): Promise<readonly PricingAveragePoint[]> {
  const rows = await runQuery<PricingHistoryRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  yearly_rows.year AS year_num,
  yearly_rows.high_range_min,
  yearly_rows.high_range_max,
  yearly_rows.low_range_min,
  yearly_rows.low_range_max,
  yearly_rows.hyper_min,
  yearly_rows.hyper_max
FROM requested_market
INNER JOIN market_source.market_yearly_data AS yearly_rows
  ON yearly_rows.market_id::text = requested_market.source_market_id
WHERE COALESCE(yearly_rows.payload->>'ARCHIVED', 'N') <> 'Y'
ORDER BY yearly_rows.year DESC
LIMIT 4;
`,
    [marketId]
  );

  return rows.map((row) =>
    buildPricingAveragePoint({
      highRangeMax: readNullableNumber(row.high_range_max),
      highRangeMin: readNullableNumber(row.high_range_min),
      hyperMax: readNullableNumber(row.hyper_max),
      hyperMin: readNullableNumber(row.hyper_min),
      lowRangeMax: readNullableNumber(row.low_range_max),
      lowRangeMin: readNullableNumber(row.low_range_min),
      year: Math.trunc(readNumber(row.year_num)),
    })
  );
}

export async function getMarketPricingRatio(marketId: string): Promise<PricingRatioResponse> {
  const rows = await runQuery<PricingRatioRow>(
    `
${REQUESTED_MARKET_CTE}
,
latest_market_year AS (
  SELECT
    yearly_rows.year AS latest_year,
    (yearly_rows.high_range_min + yearly_rows.high_range_max) / 2.0 AS wholesale_value,
    (yearly_rows.low_range_min + yearly_rows.low_range_max) / 2.0 AS retail_value,
    CASE
      WHEN yearly_rows.hyper_min IS NULL OR yearly_rows.hyper_max IS NULL THEN NULL
      ELSE (yearly_rows.hyper_min + yearly_rows.hyper_max) / 2.0
    END AS hyperscale_value
  FROM requested_market
  INNER JOIN market_source.market_yearly_data AS yearly_rows
    ON yearly_rows.market_id::text = requested_market.source_market_id
  WHERE COALESCE(yearly_rows.payload->>'ARCHIVED', 'N') <> 'Y'
  ORDER BY yearly_rows.year DESC
  LIMIT 1
),
region_peers AS (
  SELECT
    (peer_rows.high_range_min + peer_rows.high_range_max) / 2.0 AS wholesale_value,
    (peer_rows.low_range_min + peer_rows.low_range_max) / 2.0 AS retail_value,
    CASE
      WHEN peer_rows.hyper_min IS NULL OR peer_rows.hyper_max IS NULL THEN NULL
      ELSE (peer_rows.hyper_min + peer_rows.hyper_max) / 2.0
    END AS hyperscale_value
  FROM requested_market
  INNER JOIN latest_market_year
    ON TRUE
  INNER JOIN market_source.markets AS peer_markets
    ON peer_markets.region = requested_market.region_name
  INNER JOIN market_source.market_yearly_data AS peer_rows
    ON peer_rows.market_id = peer_markets.market_id
   AND peer_rows.year = latest_market_year.latest_year
  WHERE COALESCE(peer_rows.payload->>'ARCHIVED', 'N') <> 'Y'
)
SELECT
  latest_market_year.latest_year,
  latest_market_year.wholesale_value,
  AVG(region_peers.wholesale_value) AS wholesale_avg,
  STDDEV_SAMP(region_peers.wholesale_value) AS wholesale_std_dev,
  latest_market_year.retail_value,
  AVG(region_peers.retail_value) AS retail_avg,
  STDDEV_SAMP(region_peers.retail_value) AS retail_std_dev,
  latest_market_year.hyperscale_value,
  AVG(region_peers.hyperscale_value) AS hyperscale_avg,
  STDDEV_SAMP(region_peers.hyperscale_value) AS hyperscale_std_dev
FROM latest_market_year
LEFT JOIN region_peers
  ON TRUE
GROUP BY
  latest_market_year.latest_year,
  latest_market_year.wholesale_value,
  latest_market_year.retail_value,
  latest_market_year.hyperscale_value;
`,
    [marketId]
  );

  const row = rows[0];
  if (row === undefined) {
    return {
      hyperscale: null,
      hyperscaleAvg: null,
      hyperscaleStdDev: null,
      latestYear: null,
      retail: null,
      retailAvg: null,
      retailStdDev: null,
      wholesale: null,
      wholesaleAvg: null,
      wholesaleStdDev: null,
    };
  }

  return {
    hyperscale: readNullableNumber(row.hyperscale_value),
    hyperscaleAvg: readNullableNumber(row.hyperscale_avg),
    hyperscaleStdDev: readNullableNumber(row.hyperscale_std_dev),
    latestYear: row.latest_year === null ? null : Math.trunc(readNumber(row.latest_year)),
    retail: readNullableNumber(row.retail_value),
    retailAvg: readNullableNumber(row.retail_avg),
    retailStdDev: readNullableNumber(row.retail_std_dev),
    wholesale: readNullableNumber(row.wholesale_value),
    wholesaleAvg: readNullableNumber(row.wholesale_avg),
    wholesaleStdDev: readNullableNumber(row.wholesale_std_dev),
  };
}

export async function getMarketPricingForecast(marketId: string): Promise<readonly PricingPoint[]> {
  const historicalRows = await getMarketPricing(marketId);
  const forecastRows = await runQuery<PricingForecastRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  forecast_rows.year_num,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'wholesale_min' THEN forecast_rows.value_numeric END) AS wholesale_min,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'wholesale_max' THEN forecast_rows.value_numeric END) AS wholesale_max,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'retail_min' THEN forecast_rows.value_numeric END) AS retail_min,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'retail_max' THEN forecast_rows.value_numeric END) AS retail_max,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'hyper_min' THEN forecast_rows.value_numeric END) AS hyper_min,
  MAX(CASE WHEN forecast_rows.pricing_metric_code = 'hyper_max' THEN forecast_rows.value_numeric END) AS hyper_max
FROM requested_market
INNER JOIN serve.market_pricing_forecast_current AS forecast_rows
  ON forecast_rows.market_id = requested_market.canonical_market_id
GROUP BY forecast_rows.year_num
ORDER BY forecast_rows.year_num ASC;
`,
    [marketId]
  );

  return [
    ...historicalRows,
    ...forecastRows.map((row) =>
      buildPricingPoint({
        highRangeMax: readNullableNumber(row.wholesale_max),
        highRangeMin: readNullableNumber(row.wholesale_min),
        hyperMax: readNullableNumber(row.hyper_max),
        hyperMin: readNullableNumber(row.hyper_min),
        lowRangeMax: readNullableNumber(row.retail_max),
        lowRangeMin: readNullableNumber(row.retail_min),
        year: `${String(Math.trunc(readNumber(row.year_num)))} F`,
      })
    ),
  ];
}
