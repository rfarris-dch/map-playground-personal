<script setup lang="ts">
  import PipelineDashboard from "@/features/pipeline/components/pipeline-dashboard.vue";
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
    <header class="mb-5">
      <h1 class="m-0 text-2xl font-semibold tracking-tight">Parcels Pipeline Monitor</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Live status for extraction, canonical load/swap, PMTiles build, and publish.
      </p>
    </header>

    <PipelineDashboard />
  </main>
</template>
