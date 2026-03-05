import type { z } from "zod";
import type {
  BoundaryPowerFeatureCollectionSchema,
  BoundaryPowerFeatureSchema,
  BoundaryPowerLevelSchema,
  BoundaryPowerPropertiesSchema,
} from "./boundaries-contracts";

export type BoundaryPowerFeatureCollection = z.infer<typeof BoundaryPowerFeatureCollectionSchema>;

export type BoundaryPowerFeature = z.infer<typeof BoundaryPowerFeatureSchema>;

export type BoundaryPowerProperties = z.infer<typeof BoundaryPowerPropertiesSchema>;

export type BoundaryPowerLevel = z.infer<typeof BoundaryPowerLevelSchema>;
