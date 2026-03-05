import type {
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
  FacilityPerspective,
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/contracts";
import type { PerspectiveVisibilityState } from "@/features/app/app-shell.types";
import { fetchFacilitiesBySelection } from "@/features/measure/measure-analysis.api";
import { buildMeasureSelectionSummary } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import { fetchSpatialAnalysisParcelsPages } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";
import type {
  QueryMeasureSelectionSummaryArgs,
  QueryMeasureSelectionSummaryResult,
} from "./measure-selection.service.types";

const MEASURE_PARCELS_PAGE_SIZE = 20_000;

function selectionGeometryFromRing(
  ring: readonly [number, number][]
): FacilitiesSelectionRequest["geometry"] {
  return {
    type: "Polygon",
    coordinates: [ring.map((vertex) => [vertex[0], vertex[1]])],
  };
}

function selectionAoiFromRing(ring: readonly [number, number][]): ParcelEnrichRequest["aoi"] {
  return {
    type: "polygon",
    geometry: {
      type: "Polygon",
      coordinates: [ring.map((vertex) => [vertex[0], vertex[1]])],
    },
  };
}

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

  const parcelsRequest: ParcelEnrichRequest = {
    aoi: selectionAoiFromRing(args.selectionRing),
    profile: "analysis_v1",
    includeGeometry: "centroid",
    pageSize: MEASURE_PARCELS_PAGE_SIZE,
    format: "json",
  };

  const [facilitiesResult, parcelsResult] = await Promise.all([
    facilitiesRequest === null
      ? Promise.resolve<Awaited<ReturnType<typeof fetchFacilitiesBySelection>> | null>(null)
      : fetchFacilitiesBySelection(facilitiesRequest, args.signal),
    fetchSpatialAnalysisParcelsPages({
      request: parcelsRequest,
      signal: args.signal,
      cursorRepeatLogContext: "measure-selection",
    }),
  ]);

  if (
    (facilitiesResult !== null && !facilitiesResult.ok && facilitiesResult.reason === "aborted") ||
    (!parcelsResult.ok && parcelsResult.reason === "aborted")
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
      errorMessages.push(`Facilities query failed (${facilitiesResult.reason}).`);
    }
  }

  let parcelFeatures: ParcelsFeatureCollection["features"] = [];
  let parcelTruncated = false;
  let parcelNextCursor: string | null = null;
  if (parcelsResult.ok) {
    parcelFeatures = parcelsResult.features;
    parcelTruncated = parcelsResult.truncated;
    parcelNextCursor = parcelsResult.nextCursor;
  } else {
    errorMessages.push(`Parcels query failed (${parcelsResult.reason}).`);
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
