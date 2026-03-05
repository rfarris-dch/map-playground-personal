import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TileBuildProgressSnapshot } from "@/sync/parcels-sync/parcels-sync-runtime.types";
import type { TileBuildWorkProgress } from "./tile-build-progress.service.types";

const TILE_BUILD_PROGRESS_RE = /([0-9]{1,3}(?:\.[0-9]+)?)%\s+[0-9]+\/[0-9]+\/[0-9]+/g;
const TILE_READ_MILLION_PROGRESS_RE = /Read\s+([0-9]+(?:\.[0-9]+)?)\s+million features/g;
const TILE_READ_FEATURE_PROGRESS_RE = /Read\s+([0-9][0-9,]*)\s+features/g;
const TILE_TOTAL_FEATURES_RE =
  /([0-9][0-9,]*)\s+features,\s+[0-9][0-9,]*\s+bytes of geometry and attributes/g;
const PMTILES_CONVERT_START_RE = /\[tiles\]\s+converting MBTiles -> PMTiles/g;
const PMTILES_CONVERT_ATTEMPT_RE = /\[tiles\]\s+pmtiles convert attempt\s+([0-9]+)\/([0-9]+)/g;
const PMTILES_CONVERT_PROGRESS_RE = /([0-9]{1,3})%\s+\|[^\n]*\(([0-9][0-9,]*)\/([0-9][0-9,]*)\s*,/g;
const PMTILES_READY_RE = /\[tiles\]\s+PMTiles ready/g;
const TILE_BUILD_LOG_TAIL_BYTES = 512 * 1024;

function readFileTailUtf8(path: string, maxBytes: number): string | null {
  if (!existsSync(path)) {
    return null;
  }

  let fileSize = 0;
  try {
    const fileStat = statSync(path);
    fileSize = Number(fileStat.size);
  } catch {
    return null;
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return "";
  }

  const bytesToRead = Math.min(Math.floor(fileSize), Math.max(1, Math.floor(maxBytes)));
  const startOffset = Math.max(0, Math.floor(fileSize) - bytesToRead);
  const buffer = Buffer.alloc(bytesToRead);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, "r");
    const bytesRead = readSync(descriptor, buffer, 0, bytesToRead, startOffset);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return null;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Ignore close failures on ephemeral files.
      }
    }
  }
}

function parseLatestTileBuildProgress(logTail: string): {
  readonly convertAttempt: number | null;
  readonly convertAttemptTotal: number | null;
  readonly convertDone: number | null;
  readonly convertPercent: number | null;
  readonly convertTotal: number | null;
  readonly percent: number | null;
  readonly readFeatures: number | null;
  readonly stageHint: "build" | "convert" | "ready";
  readonly totalFeatures: number | null;
} {
  const normalized = logTail.replace(/\r/g, "\n");
  let latestPercent: number | null = null;
  let latestPercentMatchIndex = -1;
  let latestReadFeatures: number | null = null;
  let latestReadMatchIndex = -1;
  let latestTotalFeatures: number | null = null;
  let latestTotalMatchIndex = -1;
  let latestConvertStartIndex = -1;
  let latestPmtilesReadyIndex = -1;
  let latestConvertProgressIndex = -1;
  let latestConvertPercent: number | null = null;
  let latestConvertDone: number | null = null;
  let latestConvertTotal: number | null = null;
  let latestConvertAttemptIndex = -1;
  let latestConvertAttempt: number | null = null;
  let latestConvertAttemptTotal: number | null = null;

  const considerPercentMatch = (value: string | undefined, index: number | undefined): void => {
    if (typeof value !== "string" || typeof index !== "number") {
      return;
    }

    const parsedPercent = Number.parseFloat(value);
    if (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100) {
      return;
    }

    if (index >= latestPercentMatchIndex) {
      latestPercentMatchIndex = index;
      latestPercent = parsedPercent;
    }
  };

  const considerReadMatch = (value: number, index: number | undefined): void => {
    if (typeof index !== "number") {
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    const roundedValue = Math.round(value);
    if (index >= latestReadMatchIndex) {
      latestReadMatchIndex = index;
      latestReadFeatures = roundedValue;
    }
  };

  const parseCommaInteger = (value: string | undefined): number | null => {
    if (typeof value !== "string") {
      return null;
    }

    const parsed = Number.parseInt(value.replace(/,/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  };

  Array.from(normalized.matchAll(TILE_BUILD_PROGRESS_RE)).reduce((_, match) => {
    considerPercentMatch(match[1], match.index);
    return 0;
  }, 0);

  Array.from(normalized.matchAll(TILE_READ_MILLION_PROGRESS_RE)).reduce((_, match) => {
    const millionRaw = match[1];
    if (typeof millionRaw !== "string") {
      return 0;
    }

    const million = Number.parseFloat(millionRaw);
    if (!Number.isFinite(million)) {
      return 0;
    }

    considerReadMatch(million * 1_000_000, match.index);
    return 0;
  }, 0);

  Array.from(normalized.matchAll(TILE_READ_FEATURE_PROGRESS_RE)).reduce((_, match) => {
    const rawFeatures = match[1];
    if (typeof rawFeatures !== "string") {
      return 0;
    }

    const parsedFeatures = Number.parseInt(rawFeatures.replace(/,/g, ""), 10);
    if (!Number.isFinite(parsedFeatures)) {
      return 0;
    }

    considerReadMatch(parsedFeatures, match.index);
    return 0;
  }, 0);

  Array.from(normalized.matchAll(TILE_TOTAL_FEATURES_RE)).reduce((_, match) => {
    const totalRaw = match[1];
    if (typeof totalRaw !== "string") {
      return 0;
    }

    const parsedTotal = Number.parseInt(totalRaw.replace(/,/g, ""), 10);
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      return 0;
    }

    if (typeof match.index === "number" && match.index >= latestTotalMatchIndex) {
      latestTotalMatchIndex = match.index;
      latestTotalFeatures = parsedTotal;
    }

    return 0;
  }, 0);

  Array.from(normalized.matchAll(PMTILES_CONVERT_START_RE)).reduce((_, match) => {
    if (typeof match.index === "number" && match.index >= latestConvertStartIndex) {
      latestConvertStartIndex = match.index;
    }
    return 0;
  }, 0);

  Array.from(normalized.matchAll(PMTILES_READY_RE)).reduce((_, match) => {
    if (typeof match.index === "number" && match.index >= latestPmtilesReadyIndex) {
      latestPmtilesReadyIndex = match.index;
    }
    return 0;
  }, 0);

  Array.from(normalized.matchAll(PMTILES_CONVERT_ATTEMPT_RE)).reduce((_, match) => {
    const attemptRaw = match[1];
    const totalRaw = match[2];
    if (typeof attemptRaw !== "string" || typeof totalRaw !== "string") {
      return 0;
    }

    const parsedAttempt = Number.parseInt(attemptRaw, 10);
    const parsedAttemptTotal = Number.parseInt(totalRaw, 10);
    if (
      !Number.isFinite(parsedAttempt) ||
      parsedAttempt <= 0 ||
      !Number.isFinite(parsedAttemptTotal) ||
      parsedAttemptTotal <= 0
    ) {
      return 0;
    }

    if (typeof match.index === "number" && match.index >= latestConvertAttemptIndex) {
      latestConvertAttemptIndex = match.index;
      latestConvertAttempt = parsedAttempt;
      latestConvertAttemptTotal = parsedAttemptTotal;
    }

    return 0;
  }, 0);

  Array.from(normalized.matchAll(PMTILES_CONVERT_PROGRESS_RE)).reduce((_, match) => {
    const percentRaw = match[1];
    const doneRaw = match[2];
    const totalRaw = match[3];
    if (
      typeof percentRaw !== "string" ||
      typeof doneRaw !== "string" ||
      typeof totalRaw !== "string"
    ) {
      return 0;
    }

    const parsedPercent = Number.parseFloat(percentRaw);
    const parsedDone = parseCommaInteger(doneRaw);
    const parsedTotal = parseCommaInteger(totalRaw);
    if (
      !Number.isFinite(parsedPercent) ||
      parsedPercent < 0 ||
      parsedPercent > 100 ||
      parsedDone === null ||
      parsedTotal === null ||
      parsedTotal <= 0
    ) {
      return 0;
    }

    if (typeof match.index === "number" && match.index >= latestConvertProgressIndex) {
      latestConvertProgressIndex = match.index;
      latestConvertPercent = parsedPercent;
      latestConvertDone = parsedDone;
      latestConvertTotal = parsedTotal;
    }

    return 0;
  }, 0);

  const hasConvertSignal =
    latestConvertStartIndex >= 0 ||
    latestConvertProgressIndex >= 0 ||
    latestConvertAttemptIndex >= 0 ||
    latestPmtilesReadyIndex >= 0;
  const isConvertReady = latestPmtilesReadyIndex >= 0;
  const isConvertActive = hasConvertSignal && !isConvertReady;
  let stageHint: "build" | "convert" | "ready" = "build";
  if (isConvertReady) {
    stageHint = "ready";
  } else if (isConvertActive) {
    stageHint = "convert";
  }

  // If the newest signal in the log tail is "Read ... features", prefer derived progress.
  // This prevents stale trailing percentages from a prior build attempt from masking fresh restart progress.
  if (stageHint === "build" && latestReadMatchIndex > latestPercentMatchIndex) {
    latestPercent = null;
  }
  if (stageHint !== "build") {
    latestPercent = null;
    latestReadFeatures = null;
  }

  return {
    stageHint,
    convertPercent: latestConvertPercent,
    convertDone: latestConvertDone,
    convertTotal: latestConvertTotal,
    convertAttempt: latestConvertAttempt,
    convertAttemptTotal: latestConvertAttemptTotal,
    percent: latestPercent,
    readFeatures: latestReadFeatures,
    totalFeatures: latestTotalFeatures,
  };
}

function estimateTileBuildPercentFromRead(
  readFeatures: number | null,
  effectiveFeatureCount: number | null
): number | null {
  if (typeof readFeatures !== "number" || !Number.isFinite(readFeatures) || readFeatures < 0) {
    return null;
  }

  if (
    typeof effectiveFeatureCount !== "number" ||
    !Number.isFinite(effectiveFeatureCount) ||
    effectiveFeatureCount <= 0
  ) {
    return null;
  }

  const rawPercent = (readFeatures / effectiveFeatureCount) * 100;
  if (!Number.isFinite(rawPercent)) {
    return null;
  }

  return Math.max(0, Math.min(99.9, rawPercent));
}

function deriveTileBuildWorkProgress(
  buildProgress: TileBuildProgressSnapshot,
  expectedFeatureCount: number | null
): TileBuildWorkProgress | null {
  const effectiveFeatureTotal =
    typeof buildProgress.totalFeatures === "number" &&
    Number.isFinite(buildProgress.totalFeatures) &&
    buildProgress.totalFeatures > 0
      ? buildProgress.totalFeatures
      : expectedFeatureCount;

  if (
    typeof effectiveFeatureTotal !== "number" ||
    !Number.isFinite(effectiveFeatureTotal) ||
    effectiveFeatureTotal <= 0
  ) {
    return null;
  }

  const totalUnits = effectiveFeatureTotal * 2;
  const stage: "read" | "write" = buildProgress.percent === null ? "read" : "write";
  const hasReadFeatures =
    typeof buildProgress.readFeatures === "number" && Number.isFinite(buildProgress.readFeatures);
  const readUnitsRaw = hasReadFeatures ? Math.floor(buildProgress.readFeatures ?? 0) : 0;
  let readUnits = Math.max(0, Math.min(effectiveFeatureTotal, readUnitsRaw));
  if (stage === "write" && !hasReadFeatures) {
    // Once write progress is present, the read pass is complete even if tail parsing no longer sees "Read ..." lines.
    readUnits = effectiveFeatureTotal;
  }

  const writePercentRaw =
    typeof buildProgress.percent === "number" && Number.isFinite(buildProgress.percent)
      ? buildProgress.percent
      : 0;
  const writePercent = Math.max(0, Math.min(100, writePercentRaw));
  const writeUnits = Math.round((writePercent / 100) * effectiveFeatureTotal);

  const doneUnitsRaw = stage === "write" ? readUnits + writeUnits : readUnits;
  const doneUnits = Math.max(0, Math.min(totalUnits, doneUnitsRaw));
  const leftUnits = Math.max(0, totalUnits - doneUnits);

  return {
    stage,
    workDone: doneUnits,
    workLeft: leftUnits,
    workTotal: totalUnits,
  };
}

export function readTileBuildProgressSnapshot(
  snapshotRoot: string,
  runId: string
): TileBuildProgressSnapshot | null {
  const logPath = join(snapshotRoot, `postextract-${runId}.log`);
  if (!existsSync(logPath)) {
    return null;
  }

  let logBytes: number | null = null;
  try {
    const fileStat = statSync(logPath);
    const size = Number(fileStat.size);
    if (Number.isFinite(size) && size >= 0) {
      logBytes = Math.floor(size);
    }
  } catch {
    logBytes = null;
  }

  const logTail = readFileTailUtf8(logPath, TILE_BUILD_LOG_TAIL_BYTES);
  const fallbackProgress: ReturnType<typeof parseLatestTileBuildProgress> = {
    stageHint: "build",
    convertPercent: null,
    convertDone: null,
    convertTotal: null,
    convertAttempt: null,
    convertAttemptTotal: null,
    percent: null,
    readFeatures: null,
    totalFeatures: null,
  };
  const parsedProgress: ReturnType<typeof parseLatestTileBuildProgress> =
    typeof logTail === "string" ? parseLatestTileBuildProgress(logTail) : fallbackProgress;
  if (
    parsedProgress.convertPercent === null &&
    parsedProgress.convertDone === null &&
    parsedProgress.convertTotal === null &&
    parsedProgress.percent === null &&
    parsedProgress.readFeatures === null &&
    parsedProgress.totalFeatures === null &&
    logBytes === null
  ) {
    return null;
  }

  return {
    convertAttempt: parsedProgress.convertAttempt,
    convertAttemptTotal: parsedProgress.convertAttemptTotal,
    convertDone: parsedProgress.convertDone,
    convertPercent: parsedProgress.convertPercent,
    convertTotal: parsedProgress.convertTotal,
    logBytes,
    percent: parsedProgress.percent,
    readFeatures: parsedProgress.readFeatures,
    stageHint: parsedProgress.stageHint,
    totalFeatures: parsedProgress.totalFeatures,
  };
}

function appendLogBytesPart(parts: string[], logBytes: number | null): void {
  if (typeof logBytes === "number") {
    parts.push(`log=${String(logBytes)}`);
  }
}

function resolveConvertPercent(buildProgress: TileBuildProgressSnapshot): number | null {
  if (buildProgress.stageHint === "ready") {
    return 100;
  }

  if (
    typeof buildProgress.convertPercent !== "number" ||
    !Number.isFinite(buildProgress.convertPercent)
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, buildProgress.convertPercent));
}

function appendConvertWorkParts(parts: string[], buildProgress: TileBuildProgressSnapshot): void {
  if (
    typeof buildProgress.convertDone !== "number" ||
    !Number.isFinite(buildProgress.convertDone) ||
    buildProgress.convertDone < 0 ||
    typeof buildProgress.convertTotal !== "number" ||
    !Number.isFinite(buildProgress.convertTotal) ||
    buildProgress.convertTotal <= 0
  ) {
    return;
  }

  const doneUnits = Math.max(0, Math.min(buildProgress.convertTotal, buildProgress.convertDone));
  const leftUnits = Math.max(0, buildProgress.convertTotal - doneUnits);
  parts.push(`work=${String(doneUnits)}/${String(buildProgress.convertTotal)}`);
  parts.push(`left=${String(leftUnits)}`);
}

function appendConvertAttemptParts(
  parts: string[],
  buildProgress: TileBuildProgressSnapshot
): void {
  if (
    typeof buildProgress.convertAttempt !== "number" ||
    !Number.isFinite(buildProgress.convertAttempt) ||
    typeof buildProgress.convertAttemptTotal !== "number" ||
    !Number.isFinite(buildProgress.convertAttemptTotal)
  ) {
    return;
  }

  parts.push(
    `attempt=${String(buildProgress.convertAttempt)}/${String(buildProgress.convertAttemptTotal)}`
  );
}

function formatConvertTileBuildSummary(buildProgress: TileBuildProgressSnapshot): string {
  const parts: string[] = ["tiles:converting"];
  const convertPercent = resolveConvertPercent(buildProgress);
  if (typeof convertPercent === "number") {
    parts.push(`${convertPercent.toFixed(2)}%`);
  }

  appendConvertWorkParts(parts, buildProgress);
  appendConvertAttemptParts(parts, buildProgress);
  appendLogBytesPart(parts, buildProgress.logBytes);
  parts.push(`stage=${buildProgress.stageHint === "ready" ? "complete" : "convert"}`);
  return parts.join(" ");
}

function resolveEffectiveFeatureTotal(
  buildProgress: TileBuildProgressSnapshot,
  expectedFeatureCount: number | null
): number | null {
  if (
    typeof buildProgress.totalFeatures === "number" &&
    Number.isFinite(buildProgress.totalFeatures) &&
    buildProgress.totalFeatures > 0
  ) {
    return buildProgress.totalFeatures;
  }

  return expectedFeatureCount;
}

function resolveDisplayPercent(
  workProgress: TileBuildWorkProgress | null,
  buildProgress: TileBuildProgressSnapshot,
  effectiveFeatureTotal: number | null
): number | null {
  if (workProgress !== null && workProgress.workTotal > 0) {
    return (workProgress.workDone / workProgress.workTotal) * 100;
  }

  return estimateTileBuildPercentFromRead(buildProgress.readFeatures, effectiveFeatureTotal);
}

function appendReadProgressPart(
  parts: string[],
  buildProgress: TileBuildProgressSnapshot,
  effectiveFeatureTotal: number | null
): void {
  const hasEffectiveFeatureTotal =
    typeof effectiveFeatureTotal === "number" &&
    Number.isFinite(effectiveFeatureTotal) &&
    effectiveFeatureTotal > 0;

  if (typeof buildProgress.readFeatures === "number") {
    if (hasEffectiveFeatureTotal) {
      parts.push(`read=${String(buildProgress.readFeatures)}/${String(effectiveFeatureTotal)}`);
      return;
    }

    parts.push(`read=${String(buildProgress.readFeatures)}`);
    return;
  }

  if (
    typeof buildProgress.percent === "number" &&
    Number.isFinite(buildProgress.percent) &&
    hasEffectiveFeatureTotal
  ) {
    // In write phase, older read counters may roll out of log tail; expose read completion explicitly.
    parts.push(`read=${String(effectiveFeatureTotal)}/${String(effectiveFeatureTotal)}`);
  }
}

function appendWorkProgressParts(
  parts: string[],
  workProgress: TileBuildWorkProgress | null
): void {
  if (workProgress === null) {
    return;
  }

  parts.push(`stage=${workProgress.stage}`);
  parts.push(`work=${String(workProgress.workDone)}/${String(workProgress.workTotal)}`);
  parts.push(`left=${String(workProgress.workLeft)}`);
}

function formatBuildTileSummary(
  buildProgress: TileBuildProgressSnapshot,
  expectedFeatureCount: number | null
): string {
  const parts: string[] = ["tiles:building"];
  const effectiveFeatureTotal = resolveEffectiveFeatureTotal(buildProgress, expectedFeatureCount);
  const workProgress = deriveTileBuildWorkProgress(buildProgress, expectedFeatureCount);
  const displayPercent = resolveDisplayPercent(workProgress, buildProgress, effectiveFeatureTotal);
  if (typeof displayPercent === "number" && Number.isFinite(displayPercent)) {
    parts.push(`${displayPercent.toFixed(2)}%`);
  }

  appendReadProgressPart(parts, buildProgress, effectiveFeatureTotal);
  appendLogBytesPart(parts, buildProgress.logBytes);
  appendWorkProgressParts(parts, workProgress);
  return parts.join(" ");
}

export function formatTileBuildSummary(
  fallbackSummary: string | null,
  buildProgress: TileBuildProgressSnapshot | null,
  expectedFeatureCount: number | null
): string | null {
  if (buildProgress === null) {
    return fallbackSummary;
  }

  if (buildProgress.stageHint === "convert" || buildProgress.stageHint === "ready") {
    return formatConvertTileBuildSummary(buildProgress);
  }

  return formatBuildTileSummary(buildProgress, expectedFeatureCount);
}
