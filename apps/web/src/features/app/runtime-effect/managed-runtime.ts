import { Effect, Fiber, Layer, ManagedRuntime, type Scope } from "effect";

export interface ManagedEffectRuntimeController {
  isRunning(): boolean;
  start(program: Effect.Effect<void, unknown, Scope.Scope>): void;
  stop(): Promise<void>;
}

export function createManagedEffectRuntime(): ManagedEffectRuntimeController {
  const runtime = ManagedRuntime.make(Layer.empty);
  let activeFiber: Fiber.RuntimeFiber<void, unknown> | null = null;

  return {
    isRunning(): boolean {
      return activeFiber !== null;
    },
    start(program): void {
      if (activeFiber !== null) {
        throw new Error("Managed Effect runtime already started.");
      }

      activeFiber = runtime.runFork(Effect.scoped(program));
    },
    async stop(): Promise<void> {
      if (activeFiber !== null) {
        const fiber = activeFiber;
        activeFiber = null;
        await runtime.runPromise(Fiber.interrupt(fiber));
      }

      await runtime.dispose();
    },
  };
}
