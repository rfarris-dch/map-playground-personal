import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type LaunchPolicyResponse,
  LaunchPolicyResponseSchema,
} from "@map-migration/http-contracts/launch-policy-http";
import type { Env, Hono } from "hono";
import { getLaunchPolicyConfig } from "@/geo/launch-policy/launch-policy.service";
import { jsonOk } from "@/http/api-response";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";
import { buildResponseMeta } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

const LAUNCH_POLICY_DATA_VERSION = "launch-policy-v1-2026-03-26";

export function registerLaunchPolicyRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.launchPolicy, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(({ honoContext, requestId }) => {
        const policy = getLaunchPolicyConfig();
        const payload: LaunchPolicyResponse = {
          ...policy,
          meta: buildResponseMeta({
            dataVersion: LAUNCH_POLICY_DATA_VERSION,
            recordCount: policy.validatedCorridorMarkets.length,
            requestId,
            sourceMode: getApiRuntimeConfig().countyIntelligenceSourceMode,
          }),
        };

        return jsonOk(honoContext, LaunchPolicyResponseSchema, payload, requestId);
      })
    )
  );
}
