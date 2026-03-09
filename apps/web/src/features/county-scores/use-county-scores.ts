import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/contracts";
import {
  ApiAbortedError,
  type ApiEffectError,
  type ApiEffectSuccess,
  getApiErrorMessage,
} from "@map-migration/core-runtime/api";
import { Effect, Either } from "effect";
import { computed, onBeforeUnmount, type Ref, shallowRef, watch } from "vue";
import {
  fetchCountyScoresEffect,
  fetchCountyScoresStatusEffect,
} from "@/features/county-scores/county-scores.api";
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
      console.error("[county-scores] dashboard fetch failed", error);
    },
  });
  const countyScoresStatusRunner = createLatestRunner({
    onUnexpectedError(error) {
      countyScoresStatusLoading.value = false;
      countyScoresStatus.value = null;
      countyScoresStatusError.value = "Unable to load county intelligence publication status.";
      console.error("[county-scores] status fetch failed", error);
    },
  });

  function logCountyScoresError(context: string, error: unknown): void {
    console.error(`[county-scores] ${context} failed`, error);
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

    const statusProgram: Effect.Effect<void, never, never> = Effect.either(
      fetchCountyScoresStatusEffect()
    ).pipe(
      Effect.flatMap(
        (result: Either.Either<ApiEffectSuccess<CountyScoresStatusResponse>, ApiEffectError>) =>
          Effect.sync(() => {
            countyScoresStatusLoading.value = false;

            if (Either.isRight(result)) {
              countyScoresStatus.value = result.right.data;
              countyScoresStatusError.value = null;
              return;
            }

            if (result.left instanceof ApiAbortedError) {
              return;
            }

            countyScoresStatus.value = null;
            countyScoresStatusError.value = getApiErrorMessage(
              result.left,
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

    const countyScoresProgram: Effect.Effect<void, never, never> = Effect.either(
      fetchCountyScoresEffect(countyIds)
    ).pipe(
      Effect.flatMap(
        (result: Either.Either<ApiEffectSuccess<CountyScoresResponse>, ApiEffectError>) =>
          Effect.sync(() => {
            countyScoresLoading.value = false;

            if (Either.isRight(result)) {
              countyScores.value = result.right.data;
              countyScoresError.value = null;
              return;
            }

            if (result.left instanceof ApiAbortedError) {
              return;
            }

            countyScores.value = null;
            countyScoresError.value = getApiErrorMessage(
              result.left,
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
