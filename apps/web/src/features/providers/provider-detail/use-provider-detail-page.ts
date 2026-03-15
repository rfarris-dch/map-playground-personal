import type { ProviderTableRow } from "@map-migration/http-contracts/table-contracts";
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { fetchProvidersTable } from "@/features/providers/providers.api";

export function useProviderDetailPage() {
  const route = useRoute();

  const providerId = computed(() => {
    const value = route.params.providerId;
    return typeof value === "string" ? value : null;
  });

  const query = useQuery<ProviderTableRow | null, Error>({
    queryKey: computed(() => ["provider-detail-page", providerId.value]),
    queryFn: async ({ signal: _signal }) => {
      if (providerId.value === null) {
        throw new Error("provider id is required");
      }

      const result = await fetchProvidersTable({
        page: 1,
        pageSize: 5000,
        sortBy: "name",
        sortOrder: "asc",
      });

      if (!result.ok) {
        throw new Error(`provider table fetch failed (${result.reason})`);
      }

      const match = result.data.rows.find((row) => row.providerId === providerId.value);
      return match ?? null;
    },
    enabled: computed(() => providerId.value !== null),
  });

  const provider = computed(() => query.data.value ?? null);
  const providerName = computed(() => provider.value?.name ?? "Provider");

  return {
    providerId,
    provider,
    providerName,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export type ProviderDetailPage = ReturnType<typeof useProviderDetailPage>;
