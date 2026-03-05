export interface LayerOrderInvariants {
  choroplethBelowColocation: readonly [string, string];
  choroplethBelowHyperscale: readonly [string, string];
  modelsBelowFacilityPoints: readonly [string, string];
  parcelOutlinesAboveChoropleth: readonly [string, string];
}
