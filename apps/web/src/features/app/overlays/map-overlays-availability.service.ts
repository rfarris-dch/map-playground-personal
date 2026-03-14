import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts";
import type {
  PerspectiveStatusState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import { resolveMapOverlaysBlockedReason } from "@/features/app/overlays/map-overlays.service";
import { buildScannerSummary } from "@/features/scanner/scanner.service";

export function resolveQuickViewDisabledReason(args: {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly facilitiesStatus: PerspectiveStatusState;
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly visiblePerspectives: PerspectiveVisibilityState;
}): string | null {
  const blockedReason = resolveMapOverlaysBlockedReason({
    visiblePerspectives: args.visiblePerspectives,
    facilitiesStatus: args.facilitiesStatus,
  });
  if (blockedReason !== null) {
    return blockedReason;
  }

  const parcelSummary = buildScannerSummary({
    colocationFeatures: args.colocationFeatures,
    hyperscaleFeatures: args.hyperscaleFeatures,
    parcelFeatures: [],
    parcelTruncated: false,
    parcelNextCursor: null,
  });
  return parcelSummary.totalCount === 0 ? "No facilities in the current viewport." : null;
}
