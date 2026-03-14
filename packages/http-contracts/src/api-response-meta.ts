import { WarningSchema } from "@map-migration/geo-kernel";
import { z } from "zod";

export const SourceModeSchema = z.enum(["pmtiles", "postgis", "arcgis-proxy", "external-xyz"]);
export type SourceMode = z.infer<typeof SourceModeSchema>;

export const ResponseMetaSchema = z.object({
  requestId: z.string().min(1),
  sourceMode: SourceModeSchema,
  dataVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  recordCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(WarningSchema).default([]),
  ingestionRunId: z.string().optional(),
});

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;
