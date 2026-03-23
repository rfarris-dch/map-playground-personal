import type { Warning } from "@map-migration/geo-kernel/warning";
import type { ResponseMeta } from "@map-migration/http-contracts/api-response-meta";
import { buildResponseMeta } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

export function buildFacilitiesRouteMeta(args: {
  readonly dataVersion?: string;
  readonly datasetVersion: string;
  readonly generatedAt?: string;
  readonly requestId: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}): ResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  const generatedAtArg =
    typeof args.generatedAt === "string" ? { generatedAt: args.generatedAt } : {};

  return buildResponseMeta({
    dataVersion: args.dataVersion ?? runtimeConfig.dataVersion,
    datasetVersion: args.datasetVersion,
    recordCount: args.recordCount,
    requestId: args.requestId,
    sourceMode: runtimeConfig.facilitiesSourceMode,
    truncated: args.truncated,
    warnings: args.warnings,
    ...generatedAtArg,
  });
}
