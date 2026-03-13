import { describe, expect, it } from "bun:test";
import { isConnectionClosedError } from "@/db/postgres";

describe("isConnectionClosedError", () => {
  it("matches Bun postgres closed-connection errors", () => {
    expect(isConnectionClosedError(new Error("Connection closed"))).toBe(true);
    expect(
      isConnectionClosedError({
        message: "PostgresError: Connection closed",
      })
    ).toBe(true);
  });

  it("does not match unrelated database errors", () => {
    expect(isConnectionClosedError(new Error("connect ECONNREFUSED"))).toBe(false);
    expect(isConnectionClosedError(new Error("permission denied"))).toBe(false);
  });
});
