import { describe, expect, it } from "bun:test";
import { createBrowserEffectRuntime } from "@map-migration/core-runtime/browser";
import { Effect } from "effect";
import type { PipelineStatusFetchResult } from "../../../src/features/pipeline/pipeline.types";
import { createPipelineStatusController } from "../../../src/features/pipeline/pipeline.view.service";
import { FakeClock } from "../../support/fake-clock";
import { createPipelineStatusFetchSuccess } from "../../support/pipeline-status-fixtures";

function createFailureResult(requestId: string, message: string): PipelineStatusFetchResult {
  return {
    ok: false,
    error: {
      reason: "network",
      requestId,
      message,
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  for (let iteration = 0; iteration < 8; iteration += 1) {
    await Promise.resolve();
  }
}

function msUntil(nextPollAt: string | null, clock: FakeClock): number | null {
  if (nextPollAt === null) {
    return null;
  }

  return Date.parse(nextPollAt) - clock.now();
}

function createControllerHarness(
  effects: Array<() => Effect.Effect<PipelineStatusFetchResult, never>>,
  clock = new FakeClock()
) {
  let callCount = 0;

  const controllerInstance = createPipelineStatusController({
    clearInterval: clock.clearInterval,
    clearTimeout: clock.clearTimeout,
    fetchPipelineStatus: () => {
      const nextEffect = effects.at(callCount) ?? effects.at(-1);
      callCount += 1;
      if (typeof nextEffect !== "function") {
        throw new Error("missing fetch effect");
      }

      return nextEffect();
    },
    now: () => clock.now(),
    runtime: createBrowserEffectRuntime(),
    setInterval: clock.setInterval,
    setTimeout: clock.setTimeout,
  });

  return {
    clock,
    controller: controllerInstance.controller,
    controllerInstance,
    getCallCount(): number {
      return callCount;
    },
  };
}

describe("createPipelineStatusController", () => {
  it("keeps the 3s running poll and 15s idle poll cadence", async () => {
    const harness = createControllerHarness([
      () =>
        Effect.succeed(
          createPipelineStatusFetchSuccess({
            isRunning: true,
            phase: "extracting",
            requestId: "req-running",
          })
        ),
      () =>
        Effect.succeed(
          createPipelineStatusFetchSuccess({
            isRunning: false,
            phase: "completed",
            requestId: "req-idle",
          })
        ),
    ]);

    harness.controllerInstance.start();
    await flushAsyncWork();

    expect(harness.getCallCount()).toBe(1);
    expect(harness.controller.pollingIntervalMs.value).toBe(3000);
    expect(msUntil(harness.controller.nextPollAt.value, harness.clock)).toBe(3000);

    harness.clock.advanceBy(3000);
    await flushAsyncWork();

    expect(harness.getCallCount()).toBe(2);
    expect(harness.controller.pollingIntervalMs.value).toBe(15_000);
    expect(msUntil(harness.controller.nextPollAt.value, harness.clock)).toBe(15_000);
  });

  it("interrupts in-flight refresh work before starting a manual refresh", async () => {
    let interruptedCount = 0;

    const harness = createControllerHarness([
      () =>
        Effect.async<PipelineStatusFetchResult>(() => {
          return Effect.sync(() => {
            interruptedCount += 1;
          });
        }),
      () =>
        Effect.succeed(
          createPipelineStatusFetchSuccess({
            isRunning: false,
            phase: "completed",
            requestId: "req-manual",
          })
        ),
    ]);

    harness.controllerInstance.start();
    await flushAsyncWork();
    await harness.controller.refreshNow();

    expect(interruptedCount).toBe(1);
    expect(harness.getCallCount()).toBe(2);
    expect(harness.controller.totalRequests.value).toBe(2);
    expect(harness.controller.successfulRequests.value).toBe(1);
    expect(harness.controller.payload.value?.requestId).toBe("req-manual");
  });

  it("pauses and resumes auto-refresh without changing the controller API", async () => {
    const harness = createControllerHarness([
      () =>
        Effect.succeed(
          createPipelineStatusFetchSuccess({
            isRunning: false,
            phase: "completed",
            requestId: "req-auto",
          })
        ),
    ]);

    harness.controllerInstance.start();
    await flushAsyncWork();

    expect(msUntil(harness.controller.nextPollAt.value, harness.clock)).toBe(15_000);

    harness.controller.setAutoRefresh(false);
    harness.clock.advanceBy(20_000);
    await flushAsyncWork();

    expect(harness.getCallCount()).toBe(1);
    expect(harness.controller.nextPollAt.value).toBeNull();

    harness.controller.setAutoRefresh(true);

    expect(msUntil(harness.controller.nextPollAt.value, harness.clock)).toBe(15_000);
  });

  it("tracks failure streaks and emits a recovery event after a later success", async () => {
    const harness = createControllerHarness([
      () => Effect.succeed(createFailureResult("req-fail", "socket hang up")),
      () =>
        Effect.succeed(
          createPipelineStatusFetchSuccess({
            isRunning: false,
            phase: "completed",
            requestId: "req-recover",
          })
        ),
    ]);

    harness.controllerInstance.start();
    await flushAsyncWork();

    expect(harness.controller.consecutiveFailures.value).toBe(1);
    expect(harness.controller.lastFailedRefreshAt.value).not.toBeNull();
    expect(harness.controller.events.value.at(-1)?.message).toContain("Request failed");

    await harness.controller.refreshNow();

    expect(harness.controller.consecutiveFailures.value).toBe(0);
    expect(harness.controller.successfulRequests.value).toBe(1);
    expect(harness.controller.payload.value?.requestId).toBe("req-recover");
    expect(
      harness.controller.events.value.some((event) =>
        event.message.includes("Recovered after 1 failed poll(s)")
      )
    ).toBe(true);
  });

  it("cleans up heartbeat and in-flight refresh work on destroy", async () => {
    let interruptedCount = 0;

    const harness = createControllerHarness([
      () =>
        Effect.async<PipelineStatusFetchResult>(() => {
          return Effect.sync(() => {
            interruptedCount += 1;
          });
        }),
    ]);

    harness.controllerInstance.start();
    await flushAsyncWork();
    await harness.controllerInstance.destroy();

    expect(interruptedCount).toBe(1);
    expect(harness.clock.pendingTaskCount()).toBe(0);

    harness.clock.advanceBy(60_000);
    await flushAsyncWork();

    expect(harness.getCallCount()).toBe(1);
    expect(harness.controller.nextPollAt.value).toBeNull();
  });
});
