import { describe, expect, it } from "bun:test";
import { createApiApp } from "@/app";

function requestFromLoopback(
  app: ReturnType<typeof createApiApp>,
  path: string
): Promise<Response> {
  return app.request(path, {
    headers: {
      host: "localhost",
    },
  });
}

describe("launch policy route", () => {
  it("returns the typed MP-44 launch policy config", async () => {
    const app = createApiApp();

    const response = await requestFromLoopback(app, "/api/geo/launch-policy");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.policyVersion).toBe("v1");
    expect(payload.nonPriorityCorridorMode).toBe("derived_visible");
    expect(payload.validatedCorridorMarkets).toHaveLength(5);
    expect(
      payload.validatedCorridorMarkets.map((market: { marketId: string }) => market.marketId)
    ).toEqual(["318", "559", "364", "382", "649"]);
    expect(payload.copy.corridorDerivedLabel).toBe("Derived corridor");
    expect(payload.meta.dataVersion).toBe("launch-policy-v1-2026-03-26");
  });
});
