import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { TileDataset, TilePublishManifest } from "@map-migration/geo-tiles";
import type { MapExpression } from "@map-migration/map-engine";
import type { MapInteractionCoordinator } from "@/features/app/interaction/map-interaction.types";

export type { TileDataset, TilePublishManifest } from "@map-migration/geo-tiles";

export interface SelectedParcelRef {
  readonly expectedIngestionRunId?: string;
  readonly parcelId: string;
}

export type ParcelsGuardrailReason = "stress" | "tile-cap" | "viewport-span";

export interface ParcelsGuardrailResult {
  readonly blocked: boolean;
  readonly predictedTileCount: number;
  readonly reason: ParcelsGuardrailReason | null;
  readonly viewportWidthKm: number;
}

export type ParcelsStatus =
  | { readonly state: "idle" }
  | { readonly state: "loading-manifest" }
  | {
      readonly state: "ready";
      readonly dataset: TileDataset;
      readonly ingestionRunId?: string;
      readonly predictedTileCount: number;
      readonly version: string;
      readonly viewportWidthKm: number;
    }
  | {
      readonly state: "hidden";
      readonly ingestionRunId?: string;
      readonly predictedTileCount: number;
      readonly reason: ParcelsGuardrailReason;
      readonly viewportWidthKm: number;
    }
  | {
      readonly state: "error";
      readonly reason: string;
    };

export interface ParcelsViewportFacets {
  readonly acresMax: number | null;
  readonly acresMin: number | null;
  readonly distTransmissionMax: number | null;
  readonly distTransmissionMin: number | null;
  readonly floodZones: ReadonlySet<string>;
  readonly zoningTypes: ReadonlySet<string>;
}

export interface ParcelsLayerOptions {
  readonly disableGuardrails?: boolean;
  readonly interactionCoordinator?: MapInteractionCoordinator | null;
  readonly isInteractionEnabled?: () => boolean;
  readonly manifestPath?: string;
  readonly maxPredictedTiles?: number;
  readonly maxTilePredictionZoom?: number;
  readonly maxViewportWidthKm?: number;
  readonly onSelectParcel?: (parcel: SelectedParcelRef | null) => void;
  readonly onStatus?: (status: ParcelsStatus) => void;
  readonly onViewportFacets?: (facets: ParcelsViewportFacets) => void;
  readonly sourceLayer?: string;
}

export interface ParcelsLayerController {
  clearSelection(): void;
  destroy(): void;
  setFilter(filter: MapExpression | null): void;
  setVisible(visible: boolean): void;
}

export interface ParcelsLayerState {
  destroyed: boolean;
  guardrail: ParcelsGuardrailResult | null;
  manifest: TilePublishManifest | null;
  ready: boolean;
  selectedFeatureId: number | string | null;
  selectedParcelId: string | null;
  sourceInitializationPromise: Promise<void> | null;
  sourceInitialized: boolean;
  stressBlocked: boolean;
  visible: boolean;
}

export interface EvaluateParcelsGuardrailsArgs {
  readonly bounds: BBox;
  readonly isStressBlocked: boolean;
  readonly maxPredictedTiles: number;
  readonly maxTilePredictionZoom: number;
  readonly maxViewportWidthKm: number;
  readonly zoom: number;
}
