import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
} from "@map-migration/http-contracts/facilities-http";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import type { PerspectiveVisibilityState } from "@/features/app/core/app-shell.types";
import type {
  QueryMeasureSelectionSummaryArgs,
  QueryMeasureSelectionSummaryResult,
} from "@/features/app/measure-selection/measure-selection.service.types";
import { fetchFacilitiesBySelection } from "@/features/measure/measure-analysis.api";
import { buildMeasureSelectionSummary } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import {
  formatSelectionApiFailure,
  selectionAoiFromRing,
  selectionGeometryFromRing,
} from "@/features/selection/selection-analysis-request.service";
import { fetchSpatialAnalysisParcelsPages } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";

const MEASURE_PARCELS_PAGE_SIZE = 20_000;

function facilitiesForPerspective(
  features: FacilitiesFeatureCollection["features"],
  perspective: FacilityPerspective
): FacilitiesFeatureCollection["features"] {
  return features.filter((feature) => feature.properties.perspective === perspective);
}

export function buildEmptyMeasureSelectionSummary(
  selectionRing: readonly [number, number][]
): MeasureSelectionSummary {
  return buildMeasureSelectionSummary({
    ring: selectionRing,
    colocationFeatures: [],
    hyperscaleFeatures: [],
    parcelFeatures: [],
    parcelTruncated: false,
    parcelNextCursor: null,
  });
}

function listVisiblePerspectives(
  visiblePerspectives: PerspectiveVisibilityState
): FacilityPerspective[] {
  const perspectives: FacilityPerspective[] = [];
  if (visiblePerspectives.colocation) {
    perspectives.push("colocation");
  }
  if (visiblePerspectives.hyperscale) {
    perspectives.push("hyperscale");
  }
  return perspectives;
}

export async function queryMeasureSelectionSummary(
  args: QueryMeasureSelectionSummaryArgs
): Promise<QueryMeasureSelectionSummaryResult> {
  const perspectives = listVisiblePerspectives(args.visiblePerspectives);

  const facilitiesRequest =
    perspectives.length > 0
      ? ({
          geometry: selectionGeometryFromRing(args.selectionRing),
          perspectives,
          limitPerPerspective: 5000,
        } satisfies FacilitiesSelectionRequest)
      : null;

  const parcelsRequest = args.includeParcels
    ? ({
        aoi: selectionAoiFromRing(args.selectionRing),
        profile: "analysis_v1",
        includeGeometry: "centroid",
        pageSize: MEASURE_PARCELS_PAGE_SIZE,
        format: "json",
      } satisfies ParcelEnrichRequest)
    : null;

  const [facilitiesResult, parcelsResult] = await Promise.all([
    facilitiesRequest === null
      ? Promise.resolve<Awaited<ReturnType<typeof fetchFacilitiesBySelection>> | null>(null)
      : fetchFacilitiesBySelection(facilitiesRequest, args.signal),
    parcelsRequest === null
      ? Promise.resolve<Awaited<ReturnType<typeof fetchSpatialAnalysisParcelsPages>> | null>(null)
      : fetchSpatialAnalysisParcelsPages({
          expectedIngestionRunId: args.expectedParcelsIngestionRunId,
          request: parcelsRequest,
          signal: args.signal,
          cursorRepeatLogContext: "measure-selection",
        }),
  ]);

  if (
    (facilitiesResult !== null && !facilitiesResult.ok && facilitiesResult.reason === "aborted") ||
    (parcelsResult !== null && !parcelsResult.ok && parcelsResult.reason === "aborted")
  ) {
    return {
      ok: false,
      reason: "aborted",
    };
  }

  const errorMessages: string[] = [];

  let colocationFeatures: FacilitiesFeatureCollection["features"] = [];
  let hyperscaleFeatures: FacilitiesFeatureCollection["features"] = [];
  if (facilitiesResult !== null) {
    if (facilitiesResult.ok) {
      colocationFeatures = facilitiesForPerspective(facilitiesResult.data.features, "colocation");
      hyperscaleFeatures = facilitiesForPerspective(facilitiesResult.data.features, "hyperscale");
    } else {
      errorMessages.push(formatSelectionApiFailure("Facilities", facilitiesResult));
    }
  }

  let parcelFeatures: ParcelsFeatureCollection["features"] = [];
  let parcelTruncated = false;
  let parcelNextCursor: string | null = null;
  if (parcelsResult === null) {
    parcelFeatures = [];
  } else if (parcelsResult.ok) {
    parcelFeatures = parcelsResult.features;
    parcelTruncated = parcelsResult.truncated;
    parcelNextCursor = parcelsResult.nextCursor;
  } else {
    errorMessages.push(formatSelectionApiFailure("Parcels", parcelsResult));
  }

  return {
    ok: true,
    value: {
      errorMessage: errorMessages.length > 0 ? errorMessages.join(" ") : null,
      summary: buildMeasureSelectionSummary({
        ring: args.selectionRing,
        colocationFeatures,
        hyperscaleFeatures,
        parcelFeatures,
        parcelTruncated,
        parcelNextCursor,
      }),
    },
  };
}
