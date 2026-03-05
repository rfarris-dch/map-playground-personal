import type {
  BuildProgress,
  DbLoadProgress,
} from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
import { formatPercent } from "@/features/pipeline/pipeline.service";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readNullablePercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || value > 100) {
    return null;
  }

  return value;
}

function readNullableNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function parseDbLoadProgressFromStructured(progress: unknown): DbLoadProgress | null {
  if (!isRecord(progress)) {
    return null;
  }

  const dbLoad = Reflect.get(progress, "dbLoad");
  if (!isRecord(dbLoad)) {
    return null;
  }

  const stepKey = readNonEmptyString(Reflect.get(dbLoad, "stepKey"));
  if (stepKey === null) {
    return null;
  }

  const totalFilesRaw = readNullableNonNegativeInteger(Reflect.get(dbLoad, "totalFiles"));
  const totalFiles = totalFilesRaw !== null && totalFilesRaw > 0 ? totalFilesRaw : null;
  const activeWorkersRaw = Reflect.get(dbLoad, "activeWorkers");
  const activeWorkers = Array.isArray(activeWorkersRaw)
    ? activeWorkersRaw.reduce<string[]>((entries, entry) => {
        const worker = readNonEmptyString(entry);
        if (worker !== null) {
          entries.push(worker);
        }
        return entries;
      }, [])
    : [];

  return {
    stepKey,
    stepLabel: formatDbLoadStep(stepKey),
    activeWorkers,
    completedStates: readNullableNonNegativeInteger(Reflect.get(dbLoad, "completedStates")),
    loadedFiles: readNullableNonNegativeInteger(Reflect.get(dbLoad, "loadedFiles")),
    totalFiles,
    currentFile: readNonEmptyString(Reflect.get(dbLoad, "currentFile")),
    percent: readNullablePercent(Reflect.get(dbLoad, "percent")),
    totalStates: readNullableNonNegativeInteger(Reflect.get(dbLoad, "totalStates")),
  };
}

function parseBuildProgressFromStructured(progress: unknown): BuildProgress | null {
  if (!isRecord(progress)) {
    return null;
  }

  const tileBuild = Reflect.get(progress, "tileBuild");
  if (!isRecord(tileBuild)) {
    return null;
  }

  const stageRaw = Reflect.get(tileBuild, "stage");
  let stage: "read" | "write" | "convert" | "complete" | null = null;
  if (stageRaw === "convert") {
    stage = "convert";
  } else if (stageRaw === "ready") {
    stage = "complete";
  }

  return {
    percent: readNullablePercent(Reflect.get(tileBuild, "percent")),
    logBytes: readNullableNonNegativeInteger(Reflect.get(tileBuild, "logBytes")),
    stage,
    workDone: readNullableNonNegativeInteger(Reflect.get(tileBuild, "workDone")),
    workLeft: readNullableNonNegativeInteger(Reflect.get(tileBuild, "workLeft")),
    workTotal: readNullableNonNegativeInteger(Reflect.get(tileBuild, "workTotal")),
  };
}

function parseNonNegativeIntegerFromString(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDbLoadSummary(summary: string): {
  readonly stepKey: string;
  readonly loadedFiles: number | null;
  readonly totalFiles: number | null;
  readonly currentFile: string | null;
} | null {
  const match = DB_LOAD_SUMMARY_RE.exec(summary);
  if (match === null) {
    return null;
  }

  const stepKeyRaw = match[1];
  if (typeof stepKeyRaw !== "string" || stepKeyRaw.length === 0) {
    return null;
  }

  const currentFileRaw = match[4];
  const currentFile =
    typeof currentFileRaw === "string" && currentFileRaw.trim().length > 0
      ? currentFileRaw.trim()
      : null;

  return {
    stepKey: stepKeyRaw.toLowerCase(),
    loadedFiles: parseNonNegativeIntegerFromString(match[2]),
    totalFiles: parseNonNegativeIntegerFromString(match[3]),
    currentFile,
  };
}

function hasStepProgress(loadedFiles: number | null, totalFiles: number | null): boolean {
  return typeof loadedFiles === "number" && typeof totalFiles === "number" && totalFiles > 0;
}

function parseMaterializeDetails(currentFile: string): {
  readonly completedStates: number | null;
  readonly totalStates: number | null;
  readonly activeWorkers: readonly string[];
} {
  let completedStates: number | null = null;
  let totalStates: number | null = null;
  let activeWorkers: readonly string[] = [];

  const statesMatch = DB_LOAD_STATES_RE.exec(currentFile);
  if (statesMatch !== null) {
    const completedRaw = parseNonNegativeIntegerFromString(statesMatch[1]);
    const totalRaw = parseNonNegativeIntegerFromString(statesMatch[2]);
    if (completedRaw !== null && totalRaw !== null) {
      completedStates = completedRaw;
      totalStates = totalRaw;
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

  return {
    completedStates,
    totalStates,
    activeWorkers,
  };
}

export function parseDbLoadProgress(
  summary: string | null | undefined,
  progress?: unknown
): DbLoadProgress | null {
  const structured = parseDbLoadProgressFromStructured(progress);
  if (structured !== null) {
    return structured;
  }

  if (typeof summary !== "string") {
    return null;
  }

  const normalized = summary.trim();
  if (!normalized.startsWith("db-load:")) {
    return null;
  }

  const parsedSummary = parseDbLoadSummary(normalized);
  if (parsedSummary === null) {
    return null;
  }

  const stepKey = parsedSummary.stepKey;
  const loadedFiles = parsedSummary.loadedFiles;
  const totalFiles = parsedSummary.totalFiles;
  const currentFile = parsedSummary.currentFile;

  const hasLoadStepProgress = hasStepProgress(loadedFiles, totalFiles);

  const hasFileProgress = stepKey === "staging" && hasLoadStepProgress;
  let completedStates: number | null = null;
  let totalStates: number | null = null;
  let activeWorkers: readonly string[] = [];
  const percent =
    hasLoadStepProgress && loadedFiles !== null && totalFiles !== null
      ? formatPercent(loadedFiles, totalFiles)
      : null;

  if (stepKey === "materialize" && currentFile !== null) {
    const parsedDetails = parseMaterializeDetails(currentFile);
    completedStates = parsedDetails.completedStates;
    totalStates = parsedDetails.totalStates;
    activeWorkers = parsedDetails.activeWorkers;
  }

  return {
    stepKey,
    stepLabel: formatDbLoadStep(stepKey),
    activeWorkers,
    completedStates,
    loadedFiles: hasFileProgress ? loadedFiles : null,
    totalFiles: hasFileProgress ? totalFiles : null,
    currentFile,
    percent,
    totalStates,
  };
}

function parsePercentFromReadSummary(summary: string): number | null {
  const readMatch = BUILD_READ_RE.exec(summary);
  const readCount = parseNonNegativeIntegerFromString(readMatch?.[1]);
  const totalCount = parseNonNegativeIntegerFromString(readMatch?.[2]);
  if (readCount === null || totalCount === null || totalCount === 0) {
    return null;
  }

  return Math.max(0, Math.min(99.9, (readCount / totalCount) * 100));
}

function parseBuildPercent(summary: string): number | null {
  const percentToken = BUILD_PERCENT_RE.exec(summary)?.[1];
  if (typeof percentToken === "string") {
    const parsedPercent = Number.parseFloat(percentToken);
    if (Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100) {
      return parsedPercent;
    }
  }

  return parsePercentFromReadSummary(summary);
}

function parseBuildStage(summary: string): "read" | "write" | "convert" | "complete" | null {
  const stageToken = BUILD_STAGE_RE.exec(summary)?.[1];
  if (
    stageToken === "read" ||
    stageToken === "write" ||
    stageToken === "convert" ||
    stageToken === "complete"
  ) {
    return stageToken;
  }

  return null;
}

function parseBuildWork(summary: string): {
  readonly workDone: number | null;
  readonly workLeft: number | null;
  readonly workTotal: number | null;
} {
  const workMatch = BUILD_WORK_RE.exec(summary);
  const leftMatch = BUILD_LEFT_RE.exec(summary);

  return {
    workDone: parseNonNegativeIntegerFromString(workMatch?.[1]),
    workLeft: parseNonNegativeIntegerFromString(leftMatch?.[1]),
    workTotal: parseNonNegativeIntegerFromString(workMatch?.[2]),
  };
}

export function parseBuildProgress(
  summary: string | null | undefined,
  progress?: unknown
): BuildProgress | null {
  const structured = parseBuildProgressFromStructured(progress);
  if (structured !== null) {
    return structured;
  }

  if (typeof summary !== "string") {
    return null;
  }

  const normalized = summary.trim();
  if (!(normalized.startsWith("tiles:building") || normalized.startsWith("tiles:converting"))) {
    return null;
  }

  const percent = parseBuildPercent(normalized);
  const logBytes = parseNonNegativeIntegerFromString(BUILD_LOG_BYTES_RE.exec(normalized)?.[1]);
  const stage = parseBuildStage(normalized);
  const work = parseBuildWork(normalized);

  return {
    percent,
    logBytes,
    stage,
    workDone: work.workDone,
    workLeft: work.workLeft,
    workTotal: work.workTotal,
  };
}
