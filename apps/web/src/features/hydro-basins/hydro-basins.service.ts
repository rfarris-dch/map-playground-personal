export interface HydroBasinsControlMetadata {
  readonly color: string;
  readonly description: string;
  readonly label: string;
}

const HYDRO_BASINS_CONTROL_METADATA: HydroBasinsControlMetadata = {
  color: "#6c6486",
  label: "Hydro basins (detail increases with zoom)",
  description:
    "Displays WBD-style HUC boundaries and basin labels from one shared vector source. Granularity shifts from HUC4 to HUC12 by zoom.",
};

export function hydroBasinsControlMetadata(): HydroBasinsControlMetadata {
  return HYDRO_BASINS_CONTROL_METADATA;
}
