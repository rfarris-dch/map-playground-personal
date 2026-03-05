import { describe, expect, it } from "bun:test";
import { resolvePaginationParams } from "@/http/pagination-params.service";

describe("pagination params service", () => {
  it("rejects pagination when computed offset exceeds policy cap", () => {
    const result = resolvePaginationParams("3000", "500", {
      defaultPageSize: 100,
      maxPageSize: 500,
      maxOffset: 1_000_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected capped pagination to fail");
    }
    expect(result.message).toContain("pagination offset exceeds maximum");
  });

  it("caps pageSize to maxPageSize before calculating offset", () => {
    const result = resolvePaginationParams("2", "9999", {
      defaultPageSize: 100,
      maxPageSize: 500,
      maxOffset: 1_000_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected valid pagination result");
    }
    expect(result.value.pageSize).toBe(500);
    expect(result.value.offset).toBe(1000);
  });
});
