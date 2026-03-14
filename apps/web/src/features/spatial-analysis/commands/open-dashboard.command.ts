import type { MapContextTransfer } from "@map-migration/http-contracts";
import type { Router } from "vue-router";
import { saveSpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.service";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

/**
 * Describes the intent to open a spatial-analysis dashboard.
 * The caller is responsible for resolving the summary and map context
 * before constructing the command.
 */
export interface OpenDashboardCommand {
  readonly source: "selection" | "scanner";
  readonly title: string;
  readonly isFiltered: boolean;
  readonly summary: SpatialAnalysisSummaryModel;
  readonly mapContext?: MapContextTransfer | undefined;
}

/**
 * Returns true when the summary contains at least one meaningful result
 * worth showing on the dashboard.
 */
export function hasDashboardResults(summary: SpatialAnalysisSummaryModel): boolean {
  return (
    summary.summary.totalCount > 0 ||
    summary.summary.parcelSelection.count > 0 ||
    (summary.summary.marketSelection?.matchCount ?? 0) > 0 ||
    summary.area.countyIds.length > 0
  );
}

/**
 * Validates, persists dashboard state to sessionStorage, and navigates
 * to the spatial-analysis-dashboard route.
 *
 * Returns `false` if the command was skipped (no results), `true` if
 * navigation was initiated.
 */
export async function executeOpenDashboard(
  command: OpenDashboardCommand,
  router: Router
): Promise<boolean> {
  if (!hasDashboardResults(command.summary)) {
    return false;
  }

  saveSpatialAnalysisDashboardState({
    createdAt: new Date().toISOString(),
    isFiltered: command.isFiltered,
    mapContext: command.mapContext,
    source: command.source,
    summary: command.summary,
    title: command.title,
  });

  await router.push({ name: "spatial-analysis-dashboard" });
  return true;
}
