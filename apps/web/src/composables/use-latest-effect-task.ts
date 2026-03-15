import type { BrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import type { Effect } from "effect";
import { onBeforeUnmount } from "vue";
import { createLatestRunner } from "@/lib/effect/latest-runner";

interface UseLatestEffectTaskOptions {
  readonly onClear?: (() => void) | undefined;
  readonly onDispose?: (() => void) | undefined;
  readonly onUnexpectedError?: ((error: unknown) => void) | undefined;
  readonly runtime?: BrowserEffectRuntime;
}

interface LatestEffectTask {
  clear(): Promise<void>;
  dispose(): Promise<void>;
  run(program: Effect.Effect<void, unknown, never>): Promise<void>;
}

export function useLatestEffectTask(options: UseLatestEffectTaskOptions = {}): LatestEffectTask {
  const { onClear: _, onDispose: __, ...runnerOptions } = options;
  const runner = createLatestRunner(runnerOptions);

  const task: LatestEffectTask = {
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
