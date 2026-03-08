import { floodLegendLabel } from "./flood-zone-classification.service";

export type FloodControlKey = "flood-100" | "flood-500";

interface FloodControlMetadata {
  readonly color: string;
  readonly description: string;
  readonly label: string;
}

const FLOOD_CONTROL_METADATA: Readonly<Record<FloodControlKey, FloodControlMetadata>> = {
  "flood-100": {
    color: "#2aa7d6",
    label: floodLegendLabel("flood-100"),
    description: "Displays the interior FEMA SFHA footprint from the shared effective NFHL source.",
  },
  "flood-500": {
    color: "#e6a23a",
    label: floodLegendLabel("flood-500"),
    description:
      "Displays the cumulative 0.2% annual chance footprint and nests under the 100-year fill when both are enabled.",
  },
};

export function floodControlMetadata(controlKey: FloodControlKey): FloodControlMetadata {
  return FLOOD_CONTROL_METADATA[controlKey];
}
