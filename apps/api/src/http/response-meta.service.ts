import type { Warning } from "@map-migration/geo-kernel/warning";
import type { ResponseMeta, SourceMode } from "@map-migration/http-contracts/api-response-meta";
import type { Context } from "hono";

export function buildResponseMeta(args: {
  readonly dataVersion: string;
  readonly datasetVersion?: string | undefined;
  readonly generatedAt?: string;
  readonly recordCount: number;
  readonly requestId: string;
  readonly sourceMode: SourceMode;
  readonly truncated?: boolean;
  readonly warnings?: readonly Warning[];
}): ResponseMeta {
  return {
    dataVersion: args.dataVersion,
    ...(typeof args.datasetVersion === "string" ? { datasetVersion: args.datasetVersion } : {}),
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    recordCount: args.recordCount,
    requestId: args.requestId,
    sourceMode: args.sourceMode,
    truncated: args.truncated ?? false,
    warnings: [...(args.warnings ?? [])],
  };
}

export function setCacheControlHeader(c: Context, ttlSeconds: number): void {
  if (ttlSeconds > 0) {
    c.header("Cache-Control", `public, max-age=${String(ttlSeconds)}`);
  }
}
