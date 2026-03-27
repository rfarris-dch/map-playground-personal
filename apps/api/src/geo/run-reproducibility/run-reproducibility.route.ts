import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type RunReproducibilityDiffRequest,
  RunReproducibilityDiffRequestSchema,
  type RunReproducibilityDiffResponse,
  RunReproducibilityDiffResponseSchema,
  type RunReproducibilityRequest,
  RunReproducibilityRequestSchema,
  type RunReproducibilityResponse,
  RunReproducibilityResponseSchema,
} from "@map-migration/http-contracts/run-reproducibility-http";
import type { Context, Env, Hono } from "hono";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import {
  queryRunReproducibility,
  queryRunReproducibilityDiff,
} from "./run-reproducibility.service";

function readRunReproducibilityRequest(c: Context): RunReproducibilityRequest {
  const parsed = RunReproducibilityRequestSchema.safeParse({
    runId: c.req.query("runId"),
    runKind: c.req.query("runKind"),
    surfaceScope: c.req.query("surfaceScope"),
  });
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_RUN_REPRODUCIBILITY_REQUEST",
      message: "invalid run reproducibility request query",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

function readRunReproducibilityDiffRequest(c: Context): RunReproducibilityDiffRequest {
  const parsed = RunReproducibilityDiffRequestSchema.safeParse({
    leftRunId: c.req.query("leftRunId"),
    rightRunId: c.req.query("rightRunId"),
    runKind: c.req.query("runKind"),
    surfaceScope: c.req.query("surfaceScope"),
  });
  if (!parsed.success) {
    throw routeError({
      httpStatus: 400,
      code: "INVALID_RUN_REPRODUCIBILITY_DIFF_REQUEST",
      message: "invalid run reproducibility diff request query",
      details: toDebugDetails(parsed.error),
    });
  }

  return parsed.data;
}

export function registerRunReproducibilityRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.runReproducibility, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = readRunReproducibilityRequest(honoContext);
        const result = await queryRunReproducibility(request);
        if (result === null) {
          throw routeError({
            httpStatus: 404,
            code: "RUN_REPRODUCIBILITY_NOT_FOUND",
            message: "run reproducibility envelope not found",
          });
        }

        const payload: RunReproducibilityResponse = {
          ...result,
          meta: buildResponseMeta({
            dataVersion: result.summary.dataVersion ?? getApiRuntimeConfig().dataVersion,
            recordCount: result.sourceSnapshots.length,
            requestId,
            sourceMode: getApiRuntimeConfig().countyIntelligenceSourceMode,
          }),
        };

        return jsonOk(honoContext, RunReproducibilityResponseSchema, payload, requestId);
      })
    )
  );

  app.get(ApiRoutes.runReproducibilityDiff, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const request = readRunReproducibilityDiffRequest(honoContext);
        const result = await queryRunReproducibilityDiff(request);
        if (result === null) {
          throw routeError({
            httpStatus: 404,
            code: "RUN_REPRODUCIBILITY_DIFF_NOT_FOUND",
            message: "one or both run reproducibility envelopes were not found",
          });
        }

        const payload: RunReproducibilityDiffResponse = {
          ...result,
          meta: buildResponseMeta({
            dataVersion:
              result.right.dataVersion ??
              result.left.dataVersion ??
              getApiRuntimeConfig().dataVersion,
            recordCount:
              result.topLevelDiffs.length +
              result.sourceSnapshotDiffs.length +
              result.inputSnapshotDiffs.length,
            requestId,
            sourceMode: getApiRuntimeConfig().countyIntelligenceSourceMode,
          }),
        };

        return jsonOk(honoContext, RunReproducibilityDiffResponseSchema, payload, requestId);
      })
    )
  );
}
