import type {
  MapLayerControlsPanelEmits,
  MapLayerControlsPanelProps,
} from "@/features/app/components/map-layer-controls-panel.types";
import type { MapOverlayActionsEmits } from "@/features/app/components/map-overlay-actions.types";
import type {
  MapSelectionToolsEmits,
  MapSelectionToolsProps,
} from "@/features/app/components/map-selection-tools.types";
import type {
  MapSketchMeasureToolsEmits,
  MapSketchMeasureToolsProps,
} from "@/features/app/components/map-sketch-measure-tools.types";
import type { SelectionToolProgress } from "@/features/selection-tool/selection-tool.types";

export interface MapPageControlsProps
  extends MapLayerControlsPanelProps,
    MapSelectionToolsProps,
    MapSketchMeasureToolsProps {
  readonly overlaysBlockedReason: string | null;
  readonly quickViewActive: boolean;
  readonly quickViewDisabledReason: string | null;
  readonly scannerActive: boolean;
  readonly selectionDisabledReason: string | null;
  readonly selectionProgress: SelectionToolProgress | null;
}

export interface MapPageControlsEmits
  extends Omit<MapLayerControlsPanelEmits, "toggle-panel">,
    MapSelectionToolsEmits,
    MapSketchMeasureToolsEmits,
    MapOverlayActionsEmits {
  "toggle-layer-panel": [];
}
