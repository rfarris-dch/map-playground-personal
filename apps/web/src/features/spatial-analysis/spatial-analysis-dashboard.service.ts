import { MapContextTransferSchema } from "@map-migration/contracts";
import type { ScannerSummary } from "@/features/scanner/scanner.types";
import type { SelectionToolSummary } from "@/features/selection-tool/selection-tool.types";
import type { SpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.types";

const SPATIAL_ANALYSIS_DASHBOARD_STORAGE_KEY = "map.spatial-analysis-dashboard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasCommonSummaryShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.totalCount === "number" &&
    Array.isArray(value.facilities) &&
    isRecord(value.colocation) &&
    isRecord(value.hyperscale) &&
    isRecord(value.parcelSelection)
  );
}

function isSpatialAnalysisDashboardState(value: unknown): value is SpatialAnalysisDashboardState {
  if (!isRecord(value)) {
    return false;
  }

  if (value.source !== "selection" && value.source !== "scanner") {
    return false;
  }

  if (
    typeof value.createdAt !== "string" ||
    typeof value.isFiltered !== "boolean" ||
    typeof value.title !== "string" ||
    !hasCommonSummaryShape(value.summary)
  ) {
    return false;
  }

  if (typeof value.mapContext === "undefined") {
    return true;
  }

  return MapContextTransferSchema.safeParse(value.mapContext).success;
}

export function saveSpatialAnalysisDashboardState(nextState: SpatialAnalysisDashboardState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SPATIAL_ANALYSIS_DASHBOARD_STORAGE_KEY, JSON.stringify(nextState));
}

export function saveMeasureAnalysisDashboard(summary: SelectionToolSummary): void {
  saveSpatialAnalysisDashboardState({
    isFiltered: false,
    title: "Selection Dashboard",
    source: "selection",
    createdAt: new Date().toISOString(),
    summary,
  });
}

export function saveScannerAnalysisDashboard(summary: ScannerSummary): void {
  saveSpatialAnalysisDashboardState({
    isFiltered: false,
    title: "Scanner Dashboard",
    source: "scanner",
    createdAt: new Date().toISOString(),
    summary,
  });
}

export function loadSpatialAnalysisDashboardState(): SpatialAnalysisDashboardState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.sessionStorage.getItem(SPATIAL_ANALYSIS_DASHBOARD_STORAGE_KEY);
  if (rawState === null) {
    return null;
  }

  try {
    const parsedState: unknown = JSON.parse(rawState);
    return isSpatialAnalysisDashboardState(parsedState) ? parsedState : null;
  } catch {
    return null;
  }
}

export function clearSpatialAnalysisDashboardState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SPATIAL_ANALYSIS_DASHBOARD_STORAGE_KEY);
}
