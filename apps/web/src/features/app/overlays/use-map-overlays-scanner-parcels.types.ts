import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import type { IMap } from "@map-migration/map-engine";
import type { Ref, ShallowRef } from "vue";
import type { MapInteractionCoordinator } from "@/features/app/interaction/map-interaction.types";
import type { MapBounds } from "@/features/app/overlays/map-overlays.types";

export interface UseMapOverlaysScannerParcelsOptions {
  readonly colocationViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly hyperscaleViewportFeatures: ShallowRef<FacilitiesFeatureCollection["features"]>;
  readonly interactionCoordinator: ShallowRef<MapInteractionCoordinator | null>;
  readonly map: ShallowRef<IMap | null>;
  readonly scannerActive: ShallowRef<boolean>;
  readonly scannerFetchEnabled: Readonly<Ref<boolean>>;
}

export interface ScannerParcelsRefreshScope {
  readonly mapBounds: MapBounds;
}

export interface ScannerParcelsSelection {
  readonly features: ParcelsFeatureCollection["features"];
  readonly nextCursor: string | null;
  readonly truncated: boolean;
}

export interface ScannerAnchorSelectionAccumulator {
  nextCursor: string | null;
  readonly parcelById: Map<string, ParcelsFeatureCollection["features"][number]>;
  truncated: boolean;
}

export interface ScannerAnchorSelectionArgs {
  readonly anchorRequests: readonly ParcelEnrichRequest[];
  readonly nextCursor: string | null;
  readonly selection: ScannerParcelsSelection;
}
