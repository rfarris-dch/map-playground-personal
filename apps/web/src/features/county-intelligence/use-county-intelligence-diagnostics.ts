import { ApiAbortedError, getApiErrorMessage } from "@map-migration/core-runtime/api";
import type {
  CountyScoresCoverageResponse,
  CountyScoresDebugResponse,
  CountyScoresResolutionResponse,
} from "@map-migration/http-contracts/county-intelligence-debug-http";
import { Effect } from "effect";
import { computed, onBeforeUnmount, type Ref, shallowRef, watch } from "vue";
import {
  fetchCountyScoresCoverageEffect,
  fetchCountyScoresDebugEffect,
  fetchCountyScoresResolutionEffect,
} from "@/features/county-intelligence/county-intelligence.api";
import { createLatestRunner } from "@/lib/effect/latest-runner";

interface UseCountyScoresDiagnosticsOptions {
  readonly countyIds: Ref<readonly string[]>;
  readonly enabled: Ref<boolean>;
}

const MAX_COUNTY_DEBUG_IDS = 50;

let cachedCountyScoresCoverage: CountyScoresCoverageResponse | null = null;
let cachedCountyScoresResolution: CountyScoresResolutionResponse | null = null;
const countyScoresDebugCache = new Map<string, CountyScoresDebugResponse>();

function normalizeCountyIds(countyIds: readonly string[]): readonly string[] {
  return [...new Set(countyIds)].sort();
}

function toCountyScoresCacheKey(countyIds: readonly string[]): string {
  return countyIds.join(",");
}

export function useCountyScoresDiagnostics(options: UseCountyScoresDiagnosticsOptions) {
  const countyScoresCoverage = shallowRef<CountyScoresCoverageResponse | null>(null);
  const countyScoresCoverageError = shallowRef<string | null>(null);
  const countyScoresCoverageLoading = shallowRef(false);
  const countyScoresResolution = shallowRef<CountyScoresResolutionResponse | null>(null);
  const countyScoresResolutionError = shallowRef<string | null>(null);
  const countyScoresResolutionLoading = shallowRef(false);
  const countyScoresDebug = shallowRef<CountyScoresDebugResponse | null>(null);
  const countyScoresDebugError = shallowRef<string | null>(null);
  const countyScoresDebugLoading = shallowRef(false);
  const countyScoresCoverageRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresCoverageLoading.value = false;
      countyScoresCoverage.value = null;
      countyScoresCoverageError.value = "Unable to load county field coverage.";
      console.error("[county-intelligence] coverage fetch failed", error);
    },
  });
  const countyScoresResolutionRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresResolutionLoading.value = false;
      countyScoresResolution.value = null;
      countyScoresResolutionError.value = "Unable to load county queue resolution diagnostics.";
      console.error("[county-intelligence] resolution fetch failed", error);
    },
  });
  const countyScoresDebugRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresDebugLoading.value = false;
      countyScoresDebug.value = null;
      countyScoresDebugError.value = "Unable to load county debug diagnostics.";
      console.error("[county-intelligence] debug fetch failed", error);
    },
  });

  const normalizedCountyIds = computed(() => normalizeCountyIds(options.countyIds.value));

  async function refreshCountyScoresCoverage(): Promise<void> {
    if (!options.enabled.value) {
      countyScoresCoverage.value = null;
      countyScoresCoverageError.value = null;
      countyScoresCoverageLoading.value = false;
      return;
    }

    if (cachedCountyScoresCoverage !== null) {
      countyScoresCoverage.value = cachedCountyScoresCoverage;
      countyScoresCoverageError.value = null;
      countyScoresCoverageLoading.value = false;
      return;
    }

    countyScoresCoverageLoading.value = true;
    countyScoresCoverageError.value = null;

    const program: Effect.Effect<void, never, never> = fetchCountyScoresCoverageEffect().pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          cachedCountyScoresCoverage = result.data;
          countyScoresCoverage.value = result.data;
          countyScoresCoverageError.value = null;
          countyScoresCoverageLoading.value = false;
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          countyScoresCoverageLoading.value = false;

          if (error instanceof ApiAbortedError) {
            return;
          }

          countyScoresCoverage.value = null;
          countyScoresCoverageError.value = getApiErrorMessage(
            error,
            "Unable to load county field coverage."
          );
        })
      )
    );

    await countyScoresCoverageRunner.run(program);
  }

  async function refreshCountyScoresResolution(): Promise<void> {
    if (!options.enabled.value) {
      countyScoresResolution.value = null;
      countyScoresResolutionError.value = null;
      countyScoresResolutionLoading.value = false;
      return;
    }

    if (cachedCountyScoresResolution !== null) {
      countyScoresResolution.value = cachedCountyScoresResolution;
      countyScoresResolutionError.value = null;
      countyScoresResolutionLoading.value = false;
      return;
    }

    countyScoresResolutionLoading.value = true;
    countyScoresResolutionError.value = null;

    const program: Effect.Effect<void, never, never> = fetchCountyScoresResolutionEffect().pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          cachedCountyScoresResolution = result.data;
          countyScoresResolution.value = result.data;
          countyScoresResolutionError.value = null;
          countyScoresResolutionLoading.value = false;
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          countyScoresResolutionLoading.value = false;

          if (error instanceof ApiAbortedError) {
            return;
          }

          countyScoresResolution.value = null;
          countyScoresResolutionError.value = getApiErrorMessage(
            error,
            "Unable to load county queue resolution diagnostics."
          );
        })
      )
    );

    await countyScoresResolutionRunner.run(program);
  }

  async function refreshCountyScoresDebug(): Promise<void> {
    if (!options.enabled.value) {
      countyScoresDebug.value = null;
      countyScoresDebugError.value = null;
      countyScoresDebugLoading.value = false;
      return;
    }

    const countyIds = normalizedCountyIds.value;
    if (countyIds.length === 0) {
      countyScoresDebug.value = null;
      countyScoresDebugError.value = null;
      countyScoresDebugLoading.value = false;
      return;
    }

    if (countyIds.length > MAX_COUNTY_DEBUG_IDS) {
      countyScoresDebug.value = null;
      countyScoresDebugError.value = `County debug diagnostics are limited to ${MAX_COUNTY_DEBUG_IDS} counties per request.`;
      countyScoresDebugLoading.value = false;
      return;
    }

    const cacheKey = toCountyScoresCacheKey(countyIds);
    const cachedDebug = countyScoresDebugCache.get(cacheKey);
    if (typeof cachedDebug !== "undefined") {
      countyScoresDebug.value = cachedDebug;
      countyScoresDebugError.value = null;
      countyScoresDebugLoading.value = false;
      return;
    }

    countyScoresDebugLoading.value = true;
    countyScoresDebugError.value = null;

    const program: Effect.Effect<void, never, never> = fetchCountyScoresDebugEffect(countyIds).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          countyScoresDebugCache.set(cacheKey, result.data);
          countyScoresDebug.value = result.data;
          countyScoresDebugError.value = null;
          countyScoresDebugLoading.value = false;
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          countyScoresDebugLoading.value = false;

          if (error instanceof ApiAbortedError) {
            return;
          }

          countyScoresDebug.value = null;
          countyScoresDebugError.value = getApiErrorMessage(
            error,
            "Unable to load county debug diagnostics."
          );
        })
      )
    );

    await countyScoresDebugRunner.run(program);
  }

  watch(
    options.enabled,
    (enabled) => {
      if (!enabled) {
        countyScoresCoverage.value = null;
        countyScoresCoverageError.value = null;
        countyScoresCoverageLoading.value = false;
        countyScoresResolution.value = null;
        countyScoresResolutionError.value = null;
        countyScoresResolutionLoading.value = false;
        countyScoresDebug.value = null;
        countyScoresDebugError.value = null;
        countyScoresDebugLoading.value = false;
        return;
      }

      refreshCountyScoresCoverage().catch((error: unknown) => {
        console.error("[county-intelligence] coverage refresh failed", error);
      });
      refreshCountyScoresResolution().catch((error: unknown) => {
        console.error("[county-intelligence] resolution refresh failed", error);
      });
      refreshCountyScoresDebug().catch((error: unknown) => {
        console.error("[county-intelligence] debug refresh failed", error);
      });
    },
    {
      immediate: true,
    }
  );

  watch(normalizedCountyIds, () => {
    if (!options.enabled.value) {
      return;
    }

    refreshCountyScoresDebug().catch((error: unknown) => {
      console.error("[county-intelligence] debug refresh failed", error);
    });
  });

  onBeforeUnmount(() => {
    countyScoresCoverageRunner.dispose().catch((error: unknown) => {
      console.error("[county-intelligence] coverage runner dispose failed", error);
    });
    countyScoresResolutionRunner.dispose().catch((error: unknown) => {
      console.error("[county-intelligence] resolution runner dispose failed", error);
    });
    countyScoresDebugRunner.dispose().catch((error: unknown) => {
      console.error("[county-intelligence] debug runner dispose failed", error);
    });
  });

  return {
    countyScoresCoverage,
    countyScoresCoverageError,
    countyScoresCoverageLoading,
    countyScoresResolution,
    countyScoresResolutionError,
    countyScoresResolutionLoading,
    countyScoresDebug,
    countyScoresDebugError,
    countyScoresDebugLoading,
  };
}
