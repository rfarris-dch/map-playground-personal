export interface HydroBasinsControlMetadata {
  readonly color: string;
  readonly description: string;
  readonly label: string;
}

const HYDRO_BASINS_CONTROL_METADATA: HydroBasinsControlMetadata = {
  color: "#6c6486",
  label: "Hydro basins",
  description:
    "Displays one stable basin partition with persistent fills, outlines, and labels across zoom levels.",
};

export function hydroBasinsControlMetadata(): HydroBasinsControlMetadata {
  return HYDRO_BASINS_CONTROL_METADATA;
}
