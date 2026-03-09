import { createBrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { onBeforeUnmount, onMounted } from "vue";
import { createFetchPipelineStatusEffect } from "@/features/pipeline/pipeline.service";
import type { PipelineStatusController } from "@/features/pipeline/pipeline.types";
import { createPipelineStatusController } from "./pipeline.view.service";

export function usePipelineStatus(): PipelineStatusController {
  const controllerInstance = createPipelineStatusController({
    clearInterval,
    clearTimeout,
    fetchPipelineStatus: () => createFetchPipelineStatusEffect(),
    now: () => Date.now(),
    runtime: createBrowserEffectRuntime(),
    setInterval,
    setTimeout,
  });

  onMounted(() => {
    controllerInstance.start();
  });

  onBeforeUnmount(() => {
    controllerInstance.destroy().catch((error) => {
      console.error("[pipeline-monitor] controller teardown failed", error);
    });
  });

  return controllerInstance.controller;
}
