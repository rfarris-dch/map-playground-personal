import type { BrowserEffectFiber, BrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { createBrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import type { Effect } from "effect";
import { Cause, Exit } from "effect";

interface LatestRunnerState {
  activeFiber: BrowserEffectFiber<unknown, unknown> | null;
  disposed: boolean;
  operation: Promise<void>;
}

export interface LatestRunnerOptions {
  readonly onUnexpectedError?: (error: unknown) => void;
  readonly runtime?: BrowserEffectRuntime;
}

export interface LatestRunner {
  dispose(): Promise<void>;
  interrupt(): Promise<void>;
  run(program: Effect.Effect<void, unknown, never>): Promise<void>;
}

const defaultRuntime = createBrowserEffectRuntime();

export function createLatestRunner(options: LatestRunnerOptions = {}): LatestRunner {
  const runtime = options.runtime ?? defaultRuntime;

  const state: LatestRunnerState = {
    activeFiber: null,
    disposed: false,
    operation: Promise.resolve(),
  };

  function reportUnexpectedFailure(exit: Exit.Exit<unknown, unknown>): void {
    if (!Exit.isFailure(exit) || Cause.isInterruptedOnly(exit.cause)) {
      return;
    }

    options.onUnexpectedError?.(Cause.squash(exit.cause));
  }

  function observeFiber(fiber: BrowserEffectFiber<unknown, unknown>): void {
    runtime
      .awaitFiber(fiber)
      .then((exit) => {
        if (state.activeFiber === fiber) {
          state.activeFiber = null;
        }

        reportUnexpectedFailure(exit);
      })
      .catch((error: unknown) => {
        if (state.activeFiber === fiber) {
          state.activeFiber = null;
        }

        options.onUnexpectedError?.(error);
      });
  }

  async function interruptActiveFiber(): Promise<void> {
    const activeFiber = state.activeFiber;
    if (activeFiber === null) {
      return;
    }

    state.activeFiber = null;
    await runtime.interruptFiber(activeFiber);
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const nextOperation = state.operation.then(operation, operation);
    state.operation = nextOperation.catch(() => undefined);
    return nextOperation;
  }

  return {
    dispose(): Promise<void> {
      return enqueue(async () => {
        state.disposed = true;
        await interruptActiveFiber();
      });
    },
    interrupt(): Promise<void> {
      return enqueue(async () => {
        await interruptActiveFiber();
      });
    },
    run(program): Promise<void> {
      return enqueue(async () => {
        if (state.disposed) {
          return;
        }

        await interruptActiveFiber();
        if (state.disposed) {
          return;
        }

        const fiber = runtime.runFork(program);
        state.activeFiber = fiber;
        observeFiber(fiber);
      });
    },
  };
}
