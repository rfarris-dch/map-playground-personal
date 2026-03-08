import type { Effect, Exit, Fiber } from "effect";
import type {
  PipelineStatusController,
  PipelineStatusFetchResult,
} from "@/features/pipeline/pipeline.types";

export type PipelineSchedulerHandle = number | ReturnType<typeof setTimeout>;

export interface PipelineEffectRuntime {
  awaitFiber<A, E>(fiber: Fiber.RuntimeFiber<A, E>): Promise<Exit.Exit<A, E>>;
  interruptFiber<A, E>(fiber: Fiber.RuntimeFiber<A, E>): Promise<Exit.Exit<A, E>>;
  runFork<A, E>(effect: Effect.Effect<A, E>): Fiber.RuntimeFiber<A, E>;
}

export interface PipelineStatusControllerDeps {
  clearInterval(handle: PipelineSchedulerHandle): void;
  clearTimeout(handle: PipelineSchedulerHandle): void;
  fetchPipelineStatus(): Effect.Effect<PipelineStatusFetchResult, never>;
  now(): number;
  readonly runtime: PipelineEffectRuntime;
  setInterval(callback: () => void, delayMs: number): PipelineSchedulerHandle;
  setTimeout(callback: () => void, delayMs: number): PipelineSchedulerHandle;
}

export interface PipelineStatusControllerInstance {
  readonly controller: PipelineStatusController;
  destroy(): Promise<void>;
  start(): void;
}

export interface MutablePollingState {
  currentRefreshFiber: Fiber.RuntimeFiber<PipelineStatusFetchResult, never> | null;
  destroyed: boolean;
  heartbeatTimer: PipelineSchedulerHandle | null;
  timer: PipelineSchedulerHandle | null;
}
