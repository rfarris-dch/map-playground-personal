<script setup lang="ts">
  import { onErrorCaptured, ref } from "vue";

  const caughtError = ref<Error | null>(null);

  onErrorCaptured((err) => {
    caughtError.value = err instanceof Error ? err : new Error(String(err));
    console.error("[error-boundary]", err);
    return false;
  });

  function reload() {
    window.location.reload();
  }
</script>

<template>
  <div v-if="caughtError" class="flex h-full items-center justify-center bg-card p-8">
    <div class="flex max-w-md flex-col items-center gap-4 text-center">
      <h1 class="text-lg font-semibold text-foreground">Something went wrong</h1>
      <p class="text-sm text-muted-foreground">{{ caughtError.message }}</p>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        @click="reload"
      >
        Reload
      </button>
    </div>
  </div>
  <slot v-else />
</template>
