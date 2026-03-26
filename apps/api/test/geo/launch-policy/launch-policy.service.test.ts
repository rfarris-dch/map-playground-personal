import { describe, expect, it } from "bun:test";
import {
  getLaunchPolicyConfig,
  isValidatedCorridorMarket,
  listValidatedCorridorMarketIds,
  resolveCorridorMarketTreatment,
} from "@/geo/launch-policy/launch-policy.service";

describe("launch policy service", () => {
  it("exposes the 5 validated corridor markets by canonical market id", () => {
    expect(listValidatedCorridorMarketIds()).toEqual(["318", "559", "364", "382", "649"]);
    expect(getLaunchPolicyConfig().validatedCorridorMarkets).toHaveLength(5);
  });

  it("resolves corridor market treatment from canonical market ids", () => {
    expect(isValidatedCorridorMarket("318")).toBe(true);
    expect(isValidatedCorridorMarket("645")).toBe(false);
    expect(resolveCorridorMarketTreatment("649")).toBe("validated_market");
    expect(resolveCorridorMarketTreatment("645")).toBe("derived_market");
    expect(resolveCorridorMarketTreatment(null)).toBe("derived_market");
  });
});
