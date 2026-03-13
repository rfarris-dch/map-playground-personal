import { isPipelineDataset, PipelineStatusResponseSchema } from "@map-migration/contracts";
import type { Env, Hono } from "hono";
import { jsonOk, toDebugDetails } from "@/http/api-response";
import { fromApiRequest, routeError, runEffectRoute } from "@/http/effect-route";
import { getPipelineStatusResponse } from "./pipeline-status.service";

export function registerPipelineStatusRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/pipelines/:dataset/status", (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId }) => {
        const dataset = honoContext.req.param("dataset");
        if (!isPipelineDataset(dataset)) {
          throw routeError({
            httpStatus: 404,
            code: "PIPELINE_DATASET_NOT_FOUND",
            message: "pipeline dataset not found",
            details: {
              dataset,
            },
          });
        }

        try {
          const statusSnapshot = await getPipelineStatusResponse(dataset);
          return jsonOk(honoContext, PipelineStatusResponseSchema, statusSnapshot, requestId);
        } catch (error) {
          throw routeError({
            httpStatus: 503,
            code: "PIPELINE_STATUS_REFRESH_FAILED",
            message: "pipeline status refresh failed",
            details: toDebugDetails(error),
          });
        }
      })
    )
  );
}
