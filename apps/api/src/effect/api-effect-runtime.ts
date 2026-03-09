import { DevTools } from "@effect/experimental";
import { type Effect, Layer, ManagedRuntime } from "effect";

const DEFAULT_EFFECT_DEVTOOLS_URL = "ws://localhost:34437";

interface RunApiEffectOptions {
  readonly signal?: AbortSignal;
}

function isEffectDevToolsEnabled(): boolean {
  const rawValue = process.env.MAP_EFFECT_DEVTOOLS;
  if (typeof rawValue !== "string") {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function resolveEffectDevToolsUrl(): string {
  const rawValue = process.env.MAP_EFFECT_DEVTOOLS_URL;
  if (typeof rawValue !== "string") {
    return DEFAULT_EFFECT_DEVTOOLS_URL;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : DEFAULT_EFFECT_DEVTOOLS_URL;
}

function buildApiRuntimeLayer() {
  if (!isEffectDevToolsEnabled()) {
    return Layer.empty;
  }

  return DevTools.layer(resolveEffectDevToolsUrl());
}

const apiEffectRuntime = ManagedRuntime.make(buildApiRuntimeLayer());

export function describeEffectDevToolsConnection(): string | null {
  return isEffectDevToolsEnabled() ? resolveEffectDevToolsUrl() : null;
}

export function runApiEffect<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunApiEffectOptions = {}
): Promise<TValue> {
  return apiEffectRuntime.runPromise(program, options);
}

export function runApiEffectExit<TValue, TError>(
  program: Effect.Effect<TValue, TError, never>,
  options: RunApiEffectOptions = {}
) {
  return apiEffectRuntime.runPromiseExit(program, options);
}
