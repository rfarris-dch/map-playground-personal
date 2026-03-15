import type { BrowserEffectFiber, BrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { createBrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import type { Effect } from "effect";
import { Cause, Exit } from "effect";

interface ActiveFiberHandle {
  completion: Promise<void>;
  fiber: BrowserEffectFiber<unknown, unknown>;
}

interface LatestRunnerState {
  activeFiberHandle: ActiveFiberHandle | null;
  disposed: boolean;
  operation: Promise<void>;
}

export interface LatestRunnerOptions {
  readonly onUnexpectedError?: ((error: unknown) => void) | undefined;
  readonly runtime?: BrowserEffectRuntime | undefined;
}

export interface LatestRunner {
  dispose(): Promise<void>;
  interrupt(): Promise<void>;
  run(program: Effect.Effect<void, unknown, never>): Promise<void>;
  start(program: Effect.Effect<void, unknown, never>): Promise<void>;
}

const defaultRuntime = createBrowserEffectRuntime();

export function createLatestRunner(options: LatestRunnerOptions = {}): LatestRunner {
  const runtime = options.runtime ?? defaultRuntime;

  const state: LatestRunnerState = {
    activeFiberHandle: null,
    disposed: false,
    operation: Promise.resolve(),
  };

  function reportUnexpectedFailure(exit: Exit.Exit<unknown, unknown>): void {
    if (!Exit.isFailure(exit) || Cause.isInterruptedOnly(exit.cause)) {
      return;
    }

    options.onUnexpectedError?.(Cause.squash(exit.cause));
  }

  function createFiberHandle(fiber: BrowserEffectFiber<unknown, unknown>): ActiveFiberHandle {
    const completion = runtime
      .awaitFiber(fiber)
      .then((exit) => {
        if (state.activeFiberHandle?.fiber === fiber) {
          state.activeFiberHandle = null;
        }

        reportUnexpectedFailure(exit);
      })
      .catch((error: unknown) => {
        if (state.activeFiberHandle?.fiber === fiber) {
          state.activeFiberHandle = null;
        }

        options.onUnexpectedError?.(error);
      });

    return { fiber, completion };
  }

  async function interruptActiveFiber(): Promise<void> {
    const handle = state.activeFiberHandle;
    if (handle === null) {
      return;
    }

    state.activeFiberHandle = null;
    await runtime.interruptFiber(handle.fiber);
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const nextOperation = state.operation.then(operation, operation);
    state.operation = nextOperation.catch(() => undefined);
    return nextOperation;
  }

  async function forkProgram(
    program: Effect.Effect<void, unknown, never>
  ): Promise<ActiveFiberHandle | null> {
    if (state.disposed) {
      return null;
    }

    await interruptActiveFiber();
    if (state.disposed) {
      return null;
    }

    const fiber = runtime.runFork(program);
    const handle = createFiberHandle(fiber);
    state.activeFiberHandle = handle;
    return handle;
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
        const handle = await forkProgram(program);
        if (handle !== null) {
          await handle.completion;
        }
      });
    },
    start(program): Promise<void> {
      return enqueue(async () => {
        await forkProgram(program);
      });
    },
  };
}
