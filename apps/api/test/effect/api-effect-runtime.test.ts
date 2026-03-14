import { beforeEach, describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import { runApiEffect, runApiEffectExit } from "@/effect/api-effect-runtime";
import {
  clearRecentEffectFailures,
  getRecentEffectFailures,
} from "@/effect/effect-failure-trail.service";

describe("api effect runtime", () => {
  beforeEach(() => {
    clearRecentEffectFailures();
  });

  it("records failed exit metadata for top-level effects", async () => {
    const exit = await runApiEffectExit(Effect.fail(new Error("runtime capture failure")), {
      failureMetadata: {
        method: "POST",
        path: "/api/test/runtime",
        requestId: "api_test_runtime_failure",
        source: "test-runtime",
      },
    });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(getRecentEffectFailures()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cause: expect.stringContaining("runtime capture failure"),
          code: "EFFECT_FIBER_FAILURE",
          message: "runtime capture failure",
          method: "POST",
          path: "/api/test/runtime",
          requestId: "api_test_runtime_failure",
          scope: "runtime",
          source: "test-runtime",
        }),
      ])
    );
  });

  it("rejects runApiEffect while still recording the failure", async () => {
    await expect(
      runApiEffect(Effect.fail(new Error("runtime promise failure")), {
        failureMetadata: {
          source: "test-runtime-promise",
        },
      })
    ).rejects.toThrow("runtime promise failure");

    expect(getRecentEffectFailures()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cause: expect.stringContaining("runtime promise failure"),
          code: "EFFECT_FIBER_FAILURE",
          message: "runtime promise failure",
          scope: "runtime",
        }),
      ])
    );
  });
});
