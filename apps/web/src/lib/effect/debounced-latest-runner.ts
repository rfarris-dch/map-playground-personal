import { Effect } from "effect";
import {
  createLatestRunner,
  type LatestRunner,
  type LatestRunnerOptions,
} from "@/lib/effect/latest-runner";

export interface DebouncedLatestRunnerOptions extends LatestRunnerOptions {
  readonly debounceMs: number;
}

export interface DebouncedLatestRunner extends LatestRunner {}

export function createDebouncedLatestRunner(
  options: DebouncedLatestRunnerOptions
): DebouncedLatestRunner {
  const latestRunner = createLatestRunner(options);

  return {
    dispose: () => latestRunner.dispose(),
    interrupt: () => latestRunner.interrupt(),
    run(program) {
      return latestRunner.run(Effect.sleep(options.debounceMs).pipe(Effect.zipRight(program)));
    },
  };
}
