import type {
  MapLayerControlsPanelEmits,
  MapLayerControlsPanelProps,
} from "@/features/app/components/map-layer-controls-panel.types";
import type {
  MapMeasureToolsEmits,
  MapMeasureToolsProps,
} from "@/features/app/components/map-measure-tools.types";
import type {
  MapOverlayActionsEmits,
  MapOverlayActionsProps,
} from "@/features/app/components/map-overlay-actions.types";

export interface MapPageControlsProps
  extends MapLayerControlsPanelProps,
    MapMeasureToolsProps,
    MapOverlayActionsProps {}

export interface MapPageControlsEmits
  extends Omit<MapLayerControlsPanelEmits, "toggle-panel">,
    Omit<MapMeasureToolsEmits, "toggle-panel">,
    MapOverlayActionsEmits {
  "toggle-layer-panel": [];
  "toggle-measure-panel": [];
}
