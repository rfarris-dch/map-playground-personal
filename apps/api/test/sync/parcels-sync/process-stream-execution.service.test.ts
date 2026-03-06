import { describe, expect, it } from "bun:test";
import { createManagedRunId } from "@/sync/parcels-sync/process-stream-execution.service";

const AUTO_INTERVAL_RUN_ID_PREFIX_RE = /^auto-interval-/;

describe("parcels sync process execution service", () => {
  it("adds a random suffix to managed run ids to avoid cross-process collisions", () => {
    const first = createManagedRunId("interval");
    const second = createManagedRunId("interval");

    expect(first).toMatch(AUTO_INTERVAL_RUN_ID_PREFIX_RE);
    expect(second).toMatch(AUTO_INTERVAL_RUN_ID_PREFIX_RE);
    expect(first).not.toBe(second);
  });
});
