import type { BrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import type { Effect } from "effect";
import { onBeforeUnmount } from "vue";
import { createDebouncedLatestRunner } from "@/lib/effect/debounced-latest-runner";

interface UseDebouncedLatestEffectTaskOptions {
  readonly debounceMs: number;
  readonly onClear?: (() => void) | undefined;
  readonly onDispose?: (() => void) | undefined;
  readonly onUnexpectedError?: ((error: unknown) => void) | undefined;
  readonly runtime?: BrowserEffectRuntime;
}

interface DebouncedLatestEffectTask {
  clear(): Promise<void>;
  dispose(): Promise<void>;
  run(program: Effect.Effect<void, unknown, never>): Promise<void>;
}

export function useDebouncedLatestEffectTask(
  options: UseDebouncedLatestEffectTaskOptions
): DebouncedLatestEffectTask {
  const { onClear: _, onDispose: __, ...runnerOptions } = options;
  const runner = createDebouncedLatestRunner(runnerOptions);

  const task: DebouncedLatestEffectTask = {
    async clear(): Promise<void> {
      try {
        await runner.interrupt();
      } finally {
        options.onClear?.();
      }
    },
    async dispose(): Promise<void> {
      try {
        await runner.dispose();
      } finally {
        options.onDispose?.();
      }
    },
    run(program) {
      return runner.run(program);
    },
  };

  onBeforeUnmount(() => {
    task.dispose().catch(() => {
      return;
    });
  });

  return task;
}
