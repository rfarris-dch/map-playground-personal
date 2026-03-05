import type { MutableParcelsSyncRunStatus } from "@/sync/parcels-sync/parcels-sync-runtime.types";
import {
  ensureRunState,
  recomputeRunTotals,
  setRunPhase,
} from "@/sync/parcels-sync/run-status-mutations.service";
import { parseNullableInteger } from "@/sync/parcels-sync/value-parsing.service";

const RUN_ID_LINE_RE = /runId=([A-Za-z0-9._:-]+)/;
const STATE_START_RE = /^\[sync\]\sstate=([A-Za-z0-9]+)\sstarting\s+expected=([0-9]+)/;
const STATE_PAGE_RE =
  /^\[sync\]\sstate=([A-Za-z0-9]+)\spage=([0-9]+)\swritten=([0-9]+)\slastId=([^\s]+)/;
const STATE_COMPLETE_RE =
  /^\[sync\]\s([A-Za-z0-9]+)\sexpected=([0-9]+)\swritten=([0-9]+)\spages=([0-9]+)/;

function updateRunPhaseFromLine(run: MutableParcelsSyncRunStatus, line: string): void {
  if (line.includes("[parcels] extracting snapshot")) {
    setRunPhase(run, "extracting");
    return;
  }

  if (line.includes("[parcels] loading canonical table")) {
    setRunPhase(run, "loading");
    return;
  }

  if (line.includes("[parcels] building parcels draw PMTiles")) {
    setRunPhase(run, "building");
    return;
  }

  if (line.includes("[parcels] publishing PMTiles manifest")) {
    setRunPhase(run, "publishing");
    return;
  }

  if (line.includes("[parcels] refresh complete")) {
    setRunPhase(run, "completed");
  }
}

function parseRunIdFromLine(line: string): string | null {
  const match = line.match(RUN_ID_LINE_RE);
  if (!match) {
    return null;
  }

  const value = match[1];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function applyStartStateUpdate(
  run: MutableParcelsSyncRunStatus,
  line: string,
  updatedAt: string
): boolean {
  const startMatch = line.match(STATE_START_RE);
  if (!startMatch) {
    return false;
  }

  const stateCode = startMatch[1];
  const expectedCountRaw = startMatch[2];
  if (typeof stateCode !== "string") {
    return true;
  }

  const state = ensureRunState(run, stateCode);
  const expectedCount = parseNullableInteger(expectedCountRaw);
  state.expectedCount = expectedCount;
  state.isCompleted = false;
  state.updatedAt = updatedAt;
  recomputeRunTotals(run);
  return true;
}

function applyPageStateUpdate(
  run: MutableParcelsSyncRunStatus,
  line: string,
  updatedAt: string
): boolean {
  const pageMatch = line.match(STATE_PAGE_RE);
  if (!pageMatch) {
    return false;
  }

  const stateCode = pageMatch[1];
  const pagesFetchedRaw = pageMatch[2];
  const writtenCountRaw = pageMatch[3];
  const lastSourceIdRaw = pageMatch[4];
  if (typeof stateCode !== "string") {
    return true;
  }

  const state = ensureRunState(run, stateCode);
  const pagesFetched = parseNullableInteger(pagesFetchedRaw);
  const writtenCount = parseNullableInteger(writtenCountRaw);
  if (pagesFetched !== null) {
    state.pagesFetched = pagesFetched;
  }
  if (writtenCount !== null) {
    state.writtenCount = writtenCount;
  }
  state.isCompleted = false;
  state.lastSourceId = parseNullableInteger(lastSourceIdRaw);
  state.updatedAt = updatedAt;
  recomputeRunTotals(run);
  return true;
}

function applyCompleteStateUpdate(
  run: MutableParcelsSyncRunStatus,
  line: string,
  updatedAt: string
): void {
  const completeMatch = line.match(STATE_COMPLETE_RE);
  if (!completeMatch) {
    return;
  }

  const stateCode = completeMatch[1];
  const expectedCountRaw = completeMatch[2];
  const writtenCountRaw = completeMatch[3];
  const pagesFetchedRaw = completeMatch[4];
  if (typeof stateCode !== "string") {
    return;
  }

  const state = ensureRunState(run, stateCode);
  const expectedCount = parseNullableInteger(expectedCountRaw);
  const writtenCount = parseNullableInteger(writtenCountRaw);
  const pagesFetched = parseNullableInteger(pagesFetchedRaw);
  state.expectedCount = expectedCount;
  if (writtenCount !== null) {
    state.writtenCount = writtenCount;
  }
  if (pagesFetched !== null) {
    state.pagesFetched = pagesFetched;
  }
  state.isCompleted = true;
  state.updatedAt = updatedAt;
  recomputeRunTotals(run);
}

export function updateRunStateFromLine(run: MutableParcelsSyncRunStatus, line: string): void {
  const runIdFromLine = parseRunIdFromLine(line);
  if (runIdFromLine !== null) {
    run.runId = runIdFromLine;
  }

  updateRunPhaseFromLine(run, line);

  const updatedAt = new Date().toISOString();
  if (applyStartStateUpdate(run, line, updatedAt)) {
    return;
  }

  if (applyPageStateUpdate(run, line, updatedAt)) {
    return;
  }

  applyCompleteStateUpdate(run, line, updatedAt);
}
