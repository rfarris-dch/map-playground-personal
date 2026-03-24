import { dirname, join, resolve } from "node:path";
import {
  copyFileEnsuringDirectory,
  ensureDirectory,
  fileExists,
  readJson,
  readText,
  writeJsonAtomic,
  writeTextAtomic,
} from "./atomic-file-store";

const BUNDLE_VERSION = "county-power-v1";
const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_PATTERN = /^\d{4}-\d{2}-01$/;
const ISO_RUN_ID_PARTS_PATTERN = /[-:]/g;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ISO_RUN_ID_TRIM_PATTERN = /\.\d{3}Z$/;
const MATERIALIZED_MANIFEST_FILE_NAME = "bundle-manifest.json";
const NDJSON_LINE_SPLIT_PATTERN = /\r?\n/u;
const NORMALIZED_MANIFEST_FILE_NAME = "normalized-manifest.json";
const POWER_MARKET_CONTEXT_FILE_NAME = "power-market-context.ndjson";
const COUNTY_FIPS_ALIASES_FILE_NAME = "county-fips-aliases.ndjson";
const OPERATOR_REGIONS_FILE_NAME = "operator-regions.ndjson";
const COUNTY_OPERATOR_REGIONS_FILE_NAME = "county-operator-regions.ndjson";
const OPERATOR_ZONE_REFERENCES_FILE_NAME = "operator-zone-references.ndjson";
const COUNTY_OPERATOR_ZONES_FILE_NAME = "county-operator-zones.ndjson";
const UTILITY_CONTEXT_FILE_NAME = "utility-context.ndjson";
const TRANSMISSION_FILE_NAME = "transmission.ndjson";
const FIBER_FILE_NAME = "fiber.ndjson";
const GAS_FILE_NAME = "gas.ndjson";
const CONGESTION_FILE_NAME = "congestion.ndjson";
const GRID_FRICTION_FILE_NAME = "grid-friction.ndjson";
const POLICY_EVENTS_FILE_NAME = "policy-events.ndjson";
const POLICY_SNAPSHOTS_FILE_NAME = "policy-snapshots.ndjson";
const QUEUE_POI_REFERENCES_FILE_NAME = "queue-poi-references.ndjson";
const QUEUE_COUNTY_RESOLUTIONS_FILE_NAME = "queue-county-resolutions.ndjson";
const QUEUE_RESOLUTION_OVERRIDES_FILE_NAME = "queue-resolution-overrides.ndjson";
const QUEUE_PROJECTS_FILE_NAME = "queue-projects.ndjson";
const QUEUE_SNAPSHOTS_FILE_NAME = "queue-snapshots.ndjson";
const QUEUE_UNRESOLVED_FILE_NAME = "queue-unresolved.ndjson";
const RETAIL_CHOICE_STATUSES = new Set([
  "bundled_monopoly",
  "choice",
  "mixed",
  "partial_choice",
  "unknown",
]);
const COMPETITIVE_AREA_TYPES = new Set([
  "bundled",
  "choice",
  "co_op",
  "mixed",
  "muni",
  "noie",
  "unknown",
]);
const MARKET_STRUCTURES = new Set(["mixed", "organized_market", "traditional_vertical", "unknown"]);
const GRID_FRICTION_CONFIDENCE_VALUES = new Set(["high", "low", "medium"]);
const POLICY_CONFIDENCE_VALUES = new Set(["high", "low", "medium"]);
const POLICY_MORATORIUM_VALUES = new Set(["active", "none", "unknown", "watch"]);
const QUEUE_RESOLUTION_CONFIDENCE_VALUES = new Set(["high", "low", "medium"]);
const CONFIDENCE_CLASS_VALUES = new Set([
  "consultant",
  "derived",
  "ian_adjusted",
  "official",
  "unknown",
]);
const QUEUE_STAGE_GROUP_VALUES = new Set([
  "active_study",
  "committed",
  "construction",
  "early_planning",
  "operational",
  "permitting_or_approval",
  "suspended_or_unknown",
  "withdrawn",
]);
const INSERT_BATCH_SIZE = 250;
const bunRuntime = globalThis.Bun;

if (typeof bunRuntime === "undefined") {
  throw new Error("Bun runtime is required for county-power sync");
}

function formatRunTimestamp(date) {
  const iso = date.toISOString();
  return iso.replace(ISO_RUN_ID_PARTS_PATTERN, "").replace(ISO_RUN_ID_TRIM_PATTERN, "Z");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readRequiredString(value, path) {
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Expected non-empty string at ${path}`);
  }
  return normalized;
}
function readOptionalString(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readRequiredString(value, path);
}
function readFiniteNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number at ${path}`);
  }
  return value;
}
function readOptionalFiniteNumber(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readFiniteNumber(value, path);
}
function readOptionalNonNegativeInteger(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  const parsed = readFiniteNumber(value, path);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer at ${path}`);
  }
  return parsed;
}
function readOptionalUnitInterval(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  const parsed = readFiniteNumber(value, path);
  if (parsed < 0 || parsed > 1) {
    throw new Error(`Expected unit interval value at ${path}`);
  }
  return parsed;
}
function readExpectedDate(value, path) {
  const normalized = readRequiredString(value, path);
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error(`Expected ISO date at ${path}`);
  }
  return normalized;
}
function readExpectedMonth(value, path) {
  const normalized = readRequiredString(value, path);
  if (!ISO_MONTH_PATTERN.test(normalized)) {
    throw new Error(`Expected month start ISO date at ${path}`);
  }
  return normalized;
}
function readExpectedTimestamp(value, path) {
  const normalized = readRequiredString(value, path);
  if (!ISO_TIMESTAMP_PATTERN.test(normalized)) {
    throw new Error(`Expected UTC timestamp at ${path}`);
  }
  return normalized;
}
function readExpectedCountyFips(value, path) {
  const normalized = readRequiredString(value, path);
  if (!COUNTY_FIPS_PATTERN.test(normalized)) {
    throw new Error(`Expected 5-digit county FIPS at ${path}`);
  }
  return normalized;
}
function readOptionalExpectedCountyFips(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readExpectedCountyFips(value, path);
}
function readOptionalExpectedDate(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readExpectedDate(value, path);
}
function readExpectedEnumValue(value, path, allowedValues) {
  const normalized = readRequiredString(value, path);
  if (!allowedValues.has(normalized)) {
    throw new Error(`Unexpected enum value "${normalized}" at ${path}`);
  }
  return normalized;
}
function readRetailChoiceStatus(value, path) {
  const normalized = readExpectedEnumValue(value, path, RETAIL_CHOICE_STATUSES);
  if (
    normalized === "bundled_monopoly" ||
    normalized === "choice" ||
    normalized === "mixed" ||
    normalized === "partial_choice" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected retail choice status "${normalized}" at ${path}`);
}
function readCompetitiveAreaType(value, path) {
  const normalized = readExpectedEnumValue(value, path, COMPETITIVE_AREA_TYPES);
  if (
    normalized === "bundled" ||
    normalized === "choice" ||
    normalized === "co_op" ||
    normalized === "mixed" ||
    normalized === "muni" ||
    normalized === "noie" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected competitive area type "${normalized}" at ${path}`);
}
function readMarketStructure(value, path) {
  const normalized = readExpectedEnumValue(value, path, MARKET_STRUCTURES);
  if (
    normalized === "mixed" ||
    normalized === "organized_market" ||
    normalized === "traditional_vertical" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected market structure "${normalized}" at ${path}`);
}
function readGridFrictionConfidence(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readExpectedEnumValue(value, path, GRID_FRICTION_CONFIDENCE_VALUES);
}
function readPolicyConfidence(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readExpectedEnumValue(value, path, POLICY_CONFIDENCE_VALUES);
}
function readQueueResolutionConfidence(value, path) {
  const normalized = readExpectedEnumValue(value, path, QUEUE_RESOLUTION_CONFIDENCE_VALUES);
  if (normalized === "high" || normalized === "low" || normalized === "medium") {
    return normalized;
  }
  throw new Error(`Unexpected queue resolution confidence "${normalized}" at ${path}`);
}
function readConfidenceClass(value, path) {
  const normalized = readExpectedEnumValue(value, path, CONFIDENCE_CLASS_VALUES);
  if (
    normalized === "consultant" ||
    normalized === "derived" ||
    normalized === "ian_adjusted" ||
    normalized === "official" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected confidence class "${normalized}" at ${path}`);
}
function readOptionalConfidenceClass(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readConfidenceClass(value, path);
}
function readQueueStageGroup(value, path) {
  const normalized = readExpectedEnumValue(value, path, QUEUE_STAGE_GROUP_VALUES);
  if (
    normalized === "active_study" ||
    normalized === "committed" ||
    normalized === "construction" ||
    normalized === "early_planning" ||
    normalized === "operational" ||
    normalized === "permitting_or_approval" ||
    normalized === "suspended_or_unknown" ||
    normalized === "withdrawn"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected queue stage group "${normalized}" at ${path}`);
}
function readOptionalQueueStageGroup(value, path) {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  return readQueueStageGroup(value, path);
}
function readPolicyMoratoriumStatus(value, path) {
  const normalized = readExpectedEnumValue(value, path, POLICY_MORATORIUM_VALUES);
  if (
    normalized === "active" ||
    normalized === "none" ||
    normalized === "unknown" ||
    normalized === "watch"
  ) {
    return normalized;
  }
  throw new Error(`Unexpected policy moratorium status "${normalized}" at ${path}`);
}
function readRequiredRecord(value, path) {
  if (!isRecord(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value;
}
function readRequiredArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}`);
  }
  return value;
}
function readStringNumberRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const entries = Object.entries(record).reduce((result, entry) => {
    const [key, rawValue] = entry;
    result[key] = readFiniteNumber(rawValue, `${path}.${key}`);
    return result;
  }, {});
  return entries;
}
function decodeSourceDescriptor(value, path) {
  const record = readRequiredRecord(value, path);
  const recordCount = readFiniteNumber(record.recordCount, `${path}.recordCount`);
  if (!Number.isInteger(recordCount) || recordCount < 0) {
    throw new Error(`Expected non-negative integer at ${path}.recordCount`);
  }
  return {
    path: readRequiredString(record.path, `${path}.path`),
    recordCount,
    sourceAsOfDate: readExpectedDate(record.sourceAsOfDate, `${path}.sourceAsOfDate`),
    sourceName: readRequiredString(record.sourceName, `${path}.sourceName`),
    sourceUri: readRequiredString(record.sourceUri, `${path}.sourceUri`),
    sourceVersion: readRequiredString(record.sourceVersion, `${path}.sourceVersion`),
  };
}
function readNdjsonLines(path) {
  const lines = readText(path)
    .split(NDJSON_LINE_SPLIT_PATTERN)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines;
}
function decodeUtilityEntry(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    retailChoiceStatus: readRetailChoiceStatus(
      record.retailChoiceStatus,
      `${path}.retailChoiceStatus`
    ),
    territoryType: readOptionalString(record.territoryType, `${path}.territoryType`),
    utilityId: readOptionalString(record.utilityId, `${path}.utilityId`),
    utilityName: readOptionalString(record.utilityName, `${path}.utilityName`),
  };
}
function decodeConstraintSummaryEntry(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    constraintId: readRequiredString(record.constraintId, `${path}.constraintId`),
    flowMw: readOptionalFiniteNumber(record.flowMw, `${path}.flowMw`),
    hoursBound: readOptionalFiniteNumber(record.hoursBound, `${path}.hoursBound`),
    label: readRequiredString(record.label, `${path}.label`),
    limitMw: readOptionalFiniteNumber(record.limitMw, `${path}.limitMw`),
    operator: readOptionalString(record.operator, `${path}.operator`),
    shadowPrice: readOptionalFiniteNumber(record.shadowPrice, `${path}.shadowPrice`),
    voltageKv: readOptionalFiniteNumber(record.voltageKv, `${path}.voltageKv`),
  };
}
function decodeCountyFipsAliasRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    aliasCountyFips: readExpectedCountyFips(record.aliasCountyFips, `${path}.aliasCountyFips`),
    aliasKind: readRequiredString(record.aliasKind, `${path}.aliasKind`),
    canonicalCountyFips: readExpectedCountyFips(
      record.canonicalCountyFips,
      `${path}.canonicalCountyFips`
    ),
  };
}
function decodeOperatorRegionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    confidenceClass: readConfidenceClass(record.confidenceClass, `${path}.confidenceClass`),
    mappingMethod: readRequiredString(record.mappingMethod, `${path}.mappingMethod`),
    marketStructure: readMarketStructure(record.marketStructure, `${path}.marketStructure`),
    operatorRegion: readRequiredString(record.operatorRegion, `${path}.operatorRegion`),
    owner: readRequiredString(record.owner, `${path}.owner`),
    sourceArtifact: readRequiredString(record.sourceArtifact, `${path}.sourceArtifact`),
    sourceVersion: readOptionalString(record.sourceVersion, `${path}.sourceVersion`),
  };
}
function decodeCountyOperatorRegionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const allocationShare = readFiniteNumber(record.allocationShare, `${path}.allocationShare`);
  if (allocationShare <= 0 || allocationShare > 1) {
    throw new Error(`Expected positive allocation share at ${path}.allocationShare`);
  }
  return {
    allocationShare,
    confidenceClass: readConfidenceClass(record.confidenceClass, `${path}.confidenceClass`),
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    isBorderCounty: Boolean(record.isBorderCounty),
    isPrimaryRegion: Boolean(record.isPrimaryRegion),
    isSeamCounty: Boolean(record.isSeamCounty),
    mappingMethod: readRequiredString(record.mappingMethod, `${path}.mappingMethod`),
    marketStructure: readMarketStructure(record.marketStructure, `${path}.marketStructure`),
    operatorRegion: readRequiredString(record.operatorRegion, `${path}.operatorRegion`),
    owner: readRequiredString(record.owner, `${path}.owner`),
    sourceArtifact: readRequiredString(record.sourceArtifact, `${path}.sourceArtifact`),
    sourceVersion: readOptionalString(record.sourceVersion, `${path}.sourceVersion`),
  };
}
function decodeOperatorZoneReferenceRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    confidenceClass: readOptionalConfidenceClass(record.confidenceClass, `${path}.confidenceClass`),
    operator: readRequiredString(record.operator, `${path}.operator`),
    owner: readRequiredString(record.owner ?? "county-power-public-us", `${path}.owner`),
    operatorZoneConfidence:
      record.operatorZoneConfidence === null || typeof record.operatorZoneConfidence === "undefined"
        ? null
        : readQueueResolutionConfidence(
            record.operatorZoneConfidence,
            `${path}.operatorZoneConfidence`
          ),
    operatorZoneLabel: readRequiredString(record.operatorZoneLabel, `${path}.operatorZoneLabel`),
    operatorZoneType: readRequiredString(record.operatorZoneType, `${path}.operatorZoneType`),
    referenceName: readOptionalString(record.referenceName, `${path}.referenceName`),
    resolutionMethod: readRequiredString(record.resolutionMethod, `${path}.resolutionMethod`),
    sourceArtifact: readOptionalString(record.sourceArtifact, `${path}.sourceArtifact`),
    sourceVersion: readOptionalString(record.sourceVersion, `${path}.sourceVersion`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
  };
}
function decodeCountyOperatorZoneRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const allocationShare = readFiniteNumber(record.allocationShare, `${path}.allocationShare`);
  if (allocationShare <= 0 || allocationShare > 1) {
    throw new Error(`Expected positive allocation share at ${path}.allocationShare`);
  }
  return {
    allocationShare,
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    confidenceClass: readOptionalConfidenceClass(record.confidenceClass, `${path}.confidenceClass`),
    isPrimarySubregion:
      record.isPrimarySubregion === null || typeof record.isPrimarySubregion === "undefined"
        ? true
        : Boolean(record.isPrimarySubregion),
    operator: readRequiredString(record.operator, `${path}.operator`),
    owner: readRequiredString(record.owner ?? "county-power-public-us", `${path}.owner`),
    operatorZoneConfidence:
      record.operatorZoneConfidence === null || typeof record.operatorZoneConfidence === "undefined"
        ? null
        : readQueueResolutionConfidence(
            record.operatorZoneConfidence,
            `${path}.operatorZoneConfidence`
          ),
    operatorZoneLabel: readRequiredString(record.operatorZoneLabel, `${path}.operatorZoneLabel`),
    operatorZoneType: readRequiredString(record.operatorZoneType, `${path}.operatorZoneType`),
    resolutionMethod: readRequiredString(record.resolutionMethod, `${path}.resolutionMethod`),
    sourceArtifact: readOptionalString(record.sourceArtifact, `${path}.sourceArtifact`),
    sourceVersion: readOptionalString(record.sourceVersion, `${path}.sourceVersion`),
  };
}
function decodePowerMarketContextRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    balancingAuthority: readOptionalString(record.balancingAuthority, `${path}.balancingAuthority`),
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    loadZone: readOptionalString(record.loadZone, `${path}.loadZone`),
    marketStructure: readMarketStructure(record.marketStructure, `${path}.marketStructure`),
    meteoZone: readOptionalString(record.meteoZone, `${path}.meteoZone`),
    operatorWeatherZone: readOptionalString(
      record.operatorWeatherZone,
      `${path}.operatorWeatherZone`
    ),
    operatorZoneConfidence:
      record.operatorZoneConfidence === null || typeof record.operatorZoneConfidence === "undefined"
        ? null
        : readQueueResolutionConfidence(
            record.operatorZoneConfidence,
            `${path}.operatorZoneConfidence`
          ),
    operatorZoneLabel: readOptionalString(record.operatorZoneLabel, `${path}.operatorZoneLabel`),
    operatorZoneType: readOptionalString(record.operatorZoneType, `${path}.operatorZoneType`),
    weatherZone: readOptionalString(record.weatherZone, `${path}.weatherZone`),
    wholesaleOperator: readOptionalString(record.wholesaleOperator, `${path}.wholesaleOperator`),
  };
}
function decodeUtilityContextRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const utilities = readRequiredArray(record.utilities, `${path}.utilities`).map((entry, index) =>
    decodeUtilityEntry(entry, `${path}.utilities[${String(index)}]`)
  );
  return {
    competitiveAreaType: readCompetitiveAreaType(
      record.competitiveAreaType,
      `${path}.competitiveAreaType`
    ),
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    dominantUtilityId: readOptionalString(record.dominantUtilityId, `${path}.dominantUtilityId`),
    dominantUtilityName: readOptionalString(
      record.dominantUtilityName,
      `${path}.dominantUtilityName`
    ),
    primaryTduOrUtility: readOptionalString(
      record.primaryTduOrUtility,
      `${path}.primaryTduOrUtility`
    ),
    retailChoicePenetrationShare: readOptionalUnitInterval(
      record.retailChoicePenetrationShare,
      `${path}.retailChoicePenetrationShare`
    ),
    retailChoiceStatus: readRetailChoiceStatus(
      record.retailChoiceStatus,
      `${path}.retailChoiceStatus`
    ),
    territoryType: readOptionalString(record.territoryType, `${path}.territoryType`),
    utilities,
    utilityCount: readOptionalNonNegativeInteger(record.utilityCount, `${path}.utilityCount`),
  };
}
function decodeTransmissionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    miles138kvPlus: readOptionalFiniteNumber(record.miles138kvPlus, `${path}.miles138kvPlus`),
    miles230kvPlus: readOptionalFiniteNumber(record.miles230kvPlus, `${path}.miles230kvPlus`),
    miles345kvPlus: readOptionalFiniteNumber(record.miles345kvPlus, `${path}.miles345kvPlus`),
    miles500kvPlus: readOptionalFiniteNumber(record.miles500kvPlus, `${path}.miles500kvPlus`),
    miles69kvPlus: readOptionalFiniteNumber(record.miles69kvPlus, `${path}.miles69kvPlus`),
    miles765kvPlus: readOptionalFiniteNumber(record.miles765kvPlus, `${path}.miles765kvPlus`),
  };
}
function decodeGasRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    gasPipelineMileageCounty: readOptionalFiniteNumber(
      record.gasPipelineMileageCounty,
      `${path}.gasPipelineMileageCounty`
    ),
    gasPipelinePresenceFlag:
      record.gasPipelinePresenceFlag === null ||
      typeof record.gasPipelinePresenceFlag === "undefined"
        ? null
        : Boolean(record.gasPipelinePresenceFlag),
  };
}
function decodeFiberRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    fiberPresenceFlag:
      record.fiberPresenceFlag === null || typeof record.fiberPresenceFlag === "undefined"
        ? null
        : Boolean(record.fiberPresenceFlag),
  };
}
function decodeCongestionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const topConstraints = readRequiredArray(record.topConstraints, `${path}.topConstraints`).map(
    (entry, index) =>
      decodeConstraintSummaryEntry(entry, `${path}.topConstraints[${String(index)}]`)
  );
  return {
    avgRtCongestionComponent: readOptionalFiniteNumber(
      record.avgRtCongestionComponent,
      `${path}.avgRtCongestionComponent`
    ),
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    negativePriceHourShare: readOptionalUnitInterval(
      record.negativePriceHourShare,
      `${path}.negativePriceHourShare`
    ),
    p95ShadowPrice: readOptionalFiniteNumber(record.p95ShadowPrice, `${path}.p95ShadowPrice`),
    topConstraints,
  };
}
function decodePolicyEventRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    affectedSitingDimension: readOptionalString(
      record.affectedSitingDimension,
      `${path}.affectedSitingDimension`
    ),
    countyFips: readOptionalExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    confidenceClass: readOptionalConfidenceClass(record.confidenceClass, `${path}.confidenceClass`),
    eventDate: readExpectedDate(record.eventDate, `${path}.eventDate`),
    eventId: readRequiredString(record.eventId, `${path}.eventId`),
    eventType: readRequiredString(record.eventType, `${path}.eventType`),
    evidenceSummary: readRequiredString(record.evidenceSummary, `${path}.evidenceSummary`),
    jurisdictionKey: readOptionalString(record.jurisdictionKey, `${path}.jurisdictionKey`),
    jurisdictionLevel: readOptionalString(record.jurisdictionLevel, `${path}.jurisdictionLevel`),
    marketId: readOptionalString(record.marketId, `${path}.marketId`),
    moratoriumStatus: readOptionalString(record.moratoriumStatus, `${path}.moratoriumStatus`),
    policyDirection: readOptionalString(record.policyDirection, `${path}.policyDirection`),
    policyStatus: readOptionalString(record.policyStatus, `${path}.policyStatus`),
    policyType: readOptionalString(record.policyType, `${path}.policyType`),
    sentimentDirection: readOptionalString(record.sentimentDirection, `${path}.sentimentDirection`),
    sourceUrl: readOptionalString(record.sourceUrl, `${path}.sourceUrl`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
    title: readRequiredString(record.title, `${path}.title`),
  };
}
function decodePolicySnapshotRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    countyTaggedEventShare: readOptionalUnitInterval(
      record.countyTaggedEventShare,
      `${path}.countyTaggedEventShare`
    ),
    moratoriumStatus: readPolicyMoratoriumStatus(
      record.moratoriumStatus,
      `${path}.moratoriumStatus`
    ),
    policyConstraintScore: readOptionalFiniteNumber(
      record.policyConstraintScore,
      `${path}.policyConstraintScore`
    ),
    policyEventCount: readOptionalNonNegativeInteger(
      record.policyEventCount,
      `${path}.policyEventCount`
    ),
    policyMappingConfidence: readPolicyConfidence(
      record.policyMappingConfidence,
      `${path}.policyMappingConfidence`
    ),
    policyMomentumScore: readOptionalFiniteNumber(
      record.policyMomentumScore,
      `${path}.policyMomentumScore`
    ),
    publicSentimentScore: readOptionalFiniteNumber(
      record.publicSentimentScore,
      `${path}.publicSentimentScore`
    ),
  };
}
function decodeGridFrictionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    confidence: readGridFrictionConfidence(record.confidence, `${path}.confidence`),
    congestionProxyScore: readOptionalFiniteNumber(
      record.congestionProxyScore,
      `${path}.congestionProxyScore`
    ),
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    heatmapSignalAvailable:
      record.heatmapSignalAvailable === null || typeof record.heatmapSignalAvailable === "undefined"
        ? null
        : Boolean(record.heatmapSignalAvailable),
    marketWithdrawalPrior: readOptionalUnitInterval(
      record.marketWithdrawalPrior,
      `${path}.marketWithdrawalPrior`
    ),
    medianDaysInQueueActive: readOptionalFiniteNumber(
      record.medianDaysInQueueActive,
      `${path}.medianDaysInQueueActive`
    ),
    pastDueShare: readOptionalUnitInterval(record.pastDueShare, `${path}.pastDueShare`),
    plannedTransmissionUpgradeCount: readOptionalNonNegativeInteger(
      record.plannedTransmissionUpgradeCount,
      `${path}.plannedTransmissionUpgradeCount`
    ),
    statusMix: readStringNumberRecord(record.statusMix, `${path}.statusMix`),
  };
}
function decodeQueueProjectRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readOptionalExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    fuelType: readOptionalString(record.fuelType, `${path}.fuelType`),
    latestSourceAsOfDate: readOptionalExpectedDate(
      record.latestSourceAsOfDate,
      `${path}.latestSourceAsOfDate`
    ),
    marketId: readOptionalString(record.marketId, `${path}.marketId`),
    nativeStatus: readOptionalString(record.nativeStatus, `${path}.nativeStatus`),
    projectId: readRequiredString(record.projectId, `${path}.projectId`),
    queueCountyConfidence:
      record.queueCountyConfidence === null || typeof record.queueCountyConfidence === "undefined"
        ? null
        : readQueueResolutionConfidence(
            record.queueCountyConfidence,
            `${path}.queueCountyConfidence`
          ),
    queuePoiLabel: readOptionalString(record.queuePoiLabel, `${path}.queuePoiLabel`),
    queueName: readOptionalString(record.queueName, `${path}.queueName`),
    queueResolverType: readOptionalString(record.queueResolverType, `${path}.queueResolverType`),
    stageGroup: readOptionalQueueStageGroup(record.stageGroup, `${path}.stageGroup`),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
  };
}
function decodeQueueCountyResolutionRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const allocationShare = readFiniteNumber(record.allocationShare, `${path}.allocationShare`);
  if (allocationShare <= 0 || allocationShare > 1) {
    throw new Error(`Expected positive allocation share at ${path}.allocationShare`);
  }
  return {
    allocationShare,
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    marketId: readOptionalString(record.marketId, `${path}.marketId`),
    projectId: readRequiredString(record.projectId, `${path}.projectId`),
    queuePoiLabel: readOptionalString(record.queuePoiLabel, `${path}.queuePoiLabel`),
    resolverConfidence: readQueueResolutionConfidence(
      record.resolverConfidence,
      `${path}.resolverConfidence`
    ),
    resolverType: readRequiredString(record.resolverType, `${path}.resolverType`),
    sourceLocationLabel: readOptionalString(
      record.sourceLocationLabel,
      `${path}.sourceLocationLabel`
    ),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
  };
}
function decodeQueuePoiReferenceRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    operator: readOptionalString(record.operator, `${path}.operator`),
    operatorZoneLabel: readOptionalString(record.operatorZoneLabel, `${path}.operatorZoneLabel`),
    operatorZoneType: readOptionalString(record.operatorZoneType, `${path}.operatorZoneType`),
    queuePoiLabel: readRequiredString(record.queuePoiLabel, `${path}.queuePoiLabel`),
    resolutionMethod: readRequiredString(record.resolutionMethod, `${path}.resolutionMethod`),
    resolverConfidence: readQueueResolutionConfidence(
      record.resolverConfidence,
      `${path}.resolverConfidence`
    ),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
  };
}
function decodeQueueResolutionOverrideRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const allocationShare = readFiniteNumber(record.allocationShare, `${path}.allocationShare`);
  if (allocationShare <= 0 || allocationShare > 1) {
    throw new Error(`Expected positive allocation share at ${path}.allocationShare`);
  }
  return {
    allocationShare,
    countyFips: readExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    matcherType: readRequiredString(record.matcherType, `${path}.matcherType`),
    matcherValue: readRequiredString(record.matcherValue, `${path}.matcherValue`),
    notes: readOptionalString(record.notes, `${path}.notes`),
    resolverConfidence: readQueueResolutionConfidence(
      record.resolverConfidence,
      `${path}.resolverConfidence`
    ),
    resolverType: readRequiredString(record.resolverType, `${path}.resolverType`),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
  };
}
function decodeQueueSnapshotRecord(value, path) {
  const record = readRequiredRecord(value, path);
  return {
    capacityMw: readOptionalFiniteNumber(record.capacityMw, `${path}.capacityMw`),
    completionPrior: readOptionalUnitInterval(record.completionPrior, `${path}.completionPrior`),
    countyFips: readOptionalExpectedCountyFips(record.countyFips, `${path}.countyFips`),
    daysInQueueActive: readOptionalNonNegativeInteger(
      record.daysInQueueActive,
      `${path}.daysInQueueActive`
    ),
    expectedOperationDate: readOptionalExpectedDate(
      record.expectedOperationDate,
      `${path}.expectedOperationDate`
    ),
    isPastDue:
      record.isPastDue === null || typeof record.isPastDue === "undefined"
        ? null
        : Boolean(record.isPastDue),
    marketId: readOptionalString(record.marketId, `${path}.marketId`),
    nativeStatus: readOptionalString(record.nativeStatus, `${path}.nativeStatus`),
    projectId: readRequiredString(record.projectId, `${path}.projectId`),
    queueDate: readOptionalExpectedDate(record.queueDate, `${path}.queueDate`),
    queueStatus: readOptionalString(record.queueStatus, `${path}.queueStatus`),
    signedIa:
      record.signedIa === null || typeof record.signedIa === "undefined"
        ? null
        : Boolean(record.signedIa),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stageGroup: readOptionalQueueStageGroup(record.stageGroup, `${path}.stageGroup`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
    transmissionUpgradeCostUsd: readOptionalFiniteNumber(
      record.transmissionUpgradeCostUsd,
      `${path}.transmissionUpgradeCostUsd`
    ),
    transmissionUpgradeCount: readOptionalNonNegativeInteger(
      record.transmissionUpgradeCount,
      `${path}.transmissionUpgradeCount`
    ),
    withdrawalPrior: readOptionalUnitInterval(record.withdrawalPrior, `${path}.withdrawalPrior`),
  };
}
function decodeQueueUnresolvedRecord(value, path) {
  const record = readRequiredRecord(value, path);
  const candidateCountyFips = readRequiredArray(
    record.candidateCountyFips,
    `${path}.candidateCountyFips`
  ).map((entry, index) =>
    readExpectedCountyFips(entry, `${path}.candidateCountyFips[${String(index)}]`)
  );
  return {
    candidateCountyFips,
    manualReviewFlag:
      record.manualReviewFlag === null || typeof record.manualReviewFlag === "undefined"
        ? true
        : Boolean(record.manualReviewFlag),
    marketId: readOptionalString(record.marketId, `${path}.marketId`),
    nativeStatus: readOptionalString(record.nativeStatus, `${path}.nativeStatus`),
    projectId: readRequiredString(record.projectId, `${path}.projectId`),
    queueName: readOptionalString(record.queueName, `${path}.queueName`),
    queuePoiLabel: readOptionalString(record.queuePoiLabel, `${path}.queuePoiLabel`),
    rawLocationLabel: readOptionalString(record.rawLocationLabel, `${path}.rawLocationLabel`),
    sourceSystem: readRequiredString(record.sourceSystem, `${path}.sourceSystem`),
    stateAbbrev: readOptionalString(record.stateAbbrev, `${path}.stateAbbrev`),
    unresolvedReason: readRequiredString(record.unresolvedReason, `${path}.unresolvedReason`),
  };
}
function decodeNdjsonFile(path, recordCount, decodeRecord) {
  const lines = readNdjsonLines(path);
  if (lines.length !== recordCount) {
    throw new Error(
      `Record count mismatch for ${path}: expected ${String(recordCount)}, received ${String(lines.length)}`
    );
  }
  return lines.map((line, index) => {
    const pathLabel = `${path}:${String(index + 1)}`;
    return decodeRecord(JSON.parse(line), pathLabel);
  });
}
function sortByCountyFips(records, datasetName) {
  const seenCountyFips = new Set();
  const sorted = [...records].sort((left, right) =>
    left.countyFips.localeCompare(right.countyFips)
  );
  for (const record of sorted) {
    if (seenCountyFips.has(record.countyFips)) {
      throw new Error(`Duplicate countyFips "${record.countyFips}" detected in ${datasetName}`);
    }
    seenCountyFips.add(record.countyFips);
  }
  return sorted;
}
function sortByRecordKey(records, datasetName, readKey) {
  const seenKeys = new Set();
  const sorted = [...records].sort((left, right) => readKey(left).localeCompare(readKey(right)));
  for (const record of sorted) {
    const key = readKey(record);
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key "${key}" detected in ${datasetName}`);
    }
    seenKeys.add(key);
  }
  return sorted;
}
function materializedDatasetPaths(rawDir) {
  return {
    congestion: join(rawDir, CONGESTION_FILE_NAME),
    countyFipsAliases: join(rawDir, COUNTY_FIPS_ALIASES_FILE_NAME),
    countyOperatorRegions: join(rawDir, COUNTY_OPERATOR_REGIONS_FILE_NAME),
    countyOperatorZones: join(rawDir, COUNTY_OPERATOR_ZONES_FILE_NAME),
    fiber: join(rawDir, FIBER_FILE_NAME),
    gas: join(rawDir, GAS_FILE_NAME),
    gridFriction: join(rawDir, GRID_FRICTION_FILE_NAME),
    operatorRegions: join(rawDir, OPERATOR_REGIONS_FILE_NAME),
    operatorZoneReferences: join(rawDir, OPERATOR_ZONE_REFERENCES_FILE_NAME),
    policyEvents: join(rawDir, POLICY_EVENTS_FILE_NAME),
    policySnapshots: join(rawDir, POLICY_SNAPSHOTS_FILE_NAME),
    powerMarketContext: join(rawDir, POWER_MARKET_CONTEXT_FILE_NAME),
    queuePoiReferences: join(rawDir, QUEUE_POI_REFERENCES_FILE_NAME),
    queueCountyResolutions: join(rawDir, QUEUE_COUNTY_RESOLUTIONS_FILE_NAME),
    queueProjects: join(rawDir, QUEUE_PROJECTS_FILE_NAME),
    queueResolutionOverrides: join(rawDir, QUEUE_RESOLUTION_OVERRIDES_FILE_NAME),
    queueSnapshots: join(rawDir, QUEUE_SNAPSHOTS_FILE_NAME),
    queueUnresolved: join(rawDir, QUEUE_UNRESOLVED_FILE_NAME),
    transmission: join(rawDir, TRANSMISSION_FILE_NAME),
    utilityContext: join(rawDir, UTILITY_CONTEXT_FILE_NAME),
  };
}
function normalizedDatasetPaths(normalizedDir) {
  return materializedDatasetPaths(normalizedDir);
}
function copyLocalFile(sourcePath, destinationPath) {
  const resolvedSourcePath = resolve(sourcePath);
  if (!fileExists(resolvedSourcePath)) {
    throw new Error(`Source file not found: ${resolvedSourcePath}`);
  }
  copyFileEnsuringDirectory(resolvedSourcePath, destinationPath);
}
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)} ${response.statusText}`);
  }
  return response.text();
}
async function materializeRemoteFile(url, destinationPath) {
  writeTextAtomic(destinationPath, await fetchText(url));
}
function resolveLocalDatasetSourcePath(manifestPath, descriptorPath) {
  return resolve(dirname(manifestPath), descriptorPath);
}
function resolveRemoteDatasetSourceUrl(manifestUrl, descriptorPath) {
  return new URL(descriptorPath, manifestUrl).toString();
}
function buildMaterializedManifest(manifest) {
  return {
    ...manifest,
    datasets: {
      congestion: {
        ...manifest.datasets.congestion,
        path: CONGESTION_FILE_NAME,
      },
      countyFipsAliases: {
        ...manifest.datasets.countyFipsAliases,
        path: COUNTY_FIPS_ALIASES_FILE_NAME,
      },
      countyOperatorRegions: {
        ...manifest.datasets.countyOperatorRegions,
        path: COUNTY_OPERATOR_REGIONS_FILE_NAME,
      },
      countyOperatorZones: {
        ...manifest.datasets.countyOperatorZones,
        path: COUNTY_OPERATOR_ZONES_FILE_NAME,
      },
      fiber: {
        ...manifest.datasets.fiber,
        path: FIBER_FILE_NAME,
      },
      gas: {
        ...manifest.datasets.gas,
        path: GAS_FILE_NAME,
      },
      gridFriction: {
        ...manifest.datasets.gridFriction,
        path: GRID_FRICTION_FILE_NAME,
      },
      operatorRegions: {
        ...manifest.datasets.operatorRegions,
        path: OPERATOR_REGIONS_FILE_NAME,
      },
      operatorZoneReferences: {
        ...manifest.datasets.operatorZoneReferences,
        path: OPERATOR_ZONE_REFERENCES_FILE_NAME,
      },
      policyEvents: {
        ...manifest.datasets.policyEvents,
        path: POLICY_EVENTS_FILE_NAME,
      },
      policySnapshots: {
        ...manifest.datasets.policySnapshots,
        path: POLICY_SNAPSHOTS_FILE_NAME,
      },
      powerMarketContext: {
        ...manifest.datasets.powerMarketContext,
        path: POWER_MARKET_CONTEXT_FILE_NAME,
      },
      queuePoiReferences: {
        ...manifest.datasets.queuePoiReferences,
        path: QUEUE_POI_REFERENCES_FILE_NAME,
      },
      queueCountyResolutions: {
        ...manifest.datasets.queueCountyResolutions,
        path: QUEUE_COUNTY_RESOLUTIONS_FILE_NAME,
      },
      queueProjects: {
        ...manifest.datasets.queueProjects,
        path: QUEUE_PROJECTS_FILE_NAME,
      },
      queueResolutionOverrides: {
        ...manifest.datasets.queueResolutionOverrides,
        path: QUEUE_RESOLUTION_OVERRIDES_FILE_NAME,
      },
      queueSnapshots: {
        ...manifest.datasets.queueSnapshots,
        path: QUEUE_SNAPSHOTS_FILE_NAME,
      },
      queueUnresolved: {
        ...manifest.datasets.queueUnresolved,
        path: QUEUE_UNRESOLVED_FILE_NAME,
      },
      transmission: {
        ...manifest.datasets.transmission,
        path: TRANSMISSION_FILE_NAME,
      },
      utilityContext: {
        ...manifest.datasets.utilityContext,
        path: UTILITY_CONTEXT_FILE_NAME,
      },
    },
  };
}
function normalizeUtilityCount(record) {
  const utilityCount = record.utilityCount ?? record.utilities.length;
  return {
    ...record,
    utilityCount,
  };
}
function buildNormalizedManifest(manifest, counts) {
  return {
    ...manifest,
    datasets: {
      congestion: {
        ...manifest.datasets.congestion,
        path: CONGESTION_FILE_NAME,
        recordCount: counts.congestion,
      },
      countyFipsAliases: {
        ...manifest.datasets.countyFipsAliases,
        path: COUNTY_FIPS_ALIASES_FILE_NAME,
        recordCount: counts.countyFipsAliases,
      },
      countyOperatorRegions: {
        ...manifest.datasets.countyOperatorRegions,
        path: COUNTY_OPERATOR_REGIONS_FILE_NAME,
        recordCount: counts.countyOperatorRegions,
      },
      countyOperatorZones: {
        ...manifest.datasets.countyOperatorZones,
        path: COUNTY_OPERATOR_ZONES_FILE_NAME,
        recordCount: counts.countyOperatorZones,
      },
      fiber: {
        ...manifest.datasets.fiber,
        path: FIBER_FILE_NAME,
        recordCount: counts.fiber,
      },
      gas: {
        ...manifest.datasets.gas,
        path: GAS_FILE_NAME,
        recordCount: counts.gas,
      },
      gridFriction: {
        ...manifest.datasets.gridFriction,
        path: GRID_FRICTION_FILE_NAME,
        recordCount: counts.gridFriction,
      },
      operatorRegions: {
        ...manifest.datasets.operatorRegions,
        path: OPERATOR_REGIONS_FILE_NAME,
        recordCount: counts.operatorRegions,
      },
      operatorZoneReferences: {
        ...manifest.datasets.operatorZoneReferences,
        path: OPERATOR_ZONE_REFERENCES_FILE_NAME,
        recordCount: counts.operatorZoneReferences,
      },
      policyEvents: {
        ...manifest.datasets.policyEvents,
        path: POLICY_EVENTS_FILE_NAME,
        recordCount: counts.policyEvents,
      },
      policySnapshots: {
        ...manifest.datasets.policySnapshots,
        path: POLICY_SNAPSHOTS_FILE_NAME,
        recordCount: counts.policySnapshots,
      },
      powerMarketContext: {
        ...manifest.datasets.powerMarketContext,
        path: POWER_MARKET_CONTEXT_FILE_NAME,
        recordCount: counts.powerMarketContext,
      },
      queuePoiReferences: {
        ...manifest.datasets.queuePoiReferences,
        path: QUEUE_POI_REFERENCES_FILE_NAME,
        recordCount: counts.queuePoiReferences,
      },
      queueCountyResolutions: {
        ...manifest.datasets.queueCountyResolutions,
        path: QUEUE_COUNTY_RESOLUTIONS_FILE_NAME,
        recordCount: counts.queueCountyResolutions,
      },
      queueProjects: {
        ...manifest.datasets.queueProjects,
        path: QUEUE_PROJECTS_FILE_NAME,
        recordCount: counts.queueProjects,
      },
      queueResolutionOverrides: {
        ...manifest.datasets.queueResolutionOverrides,
        path: QUEUE_RESOLUTION_OVERRIDES_FILE_NAME,
        recordCount: counts.queueResolutionOverrides,
      },
      queueSnapshots: {
        ...manifest.datasets.queueSnapshots,
        path: QUEUE_SNAPSHOTS_FILE_NAME,
        recordCount: counts.queueSnapshots,
      },
      queueUnresolved: {
        ...manifest.datasets.queueUnresolved,
        path: QUEUE_UNRESOLVED_FILE_NAME,
        recordCount: counts.queueUnresolved,
      },
      transmission: {
        ...manifest.datasets.transmission,
        path: TRANSMISSION_FILE_NAME,
        recordCount: counts.transmission,
      },
      utilityContext: {
        ...manifest.datasets.utilityContext,
        path: UTILITY_CONTEXT_FILE_NAME,
        recordCount: counts.utilityContext,
      },
    },
  };
}
function writeNdjsonFile(path, records) {
  const content = records.map((record) => JSON.stringify(record)).join("\n");
  writeTextAtomic(path, content.length > 0 ? `${content}\n` : "");
}
function chunkRecords(records, size) {
  const chunks = [];
  for (let index = 0; index < records.length; index += size) {
    chunks.push(records.slice(index, index + size));
  }
  return chunks;
}
function buildBatchInsertStatement(tableName, columns, records) {
  const params = [];
  let parameterIndex = 1;
  const valueRows = records.map((record) => {
    const placeholders = columns.map((column) => {
      params.push(column.readValue(record));
      const placeholder = `$${String(parameterIndex)}${column.cast}`;
      parameterIndex += 1;
      return placeholder;
    });
    return `(${placeholders.join(", ")})`;
  });
  return {
    params,
    sql: `INSERT INTO ${tableName} (${columns.map((column) => column.name).join(", ")}) VALUES ${valueRows.join(", ")}`,
  };
}
async function replaceMonthSnapshot(sql, args) {
  await sql.unsafe(`DELETE FROM ${args.tableName} WHERE month = $1::date`, [args.month]).execute();
  for (const batch of chunkRecords(args.records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(args.tableName, args.columns, batch);
    await sql.unsafe(statement.sql, statement.params).execute();
  }
}
async function replaceEffectiveSnapshot(sql, args) {
  await sql
    .unsafe(`DELETE FROM ${args.tableName} WHERE effective_date = $1::date`, [args.effectiveDate])
    .execute();
  for (const batch of chunkRecords(args.records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(args.tableName, args.columns, batch);
    await sql.unsafe(statement.sql, statement.params).execute();
  }
}
async function upsertQueueProjects(sql, records) {
  for (const batch of chunkRecords(records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(
      "analytics.fact_gen_queue_project",
      [
        { cast: "::text", name: "project_id", readValue: (row) => row.projectId },
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "queue_name", readValue: (row) => row.queueName },
        { cast: "::text", name: "market_id", readValue: (row) => row.marketId },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "fuel_type", readValue: (row) => row.fuelType },
        { cast: "::text", name: "native_status", readValue: (row) => row.nativeStatus },
        { cast: "::text", name: "stage_group", readValue: (row) => row.stageGroup },
        {
          cast: "::text",
          name: "queue_county_confidence",
          readValue: (row) => row.queueCountyConfidence,
        },
        { cast: "::text", name: "queue_poi_label", readValue: (row) => row.queuePoiLabel },
        { cast: "::text", name: "queue_resolver_type", readValue: (row) => row.queueResolverType },
        {
          cast: "::date",
          name: "latest_source_as_of_date",
          readValue: (row) => row.latestSourceAsOfDate,
        },
        {
          cast: "::timestamptz",
          name: "latest_source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      batch
    );
    await sql
      .unsafe(
        `${statement.sql}
        ON CONFLICT (project_id) DO UPDATE SET
          source_system = EXCLUDED.source_system,
          queue_name = EXCLUDED.queue_name,
          market_id = EXCLUDED.market_id,
          county_geoid = EXCLUDED.county_geoid,
          state_abbrev = EXCLUDED.state_abbrev,
          fuel_type = EXCLUDED.fuel_type,
          native_status = EXCLUDED.native_status,
          stage_group = EXCLUDED.stage_group,
          queue_county_confidence = EXCLUDED.queue_county_confidence,
          queue_poi_label = EXCLUDED.queue_poi_label,
          queue_resolver_type = EXCLUDED.queue_resolver_type,
          latest_source_as_of_date = EXCLUDED.latest_source_as_of_date,
          latest_source_pull_ts = EXCLUDED.latest_source_pull_ts,
          model_version = EXCLUDED.model_version`,
        statement.params
      )
      .execute();
  }
}
async function replaceQueueCountyResolutions(sql, records, effectiveDate) {
  const sourceSystems = [...new Set(records.map((record) => record.sourceSystem))];
  for (const sourceSystem of sourceSystems) {
    await sql
      .unsafe(
        `
        DELETE FROM analytics.fact_gen_queue_county_resolution
        WHERE effective_date = $1::date
          AND source_system = $2::text
      `,
        [effectiveDate, sourceSystem]
      )
      .execute();
  }
  for (const batch of chunkRecords(records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(
      "analytics.fact_gen_queue_county_resolution",
      [
        { cast: "::text", name: "project_id", readValue: (row) => row.projectId },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "market_id", readValue: (row) => row.marketId },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::numeric", name: "allocation_share", readValue: (row) => row.allocationShare },
        { cast: "::text", name: "resolver_type", readValue: (row) => row.resolverType },
        {
          cast: "::text",
          name: "resolver_confidence",
          readValue: (row) => row.resolverConfidence,
        },
        { cast: "::text", name: "queue_poi_label", readValue: (row) => row.queuePoiLabel },
        {
          cast: "::text",
          name: "source_location_label",
          readValue: (row) => row.sourceLocationLabel,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      batch
    );
    await sql.unsafe(statement.sql, statement.params).execute();
  }
}
async function replaceQueueSnapshots(sql, records, effectiveDate) {
  const sourceSystems = [...new Set(records.map((record) => record.sourceSystem))];
  for (const sourceSystem of sourceSystems) {
    await sql
      .unsafe(
        `
        DELETE FROM analytics.fact_gen_queue_snapshot
        WHERE effective_date = $1::date
          AND source_system = $2::text
      `,
        [effectiveDate, sourceSystem]
      )
      .execute();
  }
  for (const batch of chunkRecords(records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(
      "analytics.fact_gen_queue_snapshot",
      [
        { cast: "::text", name: "snapshot_run_id", readValue: (row) => row.snapshotRunId },
        { cast: "::text", name: "project_id", readValue: (row) => row.projectId },
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "market_id", readValue: (row) => row.marketId },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "native_status", readValue: (row) => row.nativeStatus },
        { cast: "::text", name: "queue_status", readValue: (row) => row.queueStatus },
        { cast: "::text", name: "stage_group", readValue: (row) => row.stageGroup },
        { cast: "::boolean", name: "signed_ia", readValue: (row) => row.signedIa },
        { cast: "::numeric", name: "capacity_mw", readValue: (row) => row.capacityMw },
        { cast: "::date", name: "queue_date", readValue: (row) => row.queueDate },
        {
          cast: "::date",
          name: "expected_operation_date",
          readValue: (row) => row.expectedOperationDate,
        },
        {
          cast: "::integer",
          name: "days_in_queue_active",
          readValue: (row) => row.daysInQueueActive,
        },
        { cast: "::boolean", name: "is_past_due", readValue: (row) => row.isPastDue },
        {
          cast: "::numeric",
          name: "completion_prior",
          readValue: (row) => row.completionPrior,
        },
        {
          cast: "::numeric",
          name: "withdrawal_prior",
          readValue: (row) => row.withdrawalPrior,
        },
        {
          cast: "::integer",
          name: "transmission_upgrade_count",
          readValue: (row) => row.transmissionUpgradeCount,
        },
        {
          cast: "::numeric",
          name: "transmission_upgrade_cost_usd",
          readValue: (row) => row.transmissionUpgradeCostUsd,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      batch
    );
    await sql.unsafe(statement.sql, statement.params).execute();
  }
}
async function upsertPolicyEvents(sql, records) {
  for (const batch of chunkRecords(records, INSERT_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const statement = buildBatchInsertStatement(
      "analytics.fact_policy_event",
      [
        { cast: "::text", name: "event_id", readValue: (row) => row.eventId },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "market_id", readValue: (row) => row.marketId },
        { cast: "::text", name: "jurisdiction_level", readValue: (row) => row.jurisdictionLevel },
        { cast: "::text", name: "jurisdiction_key", readValue: (row) => row.jurisdictionKey },
        { cast: "::text", name: "event_type", readValue: (row) => row.eventType },
        { cast: "::text", name: "policy_type", readValue: (row) => row.policyType },
        { cast: "::text", name: "policy_status", readValue: (row) => row.policyStatus },
        { cast: "::text", name: "policy_direction", readValue: (row) => row.policyDirection },
        {
          cast: "::text",
          name: "affected_siting_dimension",
          readValue: (row) => row.affectedSitingDimension,
        },
        { cast: "::date", name: "event_date", readValue: (row) => row.eventDate },
        { cast: "::text", name: "title", readValue: (row) => row.title },
        { cast: "::text", name: "evidence_summary", readValue: (row) => row.evidenceSummary },
        { cast: "::text", name: "source_url", readValue: (row) => row.sourceUrl },
        { cast: "::text", name: "moratorium_status", readValue: (row) => row.moratoriumStatus },
        { cast: "::text", name: "sentiment_direction", readValue: (row) => row.sentimentDirection },
        { cast: "::text", name: "confidence_class", readValue: (row) => row.confidenceClass },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      batch
    );
    await sql
      .unsafe(
        `${statement.sql}
        ON CONFLICT (event_id) DO UPDATE SET
          county_geoid = EXCLUDED.county_geoid,
          state_abbrev = EXCLUDED.state_abbrev,
          market_id = EXCLUDED.market_id,
          jurisdiction_level = EXCLUDED.jurisdiction_level,
          jurisdiction_key = EXCLUDED.jurisdiction_key,
          event_type = EXCLUDED.event_type,
          policy_type = EXCLUDED.policy_type,
          policy_status = EXCLUDED.policy_status,
          policy_direction = EXCLUDED.policy_direction,
          affected_siting_dimension = EXCLUDED.affected_siting_dimension,
          event_date = EXCLUDED.event_date,
          title = EXCLUDED.title,
          evidence_summary = EXCLUDED.evidence_summary,
          source_url = EXCLUDED.source_url,
          moratorium_status = EXCLUDED.moratorium_status,
          sentiment_direction = EXCLUDED.sentiment_direction,
          confidence_class = EXCLUDED.confidence_class,
          source_pull_ts = EXCLUDED.source_pull_ts,
          source_as_of_date = EXCLUDED.source_as_of_date,
          effective_date = EXCLUDED.effective_date,
          model_version = EXCLUDED.model_version`,
        statement.params
      )
      .execute();
  }
}
export function createCountyPowerRunId(date = new Date()) {
  return formatRunTimestamp(date);
}
export function resolveCountyPowerRunContext(projectRoot, runId, env = process.env) {
  const configuredRoot = env.COUNTY_POWER_SNAPSHOT_ROOT;
  const snapshotRoot =
    typeof configuredRoot === "string" && configuredRoot.trim().length > 0
      ? resolve(projectRoot, configuredRoot.trim())
      : resolve(projectRoot, "var", "county-power-sync");
  const runDir = join(snapshotRoot, runId);
  return {
    latestRunPointerPath: join(snapshotRoot, "latest.json"),
    normalizedDir: join(runDir, "normalized"),
    normalizedManifestPath: join(runDir, "normalized", NORMALIZED_MANIFEST_FILE_NAME),
    rawDir: join(runDir, "raw"),
    rawManifestPath: join(runDir, "raw", MATERIALIZED_MANIFEST_FILE_NAME),
    runConfigPath: join(runDir, "run-config.json"),
    runDir,
    runId,
    runSummaryPath: join(runDir, "run-summary.json"),
    snapshotRoot,
  };
}
export function ensureCountyPowerRunDirectories(context) {
  ensureDirectory(context.rawDir);
  ensureDirectory(context.normalizedDir);
}
export function writeCountyPowerRunConfig(path, config) {
  writeJsonAtomic(path, {
    ...config,
    createdAt: new Date().toISOString(),
  });
}
export function verifyCountyPowerRunConfig(path, expected) {
  if (!fileExists(path)) {
    return;
  }
  const existing = readJson(path, decodeCountyPowerRunConfig);
  const expectedComparable = JSON.stringify(
    {
      dataVersion: expected.dataVersion,
      effectiveDate: expected.effectiveDate,
      manifestPath:
        typeof expected.manifestPath === "string"
          ? expected.manifestPath
          : (existing.manifestPath ?? null),
      manifestUrl:
        typeof expected.manifestUrl === "string"
          ? expected.manifestUrl
          : (existing.manifestUrl ?? null),
      month: expected.month,
      options: expected.options,
      runId: expected.runId,
    },
    null,
    2
  );
  const existingComparable = JSON.stringify(
    {
      dataVersion: existing.dataVersion,
      effectiveDate: existing.effectiveDate,
      manifestPath: existing.manifestPath ?? null,
      manifestUrl: existing.manifestUrl ?? null,
      month: existing.month,
      options: existing.options,
      runId: existing.runId,
    },
    null,
    2
  );
  if (expectedComparable !== existingComparable) {
    throw new Error(
      `Saved county power run config does not match current inputs for ${path}. Delete the run directory or reuse the original inputs.`
    );
  }
}
export function decodeCountyPowerRunConfig(value) {
  const record = readRequiredRecord(value, "runConfig");
  const optionsRecord = readRequiredRecord(record.options, "runConfig.options");
  const options = Object.entries(optionsRecord).reduce((result, entry) => {
    const [key, rawValue] = entry;
    result[key] = readRequiredString(rawValue, `runConfig.options.${key}`);
    return result;
  }, {});
  const manifestPath = readOptionalString(record.manifestPath, "runConfig.manifestPath");
  const manifestUrl = readOptionalString(record.manifestUrl, "runConfig.manifestUrl");
  return {
    createdAt: readExpectedTimestamp(record.createdAt, "runConfig.createdAt"),
    dataVersion:
      record.dataVersion === null || typeof record.dataVersion === "undefined"
        ? null
        : readExpectedDate(record.dataVersion, "runConfig.dataVersion"),
    effectiveDate:
      record.effectiveDate === null || typeof record.effectiveDate === "undefined"
        ? null
        : readExpectedDate(record.effectiveDate, "runConfig.effectiveDate"),
    ...(manifestPath === null ? {} : { manifestPath }),
    ...(manifestUrl === null ? {} : { manifestUrl }),
    month:
      record.month === null || typeof record.month === "undefined"
        ? null
        : readExpectedMonth(record.month, "runConfig.month"),
    options,
    runId: readRequiredString(record.runId, "runConfig.runId"),
  };
}
export function decodeCountyPowerBundleManifest(value) {
  const record = readRequiredRecord(value, "manifest");
  const datasets = readRequiredRecord(record.datasets, "manifest.datasets");
  const bundleVersion = readRequiredString(record.bundleVersion, "manifest.bundleVersion");
  if (bundleVersion !== BUNDLE_VERSION) {
    throw new Error(`Unsupported county power bundle version "${bundleVersion}"`);
  }
  return {
    bundleVersion: BUNDLE_VERSION,
    dataVersion: readExpectedDate(record.dataVersion, "manifest.dataVersion"),
    datasets: {
      congestion: decodeSourceDescriptor(datasets.congestion, "manifest.datasets.congestion"),
      countyFipsAliases: decodeSourceDescriptor(
        datasets.countyFipsAliases,
        "manifest.datasets.countyFipsAliases"
      ),
      countyOperatorRegions: decodeSourceDescriptor(
        datasets.countyOperatorRegions,
        "manifest.datasets.countyOperatorRegions"
      ),
      countyOperatorZones: decodeSourceDescriptor(
        datasets.countyOperatorZones,
        "manifest.datasets.countyOperatorZones"
      ),
      fiber: decodeSourceDescriptor(datasets.fiber, "manifest.datasets.fiber"),
      gas: decodeSourceDescriptor(datasets.gas, "manifest.datasets.gas"),
      gridFriction: decodeSourceDescriptor(datasets.gridFriction, "manifest.datasets.gridFriction"),
      operatorRegions: decodeSourceDescriptor(
        datasets.operatorRegions,
        "manifest.datasets.operatorRegions"
      ),
      operatorZoneReferences: decodeSourceDescriptor(
        datasets.operatorZoneReferences,
        "manifest.datasets.operatorZoneReferences"
      ),
      policyEvents: decodeSourceDescriptor(datasets.policyEvents, "manifest.datasets.policyEvents"),
      policySnapshots: decodeSourceDescriptor(
        datasets.policySnapshots,
        "manifest.datasets.policySnapshots"
      ),
      powerMarketContext: decodeSourceDescriptor(
        datasets.powerMarketContext,
        "manifest.datasets.powerMarketContext"
      ),
      queuePoiReferences: decodeSourceDescriptor(
        datasets.queuePoiReferences,
        "manifest.datasets.queuePoiReferences"
      ),
      queueCountyResolutions: decodeSourceDescriptor(
        datasets.queueCountyResolutions,
        "manifest.datasets.queueCountyResolutions"
      ),
      queueProjects: decodeSourceDescriptor(
        datasets.queueProjects,
        "manifest.datasets.queueProjects"
      ),
      queueResolutionOverrides: decodeSourceDescriptor(
        datasets.queueResolutionOverrides,
        "manifest.datasets.queueResolutionOverrides"
      ),
      queueSnapshots: decodeSourceDescriptor(
        datasets.queueSnapshots,
        "manifest.datasets.queueSnapshots"
      ),
      queueUnresolved: decodeSourceDescriptor(
        datasets.queueUnresolved,
        "manifest.datasets.queueUnresolved"
      ),
      transmission: decodeSourceDescriptor(datasets.transmission, "manifest.datasets.transmission"),
      utilityContext: decodeSourceDescriptor(
        datasets.utilityContext,
        "manifest.datasets.utilityContext"
      ),
    },
    effectiveDate: readExpectedDate(record.effectiveDate, "manifest.effectiveDate"),
    generatedAt: readExpectedTimestamp(record.generatedAt, "manifest.generatedAt"),
    month: readExpectedMonth(record.month, "manifest.month"),
  };
}
export async function materializeCountyPowerManifest(args) {
  const manifestPath =
    typeof args.manifestPath === "string" && args.manifestPath.trim().length > 0
      ? resolve(args.manifestPath.trim())
      : null;
  const manifestUrl =
    typeof args.manifestUrl === "string" && args.manifestUrl.trim().length > 0
      ? args.manifestUrl.trim()
      : null;
  if (
    (manifestPath === null && manifestUrl === null) ||
    (manifestPath !== null && manifestUrl !== null)
  ) {
    throw new Error(
      "Provide exactly one county power manifest input: --manifest-path or --manifest-url"
    );
  }
  let manifest;
  if (manifestPath !== null) {
    manifest = readJson(manifestPath, decodeCountyPowerBundleManifest);
  } else if (manifestUrl !== null) {
    manifest = decodeCountyPowerBundleManifest(JSON.parse(await fetchText(manifestUrl)));
  } else {
    throw new Error("County power manifest input is required");
  }
  const rawPaths = materializedDatasetPaths(args.rawDir);
  if (manifestPath !== null) {
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.countyFipsAliases.path),
      rawPaths.countyFipsAliases
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.operatorRegions.path),
      rawPaths.operatorRegions
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.countyOperatorRegions.path),
      rawPaths.countyOperatorRegions
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.operatorZoneReferences.path),
      rawPaths.operatorZoneReferences
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.countyOperatorZones.path),
      rawPaths.countyOperatorZones
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.powerMarketContext.path),
      rawPaths.powerMarketContext
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.utilityContext.path),
      rawPaths.utilityContext
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.fiber.path),
      rawPaths.fiber
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.gas.path),
      rawPaths.gas
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.transmission.path),
      rawPaths.transmission
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.congestion.path),
      rawPaths.congestion
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.gridFriction.path),
      rawPaths.gridFriction
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.policyEvents.path),
      rawPaths.policyEvents
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.policySnapshots.path),
      rawPaths.policySnapshots
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queuePoiReferences.path),
      rawPaths.queuePoiReferences
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queueCountyResolutions.path),
      rawPaths.queueCountyResolutions
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queueResolutionOverrides.path),
      rawPaths.queueResolutionOverrides
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queueProjects.path),
      rawPaths.queueProjects
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queueSnapshots.path),
      rawPaths.queueSnapshots
    );
    copyLocalFile(
      resolveLocalDatasetSourcePath(manifestPath, manifest.datasets.queueUnresolved.path),
      rawPaths.queueUnresolved
    );
  } else if (manifestUrl !== null) {
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.countyFipsAliases.path),
      rawPaths.countyFipsAliases
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.operatorRegions.path),
      rawPaths.operatorRegions
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.countyOperatorRegions.path),
      rawPaths.countyOperatorRegions
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.operatorZoneReferences.path),
      rawPaths.operatorZoneReferences
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.countyOperatorZones.path),
      rawPaths.countyOperatorZones
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.powerMarketContext.path),
      rawPaths.powerMarketContext
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.utilityContext.path),
      rawPaths.utilityContext
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.fiber.path),
      rawPaths.fiber
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.gas.path),
      rawPaths.gas
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.transmission.path),
      rawPaths.transmission
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.congestion.path),
      rawPaths.congestion
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.gridFriction.path),
      rawPaths.gridFriction
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.policyEvents.path),
      rawPaths.policyEvents
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.policySnapshots.path),
      rawPaths.policySnapshots
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queuePoiReferences.path),
      rawPaths.queuePoiReferences
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queueCountyResolutions.path),
      rawPaths.queueCountyResolutions
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queueResolutionOverrides.path),
      rawPaths.queueResolutionOverrides
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queueProjects.path),
      rawPaths.queueProjects
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queueSnapshots.path),
      rawPaths.queueSnapshots
    );
    await materializeRemoteFile(
      resolveRemoteDatasetSourceUrl(manifestUrl, manifest.datasets.queueUnresolved.path),
      rawPaths.queueUnresolved
    );
  }
  const materializedManifest = buildMaterializedManifest(manifest);
  writeJsonAtomic(args.rawManifestPath, materializedManifest);
  return {
    localManifestPath: args.rawManifestPath,
    manifest: materializedManifest,
    manifestPath,
    manifestUrl,
  };
}
export function normalizeCountyPowerBundle(args) {
  const manifest = readJson(args.rawManifestPath, decodeCountyPowerBundleManifest);
  const rawPaths = {
    congestion: join(dirname(args.rawManifestPath), manifest.datasets.congestion.path),
    countyFipsAliases: join(
      dirname(args.rawManifestPath),
      manifest.datasets.countyFipsAliases.path
    ),
    countyOperatorRegions: join(
      dirname(args.rawManifestPath),
      manifest.datasets.countyOperatorRegions.path
    ),
    countyOperatorZones: join(
      dirname(args.rawManifestPath),
      manifest.datasets.countyOperatorZones.path
    ),
    fiber: join(dirname(args.rawManifestPath), manifest.datasets.fiber.path),
    gridFriction: join(dirname(args.rawManifestPath), manifest.datasets.gridFriction.path),
    operatorRegions: join(dirname(args.rawManifestPath), manifest.datasets.operatorRegions.path),
    operatorZoneReferences: join(
      dirname(args.rawManifestPath),
      manifest.datasets.operatorZoneReferences.path
    ),
    policyEvents: join(dirname(args.rawManifestPath), manifest.datasets.policyEvents.path),
    policySnapshots: join(dirname(args.rawManifestPath), manifest.datasets.policySnapshots.path),
    powerMarketContext: join(
      dirname(args.rawManifestPath),
      manifest.datasets.powerMarketContext.path
    ),
    queuePoiReferences: join(
      dirname(args.rawManifestPath),
      manifest.datasets.queuePoiReferences.path
    ),
    queueCountyResolutions: join(
      dirname(args.rawManifestPath),
      manifest.datasets.queueCountyResolutions.path
    ),
    queueProjects: join(dirname(args.rawManifestPath), manifest.datasets.queueProjects.path),
    queueResolutionOverrides: join(
      dirname(args.rawManifestPath),
      manifest.datasets.queueResolutionOverrides.path
    ),
    queueSnapshots: join(dirname(args.rawManifestPath), manifest.datasets.queueSnapshots.path),
    queueUnresolved: join(dirname(args.rawManifestPath), manifest.datasets.queueUnresolved.path),
    gas: join(dirname(args.rawManifestPath), manifest.datasets.gas.path),
    transmission: join(dirname(args.rawManifestPath), manifest.datasets.transmission.path),
    utilityContext: join(dirname(args.rawManifestPath), manifest.datasets.utilityContext.path),
  };
  const countyFipsAliases = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.countyFipsAliases,
      manifest.datasets.countyFipsAliases.recordCount,
      decodeCountyFipsAliasRecord
    ),
    "countyFipsAliases",
    (record) => `${record.aliasCountyFips}:${record.canonicalCountyFips}`
  );
  const operatorRegions = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.operatorRegions,
      manifest.datasets.operatorRegions.recordCount,
      decodeOperatorRegionRecord
    ),
    "operatorRegions",
    (record) => record.operatorRegion
  );
  const countyOperatorRegions = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.countyOperatorRegions,
      manifest.datasets.countyOperatorRegions.recordCount,
      decodeCountyOperatorRegionRecord
    ),
    "countyOperatorRegions",
    (record) => `${record.countyFips}:${record.operatorRegion}`
  );
  const operatorZoneReferences = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.operatorZoneReferences,
      manifest.datasets.operatorZoneReferences.recordCount,
      decodeOperatorZoneReferenceRecord
    ),
    "operatorZoneReferences",
    (record) =>
      `${record.operator}:${record.operatorZoneLabel}:${record.operatorZoneType}:${record.stateAbbrev ?? ""}`
  );
  const countyOperatorZones = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.countyOperatorZones,
      manifest.datasets.countyOperatorZones.recordCount,
      decodeCountyOperatorZoneRecord
    ),
    "countyOperatorZones",
    (record) =>
      `${record.countyFips}:${record.operator}:${record.operatorZoneLabel}:${record.operatorZoneType}`
  );
  const powerMarketContext = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.powerMarketContext,
      manifest.datasets.powerMarketContext.recordCount,
      decodePowerMarketContextRecord
    ),
    "powerMarketContext"
  );
  const utilityContext = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.utilityContext,
      manifest.datasets.utilityContext.recordCount,
      decodeUtilityContextRecord
    ).map(normalizeUtilityCount),
    "utilityContext"
  );
  const fiber = sortByCountyFips(
    decodeNdjsonFile(rawPaths.fiber, manifest.datasets.fiber.recordCount, decodeFiberRecord),
    "fiber"
  );
  const gas = sortByCountyFips(
    decodeNdjsonFile(rawPaths.gas, manifest.datasets.gas.recordCount, decodeGasRecord),
    "gas"
  );
  const transmission = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.transmission,
      manifest.datasets.transmission.recordCount,
      decodeTransmissionRecord
    ),
    "transmission"
  );
  const congestion = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.congestion,
      manifest.datasets.congestion.recordCount,
      decodeCongestionRecord
    ),
    "congestion"
  );
  const gridFriction = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.gridFriction,
      manifest.datasets.gridFriction.recordCount,
      decodeGridFrictionRecord
    ),
    "gridFriction"
  );
  const policyEvents = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.policyEvents,
      manifest.datasets.policyEvents.recordCount,
      decodePolicyEventRecord
    ),
    "policyEvents",
    (record) => record.eventId
  );
  const policySnapshots = sortByCountyFips(
    decodeNdjsonFile(
      rawPaths.policySnapshots,
      manifest.datasets.policySnapshots.recordCount,
      decodePolicySnapshotRecord
    ),
    "policySnapshots"
  );
  const queuePoiReferences = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queuePoiReferences,
      manifest.datasets.queuePoiReferences.recordCount,
      decodeQueuePoiReferenceRecord
    ),
    "queuePoiReferences",
    (record) => `${record.sourceSystem}:${record.queuePoiLabel}:${record.countyFips}`
  );
  const queueProjects = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queueProjects,
      manifest.datasets.queueProjects.recordCount,
      decodeQueueProjectRecord
    ),
    "queueProjects",
    (record) => record.projectId
  );
  const queueCountyResolutions = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queueCountyResolutions,
      manifest.datasets.queueCountyResolutions.recordCount,
      decodeQueueCountyResolutionRecord
    ),
    "queueCountyResolutions",
    (record) => `${record.projectId}:${record.countyFips}`
  );
  const queueResolutionOverrides = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queueResolutionOverrides,
      manifest.datasets.queueResolutionOverrides.recordCount,
      decodeQueueResolutionOverrideRecord
    ),
    "queueResolutionOverrides",
    (record) =>
      `${record.sourceSystem}:${record.matcherType}:${record.matcherValue}:${record.countyFips}`
  );
  const queueSnapshots = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queueSnapshots,
      manifest.datasets.queueSnapshots.recordCount,
      decodeQueueSnapshotRecord
    ),
    "queueSnapshots",
    (record) => record.projectId
  );
  const queueUnresolved = sortByRecordKey(
    decodeNdjsonFile(
      rawPaths.queueUnresolved,
      manifest.datasets.queueUnresolved.recordCount,
      decodeQueueUnresolvedRecord
    ),
    "queueUnresolved",
    (record) => record.projectId
  );
  const normalizedManifest = buildNormalizedManifest(manifest, {
    congestion: congestion.length,
    countyFipsAliases: countyFipsAliases.length,
    countyOperatorRegions: countyOperatorRegions.length,
    countyOperatorZones: countyOperatorZones.length,
    fiber: fiber.length,
    gas: gas.length,
    gridFriction: gridFriction.length,
    operatorRegions: operatorRegions.length,
    operatorZoneReferences: operatorZoneReferences.length,
    policyEvents: policyEvents.length,
    policySnapshots: policySnapshots.length,
    powerMarketContext: powerMarketContext.length,
    queuePoiReferences: queuePoiReferences.length,
    queueCountyResolutions: queueCountyResolutions.length,
    queueProjects: queueProjects.length,
    queueResolutionOverrides: queueResolutionOverrides.length,
    queueSnapshots: queueSnapshots.length,
    queueUnresolved: queueUnresolved.length,
    transmission: transmission.length,
    utilityContext: utilityContext.length,
  });
  const normalizedPaths = normalizedDatasetPaths(args.normalizedDir);
  writeNdjsonFile(normalizedPaths.countyFipsAliases, countyFipsAliases);
  writeNdjsonFile(normalizedPaths.operatorRegions, operatorRegions);
  writeNdjsonFile(normalizedPaths.countyOperatorRegions, countyOperatorRegions);
  writeNdjsonFile(normalizedPaths.operatorZoneReferences, operatorZoneReferences);
  writeNdjsonFile(normalizedPaths.countyOperatorZones, countyOperatorZones);
  writeNdjsonFile(normalizedPaths.powerMarketContext, powerMarketContext);
  writeNdjsonFile(normalizedPaths.utilityContext, utilityContext);
  writeNdjsonFile(normalizedPaths.fiber, fiber);
  writeNdjsonFile(normalizedPaths.gas, gas);
  writeNdjsonFile(normalizedPaths.transmission, transmission);
  writeNdjsonFile(normalizedPaths.congestion, congestion);
  writeNdjsonFile(normalizedPaths.gridFriction, gridFriction);
  writeNdjsonFile(normalizedPaths.policyEvents, policyEvents);
  writeNdjsonFile(normalizedPaths.policySnapshots, policySnapshots);
  writeNdjsonFile(normalizedPaths.queuePoiReferences, queuePoiReferences);
  writeNdjsonFile(normalizedPaths.queueCountyResolutions, queueCountyResolutions);
  writeNdjsonFile(normalizedPaths.queueResolutionOverrides, queueResolutionOverrides);
  writeNdjsonFile(normalizedPaths.queueProjects, queueProjects);
  writeNdjsonFile(normalizedPaths.queueSnapshots, queueSnapshots);
  writeNdjsonFile(normalizedPaths.queueUnresolved, queueUnresolved);
  writeJsonAtomic(args.normalizedManifestPath, normalizedManifest);
  return {
    congestion,
    countyFipsAliases,
    countyOperatorRegions,
    countyOperatorZones,
    fiber,
    gridFriction,
    manifest: normalizedManifest,
    operatorRegions,
    operatorZoneReferences,
    policyEvents,
    policySnapshots,
    powerMarketContext,
    queuePoiReferences,
    queueCountyResolutions,
    queueProjects,
    queueResolutionOverrides,
    queueSnapshots,
    queueUnresolved,
    gas,
    transmission,
    utilityContext,
  };
}
export function readNormalizedCountyPowerBundle(path) {
  const manifest = readJson(path, decodeCountyPowerBundleManifest);
  const baseDir = dirname(path);
  return {
    congestion: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.congestion.path),
        manifest.datasets.congestion.recordCount,
        decodeCongestionRecord
      ),
      "congestion"
    ),
    countyFipsAliases: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.countyFipsAliases.path),
        manifest.datasets.countyFipsAliases.recordCount,
        decodeCountyFipsAliasRecord
      ),
      "countyFipsAliases",
      (record) => `${record.aliasCountyFips}:${record.canonicalCountyFips}`
    ),
    countyOperatorRegions: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.countyOperatorRegions.path),
        manifest.datasets.countyOperatorRegions.recordCount,
        decodeCountyOperatorRegionRecord
      ),
      "countyOperatorRegions",
      (record) => `${record.countyFips}:${record.operatorRegion}`
    ),
    countyOperatorZones: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.countyOperatorZones.path),
        manifest.datasets.countyOperatorZones.recordCount,
        decodeCountyOperatorZoneRecord
      ),
      "countyOperatorZones",
      (record) =>
        `${record.countyFips}:${record.operator}:${record.operatorZoneLabel}:${record.operatorZoneType}`
    ),
    fiber: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.fiber.path),
        manifest.datasets.fiber.recordCount,
        decodeFiberRecord
      ),
      "fiber"
    ),
    gas: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.gas.path),
        manifest.datasets.gas.recordCount,
        decodeGasRecord
      ),
      "gas"
    ),
    gridFriction: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.gridFriction.path),
        manifest.datasets.gridFriction.recordCount,
        decodeGridFrictionRecord
      ),
      "gridFriction"
    ),
    manifest,
    operatorRegions: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.operatorRegions.path),
        manifest.datasets.operatorRegions.recordCount,
        decodeOperatorRegionRecord
      ),
      "operatorRegions",
      (record) => record.operatorRegion
    ),
    operatorZoneReferences: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.operatorZoneReferences.path),
        manifest.datasets.operatorZoneReferences.recordCount,
        decodeOperatorZoneReferenceRecord
      ),
      "operatorZoneReferences",
      (record) =>
        `${record.operator}:${record.operatorZoneLabel}:${record.operatorZoneType}:${record.stateAbbrev ?? ""}`
    ),
    policyEvents: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.policyEvents.path),
        manifest.datasets.policyEvents.recordCount,
        decodePolicyEventRecord
      ),
      "policyEvents",
      (record) => record.eventId
    ),
    policySnapshots: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.policySnapshots.path),
        manifest.datasets.policySnapshots.recordCount,
        decodePolicySnapshotRecord
      ),
      "policySnapshots"
    ),
    powerMarketContext: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.powerMarketContext.path),
        manifest.datasets.powerMarketContext.recordCount,
        decodePowerMarketContextRecord
      ),
      "powerMarketContext"
    ),
    queuePoiReferences: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queuePoiReferences.path),
        manifest.datasets.queuePoiReferences.recordCount,
        decodeQueuePoiReferenceRecord
      ),
      "queuePoiReferences",
      (record) => `${record.sourceSystem}:${record.queuePoiLabel}:${record.countyFips}`
    ),
    queueCountyResolutions: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queueCountyResolutions.path),
        manifest.datasets.queueCountyResolutions.recordCount,
        decodeQueueCountyResolutionRecord
      ),
      "queueCountyResolutions",
      (record) => `${record.projectId}:${record.countyFips}`
    ),
    queueProjects: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queueProjects.path),
        manifest.datasets.queueProjects.recordCount,
        decodeQueueProjectRecord
      ),
      "queueProjects",
      (record) => record.projectId
    ),
    queueResolutionOverrides: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queueResolutionOverrides.path),
        manifest.datasets.queueResolutionOverrides.recordCount,
        decodeQueueResolutionOverrideRecord
      ),
      "queueResolutionOverrides",
      (record) =>
        `${record.sourceSystem}:${record.matcherType}:${record.matcherValue}:${record.countyFips}`
    ),
    queueSnapshots: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queueSnapshots.path),
        manifest.datasets.queueSnapshots.recordCount,
        decodeQueueSnapshotRecord
      ),
      "queueSnapshots",
      (record) => record.projectId
    ),
    queueUnresolved: sortByRecordKey(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.queueUnresolved.path),
        manifest.datasets.queueUnresolved.recordCount,
        decodeQueueUnresolvedRecord
      ),
      "queueUnresolved",
      (record) => record.projectId
    ),
    transmission: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.transmission.path),
        manifest.datasets.transmission.recordCount,
        decodeTransmissionRecord
      ),
      "transmission"
    ),
    utilityContext: sortByCountyFips(
      decodeNdjsonFile(
        join(baseDir, manifest.datasets.utilityContext.path),
        manifest.datasets.utilityContext.recordCount,
        decodeUtilityContextRecord
      ).map(normalizeUtilityCount),
      "utilityContext"
    ),
  };
}
export function buildCountyPowerLoadPayload(bundle, options) {
  return {
    congestion: bundle.congestion.map((record) => ({
      avgRtCongestionComponent: record.avgRtCongestionComponent,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      negativePriceHourShare: record.negativePriceHourShare,
      p95ShadowPrice: record.p95ShadowPrice,
      sourceAsOfDate: bundle.manifest.datasets.congestion.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      topConstraintsJson: JSON.stringify(record.topConstraints),
    })),
    countyFipsAliases: bundle.countyFipsAliases.map((record) => ({
      aliasCountyGeoid: record.aliasCountyFips,
      aliasKind: record.aliasKind,
      canonicalCountyGeoid: record.canonicalCountyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      sourceAsOfDate: bundle.manifest.datasets.countyFipsAliases.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
    })),
    countyOperatorRegions: bundle.countyOperatorRegions.map((record) => ({
      allocationShare: record.allocationShare,
      confidenceClass: record.confidenceClass,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      isBorderCounty: record.isBorderCounty,
      isPrimaryRegion: record.isPrimaryRegion,
      isSeamCounty: record.isSeamCounty,
      mappingMethod: record.mappingMethod,
      marketStructure: record.marketStructure,
      modelVersion: options.modelVersion,
      operatorRegion: record.operatorRegion,
      owner: record.owner,
      sourceArtifact: record.sourceArtifact,
      sourceAsOfDate: bundle.manifest.datasets.countyOperatorRegions.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceVersion: record.sourceVersion,
    })),
    countyOperatorZones: bundle.countyOperatorZones.map((record) => ({
      allocationShare: record.allocationShare,
      countyGeoid: record.countyFips,
      confidenceClass: record.confidenceClass,
      effectiveDate: bundle.manifest.effectiveDate,
      isPrimarySubregion: record.isPrimarySubregion,
      modelVersion: options.modelVersion,
      operator: record.operator,
      owner: record.owner,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      resolutionMethod: record.resolutionMethod,
      sourceArtifact: record.sourceArtifact,
      sourceAsOfDate: bundle.manifest.datasets.countyOperatorZones.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceVersion: record.sourceVersion,
    })),
    fiber: bundle.fiber.map((record) => ({
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      fiberPresenceFlag: record.fiberPresenceFlag,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      sourceAsOfDate: bundle.manifest.datasets.fiber.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
    })),
    gas: bundle.gas.map((record) => ({
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      gasPipelineMileageCounty: record.gasPipelineMileageCounty,
      gasPipelinePresenceFlag: record.gasPipelinePresenceFlag,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      sourceAsOfDate: bundle.manifest.datasets.gas.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
    })),
    gridFriction: bundle.gridFriction.map((record) => ({
      confidence: record.confidence,
      congestionProxyScore: record.congestionProxyScore,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      heatmapSignalAvailable: record.heatmapSignalAvailable,
      marketWithdrawalPrior: record.marketWithdrawalPrior,
      medianDaysInQueueActive: record.medianDaysInQueueActive,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      pastDueShare: record.pastDueShare,
      plannedTransmissionUpgradeCount: record.plannedTransmissionUpgradeCount,
      sourceAsOfDate: bundle.manifest.datasets.gridFriction.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      statusMixJson: JSON.stringify(record.statusMix),
    })),
    manifest: bundle.manifest,
    operatorRegions: bundle.operatorRegions.map((record) => ({
      confidenceClass: record.confidenceClass,
      effectiveDate: bundle.manifest.effectiveDate,
      mappingMethod: record.mappingMethod,
      marketStructure: record.marketStructure,
      modelVersion: options.modelVersion,
      operatorRegion: record.operatorRegion,
      owner: record.owner,
      sourceArtifact: record.sourceArtifact,
      sourceAsOfDate: bundle.manifest.datasets.operatorRegions.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceVersion: record.sourceVersion,
    })),
    operatorZoneReferences: bundle.operatorZoneReferences.map((record) => ({
      confidenceClass: record.confidenceClass,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      operator: record.operator,
      owner: record.owner,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      referenceName: record.referenceName,
      resolutionMethod: record.resolutionMethod,
      sourceArtifact: record.sourceArtifact,
      sourceAsOfDate: bundle.manifest.datasets.operatorZoneReferences.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceVersion: record.sourceVersion,
      stateAbbrev: record.stateAbbrev,
    })),
    policyEvents: bundle.policyEvents.map((record) => ({
      affectedSitingDimension: record.affectedSitingDimension,
      countyGeoid: record.countyFips,
      confidenceClass: record.confidenceClass,
      effectiveDate: bundle.manifest.effectiveDate,
      eventDate: record.eventDate,
      eventId: record.eventId,
      eventType: record.eventType,
      evidenceSummary: record.evidenceSummary,
      jurisdictionKey: record.jurisdictionKey,
      jurisdictionLevel: record.jurisdictionLevel,
      marketId: record.marketId,
      modelVersion: options.modelVersion,
      moratoriumStatus: record.moratoriumStatus,
      policyDirection: record.policyDirection,
      policyStatus: record.policyStatus,
      policyType: record.policyType,
      sentimentDirection: record.sentimentDirection,
      sourceAsOfDate: bundle.manifest.datasets.policyEvents.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceUrl: record.sourceUrl,
      stateAbbrev: record.stateAbbrev,
      title: record.title,
    })),
    policySnapshots: bundle.policySnapshots.map((record) => ({
      countyGeoid: record.countyFips,
      countyTaggedEventShare: record.countyTaggedEventShare,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      moratoriumStatus: record.moratoriumStatus,
      policyConstraintScore: record.policyConstraintScore,
      policyEventCount: record.policyEventCount,
      policyMappingConfidence: record.policyMappingConfidence,
      policyMomentumScore: record.policyMomentumScore,
      publicSentimentScore: record.publicSentimentScore,
      sourceAsOfDate: bundle.manifest.datasets.policySnapshots.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
    })),
    powerMarketContext: bundle.powerMarketContext.map((record) => ({
      balancingAuthority: record.balancingAuthority,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      loadZone: record.loadZone,
      marketStructure: record.marketStructure,
      meteoZone: record.meteoZone,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      operatorWeatherZone: record.operatorWeatherZone,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      sourceAsOfDate: bundle.manifest.datasets.powerMarketContext.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      weatherZone: record.weatherZone,
      wholesaleOperator: record.wholesaleOperator,
    })),
    queuePoiReferences: bundle.queuePoiReferences.map((record) => ({
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      operator: record.operator,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      queuePoiLabel: record.queuePoiLabel,
      resolutionMethod: record.resolutionMethod,
      resolverConfidence: record.resolverConfidence,
      sourceAsOfDate: bundle.manifest.datasets.queuePoiReferences.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    })),
    queueCountyResolutions: bundle.queueCountyResolutions.map((record) => ({
      allocationShare: record.allocationShare,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      marketId: record.marketId,
      modelVersion: options.modelVersion,
      projectId: record.projectId,
      queuePoiLabel: record.queuePoiLabel,
      resolverConfidence: record.resolverConfidence,
      resolverType: record.resolverType,
      sourceAsOfDate: bundle.manifest.datasets.queueCountyResolutions.sourceAsOfDate,
      sourceLocationLabel: record.sourceLocationLabel,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    })),
    queueResolutionOverrides: bundle.queueResolutionOverrides.map((record) => ({
      allocationShare: record.allocationShare,
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      matcherType: record.matcherType,
      matcherValue: record.matcherValue,
      modelVersion: options.modelVersion,
      notes: record.notes,
      resolverConfidence: record.resolverConfidence,
      resolverType: record.resolverType,
      sourceAsOfDate: bundle.manifest.datasets.queueResolutionOverrides.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    })),
    queueProjects: bundle.queueProjects.map((record) => ({
      countyGeoid: record.countyFips,
      fuelType: record.fuelType,
      latestSourceAsOfDate: record.latestSourceAsOfDate,
      marketId: record.marketId,
      modelVersion: options.modelVersion,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueCountyConfidence: record.queueCountyConfidence,
      queuePoiLabel: record.queuePoiLabel,
      queueName: record.queueName,
      queueResolverType: record.queueResolverType,
      stageGroup: record.stageGroup,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    })),
    queueSnapshots: bundle.queueSnapshots.map((record) => ({
      capacityMw: record.capacityMw,
      completionPrior: record.completionPrior,
      countyGeoid: record.countyFips,
      daysInQueueActive: record.daysInQueueActive,
      effectiveDate: bundle.manifest.effectiveDate,
      expectedOperationDate: record.expectedOperationDate,
      isPastDue: record.isPastDue,
      marketId: record.marketId,
      modelVersion: options.modelVersion,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueDate: record.queueDate,
      queueStatus: record.queueStatus,
      signedIa: record.signedIa,
      snapshotRunId: `${record.sourceSystem}-${bundle.manifest.effectiveDate}`,
      sourceAsOfDate: bundle.manifest.datasets.queueSnapshots.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stageGroup: record.stageGroup,
      stateAbbrev: record.stateAbbrev,
      transmissionUpgradeCostUsd: record.transmissionUpgradeCostUsd,
      transmissionUpgradeCount: record.transmissionUpgradeCount,
      withdrawalPrior: record.withdrawalPrior,
    })),
    queueUnresolved: bundle.queueUnresolved.map((record) => ({
      candidateCountiesJson: JSON.stringify(record.candidateCountyFips),
      effectiveDate: bundle.manifest.effectiveDate,
      manualReviewFlag: record.manualReviewFlag,
      marketId: record.marketId,
      modelVersion: options.modelVersion,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueName: record.queueName,
      queuePoiLabel: record.queuePoiLabel,
      rawLocationLabel: record.rawLocationLabel,
      sourceAsOfDate: bundle.manifest.datasets.queueUnresolved.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
      unresolvedReason: record.unresolvedReason,
    })),
    transmission: bundle.transmission.map((record) => ({
      countyGeoid: record.countyFips,
      effectiveDate: bundle.manifest.effectiveDate,
      miles138kvPlus: record.miles138kvPlus,
      miles230kvPlus: record.miles230kvPlus,
      miles345kvPlus: record.miles345kvPlus,
      miles500kvPlus: record.miles500kvPlus,
      miles69kvPlus: record.miles69kvPlus,
      miles765kvPlus: record.miles765kvPlus,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      sourceAsOfDate: bundle.manifest.datasets.transmission.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
    })),
    utilityContext: bundle.utilityContext.map((record) => ({
      competitiveAreaType: record.competitiveAreaType,
      countyGeoid: record.countyFips,
      dominantUtilityId: record.dominantUtilityId,
      dominantUtilityName: record.dominantUtilityName,
      effectiveDate: bundle.manifest.effectiveDate,
      modelVersion: options.modelVersion,
      month: bundle.manifest.month,
      primaryTduOrUtility: record.primaryTduOrUtility,
      retailChoicePenetrationShare: record.retailChoicePenetrationShare,
      retailChoiceStatus: record.retailChoiceStatus,
      sourceAsOfDate: bundle.manifest.datasets.utilityContext.sourceAsOfDate,
      sourcePullTimestamp: options.sourcePullTimestamp,
      territoryType: record.territoryType,
      utilitiesJson: JSON.stringify(record.utilities),
      utilityCount: record.utilityCount ?? record.utilities.length,
    })),
  };
}
export async function loadCountyPowerPayload(payload) {
  await bunRuntime.sql.begin("read write", async (sql) => {
    await replaceEffectiveSnapshot(sql, {
      columns: [
        {
          cast: "::text",
          name: "alias_county_geoid",
          readValue: (row) => row.aliasCountyGeoid,
        },
        {
          cast: "::text",
          name: "canonical_county_geoid",
          readValue: (row) => row.canonicalCountyGeoid,
        },
        { cast: "::text", name: "alias_kind", readValue: (row) => row.aliasKind },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.countyFipsAliases,
      tableName: "analytics.dim_county_fips_alias",
    });
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "operator_region", readValue: (row) => row.operatorRegion },
        { cast: "::text", name: "market_structure", readValue: (row) => row.marketStructure },
        { cast: "::text", name: "source_artifact", readValue: (row) => row.sourceArtifact },
        { cast: "::text", name: "source_version", readValue: (row) => row.sourceVersion },
        { cast: "::text", name: "mapping_method", readValue: (row) => row.mappingMethod },
        { cast: "::text", name: "confidence_class", readValue: (row) => row.confidenceClass },
        { cast: "::text", name: "owner", readValue: (row) => row.owner },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.operatorRegions,
      tableName: "analytics.dim_operator_region",
    });
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "operator_region", readValue: (row) => row.operatorRegion },
        { cast: "::text", name: "market_structure", readValue: (row) => row.marketStructure },
        { cast: "::numeric", name: "allocation_share", readValue: (row) => row.allocationShare },
        {
          cast: "::boolean",
          name: "is_primary_region",
          readValue: (row) => row.isPrimaryRegion,
        },
        { cast: "::boolean", name: "is_border_county", readValue: (row) => row.isBorderCounty },
        { cast: "::boolean", name: "is_seam_county", readValue: (row) => row.isSeamCounty },
        { cast: "::text", name: "source_artifact", readValue: (row) => row.sourceArtifact },
        { cast: "::text", name: "source_version", readValue: (row) => row.sourceVersion },
        { cast: "::text", name: "mapping_method", readValue: (row) => row.mappingMethod },
        { cast: "::text", name: "confidence_class", readValue: (row) => row.confidenceClass },
        { cast: "::text", name: "owner", readValue: (row) => row.owner },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.countyOperatorRegions,
      tableName: "analytics.bridge_county_operator_region",
    });
    await sql
      .unsafe(
        `
        WITH region_neighbors AS (
          SELECT
            bridge.county_geoid,
            bridge.operator_region,
            BOOL_OR(neighbor_county.state_abbrev IS DISTINCT FROM county.state_abbrev)
              AS is_border_county,
            BOOL_OR(neighbor_region.operator_region IS DISTINCT FROM bridge.operator_region)
              FILTER (WHERE neighbor_region.operator_region IS NOT NULL) AS is_seam_county
          FROM analytics.bridge_county_operator_region AS bridge
          INNER JOIN analytics.dim_county AS county
            ON county.county_geoid = bridge.county_geoid
          LEFT JOIN analytics.bridge_county_adjacency AS adjacency
            ON adjacency.county_geoid = bridge.county_geoid
          LEFT JOIN analytics.dim_county AS neighbor_county
            ON neighbor_county.county_geoid = adjacency.adjacent_county_geoid
          LEFT JOIN analytics.bridge_county_operator_region AS neighbor_region
            ON neighbor_region.effective_date = bridge.effective_date
            AND neighbor_region.county_geoid = adjacency.adjacent_county_geoid
            AND neighbor_region.is_primary_region
          WHERE bridge.effective_date = $1::date
            AND bridge.is_primary_region
          GROUP BY bridge.county_geoid, bridge.operator_region
        )
        UPDATE analytics.bridge_county_operator_region AS bridge
        SET
          is_border_county = COALESCE(region_neighbors.is_border_county, false),
          is_seam_county = COALESCE(region_neighbors.is_seam_county, false)
        FROM region_neighbors
        WHERE bridge.effective_date = $1::date
          AND bridge.county_geoid = region_neighbors.county_geoid
          AND bridge.operator_region = region_neighbors.operator_region
      `,
        [payload.manifest.effectiveDate]
      )
      .execute();
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "wholesale_operator", readValue: (row) => row.operator },
        {
          cast: "::text",
          name: "operator_zone_label",
          readValue: (row) => row.operatorZoneLabel,
        },
        { cast: "::text", name: "operator_zone_type", readValue: (row) => row.operatorZoneType },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "reference_name", readValue: (row) => row.referenceName },
        { cast: "::text", name: "resolution_method", readValue: (row) => row.resolutionMethod },
        {
          cast: "::text",
          name: "operator_zone_confidence",
          readValue: (row) => row.operatorZoneConfidence,
        },
        { cast: "::text", name: "source_artifact", readValue: (row) => row.sourceArtifact },
        { cast: "::text", name: "source_version", readValue: (row) => row.sourceVersion },
        { cast: "::text", name: "confidence_class", readValue: (row) => row.confidenceClass },
        { cast: "::text", name: "owner", readValue: (row) => row.owner },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.operatorZoneReferences,
      tableName: "analytics.dim_operator_zone_reference",
    });
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "wholesale_operator", readValue: (row) => row.operator },
        {
          cast: "::text",
          name: "operator_zone_label",
          readValue: (row) => row.operatorZoneLabel,
        },
        { cast: "::text", name: "operator_zone_type", readValue: (row) => row.operatorZoneType },
        {
          cast: "::text",
          name: "operator_zone_confidence",
          readValue: (row) => row.operatorZoneConfidence,
        },
        { cast: "::text", name: "resolution_method", readValue: (row) => row.resolutionMethod },
        { cast: "::numeric", name: "allocation_share", readValue: (row) => row.allocationShare },
        {
          cast: "::boolean",
          name: "is_primary_subregion",
          readValue: (row) => row.isPrimarySubregion,
        },
        { cast: "::text", name: "source_artifact", readValue: (row) => row.sourceArtifact },
        { cast: "::text", name: "source_version", readValue: (row) => row.sourceVersion },
        { cast: "::text", name: "confidence_class", readValue: (row) => row.confidenceClass },
        { cast: "::text", name: "owner", readValue: (row) => row.owner },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.countyOperatorZones,
      tableName: "analytics.bridge_county_operator_zone",
    });
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "queue_poi_label", readValue: (row) => row.queuePoiLabel },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "wholesale_operator", readValue: (row) => row.operator },
        {
          cast: "::text",
          name: "operator_zone_label",
          readValue: (row) => row.operatorZoneLabel,
        },
        { cast: "::text", name: "operator_zone_type", readValue: (row) => row.operatorZoneType },
        { cast: "::text", name: "resolution_method", readValue: (row) => row.resolutionMethod },
        {
          cast: "::text",
          name: "resolver_confidence",
          readValue: (row) => row.resolverConfidence,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.queuePoiReferences,
      tableName: "analytics.dim_queue_poi_reference",
    });
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "matcher_type", readValue: (row) => row.matcherType },
        { cast: "::text", name: "matcher_value", readValue: (row) => row.matcherValue },
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::numeric", name: "allocation_share", readValue: (row) => row.allocationShare },
        { cast: "::text", name: "resolver_type", readValue: (row) => row.resolverType },
        {
          cast: "::text",
          name: "resolver_confidence",
          readValue: (row) => row.resolverConfidence,
        },
        { cast: "::text", name: "notes", readValue: (row) => row.notes },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.queueResolutionOverrides,
      tableName: "analytics.fact_queue_resolution_override",
    });
    await upsertQueueProjects(sql, payload.queueProjects);
    await replaceQueueCountyResolutions(
      sql,
      payload.queueCountyResolutions,
      payload.manifest.effectiveDate
    );
    await replaceQueueSnapshots(sql, payload.queueSnapshots, payload.manifest.effectiveDate);
    await replaceEffectiveSnapshot(sql, {
      columns: [
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "project_id", readValue: (row) => row.projectId },
        { cast: "::text", name: "source_system", readValue: (row) => row.sourceSystem },
        { cast: "::text", name: "market_id", readValue: (row) => row.marketId },
        { cast: "::text", name: "state_abbrev", readValue: (row) => row.stateAbbrev },
        { cast: "::text", name: "queue_name", readValue: (row) => row.queueName },
        { cast: "::text", name: "queue_poi_label", readValue: (row) => row.queuePoiLabel },
        { cast: "::text", name: "raw_location_label", readValue: (row) => row.rawLocationLabel },
        { cast: "::text", name: "native_status", readValue: (row) => row.nativeStatus },
        { cast: "::text", name: "unresolved_reason", readValue: (row) => row.unresolvedReason },
        {
          cast: "::jsonb",
          name: "candidate_counties_json",
          readValue: (row) => row.candidateCountiesJson,
        },
        {
          cast: "::boolean",
          name: "manual_review_flag",
          readValue: (row) => row.manualReviewFlag,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      effectiveDate: payload.manifest.effectiveDate,
      records: payload.queueUnresolved,
      tableName: "analytics.fact_gen_queue_unresolved",
    });
    await upsertPolicyEvents(sql, payload.policyEvents);
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::boolean",
          name: "fiber_presence_flag",
          readValue: (row) => row.fiberPresenceFlag,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.fiber,
      tableName: "analytics.fact_fiber_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::boolean",
          name: "gas_pipeline_presence_flag",
          readValue: (row) => row.gasPipelinePresenceFlag,
        },
        {
          cast: "::numeric",
          name: "gas_pipeline_mileage_county",
          readValue: (row) => row.gasPipelineMileageCounty,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.gas,
      tableName: "analytics.fact_gas_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::numeric",
          name: "policy_constraint_score",
          readValue: (row) => row.policyConstraintScore,
        },
        {
          cast: "::numeric",
          name: "policy_momentum_score",
          readValue: (row) => row.policyMomentumScore,
        },
        { cast: "::text", name: "moratorium_status", readValue: (row) => row.moratoriumStatus },
        {
          cast: "::numeric",
          name: "public_sentiment_score",
          readValue: (row) => row.publicSentimentScore,
        },
        { cast: "::integer", name: "policy_event_count", readValue: (row) => row.policyEventCount },
        {
          cast: "::numeric",
          name: "county_tagged_event_share",
          readValue: (row) => row.countyTaggedEventShare,
        },
        {
          cast: "::text",
          name: "policy_mapping_confidence",
          readValue: (row) => row.policyMappingConfidence,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.policySnapshots,
      tableName: "analytics.fact_policy_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::text",
          name: "wholesale_operator",
          readValue: (row) => row.wholesaleOperator,
        },
        { cast: "::text", name: "market_structure", readValue: (row) => row.marketStructure },
        {
          cast: "::text",
          name: "balancing_authority",
          readValue: (row) => row.balancingAuthority,
        },
        { cast: "::text", name: "load_zone", readValue: (row) => row.loadZone },
        { cast: "::text", name: "operator_zone_label", readValue: (row) => row.operatorZoneLabel },
        { cast: "::text", name: "operator_zone_type", readValue: (row) => row.operatorZoneType },
        {
          cast: "::text",
          name: "operator_zone_confidence",
          readValue: (row) => row.operatorZoneConfidence,
        },
        { cast: "::text", name: "weather_zone", readValue: (row) => row.weatherZone },
        {
          cast: "::text",
          name: "operator_weather_zone",
          readValue: (row) => row.operatorWeatherZone,
        },
        { cast: "::text", name: "meteo_zone", readValue: (row) => row.meteoZone },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.powerMarketContext,
      tableName: "analytics.fact_power_market_context_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::text",
          name: "retail_choice_status",
          readValue: (row) => row.retailChoiceStatus,
        },
        {
          cast: "::text",
          name: "competitive_area_type",
          readValue: (row) => row.competitiveAreaType,
        },
        {
          cast: "::text",
          name: "primary_tdu_or_utility",
          readValue: (row) => row.primaryTduOrUtility,
        },
        { cast: "::text", name: "dominant_utility_id", readValue: (row) => row.dominantUtilityId },
        {
          cast: "::text",
          name: "dominant_utility_name",
          readValue: (row) => row.dominantUtilityName,
        },
        {
          cast: "::numeric",
          name: "retail_choice_penetration_share",
          readValue: (row) => row.retailChoicePenetrationShare,
        },
        { cast: "::text", name: "territory_type", readValue: (row) => row.territoryType },
        { cast: "::integer", name: "utility_count", readValue: (row) => row.utilityCount },
        { cast: "::jsonb", name: "utilities_json", readValue: (row) => row.utilitiesJson },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.utilityContext,
      tableName: "analytics.fact_utility_context_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::numeric",
          name: "transmission_miles_69kv_plus",
          readValue: (row) => row.miles69kvPlus,
        },
        {
          cast: "::numeric",
          name: "transmission_miles_138kv_plus",
          readValue: (row) => row.miles138kvPlus,
        },
        {
          cast: "::numeric",
          name: "transmission_miles_230kv_plus",
          readValue: (row) => row.miles230kvPlus,
        },
        {
          cast: "::numeric",
          name: "transmission_miles_345kv_plus",
          readValue: (row) => row.miles345kvPlus,
        },
        {
          cast: "::numeric",
          name: "transmission_miles_500kv_plus",
          readValue: (row) => row.miles500kvPlus,
        },
        {
          cast: "::numeric",
          name: "transmission_miles_765kv_plus",
          readValue: (row) => row.miles765kvPlus,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.transmission,
      tableName: "analytics.fact_transmission_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::numeric",
          name: "median_days_in_queue_active",
          readValue: (row) => row.medianDaysInQueueActive,
        },
        { cast: "::numeric", name: "past_due_share", readValue: (row) => row.pastDueShare },
        { cast: "::jsonb", name: "status_mix_json", readValue: (row) => row.statusMixJson },
        {
          cast: "::numeric",
          name: "market_withdrawal_prior",
          readValue: (row) => row.marketWithdrawalPrior,
        },
        {
          cast: "::numeric",
          name: "congestion_proxy_score",
          readValue: (row) => row.congestionProxyScore,
        },
        {
          cast: "::integer",
          name: "planned_transmission_upgrade_count",
          readValue: (row) => row.plannedTransmissionUpgradeCount,
        },
        {
          cast: "::boolean",
          name: "heatmap_signal_available",
          readValue: (row) => row.heatmapSignalAvailable,
        },
        { cast: "::text", name: "confidence", readValue: (row) => row.confidence },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.gridFriction,
      tableName: "analytics.fact_grid_friction_snapshot",
    });
    await replaceMonthSnapshot(sql, {
      columns: [
        { cast: "::text", name: "county_geoid", readValue: (row) => row.countyGeoid },
        { cast: "::date", name: "month", readValue: (row) => row.month },
        {
          cast: "::numeric",
          name: "avg_rt_congestion_component",
          readValue: (row) => row.avgRtCongestionComponent,
        },
        { cast: "::numeric", name: "p95_shadow_price", readValue: (row) => row.p95ShadowPrice },
        {
          cast: "::numeric",
          name: "negative_price_hour_share",
          readValue: (row) => row.negativePriceHourShare,
        },
        {
          cast: "::jsonb",
          name: "top_constraints_json",
          readValue: (row) => row.topConstraintsJson,
        },
        {
          cast: "::timestamptz",
          name: "source_pull_ts",
          readValue: (row) => row.sourcePullTimestamp,
        },
        { cast: "::date", name: "source_as_of_date", readValue: (row) => row.sourceAsOfDate },
        { cast: "::date", name: "effective_date", readValue: (row) => row.effectiveDate },
        { cast: "::text", name: "model_version", readValue: (row) => row.modelVersion },
      ],
      month: payload.manifest.month,
      records: payload.congestion,
      tableName: "analytics.fact_congestion_snapshot",
    });
  });
}
export async function closeCountyPowerSql() {
  await bunRuntime.sql.close();
}
