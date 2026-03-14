import type { PipelineStatusResponse } from "@map-migration/http-contracts";

type PipelineDashboardRun = PipelineStatusResponse["run"];
type PipelineDashboardState = PipelineDashboardRun["states"][number];
const ASSET_TOKEN_SPLIT_RE = /[_-]+/u;

export interface PipelineAssetChainRow {
  readonly assetKey: string;
  readonly label: string;
  readonly status: "completed" | "failed" | "pending" | "running";
  readonly statusLabel: string;
  readonly updatedAt: string | null;
}

const FAILED_SUMMARY_PREFIX = "failed at ";

function normalizeAssetToken(token: string): string {
  const normalized = token.trim();
  if (normalized.length === 0) {
    return normalized;
  }

  if (normalized === "pmtiles") {
    return "PMTiles";
  }

  if (normalized === "fema") {
    return "FEMA";
  }

  if (normalized === "cdn") {
    return "CDN";
  }

  if (normalized === "postgis") {
    return "PostGIS";
  }

  if (normalized === "dagster") {
    return "Dagster";
  }

  if (normalized === "martin") {
    return "Martin";
  }

  if (normalized === "huc" || (normalized.startsWith("huc") && normalized.length > 3)) {
    return normalized.toUpperCase();
  }

  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}

export function formatPipelineAssetLabel(assetKey: string): string {
  return assetKey
    .split(ASSET_TOKEN_SPLIT_RE)
    .map((token) => normalizeAssetToken(token))
    .join(" ");
}

function resolveFailedAssetKey(run: PipelineDashboardRun | null): string | null {
  if (run?.phase !== "failed") {
    return null;
  }

  const summary = run.summary?.trim() ?? "";
  if (!summary.startsWith(FAILED_SUMMARY_PREFIX)) {
    return null;
  }

  const assetKey = summary.slice(FAILED_SUMMARY_PREFIX.length).trim();
  return assetKey.length > 0 ? assetKey : null;
}

function resolveCurrentAssetKey(
  assetChain: readonly string[],
  states: readonly PipelineDashboardState[],
  run: PipelineDashboardRun | null
): string | null {
  if (run === null) {
    return null;
  }

  if (run.phase === "completed") {
    return null;
  }

  for (const assetKey of assetChain) {
    const state = states.find((entry) => entry.state === assetKey);
    if (state?.isCompleted === true) {
      continue;
    }

    return assetKey;
  }

  return null;
}

export function orderPipelineStatesByAssetChain(
  states: readonly PipelineDashboardState[],
  assetChain: readonly string[]
): readonly PipelineDashboardState[] {
  const indexByAsset = new Map<string, number>();
  assetChain.forEach((assetKey, index) => {
    indexByAsset.set(assetKey, index);
  });

  return [...states].sort((left, right) => {
    const leftIndex = indexByAsset.get(left.state);
    const rightIndex = indexByAsset.get(right.state);

    if (typeof leftIndex === "number" && typeof rightIndex === "number") {
      return leftIndex - rightIndex;
    }

    if (typeof leftIndex === "number") {
      return -1;
    }

    if (typeof rightIndex === "number") {
      return 1;
    }

    return left.state.localeCompare(right.state);
  });
}

export function buildPipelineAssetChainRows(
  assetChain: readonly string[],
  run: PipelineDashboardRun | null
): readonly PipelineAssetChainRow[] {
  const states = run?.states ?? [];
  const currentAssetKey = resolveCurrentAssetKey(assetChain, states, run);
  const failedAssetKey =
    resolveFailedAssetKey(run) ?? (run?.phase === "failed" ? currentAssetKey : null);

  return assetChain.map((assetKey) => {
    const state = states.find((entry) => entry.state === assetKey) ?? null;
    let status: PipelineAssetChainRow["status"] = "pending";
    let statusLabel = "Pending";

    if (run?.phase === "completed" || state?.isCompleted === true) {
      status = "completed";
      statusLabel = "Completed";
    } else if (failedAssetKey === assetKey) {
      status = "failed";
      statusLabel = "Failed";
    } else if (currentAssetKey === assetKey && run?.isRunning === true) {
      status = "running";
      statusLabel = "Running";
    }

    return {
      assetKey,
      label: formatPipelineAssetLabel(assetKey),
      status,
      statusLabel,
      updatedAt: state?.updatedAt ?? null,
    };
  });
}
