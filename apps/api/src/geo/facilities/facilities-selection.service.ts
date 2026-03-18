import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import { getFacilitiesPolygonMaxRows } from "@/geo/facilities/facilities.repo";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/facilities-selection-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import type {
  QueryFacilitiesSelectionArgs,
  QueryFacilitiesSelectionResult,
} from "./facilities-selection.service.types";

export type {
  QueryFacilitiesSelectionArgs,
  QueryFacilitiesSelectionResult,
} from "./facilities-selection.service.types";

function dedupePerspectives(perspectives: readonly FacilityPerspective[]): FacilityPerspective[] {
  return perspectives.reduce<FacilityPerspective[]>((next, perspective) => {
    if (!next.includes(perspective)) {
      next.push(perspective);
    }

    return next;
  }, []);
}

function policyRejected(
  message: string,
  error?: unknown
): Extract<QueryFacilitiesSelectionResult, { ok: false }> {
  return {
    ok: false,
    value: {
      error: error ?? new Error(message),
      message,
      reason: "policy_rejected",
    },
  };
}

async function normalizeSelectionGeometry(geometryText: string): Promise<
  | {
      readonly ok: true;
      readonly geometryText: string;
      readonly warnings: readonly Warning[];
    }
  | Extract<QueryFacilitiesSelectionResult, { ok: false }>
> {
  try {
    const normalizedGeometry = await normalizePolygonGeometryGeoJson(geometryText);

    return {
      ok: true,
      geometryText: normalizedGeometry.geometryText,
      warnings: normalizedGeometry.wasRepaired
        ? [buildPolygonRepairWarning("selection", normalizedGeometry.invalidReason)]
        : [],
    };
  } catch (error) {
    return policyRejected(
      error instanceof Error
        ? `selection polygon is invalid after repair: ${error.message}`
        : "selection polygon is invalid after repair",
      error
    );
  }
}

async function querySelectionPerspectives(args: {
  readonly geometryText: string;
  readonly limitPerPerspective: number;
  readonly perspectives: readonly FacilityPerspective[];
}): Promise<QueryFacilitiesSelectionResult> {
  const countsByPerspective: Record<FacilityPerspective, number> = {
    colocation: 0,
    hyperscale: 0,
    "hyperscale-leased": 0,
    enterprise: 0,
  };
  const truncatedByPerspective: Record<FacilityPerspective, boolean> = {
    colocation: false,
    hyperscale: false,
    "hyperscale-leased": false,
    enterprise: false,
  };
  const features: FacilitiesFeatureCollection["features"] = [];
  const warnings: Warning[] = [];

  for (const perspective of args.perspectives) {
    const maxRows = getFacilitiesPolygonMaxRows(perspective);
    const limit = Math.min(args.limitPerPerspective, maxRows);
    const queryResult = await queryFacilitiesByPolygon({
      geometryGeoJson: args.geometryText,
      limit,
      perspective,
    });

    if (!queryResult.ok) {
      return {
        ok: false,
        value: {
          error: queryResult.value.error,
          message:
            queryResult.value.reason === "query_failed"
              ? "postgis query failed"
              : "facility mapping failed",
          reason: queryResult.value.reason,
        },
      };
    }

    countsByPerspective[perspective] = queryResult.value.features.length;
    truncatedByPerspective[perspective] = queryResult.value.truncated;
    features.push(...queryResult.value.features);
    warnings.push(
      ...queryResult.value.warnings.map((warning) => ({
        code: `${perspective.toUpperCase()}_${warning.code}`,
        message: `[${perspective}] ${warning.message}`,
      }))
    );
  }

  return {
    ok: true,
    value: {
      countsByPerspective,
      features,
      truncatedByPerspective,
      warnings,
    },
  };
}

export async function queryFacilitiesSelection(
  args: QueryFacilitiesSelectionArgs
): Promise<QueryFacilitiesSelectionResult> {
  const geometry = resolveFacilitiesSelectionGeometry(args.geometry);
  if (facilitiesSelectionBboxExceedsLimits(geometry.bbox)) {
    return policyRejected("selection polygon AOI exceeds the facilities selection extent limit");
  }

  if (geometry.geometryText.length > FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS) {
    return policyRejected("selection polygon AOI payload is too large");
  }

  const normalizedGeometry = await normalizeSelectionGeometry(geometry.geometryText);
  if (!normalizedGeometry.ok) {
    return normalizedGeometry;
  }

  const perspectives = dedupePerspectives(args.perspectives);
  const selectionResult = await querySelectionPerspectives({
    geometryText: normalizedGeometry.geometryText,
    limitPerPerspective: args.limitPerPerspective,
    perspectives,
  });
  if (!selectionResult.ok) {
    return selectionResult.value.reason === "query_failed"
      ? {
          ok: false,
          value: {
            error: selectionResult.value.error,
            message: "postgis query failed",
            reason: "query_failed",
          },
        }
      : {
          ok: false,
          value: {
            error: selectionResult.value.error,
            message: "facility mapping failed",
            reason: "mapping_failed",
          },
        };
  }

  return {
    ok: true,
    value: {
      countsByPerspective: selectionResult.value.countsByPerspective,
      features: selectionResult.value.features,
      truncatedByPerspective: selectionResult.value.truncatedByPerspective,
      warnings: [...normalizedGeometry.warnings, ...selectionResult.value.warnings],
    },
  };
}
