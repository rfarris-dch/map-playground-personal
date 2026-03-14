import { ApiAbortedError, getApiErrorMessage } from "@map-migration/core-runtime/api";
import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";
import { Effect } from "effect";
import { computed, onBeforeUnmount, type Ref, shallowRef, watch } from "vue";
import {
  fetchCountyScoresEffect,
  fetchCountyScoresStatusEffect,
} from "@/features/county-intelligence/county-intelligence.api";
import { createLatestRunner } from "@/lib/effect/latest-runner";

interface UseCountyScoresOptions {
  readonly countyIds: Ref<readonly string[]>;
}

function areCountyIdsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (const [index, countyId] of left.entries()) {
    if (countyId !== right[index]) {
      return false;
    }
  }

  return true;
}

function uniqueCountyIds(countyIds: readonly string[]): readonly string[] {
  return [...new Set(countyIds)];
}

export function useCountyScores(options: UseCountyScoresOptions) {
  const countyScores = shallowRef<CountyScoresResponse | null>(null);
  const countyScoresError = shallowRef<string | null>(null);
  const countyScoresLoading = shallowRef(false);
  const countyScoresStatus = shallowRef<CountyScoresStatusResponse | null>(null);
  const countyScoresStatusError = shallowRef<string | null>(null);
  const countyScoresStatusLoading = shallowRef(false);
  const countyScoresRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresLoading.value = false;
      countyScores.value = null;
      countyScoresError.value = "Unable to load county market-pressure rows.";
      console.error("[county-intelligence] dashboard fetch failed", error);
    },
  });
  const countyScoresStatusRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresStatusLoading.value = false;
      countyScoresStatus.value = null;
      countyScoresStatusError.value = "Unable to load county intelligence publication status.";
      console.error("[county-intelligence] status fetch failed", error);
    },
  });

  function logCountyScoresError(context: string, error: unknown): void {
    console.error(`[county-intelligence] ${context} failed`, error);
  }

  const normalizedCountyIds = computed(() => uniqueCountyIds(options.countyIds.value));

  async function refreshCountyScoresStatus(): Promise<void> {
    if (
      countyScoresStatusLoading.value ||
      countyScoresStatus.value !== null ||
      countyScoresStatusError.value !== null
    ) {
      return;
    }

    countyScoresStatusLoading.value = true;
    countyScoresStatusError.value = null;

    const statusProgram: Effect.Effect<void, never, never> = fetchCountyScoresStatusEffect().pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          countyScoresStatusLoading.value = false;
          countyScoresStatus.value = result.data;
          countyScoresStatusError.value = null;
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          countyScoresStatusLoading.value = false;

          if (error instanceof ApiAbortedError) {
            return;
          }

          countyScoresStatus.value = null;
          countyScoresStatusError.value = getApiErrorMessage(
            error,
            "Unable to load county intelligence publication status."
          );
        })
      )
    );
    await countyScoresStatusRunner.run(statusProgram);
  }

  async function refreshCountyScores(): Promise<void> {
    const countyIds = normalizedCountyIds.value;
    await countyScoresRunner.interrupt();

    if (countyIds.length === 0) {
      countyScores.value = null;
      countyScoresError.value = null;
      countyScoresLoading.value = false;
      return;
    }

    countyScoresLoading.value = true;
    countyScoresError.value = null;
    countyScores.value = null;

    const countyScoresProgram: Effect.Effect<void, never, never> = fetchCountyScoresEffect(
      countyIds
    ).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          countyScoresLoading.value = false;
          countyScores.value = result.data;
          countyScoresError.value = null;
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          countyScoresLoading.value = false;

          if (error instanceof ApiAbortedError) {
            return;
          }

          countyScores.value = null;
          countyScoresError.value = getApiErrorMessage(
            error,
            "Unable to load county market-pressure rows."
          );
        })
      )
    );
    await countyScoresRunner.run(countyScoresProgram);
  }

  refreshCountyScoresStatus().catch((error: unknown) => {
    logCountyScoresError("status fetch", error);
  });

  watch(
    () => normalizedCountyIds.value,
    (nextCountyIds, previousCountyIds) => {
      const previous = previousCountyIds ?? [];
      if (areCountyIdsEqual(nextCountyIds, previous)) {
        return;
      }

      refreshCountyScores().catch((error: unknown) => {
        logCountyScoresError("dashboard fetch", error);
      });
    },
    {
      immediate: true,
    }
  );

  onBeforeUnmount(() => {
    countyScoresRunner.dispose().catch((error: unknown) => {
      logCountyScoresError("runner dispose", error);
    });
    countyScoresStatusRunner.dispose().catch((error: unknown) => {
      logCountyScoresError("status runner dispose", error);
    });
  });

  return {
    countyScores,
    countyScoresError,
    countyScoresLoading,
    countyScoresStatus,
    countyScoresStatusError,
    countyScoresStatusLoading,
  };
}
