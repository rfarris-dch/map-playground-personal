import { Effect, type Exit, Fiber } from "effect";
import type { PipelineEffectRuntime } from "./pipeline.view.types";

export function createPipelineEffectRuntime(): PipelineEffectRuntime {
  return {
    awaitFiber<A, E>(fiber: Fiber.RuntimeFiber<A, E>): Promise<Exit.Exit<A, E>> {
      return Effect.runPromise(Fiber.await(fiber));
    },
    interruptFiber<A, E>(fiber: Fiber.RuntimeFiber<A, E>): Promise<Exit.Exit<A, E>> {
      return Effect.runPromise(Fiber.interrupt(fiber));
    },
    runFork<A, E>(effect: Effect.Effect<A, E>): Fiber.RuntimeFiber<A, E> {
      return Effect.runFork(effect);
    },
  };
}
