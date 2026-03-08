import type { IMap } from "@map-migration/map-engine";
import type { Ref, ShallowRef } from "vue";
import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";

export interface UseMapOverlaysScannerMarketsOptions {
  readonly map: ShallowRef<IMap | null>;
  readonly scannerFetchEnabled: Readonly<Ref<boolean>>;
}

export interface UseMapOverlaysScannerMarketsResult {
  readonly scannerMarketSelection: ShallowRef<
    NonNullable<SpatialAnalysisPanelSummary["marketSelection"]>
  >;
}
