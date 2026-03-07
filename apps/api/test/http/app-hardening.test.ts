import { describe, expect, it } from "bun:test";
import { ApiHeaders, ApiRoutes, buildParcelLookupRoute } from "@map-migration/contracts";
import { createApiApp } from "@/app";

describe("api hardening middleware", () => {
  it("propagates inbound request ids to response headers and envelopes", async () => {
    const app = createApiApp();
    const requestId = "req-123";

    const response = await app.request("/api/not-found", {
      headers: {
        [ApiHeaders.requestId]: requestId,
      },
    });

    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(response.headers.get(ApiHeaders.requestId)).toBe(requestId);
    expect(payload.requestId).toBe(requestId);
  });

  it("returns a 413 error envelope when body exceeds configured limit", async () => {
    const app = createApiApp({
      requestBodyLimitBytes: 32,
    });

    const response = await app.request(buildParcelLookupRoute(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        parcelIds: ["a".repeat(64)],
      }),
    });

    const payload = await response.json();
    expect(response.status).toBe(413);
    expect(payload.error.code).toBe("REQUEST_BODY_TOO_LARGE");
    expect(response.headers.get(ApiHeaders.requestId)).toBe(payload.requestId);
  });

  it("times out long-running API handlers with a structured error", async () => {
    const app = createApiApp({
      requestTimeoutMs: 1,
    });

    app.get("/api/slow-timeout", async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return c.json({
        status: "ok",
      });
    });

    const response = await app.request("/api/slow-timeout");
    const payload = await response.json();

    expect(response.status).toBe(408);
    expect(payload.error.code).toBe("REQUEST_TIMEOUT");
    expect(response.headers.get(ApiHeaders.requestId)).toBe(payload.requestId);
  });

  it("allows longer timeouts for spatial selection routes", async () => {
    const app = createApiApp({
      requestTimeoutMs: 1,
      selectionRequestTimeoutMs: 50,
    });

    app.use(ApiRoutes.facilitiesSelection, async (_c, next) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await next();
    });

    const response = await app.request(ApiRoutes.facilitiesSelection, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        geometry: {
          type: "Polygon",
          coordinates: [],
        },
        limitPerPerspective: 10,
        perspectives: ["colocation"],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_SELECTION_REQUEST");
  });

  it("allows longer timeouts for parcels lookup routes", async () => {
    const app = createApiApp({
      requestTimeoutMs: 1,
      parcelsRequestTimeoutMs: 50,
    });

    app.use(`${ApiRoutes.parcels}/lookup`, async (_c, next) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await next();
    });

    const response = await app.request(`${ApiRoutes.parcels}/lookup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        parcelIds: [],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("BAD_REQUEST");
  });

  it("rejects JSON payloads without content-type", async () => {
    const app = createApiApp();

    const response = await app.request(buildParcelLookupRoute(), {
      method: "POST",
      body: JSON.stringify({
        parcelIds: ["123"],
      }),
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("BAD_REQUEST");
  });
});
