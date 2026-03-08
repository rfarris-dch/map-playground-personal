export interface LayerOrderInvariants {
  choroplethBelowColocation: readonly [string, string];
  choroplethBelowHyperscale: readonly [string, string];
  flood100BelowParcelOutlines: readonly [string, string];
  flood500BelowParcelOutlines: readonly [string, string];
  hydroLabelsBelowFacilityPoints: readonly [string, string];
  hydroLinesBelowParcelOutlines: readonly [string, string];
  modelsBelowFacilityPoints: readonly [string, string];
  parcelOutlinesAboveChoropleth: readonly [string, string];
}
