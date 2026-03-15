<script setup lang="ts">
  import ProviderDetailPageContent from "@/features/providers/provider-detail/provider-detail-page-content.vue";
  import { useProviderDetailPage } from "@/features/providers/provider-detail/use-provider-detail-page";

  const page = useProviderDetailPage();
</script>

<template>
  <ProviderDetailPageContent
    :provider-id="page.providerId.value"
    :provider="page.provider.value"
    :provider-name="page.providerName.value"
    :is-loading="page.isLoading.value"
    :is-error="page.isError.value"
  />
</template>
