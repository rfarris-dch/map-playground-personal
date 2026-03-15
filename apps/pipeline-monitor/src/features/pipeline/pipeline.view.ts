import { createBrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { onBeforeUnmount, onMounted } from "vue";
import { createFetchPipelineStatusEffect } from "@/features/pipeline/pipeline.service";
import type {
  PipelineDataset,
  PipelineLiveSample,
  PipelineStatusController,
} from "@/features/pipeline/pipeline.types";
import { createPipelineStatusController } from "./pipeline.view.service";

const PIPELINE_HISTORY_STORAGE_KEY_PREFIX = "pipeline-monitor.history.";

function buildPipelineHistoryStorageKey(dataset: PipelineDataset): string {
  return `${PIPELINE_HISTORY_STORAGE_KEY_PREFIX}${dataset}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPipelineLiveSample(value: unknown): value is PipelineLiveSample {
  if (!isRecord(value)) {
    return false;
  }

  if (Reflect.get(value, "writtenUnit") !== "rows") {
    return false;
  }

  const counterMode = Reflect.get(value, "counterMode");
  if (counterMode !== "default" && counterMode !== "flood-staging-rows") {
    return false;
  }

  return (
    isNullableFiniteNumber(Reflect.get(value, "buildLogBytes")) &&
    isNullableFiniteNumber(Reflect.get(value, "buildProgressPercent")) &&
    typeof Reflect.get(value, "capturedAt") === "string" &&
    isNullableFiniteNumber(Reflect.get(value, "expectedCount")) &&
    typeof Reflect.get(value, "isRunning") === "boolean" &&
    isNullableString(Reflect.get(value, "lastStateUpdatedAt")) &&
    typeof Reflect.get(value, "phase") === "string" &&
    isFiniteNumber(Reflect.get(value, "rawWrittenCount")) &&
    typeof Reflect.get(value, "requestId") === "string" &&
    isNullableString(Reflect.get(value, "runId")) &&
    isNullableString(Reflect.get(value, "runStartedAt")) &&
    isNullableFiniteNumber(Reflect.get(value, "stageBytes")) &&
    isFiniteNumber(Reflect.get(value, "statesCompleted")) &&
    isFiniteNumber(Reflect.get(value, "statesTotal")) &&
    isFiniteNumber(Reflect.get(value, "writtenCount"))
  );
}

function loadPersistedHistory(dataset: PipelineDataset): readonly PipelineLiveSample[] {
  const raw = window.localStorage.getItem(buildPipelineHistoryStorageKey(dataset));
  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPipelineLiveSample);
  } catch {
    return [];
  }
}

function savePersistedHistory(
  dataset: PipelineDataset,
  history: readonly PipelineLiveSample[]
): void {
  try {
    window.localStorage.setItem(buildPipelineHistoryStorageKey(dataset), JSON.stringify(history));
  } catch (_error) {
    /* ignored */
  }
}

export function usePipelineStatus(dataset: PipelineDataset = "parcels"): PipelineStatusController {
  const controllerInstance = createPipelineStatusController({
    clearInterval: (handle) => {
      window.clearInterval(handle);
    },
    clearTimeout: (handle) => {
      window.clearTimeout(handle);
    },
    fetchPipelineStatus: () => createFetchPipelineStatusEffect(dataset),
    loadPersistedHistory: () => loadPersistedHistory(dataset),
    now: () => Date.now(),
    runtime: createBrowserEffectRuntime(),
    savePersistedHistory: (history) => {
      savePersistedHistory(dataset, history);
    },
    setInterval: (callback, delayMs) => {
      return window.setInterval(callback, delayMs);
    },
    setTimeout: (callback, delayMs) => {
      return window.setTimeout(callback, delayMs);
    },
  });

  const startController = (): void => {
    controllerInstance.start();
  };

  onMounted(() => {
    startController();
  });

  onBeforeUnmount(() => {
    controllerInstance.destroy().catch((error) => {
      console.error("[pipeline-monitor] controller teardown failed", error);
    });
  });

  return controllerInstance.controller;
}
