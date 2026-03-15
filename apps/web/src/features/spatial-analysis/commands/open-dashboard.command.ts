import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import type { Router } from "vue-router";
import { saveSpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.service";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

export interface OpenDashboardCommand {
  readonly isFiltered: boolean;
  readonly mapContext?: MapContextTransfer | undefined;
  readonly source: "selection" | "scanner";
  readonly summary: SpatialAnalysisSummaryModel;
  readonly title: string;
}

export function hasDashboardResults(summary: SpatialAnalysisSummaryModel): boolean {
  return (
    summary.summary.totalCount > 0 ||
    summary.summary.parcelSelection.count > 0 ||
    (summary.summary.marketSelection?.matchCount ?? 0) > 0 ||
    summary.area.countyIds.length > 0
  );
}

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
