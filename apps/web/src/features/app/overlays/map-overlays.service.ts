import type { ParcelEnrichRequest } from "@map-migration/contracts";
import type {
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import type {
  BuildFacilityAnchorParcelRequestsArgs,
  FacilityAnchorCandidate,
} from "@/features/app/overlays/map-overlays.service.types";
import type { MapBounds, MapOverlaysQueryState } from "@/features/app/overlays/map-overlays.types";
import type { FacilitiesStatus } from "@/features/facilities/facilities.types";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeLongitude(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function readPointCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const lng = value[0];
  const lat = value[1];
  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    typeof lat !== "number" ||
    !Number.isFinite(lat)
  ) {
    return null;
  }

  return [lng, lat];
}

function readBooleanSearchParam(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const value = new URLSearchParams(window.location.search).get(key);
  return value === "true" || value === "1";
}

function isZoomHiddenStatus(
  status: FacilitiesStatus
): status is Extract<FacilitiesStatus, { state: "hidden" }> {
  return status.state === "hidden";
}

function isParcelsHiddenStatus(
  status: ParcelsStatus
): status is Extract<ParcelsStatus, { state: "hidden" }> {
  return status.state === "hidden";
}

export function resolveMapOverlaysBlockedReason(args: {
  readonly facilitiesStatus: PerspectiveStatusState;
  readonly visiblePerspectives: PerspectiveVisibilityState;
}): string | null {
  const visibleStatuses: FacilitiesStatus[] = [];
  if (args.visiblePerspectives.colocation) {
    visibleStatuses.push(args.facilitiesStatus.colocation);
  }

  if (args.visiblePerspectives.hyperscale) {
    visibleStatuses.push(args.facilitiesStatus.hyperscale);
  }

  if (visibleStatuses.length === 0) {
    return "Enable a facility layer to use scanner and quick view.";
  }

  const hiddenStatuses = visibleStatuses.filter((status) => isZoomHiddenStatus(status));
  if (hiddenStatuses.length !== visibleStatuses.length) {
    return null;
  }

  const requiredMinZoom = hiddenStatuses.reduce((maxMinZoom, status) => {
    return Math.max(maxMinZoom, status.minZoom);
  }, 0);

  return `Zoom in to at least ${requiredMinZoom.toFixed(1)} to load facilities.`;
}

export function resolveScannerParcelsBlockedReason(status: ParcelsStatus): string | null {
  if (!isParcelsHiddenStatus(status)) {
    return null;
  }

  if (status.reason === "stress") {
    return "Parcels are temporarily blocked in the current viewport.";
  }

  return "Zoom in to load parcels in the current viewport.";
}

export function readMapOverlaysQueryState(): MapOverlaysQueryState {
  return {
    quickView: readBooleanSearchParam("quickView"),
    scanner: readBooleanSearchParam("scanner"),
  };
}

export function writeMapOverlaysQueryState(state: MapOverlaysQueryState): void {
  if (typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);
  if (state.quickView) {
    currentUrl.searchParams.set("quickView", "true");
  } else {
    currentUrl.searchParams.delete("quickView");
  }

  if (state.scanner) {
    currentUrl.searchParams.set("scanner", "true");
  } else {
    currentUrl.searchParams.delete("scanner");
  }

  const nextHref = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState(window.history.state, "", nextHref);
}

export function buildCenterLimitedBbox(bounds: MapBounds): MapBounds {
  const eastUnwrapped = bounds.east < bounds.west ? bounds.east + 360 : bounds.east;
  const centerLngUnwrapped = (bounds.west + eastUnwrapped) / 2;
  const centerLat = (bounds.north + bounds.south) / 2;
  const halfLngSpan = Math.min((eastUnwrapped - bounds.west) / 2, 0.75);
  const halfLatSpan = Math.min((bounds.north - bounds.south) / 2, 0.75);

  const west = normalizeLongitude(centerLngUnwrapped - halfLngSpan);
  const east = normalizeLongitude(centerLngUnwrapped + halfLngSpan);
  const south = clampNumber(centerLat - halfLatSpan, -89.9, 89.9);
  const north = clampNumber(centerLat + halfLatSpan, -89.9, 89.9);

  return {
    west,
    south,
    east,
    north,
  };
}

export function buildMapOverlaysFetchKey(
  bounds: MapBounds,
  expectedIngestionRunId: string | null
): string {
  const ingestionRunSegment =
    typeof expectedIngestionRunId === "string" ? expectedIngestionRunId : "unversioned";
  return `${bounds.west.toFixed(3)},${bounds.south.toFixed(3)},${bounds.east.toFixed(3)},${bounds.north.toFixed(3)}:${ingestionRunSegment}`;
}

export function buildFacilityAnchorParcelRequests(
  args: BuildFacilityAnchorParcelRequestsArgs
): readonly ParcelEnrichRequest[] {
  const anchorCandidates = [...args.colocationFeatures, ...args.hyperscaleFeatures]
    .map<FacilityAnchorCandidate | null>((feature) => {
      const coordinates = readPointCoordinates(feature.geometry.coordinates);
      if (coordinates === null) {
        return null;
      }

      return {
        lng: coordinates[0],
        lat: coordinates[1],
        score:
          typeof feature.properties.commissionedPowerMw === "number"
            ? feature.properties.commissionedPowerMw
            : 0,
      };
    })
    .filter((candidate): candidate is FacilityAnchorCandidate => candidate !== null);

  anchorCandidates.sort((left, right) => right.score - left.score);
  const selectedAnchors = anchorCandidates.slice(0, 4);
  return selectedAnchors.map((anchor) => {
    const west = clampNumber(anchor.lng - 0.08, -179.9, 179.9);
    const east = clampNumber(anchor.lng + 0.08, -179.9, 179.9);
    const south = clampNumber(anchor.lat - 0.08, -89.9, 89.9);
    const north = clampNumber(anchor.lat + 0.08, -89.9, 89.9);

    return {
      aoi: {
        type: "bbox",
        bbox: { west, south, east, north },
      },
      profile: "analysis_v1",
      includeGeometry: "centroid",
      pageSize: args.pageSize,
      format: "json",
    };
  });
}
