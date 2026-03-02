import { ApiRoutes, HealthSchema } from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { ApiHealthResult } from "./diagnostics.types";

export function fetchApiHealth(): Promise<ApiHealthResult> {
  return apiGetJson(ApiRoutes.health, HealthSchema);
}
