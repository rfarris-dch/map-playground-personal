/**
 * Pipeline / ETL status contracts.
 *
 * Now composes generic SyncStatusResponseSchema from sync-run-http
 * instead of depending on parcels-http (which reversed the dependency).
 */
import { z } from "zod";
import { SyncStatusResponseSchema } from "./sync-run-http.js";

export const PipelineDatasetSchema = z.enum(["parcels", "flood", "hydro-basins"]);
export const PipelineDatasetFamilySchema = z.enum(["parcels", "environmental"]);

export const PipelinePlatformSchema = z.object({
  orchestration: z.literal("dagster"),
  canonicalStore: z.literal("postgis"),
  tileBuild: z.literal("planetiler"),
  tileServe: z.literal("martin"),
  tilePublish: z.literal("pmtiles-cdn"),
});

export const PipelineDatasetDescriptorSchema = z.object({
  dataset: PipelineDatasetSchema,
  family: PipelineDatasetFamilySchema,
  storageDataset: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  syncCommand: z.string().min(1),
  assetChain: z.array(z.string().min(1)).min(1),
});

export const PipelineStatusResponseSchema = SyncStatusResponseSchema.extend({
  dataset: PipelineDatasetDescriptorSchema,
  platform: PipelinePlatformSchema,
});

export type PipelineDataset = z.infer<typeof PipelineDatasetSchema>;
export type PipelineDatasetFamily = z.infer<typeof PipelineDatasetFamilySchema>;
export type PipelinePlatform = z.infer<typeof PipelinePlatformSchema>;
export type PipelineDatasetDescriptor = z.infer<typeof PipelineDatasetDescriptorSchema>;
export type PipelineStatusResponse = z.infer<typeof PipelineStatusResponseSchema>;

export const PIPELINE_PLATFORM: PipelinePlatform = Object.freeze({
  orchestration: "dagster",
  canonicalStore: "postgis",
  tileBuild: "planetiler",
  tileServe: "martin",
  tilePublish: "pmtiles-cdn",
});

export const PIPELINE_DATASETS = Object.freeze<Record<PipelineDataset, PipelineDatasetDescriptor>>({
  parcels: {
    dataset: "parcels",
    family: "parcels",
    storageDataset: "parcels",
    displayName: "Parcels",
    description: "Extraction, canonical load, PMTiles build, and publish for parcel coverage.",
    syncCommand: "bun run sync:parcels",
    assetChain: [
      "raw_parcel_extract",
      "canonical_parcels",
      "parcel_tilesource",
      "parcel_pmtiles",
      "parcel_manifest_publish",
      "validate",
    ],
  },
  flood: {
    dataset: "flood",
    family: "environmental",
    storageDataset: "environmental-flood",
    displayName: "Flood",
    description: "FEMA flood normalization, canonical load, PMTiles build, and publish.",
    syncCommand: "bun run sync:environmental-flood",
    assetChain: [
      "raw_fema_extract",
      "canonical_flood_hazard",
      "flood100_tilesource",
      "flood500_tilesource",
      "flood_pmtiles",
      "flood_manifest_publish",
      "validate",
    ],
  },
  "hydro-basins": {
    dataset: "hydro-basins",
    family: "environmental",
    storageDataset: "environmental-hydro-basins",
    displayName: "Hydro Basins",
    description: "Hydro basin normalization, canonical load, PMTiles build, and publish.",
    syncCommand: "bun run sync:environmental-hydro-basins",
    assetChain: [
      "raw_hydro_source",
      "canonical_huc_polygons",
      "hydro_tilesource",
      "hydro_pmtiles",
      "hydro_manifest_publish",
      "validate",
    ],
  },
});

export function isPipelineDataset(value: string | null | undefined): value is PipelineDataset {
  return value === "parcels" || value === "flood" || value === "hydro-basins";
}

export function getPipelineDatasetDescriptor(dataset: PipelineDataset): PipelineDatasetDescriptor {
  return PIPELINE_DATASETS[dataset];
}
