import { describe, expect, it } from "bun:test";
import { createQuerySlotLimiter, isConnectionClosedError } from "@/db/postgres";

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

describe("createQuerySlotLimiter", () => {
  it("reuses released slots without deadlocking queued queries", async () => {
    const limiter = createQuerySlotLimiter(1);

    await limiter.acquire();

    let secondStarted = false;
    const secondAcquire = limiter.acquire().then(() => {
      secondStarted = true;
    });

    await Promise.resolve();
    expect(secondStarted).toBe(false);

    limiter.release();

    await secondAcquire;
    expect(secondStarted).toBe(true);

    let thirdStarted = false;
    const thirdAcquire = limiter.acquire().then(() => {
      thirdStarted = true;
    });

    await Promise.resolve();
    expect(thirdStarted).toBe(false);

    limiter.release();

    await thirdAcquire;
    expect(thirdStarted).toBe(true);

    limiter.release();
  });
});
