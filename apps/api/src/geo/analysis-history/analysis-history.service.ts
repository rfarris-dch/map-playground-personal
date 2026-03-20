import type {
  SpatialAnalysisHistoryPoint,
  SpatialAnalysisHistoryRequest,
  SpatialAnalysisHistorySummary,
} from "@map-migration/http-contracts/spatial-analysis-history-http";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/facilities-selection-policy.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import { queryAreaHistoryCoverage, queryAreaHistoryPoints } from "./analysis-history.repo";
import type { AreaHistoryCoverageRow, AreaHistoryPointRow } from "./analysis-history.repo.types";

function buildWarning(code: string, message: string) {
  return { code, message };
}

function readNumber(value: number | string): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readInteger(value: number | string): number {
  const parsed = readNumber(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

function toHistoryPoint(row: AreaHistoryPointRow): SpatialAnalysisHistoryPoint {
  return {
    colocationAvailableMw: readNumber(row.colocation_available_mw),
    colocationCommissionedMw: readNumber(row.colocation_commissioned_mw),
    colocationPlannedMw: readNumber(row.colocation_planned_mw),
    colocationUnderConstructionMw: readNumber(row.colocation_under_construction_mw),
    facilityCount: row.facility_count,
    hyperscaleOwnedMw: readNumber(row.hyperscale_owned_mw),
    hyperscalePlannedMw: readNumber(row.hyperscale_planned_mw),
    hyperscaleUnderConstructionMw: readNumber(row.hyperscale_under_construction_mw),
    periodId: readInteger(row.period_id),
    periodLabel: row.period_label,
    quarterNum: readInteger(row.quarter_num),
    totalMarketSizeMw: readNumber(row.total_market_size_mw),
    yearNum: readInteger(row.year_num),
  };
}

function buildCoverageStatus(
  coverage: AreaHistoryCoverageRow | null
): SpatialAnalysisHistorySummary["coverageStatus"] {
  if (
    coverage === null ||
    coverage.selected_facility_count === 0 ||
    coverage.included_facility_count === 0
  ) {
    return "none";
  }

  if (coverage.included_facility_count < coverage.selected_facility_count) {
    return "partial";
  }

  return "complete";
}

function listSupportedPerspectives(
  perspectives: SpatialAnalysisHistoryRequest["perspectives"]
): readonly string[] {
  const supportedPerspectives: string[] = [];

  for (const perspective of perspectives) {
    if (perspective === "colocation") {
      supportedPerspectives.push("colo");
      continue;
    }

    if (perspective === "hyperscale") {
      supportedPerspectives.push("hyperscale");
    }
  }

  return supportedPerspectives;
}

export async function querySpatialAnalysisHistory(request: SpatialAnalysisHistoryRequest): Promise<{
  readonly summary: SpatialAnalysisHistorySummary;
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
}> {
  const supportedPerspectives = listSupportedPerspectives(request.perspectives);
  if (supportedPerspectives.length === 0) {
    return {
      summary: {
        coverageStatus: "none",
        geometryBasis: "current",
        includedColocationFacilityCount: 0,
        includedFacilityCount: 0,
        includedHyperscaleFacilityCount: 0,
        leasedOverlayAvailable: false,
        leasedOverlayReason:
          "Hyperscale leased totals are modeled at market plus company plus year and are not allocated to drawn selection areas.",
        pointCount: 0,
        points: [],
        publicationBasis: "live_only",
        selectedColocationFacilityCount: 0,
        selectedFacilityCount: 0,
        selectedHyperscaleFacilityCount: 0,
        selectedMarketCount: 0,
        unavailableReason: "No supported facility perspectives are enabled for history.",
      },
      warnings: [],
    };
  }

  const resolvedGeometry = resolveFacilitiesSelectionGeometry(request.geometry);
  if (resolvedGeometry.geometryText.length > FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS) {
    throw new Error("selection geometry is too large for history analysis");
  }

  const warnings: Array<{ readonly code: string; readonly message: string }> = [];
  const normalizedGeometry = await normalizePolygonGeometryGeoJson(resolvedGeometry.geometryText);
  if (normalizedGeometry.wasRepaired) {
    warnings.push(
      buildPolygonRepairWarning("Spatial analysis history", normalizedGeometry.invalidReason)
    );
  }

  const [points, coverage] = await Promise.all([
    queryAreaHistoryPoints({
      geometryText: normalizedGeometry.geometryText,
      periodLimit: request.periodLimit,
      perspectives: supportedPerspectives,
    }),
    queryAreaHistoryCoverage({
      geometryText: normalizedGeometry.geometryText,
      perspectives: supportedPerspectives,
    }),
  ]);

  const historyPoints = points.map((point) => toHistoryPoint(point));
  const selectedFacilityCount = coverage?.selected_facility_count ?? 0;
  const includedFacilityCount = coverage?.included_facility_count ?? 0;
  if (selectedFacilityCount > includedFacilityCount && includedFacilityCount > 0) {
    warnings.push(
      buildWarning(
        "AREA_HISTORY_PARTIAL_COVERAGE",
        `History covers ${String(includedFacilityCount)} of ${String(selectedFacilityCount)} currently selected facilities.`
      )
    );
  }

  let unavailableReason: string | null = null;
  if (selectedFacilityCount === 0) {
    unavailableReason = "No colocation or hyperscale facilities were found inside this selection.";
  } else if (historyPoints.length === 0) {
    unavailableReason = "No live quarterly facility history is available for the selected area.";
  }

  return {
    summary: {
      coverageStatus: buildCoverageStatus(coverage),
      geometryBasis: "current",
      includedColocationFacilityCount: coverage?.included_colocation_facility_count ?? 0,
      includedFacilityCount,
      includedHyperscaleFacilityCount: coverage?.included_hyperscale_facility_count ?? 0,
      leasedOverlayAvailable: false,
      leasedOverlayReason:
        "Hyperscale leased totals are modeled at market plus company plus year and are not allocated to drawn selection areas.",
      pointCount: historyPoints.length,
      points: historyPoints,
      publicationBasis: "live_only",
      selectedColocationFacilityCount: coverage?.selected_colocation_facility_count ?? 0,
      selectedFacilityCount,
      selectedHyperscaleFacilityCount: coverage?.selected_hyperscale_facility_count ?? 0,
      selectedMarketCount: coverage?.selected_market_count ?? 0,
      unavailableReason,
    },
    warnings,
  };
}
