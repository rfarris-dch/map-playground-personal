import { describe, expect, it } from "bun:test";
import { ApiHeaders } from "@map-migration/contracts";
import { Effect } from "effect";
import { Hono } from "hono";
import { ApiRequestContext, ApiRouteError, runEffectRoute } from "@/http/effect-route";

describe("runEffectRoute", () => {
  it("provides request-scoped services and sets the request-id header", async () => {
    const app = new Hono();

    app.get("/request-context", (c) =>
      runEffectRoute(
        c,
        Effect.gen(function* () {
          const request = yield* ApiRequestContext;

          return request.honoContext.json({
            requestId: request.requestId,
            aborted: request.signal.aborted,
          });
        })
      )
    );

    const response = await app.request("/request-context", {
      headers: {
        [ApiHeaders.requestId]: "req-123",
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get(ApiHeaders.requestId)).toBe(payload.requestId);
    expect(typeof payload.requestId).toBe("string");
    expect(payload.requestId.length).toBeGreaterThan(0);
    expect(payload.aborted).toBe(false);
  });

  it("renders typed route failures with the standard error envelope", async () => {
    const app = new Hono();

    app.get("/fail", (c) =>
      runEffectRoute(
        c,
        Effect.fail(
          new ApiRouteError({
            httpStatus: 409,
            code: "TEST_CONFLICT",
            message: "test conflict",
          })
        )
      )
    );

    const response = await app.request("/fail");
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get(ApiHeaders.requestId)).toBe(payload.requestId);
    expect(payload.error.code).toBe("TEST_CONFLICT");
    expect(payload.error.message).toBe("test conflict");
  });
});
