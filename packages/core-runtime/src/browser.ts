import { type Effect, scoped } from "effect/Effect";
import { die, type Exit, succeed } from "effect/Exit";
import { await as awaitFiber, interrupt, type RuntimeFiber } from "effect/Fiber";
import { empty } from "effect/Layer";
import { make } from "effect/ManagedRuntime";
import { close, extend, make as makeScope, type Scope } from "effect/Scope";

const browserRuntime = make(empty);

export type BrowserEffectFiber<TValue = void, TError = unknown> = RuntimeFiber<TValue, TError>;

export interface RunBrowserEffectOptions {
  readonly signal?: AbortSignal;
}

export interface BrowserEffectRuntime {
  awaitFiber<A, E>(fiber: RuntimeFiber<A, E>): Promise<Exit<A, E>>;
  interruptFiber<A, E>(fiber: RuntimeFiber<A, E>): Promise<Exit<A, E>>;
  runFork<A, E>(effect: Effect<A, E>): RuntimeFiber<A, E>;
}

export interface ScopedEffectHandle<TValue> {
  readonly dispose: () => Promise<void>;
  readonly value: TValue;
}

export function runBrowserEffect<TValue, TError>(
  program: Effect<TValue, TError, never>,
  options: RunBrowserEffectOptions = {}
): Promise<TValue> {
  return browserRuntime.runPromise(program, options);
}

export function runBrowserEffectExit<TValue, TError>(
  program: Effect<TValue, TError, never>,
  options: RunBrowserEffectOptions = {}
) {
  return browserRuntime.runPromiseExit(program, options);
}

export function forkBrowserEffect<TValue, TError>(
  program: Effect<TValue, TError, never>
): BrowserEffectFiber<TValue, TError> {
  return browserRuntime.runFork(program);
}

export function forkScopedBrowserEffect<TValue, TError>(
  program: Effect<TValue, TError, Scope>
): BrowserEffectFiber<TValue, TError> {
  return browserRuntime.runFork(scoped(program));
}

export async function interruptBrowserFiber(
  fiber: BrowserEffectFiber<unknown, unknown> | null
): Promise<void> {
  if (fiber === null) {
    return;
  }

  await browserRuntime.runPromise(interrupt(fiber));
}

export function createBrowserEffectRuntime(): BrowserEffectRuntime {
  return {
    awaitFiber: (fiber) => browserRuntime.runPromise(awaitFiber(fiber)),
    interruptFiber: (fiber) => browserRuntime.runPromise(interrupt(fiber)),
    runFork: (effect) => browserRuntime.runFork(effect),
  };
}

export async function startBrowserScopedEffect<TValue, TError>(
  program: Effect<TValue, TError, Scope>
): Promise<ScopedEffectHandle<TValue>> {
  const scope = await runBrowserEffect(makeScope());

  try {
    const value = await runBrowserEffect(extend(program, scope));
    return {
      dispose: () => runBrowserEffect(close(scope, succeed(undefined))),
      value,
    };
  } catch (error) {
    await runBrowserEffect(close(scope, die(error)));
    throw error;
  }
}
