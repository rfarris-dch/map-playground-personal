import { WarningSchema } from "@map-migration/geo-kernel/warning";
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

export interface CreateResponseMetaArgs {
  readonly dataVersion: string;
  readonly generatedAt?: string;
  readonly ingestionRunId?: string | undefined;
  readonly recordCount: number;
  readonly requestId: string;
  readonly sourceMode: SourceMode;
  readonly truncated?: boolean;
  readonly warnings?: readonly z.infer<typeof WarningSchema>[];
}

export function createResponseMeta(args: CreateResponseMetaArgs): ResponseMeta {
  return {
    requestId: args.requestId,
    sourceMode: args.sourceMode,
    dataVersion: args.dataVersion,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    recordCount: args.recordCount,
    truncated: args.truncated ?? false,
    warnings: [...(args.warnings ?? [])],
    ...(typeof args.ingestionRunId === "string" ? { ingestionRunId: args.ingestionRunId } : {}),
  };
}
