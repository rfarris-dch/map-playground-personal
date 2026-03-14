import type { BrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { Effect } from "effect";
import {
  createLatestRunner,
  type LatestRunner,
  type LatestRunnerOptions,
} from "@/lib/effect/latest-runner";

export interface DebouncedLatestRunnerOptions extends LatestRunnerOptions {
  readonly debounceMs: number;
  readonly runtime?: BrowserEffectRuntime;
}

export interface DebouncedLatestRunner extends LatestRunner {}

export function createDebouncedLatestRunner(
  options: DebouncedLatestRunnerOptions
): DebouncedLatestRunner {
  const latestRunner = createLatestRunner({
    onUnexpectedError: options.onUnexpectedError,
    runtime: options.runtime,
  });

  return {
    dispose: () => latestRunner.dispose(),
    interrupt: () => latestRunner.interrupt(),
    run(program) {
      return latestRunner.run(Effect.sleep(options.debounceMs).pipe(Effect.zipRight(program)));
    },
  };
}
