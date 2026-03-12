import type {
  CountyChange,
  CountyDeferredReasonCode,
  CountyDriver,
  CountyPillarValueStates,
  CountyScore,
} from "@map-migration/contracts";
import type { CountyScoreRow } from "./county-scores.repo";

const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;
function readCountyFips(value: string): string {
  const normalized = value.trim();
  if (!COUNTY_FIPS_PATTERN.test(normalized)) {
    throw new Error(`invalid county_fips: ${value}`);
  }

  return normalized;
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableStateAbbrev(value: string | null | undefined): string | null {
  const normalized = readNullableText(value);
  if (normalized === null || normalized.length !== 2) {
    return null;
  }

  return normalized;
}

function readNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNullableInteger(value: number | string | null | undefined): number | null {
  const parsed = readNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  return Number.isInteger(parsed) ? parsed : null;
}

function readBooleanFlag(
  value: boolean | number | string | null | undefined,
  fieldName: string
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    throw new Error(`invalid ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`missing ${fieldName}`);
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "f" || normalized === "0") {
    return false;
  }

  throw new Error(`invalid ${fieldName}`);
}

function readNullableBoolean(
  value: boolean | number | string | null | undefined,
  fieldName: string
): boolean | null {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  return readBooleanFlag(value, fieldName);
}

function readNullableVersion(
  value: number | string | null | undefined,
  fieldName: string
): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`invalid ${fieldName}`);
    }

    return String(value);
  }

  const normalized = readNullableText(value);
  if (normalized === null) {
    return null;
  }

  return normalized;
}

function readNullableIsoDateTime(
  value: Date | string | null | undefined,
  fieldName: string
): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`invalid ${fieldName}`);
    }

    return value.toISOString();
  }

  const normalized = readNullableText(value);
  if (normalized === null) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed.toISOString();
}

function readJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return JSON.parse(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNormalizedText(value: string | null | undefined): string | null {
  const normalized = readNullableText(value);
  if (normalized === null) {
    return null;
  }

  return normalized;
}

function readRankStatus(
  value: string | null | undefined,
  fallback: CountyScore["rankStatus"]
): CountyScore["rankStatus"] {
  const normalized = readNormalizedText(value);
  if (normalized === "ranked" || normalized === "deferred" || normalized === "blocked") {
    return normalized;
  }

  return fallback;
}

function readAttractivenessTier(
  value: string | null | undefined,
  fallback: CountyScore["attractivenessTier"]
): CountyScore["attractivenessTier"] {
  const normalized = readNormalizedText(value);
  if (
    normalized === "advantaged" ||
    normalized === "balanced" ||
    normalized === "constrained" ||
    normalized === "blocked" ||
    normalized === "deferred"
  ) {
    return normalized;
  }

  return fallback;
}

function readConfidenceBadge(
  value: string | null | undefined,
  fallback: CountyScore["confidenceBadge"]
): CountyScore["confidenceBadge"] {
  const normalized = readNormalizedText(value);
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return fallback;
}

function readDriverImpact(value: string | null | undefined): CountyDriver["impact"] {
  const normalized = readNormalizedText(value);
  if (
    normalized === "tailwind" ||
    normalized === "headwind" ||
    normalized === "blocker" ||
    normalized === "context"
  ) {
    return normalized;
  }

  return "context";
}

function readChangeDirection(value: string | null | undefined): CountyChange["direction"] {
  const normalized = readNormalizedText(value);
  if (normalized === "up" || normalized === "down" || normalized === "flat") {
    return normalized;
  }

  return "flat";
}

function readMoratoriumStatus(value: string | null | undefined): CountyScore["moratoriumStatus"] {
  const normalized = readNormalizedText(value);
  if (normalized === "none" || normalized === "watch" || normalized === "active") {
    return normalized;
  }

  return "unknown";
}

function readSourceVolatility(value: string | null | undefined): CountyScore["sourceVolatility"] {
  const normalized = readNormalizedText(value);
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function readValueState(value: string | null | undefined): CountyPillarValueStates["demand"] {
  const normalized = readNormalizedText(value);
  if (
    normalized === "observed" ||
    normalized === "derived" ||
    normalized === "estimated" ||
    normalized === "unknown" ||
    normalized === "restricted" ||
    normalized === "not_applicable"
  ) {
    return normalized;
  }

  return "unknown";
}

function readDeferredReasonCode(value: unknown): CountyDeferredReasonCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (
    normalized === "MISSING_DEMAND_BASELINE" ||
    normalized === "MISSING_QUEUE_BASELINE" ||
    normalized === "MISSING_POLICY_BASELINE" ||
    normalized === "STALE_SOURCE" ||
    normalized === "LOW_CONFIDENCE_MAPPING" ||
    normalized === "RESTRICTED_CRITICAL_SOURCE"
  ) {
    return normalized;
  }

  return null;
}

function mapDriverArray(value: unknown): CountyDriver[] {
  const parsed = readJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry): CountyDriver[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const code = readNullableText(typeof entry.code === "string" ? entry.code : null);
    const label = readNullableText(typeof entry.label === "string" ? entry.label : null);
    const summary = readNullableText(typeof entry.summary === "string" ? entry.summary : null);
    const impact = readDriverImpact(typeof entry.impact === "string" ? entry.impact : null);

    if (code === null || label === null || summary === null) {
      return [];
    }

    return [
      {
        code,
        impact,
        label,
        summary,
      },
    ];
  });
}

function mapChangeArray(value: unknown): CountyChange[] {
  const parsed = readJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry): CountyChange[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const code = readNullableText(typeof entry.code === "string" ? entry.code : null);
    const label = readNullableText(typeof entry.label === "string" ? entry.label : null);
    const summary = readNullableText(typeof entry.summary === "string" ? entry.summary : null);
    const direction = readChangeDirection(
      typeof entry.direction === "string" ? entry.direction : null
    );
    const magnitude =
      typeof entry.magnitude === "number" || typeof entry.magnitude === "string"
        ? readNullableNumber(entry.magnitude)
        : null;

    if (code === null || label === null || summary === null) {
      return [];
    }

    return [
      {
        code,
        direction,
        label,
        magnitude,
        summary,
      },
    ];
  });
}

function defaultPillarValueStates(): CountyPillarValueStates {
  return {
    demand: "unknown",
    gridFriction: "unknown",
    infrastructure: "unknown",
    policy: "unknown",
    supplyTimeline: "unknown",
  };
}

function mapPillarValueStates(value: unknown): CountyPillarValueStates {
  const parsed = readJsonValue(value);
  if (!isRecord(parsed)) {
    return defaultPillarValueStates();
  }

  return {
    demand: readValueState(typeof parsed.demand === "string" ? parsed.demand : null),
    gridFriction: readValueState(
      typeof parsed.gridFriction === "string" ? parsed.gridFriction : null
    ),
    infrastructure: readValueState(
      typeof parsed.infrastructure === "string" ? parsed.infrastructure : null
    ),
    policy: readValueState(typeof parsed.policy === "string" ? parsed.policy : null),
    supplyTimeline: readValueState(
      typeof parsed.supplyTimeline === "string" ? parsed.supplyTimeline : null
    ),
  };
}

function mapDeferredReasonCodes(value: unknown): CountyDeferredReasonCode[] {
  const parsed = readJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    const normalized = readDeferredReasonCode(entry);
    return normalized === null ? [] : [normalized];
  });
}

export function mapCountyScoreRow(row: CountyScoreRow): CountyScore {
  const hasCountyScore = readBooleanFlag(row.has_county_score, "has_county_score");

  return {
    countyFips: readCountyFips(row.county_fips),
    countyName: readNullableText(row.county_name),
    stateAbbrev: readNullableStateAbbrev(row.state_abbrev),
    rankStatus: hasCountyScore ? readRankStatus(row.rank_status, "deferred") : "deferred",
    attractivenessTier: hasCountyScore
      ? readAttractivenessTier(row.attractiveness_tier, "deferred")
      : "deferred",
    confidenceBadge: hasCountyScore ? readConfidenceBadge(row.confidence_badge, "low") : "low",
    marketPressureIndex: readNullableNumber(row.market_pressure_index),
    demandPressureScore: readNullableNumber(row.demand_pressure_score),
    supplyTimelineScore: readNullableNumber(row.supply_timeline_score),
    gridFrictionScore: readNullableNumber(row.grid_friction_score),
    policyConstraintScore: readNullableNumber(row.policy_constraint_score),
    freshnessScore: readNullableNumber(row.freshness_score),
    lastUpdatedAt: readNullableIsoDateTime(row.last_updated_at, "last_updated_at"),
    sourceVolatility: readSourceVolatility(row.source_volatility),
    narrativeSummary: readNullableText(row.narrative_summary),
    topDrivers: mapDriverArray(row.top_drivers_json),
    deferredReasonCodes: mapDeferredReasonCodes(row.deferred_reason_codes_json),
    whatChanged30d: mapChangeArray(row.what_changed_30d_json),
    whatChanged60d: mapChangeArray(row.what_changed_60d_json),
    whatChanged90d: mapChangeArray(row.what_changed_90d_json),
    pillarValueStates: mapPillarValueStates(row.pillar_value_states_json),
    expectedMw0To24m: readNullableNumber(row.expected_mw_0_24m),
    expectedMw24To60m: readNullableNumber(row.expected_mw_24_60m),
    recentCommissionedMw24m: readNullableNumber(row.recent_commissioned_mw_24m),
    demandMomentumQoq: readNullableNumber(row.demand_momentum_qoq),
    providerEntryCount12m: readNullableInteger(row.provider_entry_count_12m),
    expectedSupplyMw0To36m: readNullableNumber(row.expected_supply_mw_0_36m),
    expectedSupplyMw36To60m: readNullableNumber(row.expected_supply_mw_36_60m),
    signedIaMw: readNullableNumber(row.signed_ia_mw),
    queueMwActive: readNullableNumber(row.queue_mw_active),
    queueProjectCountActive: readNullableInteger(row.queue_project_count_active),
    medianDaysInQueueActive: readNullableNumber(row.median_days_in_queue_active),
    pastDueShare: readNullableNumber(row.past_due_share),
    marketWithdrawalPrior: readNullableNumber(row.market_withdrawal_prior),
    congestionProxyScore: readNullableNumber(row.congestion_proxy_score),
    plannedUpgradeCount: readNullableInteger(row.planned_upgrade_count),
    heatmapSignalFlag: readNullableBoolean(row.heatmap_signal_flag, "heatmap_signal_flag"),
    policyMomentumScore: readNullableNumber(row.policy_momentum_score),
    moratoriumStatus: readMoratoriumStatus(row.moratorium_status),
    publicSentimentScore: readNullableNumber(row.public_sentiment_score),
    policyEventCount: readNullableInteger(row.policy_event_count),
    countyTaggedEventShare: readNullableNumber(row.county_tagged_event_share),
    policyMappingConfidence:
      readNullableText(row.policy_mapping_confidence) === null
        ? null
        : readConfidenceBadge(row.policy_mapping_confidence, "low"),
    transmissionMiles69kvPlus: readNullableNumber(row.transmission_miles_69kv_plus),
    transmissionMiles230kvPlus: readNullableNumber(row.transmission_miles_230kv_plus),
    gasPipelinePresenceFlag: readNullableBoolean(
      row.gas_pipeline_presence_flag,
      "gas_pipeline_presence_flag"
    ),
    gasPipelineMileageCounty: readNullableNumber(row.gas_pipeline_mileage_county),
    fiberPresenceFlag: readNullableBoolean(row.fiber_presence_flag, "fiber_presence_flag"),
    primaryMarketId: readNullableText(row.primary_market_id),
    isSeamCounty: readNullableBoolean(row.is_seam_county, "is_seam_county") ?? false,
    formulaVersion: readNullableVersion(row.formula_version, "formula_version"),
    inputDataVersion: readNullableVersion(row.input_data_version, "input_data_version"),
  };
}
