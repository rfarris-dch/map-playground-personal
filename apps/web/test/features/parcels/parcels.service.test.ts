import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { createStressGovernor } from "@/features/parcels/parcels.service";

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
let activeHandles = new Set<number>();

describe("stress governor", () => {
  beforeEach(() => {
    let nextHandle = 1;
    activeHandles = new Set<number>();

    Reflect.set(globalThis, "requestAnimationFrame", () => {
      const handle = nextHandle;
      nextHandle += 1;
      activeHandles.add(handle);
      return handle;
    });

    Reflect.set(globalThis, "cancelAnimationFrame", (handle: number) => {
      activeHandles.delete(handle);
    });
  });

  afterAll(() => {
    Reflect.set(globalThis, "requestAnimationFrame", originalRequestAnimationFrame);
    Reflect.set(globalThis, "cancelAnimationFrame", originalCancelAnimationFrame);
  });

  it("does not keep a frame loop alive while disabled", () => {
    const governor = createStressGovernor();

    try {
      expect(activeHandles.size).toBe(0);

      governor.setEnabled(true);
      expect(activeHandles.size).toBe(1);

      governor.setEnabled(false);
      expect(activeHandles.size).toBe(0);
    } finally {
      governor.destroy();
    }
  });
});
