import type { BBox } from "@map-migration/contracts";
import type { TileDataset, TilePublishManifest } from "@map-migration/geo-tiles";

export type { TileDataset, TileManifestEntry, TilePublishManifest } from "@map-migration/geo-tiles";

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

export interface ParcelsLayerOptions {
  readonly disableGuardrails?: boolean;
  readonly isInteractionEnabled?: () => boolean;
  readonly manifestPath?: string;
  readonly maxPredictedTiles?: number;
  readonly maxTilePredictionZoom?: number;
  readonly maxViewportWidthKm?: number;
  readonly onSelectParcel?: (parcel: SelectedParcelRef | null) => void;
  readonly onStatus?: (status: ParcelsStatus) => void;
  readonly sourceLayer?: string;
}

export interface ParcelsLayerController {
  clearSelection(): void;
  destroy(): void;
  setFilter(filter: import("@map-migration/map-engine").MapExpression | null): void;
  setVisible(visible: boolean): void;
}

export interface ParcelsLayerState {
  destroyed: boolean;
  guardrail: ParcelsGuardrailResult | null;
  hoverFeatureId: number | string | null;
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
