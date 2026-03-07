import type { z } from "zod";
import type {
  MapContextHighlightTargetSchema,
  MapContextSurfaceSchema,
  MapContextTransferSchema,
  MapContextViewportSchema,
} from "./map-context-transfer-contracts";

export type MapContextSurface = z.infer<typeof MapContextSurfaceSchema>;

export type MapContextViewport = z.infer<typeof MapContextViewportSchema>;

export type MapContextHighlightTarget = z.infer<typeof MapContextHighlightTargetSchema>;

export type MapContextTransfer = z.infer<typeof MapContextTransferSchema>;
