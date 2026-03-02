import { useQuery } from "@tanstack/vue-query";
import { fetchApiHealth } from "./api";
import { unwrapApiHealthResult } from "./diagnostics.service";
import type { ApiHealthQueryOptions } from "./diagnostics.types";

export function useApiHealthQuery(options: ApiHealthQueryOptions = {}) {
  const refetchIntervalMs = options.refetchIntervalMs ?? 30_000;

  return useQuery({
    queryKey: ["api-health"],
    queryFn: async () => {
      const result = await fetchApiHealth();
      return unwrapApiHealthResult(result);
    },
    refetchInterval: refetchIntervalMs,
  });
}
