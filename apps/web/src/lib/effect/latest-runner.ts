import { Cause, type Effect, Exit, Fiber } from "effect";
import type { BrowserEffectFiber } from "@/lib/effect/runtime";
import { forkBrowserEffect, interruptBrowserFiber, runBrowserEffect } from "@/lib/effect/runtime";

interface LatestRunnerState {
  activeFiber: BrowserEffectFiber<unknown, unknown> | null;
  disposed: boolean;
  operation: Promise<void>;
}

export interface LatestRunnerOptions {
  readonly onUnexpectedError?: (error: unknown) => void;
}

export interface LatestRunner {
  dispose(): Promise<void>;
  interrupt(): Promise<void>;
  run(program: Effect.Effect<void, unknown, never>): Promise<void>;
}

export function createLatestRunner(options: LatestRunnerOptions = {}): LatestRunner {
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
    runBrowserEffect(Fiber.await(fiber))
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
    state.activeFiber = null;
    await interruptBrowserFiber(activeFiber);
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

        const fiber = forkBrowserEffect(program);
        state.activeFiber = fiber;
        observeFiber(fiber);
      });
    },
  };
}
