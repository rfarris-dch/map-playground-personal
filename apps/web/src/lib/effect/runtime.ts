import { Effect, Fiber, Layer, ManagedRuntime, type Scope } from "effect";

const browserRuntime = ManagedRuntime.make(Layer.empty);

export type BrowserEffectFiber<TValue = void, TError = unknown> = Fiber.RuntimeFiber<
  TValue,
  TError
>;

export interface RunBrowserEffectOptions {
  readonly signal?: AbortSignal;
}

export function runBrowserEffect<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunBrowserEffectOptions = {}
): Promise<TValue> {
  return browserRuntime.runPromise(program, options);
}

export function runBrowserEffectExit<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunBrowserEffectOptions = {}
) {
  return browserRuntime.runPromiseExit(program, options);
}

export function forkBrowserEffect<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>
): BrowserEffectFiber<TValue, TError> {
  return browserRuntime.runFork(program);
}

export function forkScopedBrowserEffect<TValue, TError>(
  program: Effect.Effect<TValue, TError, Scope.Scope>
): BrowserEffectFiber<TValue, TError> {
  return browserRuntime.runFork(Effect.scoped(program));
}

export async function interruptBrowserFiber(
  fiber: BrowserEffectFiber<unknown, unknown> | null
): Promise<void> {
  if (fiber === null) {
    return;
  }

  await browserRuntime.runPromise(Fiber.interrupt(fiber));
}
