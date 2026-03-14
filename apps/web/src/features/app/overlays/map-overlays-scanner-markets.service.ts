import type {
  MarketSelectionResponse,
  MarketsSelectionRequest,
} from "@map-migration/http-contracts/markets-selection-http";
import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";
import type { MapBounds } from "./map-overlays.types";

type ScannerMarketSelectionSummary = NonNullable<SpatialAnalysisPanelSummary["marketSelection"]>;

const SCANNER_MARKETS_LIMIT = 25;

export function buildEmptyScannerMarketSelectionSummary(
  unavailableReason: string | null = null
): ScannerMarketSelectionSummary {
  return {
    markets: [],
    matchCount: 0,
    minimumSelectionOverlapPercent: 0,
    primaryMarket: null,
    selectionAreaSqKm: 0,
    unavailableReason,
  };
}

export function buildScannerMarketsRequest(mapBounds: MapBounds): MarketsSelectionRequest | null {
  if (mapBounds.east < mapBounds.west) {
    return null;
  }

  return {
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [mapBounds.west, mapBounds.south],
          [mapBounds.east, mapBounds.south],
          [mapBounds.east, mapBounds.north],
          [mapBounds.west, mapBounds.north],
          [mapBounds.west, mapBounds.south],
        ],
      ],
    },
    limit: SCANNER_MARKETS_LIMIT,
    minimumSelectionOverlapPercent: 0,
  };
}

export function buildScannerMarketSelectionSummary(
  response: MarketSelectionResponse
): ScannerMarketSelectionSummary {
  return {
    markets: response.matchedMarkets,
    matchCount: response.selection.matchCount,
    minimumSelectionOverlapPercent: response.selection.minimumSelectionOverlapPercent,
    primaryMarket: response.primaryMarket,
    selectionAreaSqKm: response.selection.selectionAreaSqKm,
    unavailableReason: null,
  };
}
