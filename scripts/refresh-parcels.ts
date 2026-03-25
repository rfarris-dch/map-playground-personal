#!/usr/bin/env bun
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Writable } from "node:stream";
import type {
  ArcgisCountResponse,
  ArcgisLayerMetadata,
  ArcgisQueryErrorPayload,
  ArcgisQueryFeature,
  ArcgisQueryResponse,
  ArcgisTokenProvider,
  ArcgisTokenResponse,
  CliArgs,
  StateProgress,
  StateSyncCounters,
  SyncRunConfig,
  SyncRunSummary,
  SyncStateArgs,
} from "./refresh-parcels.types";

const BASE_STATES: readonly string[] = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
  "PR",
  "VI",
  "GU",
  "AS",
  "MP",
];

function buildDefaultStates(states: readonly string[]): readonly string[] {
  const deduped = Array.from(new Set(states.map((state) => state.trim().toUpperCase())));
  const normalized = deduped.filter((state) => state.length > 0);
  const ordered: string[] = [];

  if (normalized.includes("TX")) {
    ordered.push("TX");
  }
  if (normalized.includes("AL")) {
    ordered.push("AL");
  }

  const remaining = normalized
    .filter((state) => state !== "TX" && state !== "AL")
    .sort((left, right) => left.localeCompare(right));
  ordered.push(...remaining);

  return ordered;
}

const DEFAULT_STATES = buildDefaultStates(BASE_STATES);

const TOKEN_URL =
  process.env.ARCGIS_PARCEL_TOKEN_URL ?? "https://www.arcgis.com/sharing/rest/oauth2/token";
const FEATURE_LAYER_URL =
  process.env.ARCGIS_PARCEL_FEATURE_LAYER_URL ??
  "https://utility.arcgis.com/usrsvcs/servers/c5b6a214d0324a3c91684309ab3950e4/rest/services/premium/FeatureServer/0";
const REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.ARCGIS_UPSTREAM_REQUEST_TIMEOUT_MS, 30_000);
const HTTP_REQUEST_RETRY_COUNT = Math.floor(
  parseNonNegativeNumber(process.env.ARCGIS_HTTP_RETRY_COUNT, 4)
);
const HTTP_REQUEST_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.ARCGIS_HTTP_RETRY_BASE_DELAY_MS,
  600
);
const HTTP_REQUEST_MAX_RETRY_DELAY_MS = parsePositiveInt(
  process.env.ARCGIS_HTTP_MAX_RETRY_DELAY_MS,
  5000
);
const OUT_SPATIAL_REFERENCE = parsePositiveInt(process.env.ARCGIS_PARCEL_OUT_SR, 4326);
const QUERY_PAYLOAD_MAX_ATTEMPTS = parsePositiveInt(
  process.env.ARCGIS_QUERY_PAYLOAD_MAX_ATTEMPTS,
  5
);
const QUERY_PAYLOAD_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.ARCGIS_QUERY_PAYLOAD_RETRY_BASE_DELAY_MS,
  800
);
const STATE_SYNC_MAX_ATTEMPTS = parsePositiveInt(process.env.PARCEL_SYNC_STATE_MAX_ATTEMPTS, 3);
const STATE_SYNC_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.PARCEL_SYNC_RETRY_BASE_DELAY_MS,
  1500
);
const MAX_RETRY_DELAY_MS = parsePositiveInt(process.env.PARCEL_SYNC_MAX_RETRY_DELAY_MS, 15_000);
const STATE_COUNT_CONCURRENCY = parsePositiveInt(process.env.PARCEL_SYNC_COUNT_CONCURRENCY, 8);
const STATE_COUNT_MAX_ATTEMPTS = parsePositiveInt(process.env.PARCEL_SYNC_COUNT_MAX_ATTEMPTS, 3);
const STATE_COUNT_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.PARCEL_SYNC_COUNT_RETRY_BASE_DELAY_MS,
  800
);
const OBJECT_ID_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TRAILING_DECIMAL_ZEROES_RE = /(?:\.0+|(\.\d+?)0+)$/;
const ACREAGE_FIELD_PRIORITY: readonly string[] = ["ll_gisacre", "gisacre", "deeded_acres"];
const NUMERIC_ARCGIS_FIELD_TYPES = new Set<string>([
  "esriFieldTypeDouble",
  "esriFieldTypeSingle",
  "esriFieldTypeInteger",
  "esriFieldTypeSmallInteger",
]);
const RUN_CONFIG_FILE_NAME = "run-config.json";
const STATE_CHECKPOINT_FILE_RE = /^state-[A-Z0-9_]+\.checkpoint\.json$/;

function parseArg(name: string): string | null {
  const prefix = `${name}=`;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) {
      return raw.slice(prefix.length);
    }
  }

  return null;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseNonNegativeNumber(raw: string | null | undefined, fallback: number): number {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function computeBackoffMs(
  baseDelayMs: number,
  attempt: number,
  maxDelayMs = MAX_RETRY_DELAY_MS
): number {
  const exponent = Math.max(0, attempt - 1);
  const rawDelayMs = baseDelayMs * 2 ** exponent;
  return Math.min(rawDelayMs, maxDelayMs);
}

function validateObjectIdField(fieldName: string): string {
  const normalized = fieldName.trim();
  if (!OBJECT_ID_FIELD_PATTERN.test(normalized)) {
    throw new Error(`Unsupported ArcGIS objectIdField value: "${fieldName}"`);
  }

  return normalized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function parseStates(value: string | null): readonly string[] {
  if (!value) {
    return DEFAULT_STATES;
  }

  const normalized = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0);

  if (normalized.length === 0) {
    throw new Error("--states cannot be empty when provided");
  }

  return buildDefaultStates(normalized);
}

function parseCliArgs(): CliArgs {
  const outputDir = parseArg("--output-dir") ?? parseArg("--out-dir") ?? "var/parcels-sync";
  const pageSize = parsePositiveInt(
    parseArg("--page-size") ?? process.env.PARCEL_SYNC_PAGE_SIZE,
    2000
  );
  const minimumAcres = parseNonNegativeNumber(
    parseArg("--min-acres") ?? process.env.PARCEL_SYNC_MIN_ACRES,
    5
  );
  const stateConcurrency = parsePositiveInt(
    parseArg("--state-concurrency") ?? process.env.PARCEL_SYNC_STATE_CONCURRENCY,
    1
  );
  const maxPagesRaw =
    parseArg("--max-pages-per-state") ?? process.env.PARCEL_SYNC_MAX_PAGES_PER_STATE;
  const maxPages = maxPagesRaw ? parsePositiveInt(maxPagesRaw, 0) : 0;
  const runIdRaw =
    parseArg("--run-id") ??
    parseArg("--runId") ??
    process.env.PARCEL_SYNC_RUN_ID ??
    `parcel-sync-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runId = runIdRaw.trim();
  if (runId.length === 0) {
    throw new Error("--run-id cannot be empty");
  }

  return {
    minimumAcres,
    outputDir: resolve(outputDir),
    pageSize,
    stateConcurrency,
    maxPagesPerState: maxPages > 0 ? maxPages : null,
    states: parseStates(parseArg("--states") ?? process.env.PARCEL_SYNC_STATES ?? null),
    resume: hasFlag("--resume") || (process.env.PARCEL_SYNC_RESUME ?? "0") === "1",
    runId,
    verifyRunConfigOnly: hasFlag("--verify-run-config-only"),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeJsonFile(path: string, value: unknown): void {
  ensureDirectory(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) {
    return null;
  }

  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) {
    return null;
  }

  return JSON.parse(raw);
}

function readRunConfig(path: string): SyncRunConfig | null {
  const raw = readJsonFile(path);
  if (!isRecord(raw)) {
    return null;
  }

  const runId = Reflect.get(raw, "runId");
  const featureLayerUrl = Reflect.get(raw, "featureLayerUrl");
  const minimumAcres = Number(Reflect.get(raw, "minimumAcres"));
  const pageSize = Number(Reflect.get(raw, "pageSize"));
  const stateConcurrency = Number(Reflect.get(raw, "stateConcurrency"));
  const maxPagesPerStateRaw = Reflect.get(raw, "maxPagesPerState");
  const acreageField = Reflect.get(raw, "acreageField");
  const metadataObjectIdField = Reflect.get(raw, "metadataObjectIdField");
  const tieBreakerFieldRaw = Reflect.get(raw, "tieBreakerField");
  const statesRaw = Reflect.get(raw, "states");

  if (
    typeof runId !== "string" ||
    typeof featureLayerUrl !== "string" ||
    !Number.isFinite(minimumAcres) ||
    !Number.isFinite(pageSize) ||
    !Number.isFinite(stateConcurrency) ||
    typeof acreageField !== "string" ||
    typeof metadataObjectIdField !== "string" ||
    !Array.isArray(statesRaw)
  ) {
    return null;
  }

  const states = statesRaw.filter((item): item is string => typeof item === "string");
  if (states.length !== statesRaw.length) {
    return null;
  }

  let maxPagesPerState: number | null = null;
  if (maxPagesPerStateRaw !== null && typeof maxPagesPerStateRaw !== "undefined") {
    const parsedMaxPages = Number(maxPagesPerStateRaw);
    if (!Number.isFinite(parsedMaxPages) || parsedMaxPages <= 0) {
      return null;
    }
    maxPagesPerState = Math.floor(parsedMaxPages);
  }

  let tieBreakerField: string | null = null;
  if (tieBreakerFieldRaw !== null && typeof tieBreakerFieldRaw !== "undefined") {
    if (typeof tieBreakerFieldRaw !== "string") {
      return null;
    }
    tieBreakerField = tieBreakerFieldRaw;
  }

  return {
    acreageField,
    featureLayerUrl,
    maxPagesPerState,
    metadataObjectIdField,
    minimumAcres: Math.floor(minimumAcres * 1_000_000) / 1_000_000,
    pageSize: Math.floor(pageSize),
    runId,
    stateConcurrency: Math.floor(stateConcurrency),
    states,
    tieBreakerField,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTokenResponse(value: unknown): ArcgisTokenResponse {
  if (!isRecord(value)) {
    throw new Error("ArcGIS token response is not an object");
  }

  const accessToken = Reflect.get(value, "access_token");
  const expiresIn = Reflect.get(value, "expires_in");

  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    throw new Error("ArcGIS token response missing access_token");
  }

  const numericExpires = Number(expiresIn);
  if (!Number.isFinite(numericExpires) || numericExpires <= 0) {
    throw new Error("ArcGIS token response missing expires_in");
  }

  return {
    access_token: accessToken,
    expires_in: Math.floor(numericExpires),
  };
}

function readLayerMetadata(value: unknown): ArcgisLayerMetadata {
  if (!isRecord(value)) {
    throw new Error("ArcGIS layer metadata response is not an object");
  }

  const name = Reflect.get(value, "name");
  const objectIdField = Reflect.get(value, "objectIdField");
  const fields = Reflect.get(value, "fields");

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("ArcGIS layer metadata missing name");
  }

  if (typeof objectIdField !== "string" || objectIdField.trim().length === 0) {
    throw new Error("ArcGIS layer metadata missing objectIdField");
  }

  if (!Array.isArray(fields)) {
    throw new Error("ArcGIS layer metadata missing fields array");
  }

  return {
    name,
    objectIdField,
    fields,
  };
}

function readLayerFieldNames(metadata: ArcgisLayerMetadata): readonly string[] {
  const fieldNames: string[] = [];
  for (const field of metadata.fields) {
    if (!isRecord(field)) {
      continue;
    }

    const name = Reflect.get(field, "name");
    if (typeof name !== "string") {
      continue;
    }

    const normalized = name.trim();
    if (normalized.length === 0) {
      continue;
    }

    fieldNames.push(normalized);
  }

  return fieldNames;
}

function readLayerFieldType(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const typeValue = Reflect.get(value, "type");
  if (typeof typeValue !== "string") {
    return null;
  }

  const normalized = typeValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function isNumericArcgisFieldType(fieldType: string | null): boolean {
  if (fieldType === null) {
    return true;
  }

  return NUMERIC_ARCGIS_FIELD_TYPES.has(fieldType);
}

function selectAcreageField(metadata: ArcgisLayerMetadata): string {
  const candidateFields = new Map<string, string>();

  for (const field of metadata.fields) {
    if (!isRecord(field)) {
      continue;
    }

    const rawName = Reflect.get(field, "name");
    if (typeof rawName !== "string") {
      continue;
    }

    const normalizedName = rawName.trim();
    if (normalizedName.length === 0) {
      continue;
    }

    if (!isNumericArcgisFieldType(readLayerFieldType(field))) {
      continue;
    }

    candidateFields.set(normalizedName.toLowerCase(), normalizedName);
  }

  for (const fieldName of ACREAGE_FIELD_PRIORITY) {
    const match = candidateFields.get(fieldName);
    if (typeof match === "string") {
      return match;
    }
  }

  throw new Error(
    `ArcGIS layer metadata missing numeric acreage field. Expected one of: ${ACREAGE_FIELD_PRIORITY.join(", ")}`
  );
}

function formatWhereNumberLiteral(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  const fixed = value.toFixed(6);
  return fixed.replace(TRAILING_DECIMAL_ZEROES_RE, "$1");
}

function buildAcreageWhereClause(acreageField: string, minimumAcres: number): string {
  return `${acreageField} > ${formatWhereNumberLiteral(minimumAcres)}`;
}

function selectTieBreakerField(
  metadata: ArcgisLayerMetadata,
  objectIdField: string
): string | null {
  const fieldNames = new Set(readLayerFieldNames(metadata).map((field) => field.toLowerCase()));
  if (!fieldNames.has("ogc_fid")) {
    return null;
  }

  if (objectIdField.toLowerCase() === "ogc_fid") {
    return null;
  }

  return "ogc_fid";
}

function readCountResponse(value: unknown): ArcgisCountResponse {
  if (!isRecord(value)) {
    throw new Error("ArcGIS count response is not an object");
  }

  const count = Number(Reflect.get(value, "count"));
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("ArcGIS count response missing count");
  }

  return {
    count: Math.floor(count),
  };
}

function readQueryErrorPayload(value: unknown): ArcgisQueryErrorPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawError = Reflect.get(value, "error");
  if (!isRecord(rawError)) {
    return null;
  }

  const codeValue = Number(Reflect.get(rawError, "code"));
  const code = Number.isFinite(codeValue) ? Math.floor(codeValue) : null;

  const messageParts: string[] = [];
  const rawMessage = Reflect.get(rawError, "message");
  if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
    messageParts.push(rawMessage.trim());
  }

  const rawDetails = Reflect.get(rawError, "details");
  if (Array.isArray(rawDetails)) {
    for (const detail of rawDetails) {
      if (typeof detail !== "string") {
        continue;
      }

      const normalizedDetail = detail.trim();
      if (normalizedDetail.length === 0) {
        continue;
      }

      messageParts.push(normalizedDetail);
    }
  }

  if (code === null && messageParts.length === 0) {
    return null;
  }

  return {
    code,
    message: messageParts.join(" | ") || "ArcGIS error payload",
  };
}

function readQueryResponse(value: unknown): ArcgisQueryResponse {
  if (!isRecord(value)) {
    throw new Error("ArcGIS query response is not an object");
  }

  const features = Reflect.get(value, "features");
  if (!Array.isArray(features)) {
    throw new Error("ArcGIS query response missing features array");
  }

  const normalized: ArcgisQueryFeature[] = [];
  for (const feature of features) {
    if (!isRecord(feature)) {
      continue;
    }

    const attributes = Reflect.get(feature, "attributes");
    if (!isRecord(attributes)) {
      continue;
    }

    const geometry = Reflect.get(feature, "geometry");
    normalized.push({ attributes, geometry });
  }

  return {
    features: normalized,
  };
}

function describePayloadShape(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return "object{}";
    }

    const keyPreview = keys.slice(0, 8).join(",");
    return `object{${keyPreview}}`;
  }

  return typeof value;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  retryCount = HTTP_REQUEST_RETRY_COUNT,
  baseDelayMs = HTTP_REQUEST_RETRY_BASE_DELAY_MS
): Promise<unknown> {
  let attempt = 0;
  while (true) {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${String(response.status)} for ${url}: ${text}`);
      }

      return await response.json();
    } catch (error) {
      attempt += 1;
      if (attempt > retryCount) {
        throw error;
      }

      const waitMs = computeBackoffMs(baseDelayMs, attempt, HTTP_REQUEST_MAX_RETRY_DELAY_MS);
      await sleep(waitMs);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

async function fetchArcgisToken(
  clientId: string,
  clientSecret: string
): Promise<ArcgisTokenResponse> {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "client_credentials");

  const payload = await fetchJsonWithRetry(TOKEN_URL, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
  });

  return readTokenResponse(payload);
}

async function createArcgisTokenProvider(
  clientId: string,
  clientSecret: string
): Promise<ArcgisTokenProvider> {
  const state: {
    expiresInSeconds: number;
    expiresAtMs: number;
    refreshInFlight: Promise<void> | null;
    token: string;
  } = {
    token: "",
    expiresAtMs: 0,
    expiresInSeconds: 0,
    refreshInFlight: null,
  };

  const refreshToken = async (): Promise<void> => {
    const tokenPayload = await fetchArcgisToken(clientId, clientSecret);
    state.token = tokenPayload.access_token;
    state.expiresInSeconds = tokenPayload.expires_in;
    state.expiresAtMs = Date.now() + tokenPayload.expires_in * 1000;
  };

  await refreshToken();

  return {
    async getToken(minValiditySeconds = 120): Promise<string> {
      const minValidityMs = Math.max(0, Math.floor(minValiditySeconds)) * 1000;
      const refreshRequired = Date.now() + minValidityMs >= state.expiresAtMs;
      if (refreshRequired) {
        if (state.refreshInFlight === null) {
          state.refreshInFlight = refreshToken().finally(() => {
            state.refreshInFlight = null;
          });
        }
        await state.refreshInFlight;
      }

      return state.token;
    },
    getLatestExpiresInSeconds(): number {
      return state.expiresInSeconds;
    },
  };
}

async function fetchLayerMetadata(token: string): Promise<ArcgisLayerMetadata> {
  const url = new URL(FEATURE_LAYER_URL);
  url.searchParams.set("f", "json");
  url.searchParams.set("token", token);

  const payload = await fetchJsonWithRetry(url.toString(), {
    method: "GET",
  });

  return readLayerMetadata(payload);
}

async function fetchStateCount(
  token: string,
  state2: string,
  objectIdField: string,
  acreageWhereClause: string
): Promise<number> {
  const whereClauses: string[] = [`state2='${state2.replace(/'/g, "''")}'`, acreageWhereClause];
  const url = new URL(`${FEATURE_LAYER_URL}/query`);
  url.searchParams.set("f", "json");
  url.searchParams.set("where", whereClauses.join(" AND "));
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("orderByFields", `${objectIdField} ASC`);
  url.searchParams.set("token", token);

  const payload = await fetchJsonWithRetry(url.toString(), {
    method: "GET",
  });

  return readCountResponse(payload).count;
}

async function fetchStateCounts(args: {
  readonly acreageWhereClause: string;
  readonly getToken: (minValiditySeconds?: number) => Promise<string>;
  readonly objectIdField: string;
  readonly states: readonly string[];
}): Promise<Map<string, number>> {
  const expectedByState = new Map<string, number>();
  const pendingStates = [...args.states];
  const workerCount = Math.min(Math.max(1, STATE_COUNT_CONCURRENCY), pendingStates.length);

  const runWorker = async (): Promise<void> => {
    while (pendingStates.length > 0) {
      const state2 = pendingStates.shift();
      if (!state2) {
        return;
      }

      let resolvedExpectedCount = 0;
      let resolved = false;
      for (let attempt = 1; attempt <= STATE_COUNT_MAX_ATTEMPTS; attempt += 1) {
        try {
          resolvedExpectedCount = await fetchStateCount(
            await args.getToken(),
            state2,
            args.objectIdField,
            args.acreageWhereClause
          );
          resolved = true;
          break;
        } catch (error) {
          const message = readErrorMessage(error);
          if (attempt >= STATE_COUNT_MAX_ATTEMPTS) {
            console.warn(
              `[sync] state=${state2} expected-count fetch failed after ${String(STATE_COUNT_MAX_ATTEMPTS)} attempts; defaulting expected=0 (${message})`
            );
            break;
          }

          const waitMs = computeBackoffMs(STATE_COUNT_RETRY_BASE_DELAY_MS, attempt);
          console.warn(
            `[sync] state=${state2} expected-count fetch attempt ${String(attempt)}/${String(STATE_COUNT_MAX_ATTEMPTS)} failed (${message}); retrying in ${String(waitMs)}ms`
          );
          await sleep(waitMs);
        }
      }

      if (!resolved) {
        resolvedExpectedCount = 0;
      }
      expectedByState.set(state2, resolvedExpectedCount);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return expectedByState;
}

function readRequiredNumericAttribute(feature: ArcgisQueryFeature, fieldName: string): number {
  const rawValue = Reflect.get(feature.attributes, fieldName);
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`ArcGIS feature missing numeric attributes.${fieldName}`);
  }

  return Math.floor(parsedValue);
}

async function fetchQueryFeatures(args: {
  readonly pageSize: number;
  readonly state2: string;
  readonly token: string;
  readonly whereClause: string;
  readonly orderByFields: string;
}): Promise<readonly ArcgisQueryFeature[]> {
  const url = new URL(`${FEATURE_LAYER_URL}/query`);
  url.searchParams.set("f", "json");
  url.searchParams.set("where", args.whereClause);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("orderByFields", args.orderByFields);
  url.searchParams.set("resultRecordCount", String(args.pageSize));
  url.searchParams.set("outSR", String(OUT_SPATIAL_REFERENCE));
  url.searchParams.set("token", args.token);

  for (let attempt = 1; attempt <= QUERY_PAYLOAD_MAX_ATTEMPTS; attempt += 1) {
    const payload = await fetchJsonWithRetry(url.toString(), { method: "GET" });

    const payloadError = readQueryErrorPayload(payload);
    if (payloadError !== null) {
      if (attempt >= QUERY_PAYLOAD_MAX_ATTEMPTS) {
        const codeLabel = payloadError.code === null ? "unknown" : String(payloadError.code);
        throw new Error(
          `ArcGIS query returned error payload for state=${args.state2} code=${codeLabel}: ${payloadError.message}`
        );
      }

      const waitMs = computeBackoffMs(QUERY_PAYLOAD_RETRY_BASE_DELAY_MS, attempt);
      const codeLabel = payloadError.code === null ? "unknown" : String(payloadError.code);
      console.warn(
        `[sync] state=${args.state2} query payload error attempt=${String(attempt)}/${String(QUERY_PAYLOAD_MAX_ATTEMPTS)} code=${codeLabel} message=${payloadError.message}; retrying in ${String(waitMs)}ms`
      );
      await sleep(waitMs);
      continue;
    }

    try {
      return readQueryResponse(payload).features;
    } catch (error) {
      if (attempt >= QUERY_PAYLOAD_MAX_ATTEMPTS) {
        throw error;
      }

      const waitMs = computeBackoffMs(QUERY_PAYLOAD_RETRY_BASE_DELAY_MS, attempt);
      console.warn(
        `[sync] state=${args.state2} query payload parse issue attempt=${String(attempt)}/${String(QUERY_PAYLOAD_MAX_ATTEMPTS)} reason=${readErrorMessage(error)} payload=${describePayloadShape(payload)}; retrying in ${String(waitMs)}ms`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`ArcGIS query payload retry loop exhausted for state=${args.state2}`);
}

async function fetchPage(
  token: string,
  state2: string,
  pageSize: number,
  lastSourceId: number | null,
  lastTieBreakerId: number | null,
  objectIdField: string,
  tieBreakerField: string | null,
  acreageWhereClause: string
): Promise<readonly ArcgisQueryFeature[]> {
  const safeState = state2.replace(/'/g, "''");
  const baseWhereClauses = [`state2='${safeState}'`, acreageWhereClause];
  const defaultOrder =
    tieBreakerField === null
      ? `${objectIdField} ASC`
      : `${objectIdField} ASC, ${tieBreakerField} ASC`;

  if (lastSourceId === null) {
    return fetchQueryFeatures({
      token,
      state2,
      pageSize,
      whereClause: baseWhereClauses.join(" AND "),
      orderByFields: defaultOrder,
    });
  }

  if (tieBreakerField !== null && lastTieBreakerId !== null) {
    const sameIdFeatures = await fetchQueryFeatures({
      token,
      state2,
      pageSize,
      whereClause: [
        ...baseWhereClauses,
        `${objectIdField} = ${String(lastSourceId)}`,
        `${tieBreakerField} > ${String(lastTieBreakerId)}`,
      ].join(" AND "),
      orderByFields: `${tieBreakerField} ASC`,
    });

    if (sameIdFeatures.length >= pageSize) {
      return sameIdFeatures;
    }

    const remaining = pageSize - sameIdFeatures.length;
    const higherIdFeatures = await fetchQueryFeatures({
      token,
      state2,
      pageSize: remaining,
      whereClause: [...baseWhereClauses, `${objectIdField} > ${String(lastSourceId)}`].join(
        " AND "
      ),
      orderByFields: defaultOrder,
    });
    return [...sameIdFeatures, ...higherIdFeatures];
  }

  return fetchQueryFeatures({
    token,
    state2,
    pageSize,
    whereClause: [...baseWhereClauses, `${objectIdField} > ${String(lastSourceId)}`].join(" AND "),
    orderByFields: defaultOrder,
  });
}

function ensureFeatureUrlNotCoreLogic(featureLayerUrl: string): void {
  const host = new URL(featureLayerUrl).host.toLowerCase();
  if (host.includes("corelogic")) {
    throw new Error(`CoreLogic host is blocked for parcel sync: ${host}`);
  }
}

function ensureRegridProvider(metadata: ArcgisLayerMetadata): void {
  const normalizedName = metadata.name.toLowerCase();
  if (!normalizedName.includes("regrid")) {
    throw new Error(
      `ArcGIS layer provider mismatch. Expected Regrid metadata, got name="${metadata.name}". Refusing sync.`
    );
  }
}

function openStateWriter(path: string, resume: boolean) {
  ensureDirectory(dirname(path));
  return createWriteStream(path, {
    flags: resume ? "a" : "w",
    encoding: "utf8",
  });
}

function writeLine(writer: Writable, line: string): Promise<void> {
  if (writer.write(line)) {
    return Promise.resolve();
  }

  return new Promise((resolveWrite, rejectWrite) => {
    const handleDrain = (): void => {
      cleanup();
      resolveWrite();
    };
    const handleError = (error: Error): void => {
      cleanup();
      rejectWrite(error);
    };
    const cleanup = (): void => {
      writer.off("drain", handleDrain);
      writer.off("error", handleError);
    };

    writer.on("drain", handleDrain);
    writer.on("error", handleError);
  });
}

function closeWriter(writer: Writable): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    const handleFinish = (): void => {
      cleanup();
      resolveClose();
    };
    const handleError = (error: Error): void => {
      cleanup();
      rejectClose(error);
    };
    const cleanup = (): void => {
      writer.off("finish", handleFinish);
      writer.off("error", handleError);
    };

    writer.on("finish", handleFinish);
    writer.on("error", handleError);
    writer.end();
  });
}

function readCheckpoint(path: string): StateProgress | null {
  const raw = readJsonFile(path);
  if (!isRecord(raw)) {
    return null;
  }

  const state = Reflect.get(raw, "state");
  const expectedCount = Number(Reflect.get(raw, "expectedCount"));
  const pagesFetched = Number(Reflect.get(raw, "pagesFetched"));
  const writtenCount = Number(Reflect.get(raw, "writtenCount"));
  const lastSourceIdRaw = Reflect.get(raw, "lastSourceId");
  const lastTieBreakerIdRaw = Reflect.get(raw, "lastTieBreakerId");
  const isCompletedRaw = Reflect.get(raw, "isCompleted");

  if (
    typeof state !== "string" ||
    !Number.isFinite(expectedCount) ||
    !Number.isFinite(pagesFetched) ||
    !Number.isFinite(writtenCount)
  ) {
    return null;
  }

  let lastSourceId: number | null = null;
  if (lastSourceIdRaw !== null && typeof lastSourceIdRaw !== "undefined") {
    const parsedLastSourceId = Number(lastSourceIdRaw);
    if (Number.isFinite(parsedLastSourceId)) {
      lastSourceId = Math.floor(parsedLastSourceId);
    }
  }

  let lastTieBreakerId: number | null = null;
  if (lastTieBreakerIdRaw !== null && typeof lastTieBreakerIdRaw !== "undefined") {
    const parsedLastTieBreakerId = Number(lastTieBreakerIdRaw);
    if (Number.isFinite(parsedLastTieBreakerId)) {
      lastTieBreakerId = Math.floor(parsedLastTieBreakerId);
    }
  }

  const isCompleted = isCompletedRaw === true;

  return {
    state,
    expectedCount: Math.floor(expectedCount),
    isCompleted,
    pagesFetched: Math.floor(pagesFetched),
    writtenCount: Math.floor(writtenCount),
    lastSourceId,
    lastTieBreakerId,
  };
}

function readResumeCounters(
  checkpointPath: string,
  state2: string,
  resume: boolean
): StateSyncCounters {
  if (!resume) {
    return {
      lastSourceId: null,
      lastTieBreakerId: null,
      pagesFetched: 0,
      writtenCount: 0,
    };
  }

  const checkpoint = readCheckpoint(checkpointPath);
  if (!checkpoint || checkpoint.state !== state2) {
    return {
      lastSourceId: null,
      lastTieBreakerId: null,
      pagesFetched: 0,
      writtenCount: 0,
    };
  }

  return {
    lastSourceId: checkpoint.lastSourceId,
    lastTieBreakerId: checkpoint.lastTieBreakerId,
    pagesFetched: checkpoint.pagesFetched,
    writtenCount: checkpoint.writtenCount,
  };
}

function areSameStates(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function assertRunConfigMatches(
  expected: SyncRunConfig,
  existing: SyncRunConfig,
  runDir: string
): void {
  const mismatches: string[] = [];

  if (existing.runId !== expected.runId) {
    mismatches.push(`runId expected=${expected.runId} actual=${existing.runId}`);
  }
  if (existing.featureLayerUrl !== expected.featureLayerUrl) {
    mismatches.push("featureLayerUrl");
  }
  if (existing.minimumAcres !== expected.minimumAcres) {
    mismatches.push(
      `minimumAcres expected=${String(expected.minimumAcres)} actual=${String(existing.minimumAcres)}`
    );
  }
  if (existing.pageSize !== expected.pageSize) {
    mismatches.push(
      `pageSize expected=${String(expected.pageSize)} actual=${String(existing.pageSize)}`
    );
  }
  if (existing.stateConcurrency !== expected.stateConcurrency) {
    mismatches.push(
      `stateConcurrency expected=${String(expected.stateConcurrency)} actual=${String(existing.stateConcurrency)}`
    );
  }
  if (existing.maxPagesPerState !== expected.maxPagesPerState) {
    mismatches.push(
      `maxPagesPerState expected=${String(expected.maxPagesPerState)} actual=${String(existing.maxPagesPerState)}`
    );
  }
  if (existing.acreageField !== expected.acreageField) {
    mismatches.push(
      `acreageField expected=${expected.acreageField} actual=${existing.acreageField}`
    );
  }
  if (existing.metadataObjectIdField !== expected.metadataObjectIdField) {
    mismatches.push(
      `metadataObjectIdField expected=${expected.metadataObjectIdField} actual=${existing.metadataObjectIdField}`
    );
  }
  if (existing.tieBreakerField !== expected.tieBreakerField) {
    mismatches.push(
      `tieBreakerField expected=${expected.tieBreakerField ?? "null"} actual=${existing.tieBreakerField ?? "null"}`
    );
  }
  if (!areSameStates(existing.states, expected.states)) {
    mismatches.push("states");
  }

  if (mismatches.length > 0) {
    throw new Error(
      `[sync] existing run config mismatch for ${runDir}. Refusing to resume with different inputs: ${mismatches.join(", ")}`
    );
  }
}

function assertRuntimeRunConfigMatchesCli(
  cli: CliArgs,
  existing: SyncRunConfig,
  runDir: string
): void {
  const mismatches: string[] = [];

  if (existing.runId !== cli.runId) {
    mismatches.push(`runId expected=${cli.runId} actual=${existing.runId}`);
  }
  if (existing.featureLayerUrl !== FEATURE_LAYER_URL) {
    mismatches.push("featureLayerUrl");
  }
  if (existing.minimumAcres !== cli.minimumAcres) {
    mismatches.push(
      `minimumAcres expected=${String(cli.minimumAcres)} actual=${String(existing.minimumAcres)}`
    );
  }
  if (existing.pageSize !== cli.pageSize) {
    mismatches.push(
      `pageSize expected=${String(cli.pageSize)} actual=${String(existing.pageSize)}`
    );
  }
  if (existing.stateConcurrency !== cli.stateConcurrency) {
    mismatches.push(
      `stateConcurrency expected=${String(cli.stateConcurrency)} actual=${String(existing.stateConcurrency)}`
    );
  }
  if (existing.maxPagesPerState !== cli.maxPagesPerState) {
    mismatches.push(
      `maxPagesPerState expected=${String(cli.maxPagesPerState)} actual=${String(existing.maxPagesPerState)}`
    );
  }
  if (!areSameStates(existing.states, cli.states)) {
    mismatches.push("states");
  }

  if (mismatches.length > 0) {
    throw new Error(
      `[sync] existing run config mismatch for ${runDir}. Refusing to resume with different runtime inputs: ${mismatches.join(", ")}`
    );
  }
}

async function reconcileStateDataFile(
  dataPath: string,
  expectedLineCount: number,
  resume: boolean
): Promise<void> {
  if (!resume) {
    if (existsSync(dataPath)) {
      rmSync(dataPath);
    }
    return;
  }

  if (!existsSync(dataPath)) {
    if (expectedLineCount === 0) {
      return;
    }
    throw new Error(
      `[sync] checkpoint expects ${String(expectedLineCount)} rows but data file is missing: ${dataPath}`
    );
  }

  const tempPath = `${dataPath}.resume-${process.pid}.tmp`;
  const reader = createInterface({
    input: createReadStream(dataPath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const writer = createWriteStream(tempPath, {
    flags: "w",
    encoding: "utf8",
  });

  let seenLineCount = 0;
  let truncated = false;

  try {
    for await (const line of reader) {
      seenLineCount += 1;
      if (seenLineCount <= expectedLineCount) {
        await writeLine(writer, `${line}\n`);
        continue;
      }

      truncated = true;
    }
  } finally {
    await closeWriter(writer);
  }

  if (seenLineCount < expectedLineCount) {
    rmSync(tempPath, { force: true });
    throw new Error(
      `[sync] checkpoint expects ${String(expectedLineCount)} rows but file only has ${String(seenLineCount)}: ${dataPath}`
    );
  }

  if (!truncated && seenLineCount === expectedLineCount) {
    rmSync(tempPath, { force: true });
    return;
  }

  renameSync(tempPath, dataPath);
  console.warn(
    `[sync] reconciled ${dataPath} to checkpoint rows=${String(expectedLineCount)} (removed ${String(Math.max(seenLineCount - expectedLineCount, 0))} trailing rows)`
  );
}

function shouldStopPaging(maxPagesPerState: number | null, pagesFetched: number): boolean {
  return maxPagesPerState !== null && pagesFetched >= maxPagesPerState;
}

async function appendPage(
  writer: Writable,
  features: readonly ArcgisQueryFeature[],
  lastSourceId: number | null,
  lastTieBreakerId: number | null,
  objectIdField: string,
  tieBreakerField: string | null
): Promise<{
  readonly nextSourceId: number | null;
  readonly nextTieBreakerId: number | null;
  readonly writtenDelta: number;
}> {
  let maxSourceIdForPage = lastSourceId;
  let maxTieBreakerIdForPage = lastTieBreakerId;
  let writtenDelta = 0;

  for (const feature of features) {
    const sourceId = readRequiredNumericAttribute(feature, objectIdField);
    if (tieBreakerField !== null) {
      const tieBreakerId = readRequiredNumericAttribute(feature, tieBreakerField);
      maxSourceIdForPage = sourceId;
      maxTieBreakerIdForPage = tieBreakerId;
    } else if (maxSourceIdForPage === null || sourceId > maxSourceIdForPage) {
      maxSourceIdForPage = sourceId;
    }

    await writeLine(writer, `${JSON.stringify(feature)}\n`);
    writtenDelta += 1;
  }

  return {
    nextSourceId: maxSourceIdForPage,
    nextTieBreakerId: maxTieBreakerIdForPage,
    writtenDelta,
  };
}

function writeStateCheckpoint(
  checkpointPath: string,
  state2: string,
  expectedCount: number,
  counters: StateSyncCounters,
  isCompleted: boolean
): void {
  writeJsonFile(checkpointPath, {
    state: state2,
    expectedCount,
    isCompleted,
    pagesFetched: counters.pagesFetched,
    writtenCount: counters.writtenCount,
    lastSourceId: counters.lastSourceId,
    lastTieBreakerId: counters.lastTieBreakerId,
    updatedAt: new Date().toISOString(),
  });
}

function normalizeExpectedCount(expectedCount: number, writtenCount: number): number {
  const expected = Number.isFinite(expectedCount) ? Math.floor(expectedCount) : 0;
  const written = Number.isFinite(writtenCount) ? Math.floor(writtenCount) : 0;
  return Math.max(0, expected, written);
}

function shouldLogStateProgress(pagesFetched: number): boolean {
  return pagesFetched === 1 || pagesFetched % 10 === 0;
}

function didCursorAdvance(args: {
  readonly previousSourceId: number | null;
  readonly nextSourceId: number | null;
  readonly previousTieBreakerId: number | null;
  readonly nextTieBreakerId: number | null;
  readonly tieBreakerField: string | null;
}): boolean {
  if (args.previousSourceId === null || args.nextSourceId === null) {
    return true;
  }

  if (args.tieBreakerField === null) {
    return args.nextSourceId > args.previousSourceId;
  }

  return (
    args.nextSourceId > args.previousSourceId ||
    (args.nextSourceId === args.previousSourceId &&
      args.previousTieBreakerId !== null &&
      args.nextTieBreakerId !== null &&
      args.nextTieBreakerId > args.previousTieBreakerId)
  );
}

function validateStateCountMatch(
  state2: string,
  maxPagesPerState: number | null,
  writtenCount: number,
  expectedCount: number
): void {
  if (maxPagesPerState !== null) {
    return;
  }

  if (writtenCount !== expectedCount) {
    const delta = writtenCount - expectedCount;
    const direction = delta > 0 ? "over" : "under";
    console.log(
      `[sync] state=${state2} count advisory mismatch written=${String(writtenCount)} expected=${String(expectedCount)} delta=${String(delta)} (${direction}) (ArcGIS returnCountOnly may not match pageable feature rows for this provider)`
    );
  }
}

function toStateCounters(progress: StateProgress): StateSyncCounters {
  return {
    lastSourceId: progress.lastSourceId,
    lastTieBreakerId: progress.lastTieBreakerId,
    pagesFetched: progress.pagesFetched,
    writtenCount: progress.writtenCount,
  };
}

function tryReuseCompletedCheckpoint(
  args: SyncStateArgs,
  checkpointPath: string,
  existingCheckpoint: StateProgress | null
): StateProgress | null {
  const canReuseCheckpoint =
    args.resume &&
    args.maxPagesPerState === null &&
    existingCheckpoint !== null &&
    existingCheckpoint.state === args.state2 &&
    existingCheckpoint.isCompleted;
  if (!canReuseCheckpoint || existingCheckpoint === null) {
    return null;
  }

  const normalizedExpected = normalizeExpectedCount(
    existingCheckpoint.expectedCount,
    existingCheckpoint.writtenCount
  );
  if (normalizedExpected !== existingCheckpoint.expectedCount) {
    writeStateCheckpoint(
      checkpointPath,
      args.state2,
      normalizedExpected,
      toStateCounters(existingCheckpoint),
      true
    );
    return {
      ...existingCheckpoint,
      expectedCount: normalizedExpected,
    };
  }

  console.log(`[sync] state=${args.state2} already completed from checkpoint; skipping`);
  return existingCheckpoint;
}

async function fetchStatePage(args: SyncStateArgs, counters: StateSyncCounters) {
  return fetchPage(
    await args.getToken(),
    args.state2,
    args.pageSize,
    counters.lastSourceId,
    counters.lastTieBreakerId,
    args.objectIdField,
    args.tieBreakerField,
    args.acreageWhereClause
  );
}

async function appendStatePageAndAdvanceCursor(
  args: SyncStateArgs,
  writer: Writable,
  counters: StateSyncCounters,
  expectedCount: number,
  features: readonly ArcgisQueryFeature[]
): Promise<number> {
  const pageResult = await appendPage(
    writer,
    features,
    counters.lastSourceId,
    counters.lastTieBreakerId,
    args.objectIdField,
    args.tieBreakerField
  );
  const previousLastSourceId = counters.lastSourceId;
  const previousLastTieBreakerId = counters.lastTieBreakerId;
  counters.lastSourceId = pageResult.nextSourceId;
  counters.lastTieBreakerId = pageResult.nextTieBreakerId;
  const advanced = didCursorAdvance({
    previousSourceId: previousLastSourceId,
    nextSourceId: counters.lastSourceId,
    previousTieBreakerId: previousLastTieBreakerId,
    nextTieBreakerId: counters.lastTieBreakerId,
    tieBreakerField: args.tieBreakerField,
  });
  if (previousLastSourceId !== null && !advanced) {
    throw new Error(
      `State ${args.state2} cursor did not advance for objectIdField=${args.objectIdField} (previous=${String(previousLastSourceId)} next=${String(counters.lastSourceId)} previousTie=${String(previousLastTieBreakerId)} nextTie=${String(counters.lastTieBreakerId)} tieBreaker=${args.tieBreakerField ?? "none"}).`
    );
  }
  counters.pagesFetched += 1;
  counters.writtenCount += pageResult.writtenDelta;
  return normalizeExpectedCount(expectedCount, counters.writtenCount);
}

function toStateProgress(
  state2: string,
  expectedCount: number,
  isCompleted: boolean,
  counters: StateSyncCounters
): StateProgress {
  return {
    state: state2,
    expectedCount,
    isCompleted,
    pagesFetched: counters.pagesFetched,
    writtenCount: counters.writtenCount,
    lastSourceId: counters.lastSourceId,
    lastTieBreakerId: counters.lastTieBreakerId,
  };
}

async function syncState(args: SyncStateArgs): Promise<StateProgress> {
  const dataPath = join(args.runDir, `state-${args.state2}.ndjson`);
  const checkpointPath = join(args.runDir, `state-${args.state2}.checkpoint.json`);
  const existingCheckpoint = readCheckpoint(checkpointPath);
  const completedCheckpoint = tryReuseCompletedCheckpoint(args, checkpointPath, existingCheckpoint);
  if (completedCheckpoint !== null) {
    return completedCheckpoint;
  }

  const counters = readResumeCounters(checkpointPath, args.state2, args.resume);
  const initialExpectedCount = Math.max(0, Math.floor(args.expectedCount));
  let expectedCount = normalizeExpectedCount(initialExpectedCount, counters.writtenCount);

  await reconcileStateDataFile(dataPath, counters.writtenCount, args.resume);
  const writer = openStateWriter(dataPath, args.resume);
  console.log(
    `[sync] state=${args.state2} starting expected=${String(expectedCount)} resume=${args.resume ? "true" : "false"} lastId=${String(counters.lastSourceId ?? "none")} lastTie=${String(counters.lastTieBreakerId ?? "none")} tieBreaker=${args.tieBreakerField ?? "none"} filter=${args.acreageWhereClause}`
  );
  writeStateCheckpoint(checkpointPath, args.state2, expectedCount, counters, false);
  let isCompleted = false;

  try {
    while (true) {
      if (shouldStopPaging(args.maxPagesPerState, counters.pagesFetched)) {
        break;
      }

      const features = await fetchStatePage(args, counters);
      if (features.length === 0) {
        isCompleted = args.maxPagesPerState === null;
        break;
      }

      expectedCount = await appendStatePageAndAdvanceCursor(
        args,
        writer,
        counters,
        expectedCount,
        features
      );

      writeStateCheckpoint(checkpointPath, args.state2, expectedCount, counters, false);

      if (shouldLogStateProgress(counters.pagesFetched)) {
        console.log(
          `[sync] state=${args.state2} page=${String(counters.pagesFetched)} written=${String(counters.writtenCount)} lastId=${String(counters.lastSourceId ?? "none")}`
        );
      }
    }
  } finally {
    await closeWriter(writer);
  }

  writeStateCheckpoint(checkpointPath, args.state2, expectedCount, counters, isCompleted);

  validateStateCountMatch(
    args.state2,
    args.maxPagesPerState,
    counters.writtenCount,
    initialExpectedCount
  );

  return toStateProgress(args.state2, expectedCount, isCompleted, counters);
}

function persistRunConfig(
  cli: CliArgs,
  runConfigPath: string,
  runConfig: SyncRunConfig,
  runDir: string
): void {
  if (cli.resume) {
    if (existsSync(runConfigPath)) {
      const existingRunConfig = readRunConfig(runConfigPath);
      if (existingRunConfig === null) {
        throw new Error(`[sync] invalid existing run config: ${runConfigPath}`);
      }

      assertRunConfigMatches(runConfig, existingRunConfig, runDir);
    } else {
      const hasExistingCheckpoint = readdirSync(runDir).some((entry) =>
        STATE_CHECKPOINT_FILE_RE.test(entry)
      );
      if (hasExistingCheckpoint) {
        throw new Error(
          `[sync] refusing to resume run without ${RUN_CONFIG_FILE_NAME}: ${runDir}. Start a fresh run or repair the run directory metadata first.`
        );
      }
    }
  }

  writeJsonFile(runConfigPath, runConfig);
}

function initializeExpectedStateCheckpoints(args: {
  readonly cli: CliArgs;
  readonly fetchedExpectedByState: ReadonlyMap<string, number>;
  readonly runDir: string;
}): Map<string, number> {
  const expectedByState = new Map<string, number>();

  for (const state2 of args.cli.states) {
    const checkpointPath = join(args.runDir, `state-${state2}.checkpoint.json`);
    const existingCheckpoint = readCheckpoint(checkpointPath);
    const shouldResumeExisting = args.cli.resume && existingCheckpoint !== null;
    const counters: StateSyncCounters = shouldResumeExisting
      ? {
          lastSourceId: existingCheckpoint.lastSourceId,
          lastTieBreakerId: existingCheckpoint.lastTieBreakerId,
          pagesFetched: existingCheckpoint.pagesFetched,
          writtenCount: existingCheckpoint.writtenCount,
        }
      : {
          lastSourceId: null,
          lastTieBreakerId: null,
          pagesFetched: 0,
          writtenCount: 0,
        };
    const expectedFromFetch = args.fetchedExpectedByState.get(state2) ?? 0;
    const expectedFromCheckpoint = shouldResumeExisting ? existingCheckpoint.expectedCount : 0;
    const normalizedExpected = normalizeExpectedCount(
      Math.max(expectedFromFetch, expectedFromCheckpoint),
      counters.writtenCount
    );
    const isCompleted =
      args.cli.resume &&
      args.cli.maxPagesPerState === null &&
      existingCheckpoint?.isCompleted === true;

    expectedByState.set(state2, normalizedExpected);
    writeStateCheckpoint(checkpointPath, state2, normalizedExpected, counters, isCompleted);
  }

  return expectedByState;
}

function partitionStateWork(args: { readonly cli: CliArgs; readonly runDir: string }): {
  readonly pendingStates: string[];
  readonly completedStates: StateProgress[];
} {
  const completedStates: StateProgress[] = [];
  const pendingStates: string[] = [];

  for (const state2 of args.cli.states) {
    if (!args.cli.resume || args.cli.maxPagesPerState !== null) {
      pendingStates.push(state2);
      continue;
    }

    const checkpointPath = join(args.runDir, `state-${state2}.checkpoint.json`);
    const checkpoint = readCheckpoint(checkpointPath);
    if (checkpoint?.isCompleted) {
      completedStates.push(checkpoint);
      console.log(`[sync] state=${state2} already completed from checkpoint; skipping`);
      continue;
    }

    pendingStates.push(state2);
  }

  return {
    pendingStates,
    completedStates,
  };
}

async function main(): Promise<void> {
  const cli = parseCliArgs();
  const runId = cli.runId;
  const runDir = join(cli.outputDir, runId);
  ensureDirectory(runDir);
  const runConfigPath = join(runDir, RUN_CONFIG_FILE_NAME);

  if (cli.verifyRunConfigOnly) {
    const existingRunConfig = readRunConfig(runConfigPath);
    if (existingRunConfig === null) {
      throw new Error(`[sync] missing or invalid run config: ${runConfigPath}`);
    }

    assertRuntimeRunConfigMatchesCli(cli, existingRunConfig, runDir);
    console.log(`[sync] run config verified: ${runId}`);
    return;
  }

  const clientId = requireEnv("ARCGIS_PARCEL_CLIENT_ID");
  const clientSecret = requireEnv("ARCGIS_PARCEL_CLIENT_SECRET");

  const startedAt = new Date().toISOString();
  ensureFeatureUrlNotCoreLogic(FEATURE_LAYER_URL);

  const tokenProvider = await createArcgisTokenProvider(clientId, clientSecret);
  const metadata = await fetchLayerMetadata(await tokenProvider.getToken(300));
  ensureRegridProvider(metadata);
  const objectIdField = validateObjectIdField(metadata.objectIdField);
  const tieBreakerField = selectTieBreakerField(metadata, objectIdField);
  const validatedTieBreakerField =
    tieBreakerField === null ? null : validateObjectIdField(tieBreakerField);
  const acreageField = validateObjectIdField(selectAcreageField(metadata));
  const acreageWhereClause = buildAcreageWhereClause(acreageField, cli.minimumAcres);
  const runConfig: SyncRunConfig = {
    acreageField,
    featureLayerUrl: FEATURE_LAYER_URL,
    maxPagesPerState: cli.maxPagesPerState,
    metadataObjectIdField: objectIdField,
    minimumAcres: cli.minimumAcres,
    pageSize: cli.pageSize,
    runId,
    stateConcurrency: cli.stateConcurrency,
    states: cli.states,
    tieBreakerField: validatedTieBreakerField,
  };
  persistRunConfig(cli, runConfigPath, runConfig, runDir);

  console.log(
    `[sync] acreage filter enabled field=${acreageField} minimumAcres=${formatWhereNumberLiteral(cli.minimumAcres)}`
  );
  console.log(`[sync] state concurrency=${String(cli.stateConcurrency)}`);

  writeJsonFile(join(runDir, "layer-metadata.json"), metadata);
  console.log(`[sync] prefetching expected counts for ${String(cli.states.length)} states`);
  const fetchedExpectedByState = await fetchStateCounts({
    getToken: (minValiditySeconds): Promise<string> => tokenProvider.getToken(minValiditySeconds),
    objectIdField,
    acreageWhereClause,
    states: cli.states,
  });
  const expectedByState = initializeExpectedStateCheckpoints({
    cli,
    fetchedExpectedByState,
    runDir,
  });
  const partitionedStateWork = partitionStateWork({ cli, runDir });
  const stateProgressList: StateProgress[] = [...partitionedStateWork.completedStates];
  const pendingStates = [...partitionedStateWork.pendingStates];
  const workerCount = Math.min(Math.max(1, cli.stateConcurrency), pendingStates.length);

  function readExpectedCountForState(state2: string): number {
    const checkpointPath = join(runDir, `state-${state2}.checkpoint.json`);
    const checkpoint = readCheckpoint(checkpointPath);
    return normalizeExpectedCount(expectedByState.get(state2) ?? 0, checkpoint?.writtenCount ?? 0);
  }

  function nextPageSizeAfterFailure(state2: string, currentPageSize: number): number {
    if (currentPageSize <= 25) {
      return currentPageSize;
    }

    const nextPageSize = Math.max(25, Math.floor(currentPageSize / 2));
    if (nextPageSize < currentPageSize) {
      console.warn(
        `[sync] state=${state2} reducing pageSize ${String(currentPageSize)} -> ${String(nextPageSize)} after failure`
      );
      return nextPageSize;
    }

    return currentPageSize;
  }

  async function syncStateWithRetries(state2: string): Promise<StateProgress | null> {
    let pageSizeForState = cli.pageSize;

    for (let attempt = 1; attempt <= STATE_SYNC_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await syncState({
          expectedCount: readExpectedCountForState(state2),
          runDir,
          state2,
          getToken: (minValiditySeconds): Promise<string> =>
            tokenProvider.getToken(minValiditySeconds),
          objectIdField,
          tieBreakerField: validatedTieBreakerField,
          pageSize: pageSizeForState,
          acreageWhereClause,
          maxPagesPerState: cli.maxPagesPerState,
          resume: cli.resume,
        });
      } catch (error) {
        console.warn(
          `[sync] state=${state2} attempt ${String(attempt)}/${String(STATE_SYNC_MAX_ATTEMPTS)} failed: ${readErrorMessage(error)}`
        );
        pageSizeForState = nextPageSizeAfterFailure(state2, pageSizeForState);
        if (attempt < STATE_SYNC_MAX_ATTEMPTS) {
          const waitMs = computeBackoffMs(STATE_SYNC_RETRY_BASE_DELAY_MS, attempt);
          console.warn(`[sync] state=${state2} retrying in ${String(waitMs)}ms before advancing`);
          await sleep(waitMs);
        }
      }
    }

    return null;
  }

  function preserveCheckpointProgress(state2: string): void {
    const checkpointPath = join(runDir, `state-${state2}.checkpoint.json`);
    const checkpoint = readCheckpoint(checkpointPath);
    if (checkpoint !== null) {
      stateProgressList.push(checkpoint);
      console.error(
        `[sync] state=${state2} skipped after retries; preserving checkpoint progress written=${String(checkpoint.writtenCount)} pages=${String(checkpoint.pagesFetched)}`
      );
      return;
    }

    console.error(`[sync] state=${state2} skipped after retries with no checkpoint progress`);
  }

  const runWorker = async (): Promise<void> => {
    while (pendingStates.length > 0) {
      const state2 = pendingStates.shift();
      if (!state2) {
        return;
      }

      const next = await syncStateWithRetries(state2);

      if (next === null) {
        preserveCheckpointProgress(state2);
        continue;
      }

      stateProgressList.push(next);
      console.log(
        `[sync] ${state2} expected=${String(next.expectedCount)} written=${String(next.writtenCount)} pages=${String(next.pagesFetched)} lastId=${String(next.lastSourceId ?? "none")} lastTie=${String(next.lastTieBreakerId ?? "none")}`
      );
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  stateProgressList.sort((left, right) => left.state.localeCompare(right.state));

  if (cli.maxPagesPerState === null) {
    const incompleteStates = stateProgressList.filter((progress) => !progress.isCompleted);
    if (incompleteStates.length > 0) {
      const details = incompleteStates
        .map(
          (progress) =>
            `${progress.state}(written=${String(progress.writtenCount)} expected=${String(progress.expectedCount)} pages=${String(progress.pagesFetched)})`
        )
        .join(", ");
      writeJsonFile(join(runDir, "run-incomplete.json"), {
        runId,
        startedAt,
        failedAt: new Date().toISOString(),
        minimumAcres: cli.minimumAcres,
        stateConcurrency: cli.stateConcurrency,
        pageSize: cli.pageSize,
        incompleteStates,
      });
      throw new Error(
        `[sync] extraction incomplete; refusing to mark run complete. unresolved states: ${details}`
      );
    }
  }

  const completedAt = new Date().toISOString();
  const summary: SyncRunSummary = {
    acreageField,
    runId,
    startedAt,
    completedAt,
    featureLayerUrl: FEATURE_LAYER_URL,
    minimumAcres: cli.minimumAcres,
    stateConcurrency: cli.stateConcurrency,
    tokenExpiresInSeconds: tokenProvider.getLatestExpiresInSeconds(),
    pageSize: cli.pageSize,
    states: stateProgressList,
  };

  writeJsonFile(join(runDir, "run-summary.json"), summary);

  const latestPointer = {
    runId,
    updatedAt: completedAt,
    summaryPath: join(runDir, "run-summary.json"),
    metadataPath: join(runDir, "layer-metadata.json"),
    configPath: runConfigPath,
  };
  writeJsonFile(join(cli.outputDir, "latest.json"), latestPointer);

  console.log(`[sync] run complete: ${runId}`);
}

main().catch((error) => {
  console.error("[sync] parcels refresh failed", error);
  process.exit(1);
});
