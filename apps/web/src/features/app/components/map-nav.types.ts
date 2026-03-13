export type MapNavIconName =
  | "bubbles"
  | "chevron-left"
  | "clusters"
  | "dots"
  | "eye"
  | "filter"
  | "heatmap"
  | "icons"
  | "layers";

export type MapNavViewModeId = "bubbles" | "clusters" | "dots" | "heatmap" | "icons";

export interface MapNavViewMode {
  readonly icon: MapNavIconName;
  readonly id: MapNavViewModeId;
  readonly label: string;
  readonly state: "active" | "inactive";
}
