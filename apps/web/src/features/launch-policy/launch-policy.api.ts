import { apiRequestJson } from "@map-migration/core-runtime/api";
import { buildLaunchPolicyRoute } from "@map-migration/http-contracts/api-routes";
import { LaunchPolicyResponseSchema } from "@map-migration/http-contracts/launch-policy-http";
import type { LaunchPolicyFetchResult } from "./launch-policy.types";

export function fetchLaunchPolicy(init: RequestInit = {}): Promise<LaunchPolicyFetchResult> {
  return apiRequestJson(buildLaunchPolicyRoute(), LaunchPolicyResponseSchema, init);
}
