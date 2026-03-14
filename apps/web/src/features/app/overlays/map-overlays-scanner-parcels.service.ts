import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import type { MapBounds } from "./map-overlays.types";
import type {
  ScannerAnchorSelectionAccumulator,
  ScannerParcelsSelection,
} from "./use-map-overlays-scanner-parcels.types";

const SCANNER_PARCELS_PAGE_SIZE = 20_000;

export function createScannerBboxRequest(mapBounds: MapBounds): ParcelEnrichRequest {
  return {
    aoi: {
      type: "bbox",
      bbox: mapBounds,
    },
    profile: "analysis_v1",
    includeGeometry: "centroid",
    pageSize: SCANNER_PARCELS_PAGE_SIZE,
    format: "json",
  };
}

export function createScannerAnchorRequests(args: {
  readonly buildFacilityAnchorParcelRequests: (args: {
    readonly colocationFeatures: FacilitiesFeatureCollection["features"];
    readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
    readonly pageSize: number;
  }) => readonly ParcelEnrichRequest[];
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
}): readonly ParcelEnrichRequest[] {
  return args.buildFacilityAnchorParcelRequests({
    colocationFeatures: args.colocationFeatures,
    hyperscaleFeatures: args.hyperscaleFeatures,
    pageSize: SCANNER_PARCELS_PAGE_SIZE,
  });
}

export function createScannerAnchorAccumulator(args: {
  readonly nextCursor: string | null;
  readonly selection: ScannerParcelsSelection;
}): ScannerAnchorSelectionAccumulator {
  return {
    parcelById: new Map<string, ParcelsFeatureCollection["features"][number]>(),
    truncated: args.selection.truncated,
    nextCursor: args.nextCursor,
  };
}

export function appendScannerAnchorFeatures(
  parcelById: Map<string, ParcelsFeatureCollection["features"][number]>,
  features: ParcelsFeatureCollection["features"]
): void {
  for (const feature of features) {
    parcelById.set(feature.properties.parcelId, feature);
  }
}

export function mergeScannerAnchorCursor(
  currentCursor: string | null,
  incomingCursor: string | null
): string | null {
  if (currentCursor === null && incomingCursor !== null) {
    return incomingCursor;
  }

  return currentCursor;
}

export function buildScannerSelectionFromAccumulator(args: {
  readonly accumulator: ScannerAnchorSelectionAccumulator;
  readonly selection: ScannerParcelsSelection;
}): ScannerParcelsSelection {
  if (args.accumulator.parcelById.size === 0) {
    return args.selection;
  }

  return {
    features: [...args.accumulator.parcelById.values()],
    truncated: args.accumulator.truncated,
    nextCursor: args.accumulator.truncated ? args.accumulator.nextCursor : null,
  };
}
