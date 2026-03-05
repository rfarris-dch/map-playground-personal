import type { ResponseMeta, Warning } from "@map-migration/contracts";
import { getApiRuntimeConfig } from "@/http/runtime-config";

export function buildFacilitiesRouteMeta(args: {
  readonly requestId: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}): ResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  return {
    requestId: args.requestId,
    sourceMode: runtimeConfig.facilitiesSourceMode,
    dataVersion: runtimeConfig.dataVersion,
    generatedAt: new Date().toISOString(),
    recordCount: args.recordCount,
    truncated: args.truncated,
    warnings: [...args.warnings],
  };
}
