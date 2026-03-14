import type { Warning } from "@map-migration/geo-kernel/warning";
import type { ResponseMeta } from "@map-migration/http-contracts/api-response-meta";
import { buildResponseMeta } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

export function buildFacilitiesRouteMeta(args: {
  readonly requestId: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}): ResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  return buildResponseMeta({
    dataVersion: runtimeConfig.dataVersion,
    recordCount: args.recordCount,
    requestId: args.requestId,
    sourceMode: runtimeConfig.facilitiesSourceMode,
    truncated: args.truncated,
    warnings: args.warnings,
  });
}
