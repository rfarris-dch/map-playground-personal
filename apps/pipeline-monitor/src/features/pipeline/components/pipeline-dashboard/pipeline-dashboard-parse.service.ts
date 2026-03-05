import { formatPercent } from "../../pipeline.service";
import type { BuildProgress, DbLoadProgress } from "./pipeline-dashboard.types";

const DB_LOAD_SUMMARY_RE = /^db-load:([a-z0-9-]+)(?:\s+([0-9]+)\/([0-9]+))?(?:\s+(.+))?$/i;
const DB_LOAD_STATES_RE = /\bstates=([0-9]+)\/([0-9]+)\b/i;
const DB_LOAD_ACTIVE_RE = /\bactive=([^ ]+)/i;
const BUILD_PERCENT_RE = /([0-9]+(?:\.[0-9]+)?)%/;
const BUILD_READ_RE = /\bread=([0-9]+)\/([0-9]+)\b/;
const BUILD_LOG_BYTES_RE = /\blog=([0-9]+)\b/;
const BUILD_STAGE_RE = /\bstage=(read|write|convert|complete)\b/;
const BUILD_WORK_RE = /\bwork=([0-9]+)\/([0-9]+)\b/;
const BUILD_LEFT_RE = /\bleft=([0-9]+)\b/;

function formatDbLoadStep(stepKey: string): string {
  switch (stepKey) {
    case "prepare-schema":
      return "Preparing schema";
    case "prepare-build-tables":
      return "Preparing build tables";
    case "index-stage-state2":
      return "Indexing staged state codes";
    case "staging":
      return "Staging NDJSON into Postgres";
    case "materialize":
      return "Materializing canonical rows";
    case "swap-current":
      return "Swapping current table";
    case "record-metadata":
      return "Recording metadata";
    case "complete":
      return "Load complete";
    default:
      return stepKey;
  }
}

export function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function stringifyUnknown(value: unknown): string | null {
  if (typeof value === "undefined") {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parser requires explicit validation branches to avoid malformed status strings
export function parseDbLoadProgress(summary: string | null | undefined): DbLoadProgress | null {
  if (typeof summary !== "string") {
    return null;
  }

  const normalized = summary.trim();
  if (!normalized.startsWith("db-load:")) {
    return null;
  }

  const match = DB_LOAD_SUMMARY_RE.exec(normalized);
  if (match === null) {
    return null;
  }

  const stepKeyRaw = match[1];
  if (typeof stepKeyRaw !== "string" || stepKeyRaw.length === 0) {
    return null;
  }

  const stepKey = stepKeyRaw.toLowerCase();
  const loadedRaw = match[2];
  const totalRaw = match[3];
  const currentFileRaw = match[4];
  const currentFile =
    typeof currentFileRaw === "string" && currentFileRaw.trim().length > 0
      ? currentFileRaw.trim()
      : null;

  const loadedFiles =
    typeof loadedRaw === "string" && loadedRaw.length > 0 ? Number.parseInt(loadedRaw, 10) : null;
  const totalFiles =
    typeof totalRaw === "string" && totalRaw.length > 0 ? Number.parseInt(totalRaw, 10) : null;

  const hasStepProgress =
    typeof loadedFiles === "number" &&
    Number.isFinite(loadedFiles) &&
    loadedFiles >= 0 &&
    typeof totalFiles === "number" &&
    Number.isFinite(totalFiles) &&
    totalFiles > 0;

  const hasFileProgress = stepKey === "staging" && hasStepProgress;
  let completedStates: number | null = null;
  let totalStates: number | null = null;
  let activeWorkers: readonly string[] = [];

  if (stepKey === "materialize" && currentFile !== null) {
    const statesMatch = DB_LOAD_STATES_RE.exec(currentFile);
    if (statesMatch !== null) {
      const completedRaw = Number.parseInt(statesMatch[1] ?? "", 10);
      const totalRawValue = Number.parseInt(statesMatch[2] ?? "", 10);
      if (
        Number.isFinite(completedRaw) &&
        completedRaw >= 0 &&
        Number.isFinite(totalRawValue) &&
        totalRawValue >= 0
      ) {
        completedStates = completedRaw;
        totalStates = totalRawValue;
      }
    }

    const activeMatch = DB_LOAD_ACTIVE_RE.exec(currentFile);
    const activeToken = activeMatch?.[1]?.trim() ?? "";
    if (activeToken.length > 0 && activeToken.toLowerCase() !== "none") {
      activeWorkers = activeToken
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return {
    stepKey,
    stepLabel: formatDbLoadStep(stepKey),
    activeWorkers,
    completedStates,
    loadedFiles: hasFileProgress ? loadedFiles : null,
    totalFiles: hasFileProgress ? totalFiles : null,
    currentFile,
    percent: hasStepProgress ? formatPercent(loadedFiles, totalFiles) : null,
    totalStates,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parser supports explicit fallback extraction from multiple summary shapes
export function parseBuildProgress(summary: string | null | undefined): BuildProgress | null {
  if (typeof summary !== "string") {
    return null;
  }

  const normalized = summary.trim();
  if (!(normalized.startsWith("tiles:building") || normalized.startsWith("tiles:converting"))) {
    return null;
  }

  const percentMatch = BUILD_PERCENT_RE.exec(normalized);
  let percent: number | null = null;
  if (percentMatch?.[1]) {
    const parsedPercent = Number.parseFloat(percentMatch[1]);
    if (Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100) {
      percent = parsedPercent;
    }
  }

  if (percent === null) {
    const readMatch = BUILD_READ_RE.exec(normalized);
    const readRaw = readMatch?.[1];
    const totalRaw = readMatch?.[2];
    if (typeof readRaw === "string" && typeof totalRaw === "string") {
      const readCount = Number.parseInt(readRaw, 10);
      const totalCount = Number.parseInt(totalRaw, 10);
      if (
        Number.isFinite(readCount) &&
        readCount >= 0 &&
        Number.isFinite(totalCount) &&
        totalCount > 0
      ) {
        percent = Math.max(0, Math.min(99.9, (readCount / totalCount) * 100));
      }
    }
  }

  const logBytesMatch = BUILD_LOG_BYTES_RE.exec(normalized);
  let logBytes: number | null = null;
  if (logBytesMatch?.[1]) {
    const parsedLogBytes = Number.parseInt(logBytesMatch[1], 10);
    if (Number.isFinite(parsedLogBytes) && parsedLogBytes >= 0) {
      logBytes = parsedLogBytes;
    }
  }

  let stage: "read" | "write" | "convert" | "complete" | null = null;
  const stageToken = BUILD_STAGE_RE.exec(normalized)?.[1];
  if (
    stageToken === "read" ||
    stageToken === "write" ||
    stageToken === "convert" ||
    stageToken === "complete"
  ) {
    stage = stageToken;
  }

  const workMatch = BUILD_WORK_RE.exec(normalized);
  const workDone = typeof workMatch?.[1] === "string" ? Number.parseInt(workMatch[1], 10) : null;
  const workTotal = typeof workMatch?.[2] === "string" ? Number.parseInt(workMatch[2], 10) : null;
  const leftMatch = BUILD_LEFT_RE.exec(normalized);
  const workLeft = typeof leftMatch?.[1] === "string" ? Number.parseInt(leftMatch[1], 10) : null;

  return {
    percent,
    logBytes,
    stage,
    workDone: typeof workDone === "number" && Number.isFinite(workDone) ? workDone : null,
    workLeft: typeof workLeft === "number" && Number.isFinite(workLeft) ? workLeft : null,
    workTotal: typeof workTotal === "number" && Number.isFinite(workTotal) ? workTotal : null,
  };
}
