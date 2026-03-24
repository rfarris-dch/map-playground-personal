import { describe, expect, it } from "bun:test";
import { createSelfAuthoredQuerySignatureRegistry } from "@/features/app/core/app-shell-url-state.service";

describe("app-shell-url-state service", () => {
  it("ignores older self-authored route signatures when later writes supersede them", () => {
    const registry = createSelfAuthoredQuerySignatureRegistry();

    registry.add('[["map","first"]]');
    registry.add('[["map","second"]]');

    expect(registry.consume('[["map","first"]]')).toBe(true);
    expect(registry.consume('[["map","second"]]')).toBe(true);
    expect(registry.consume('[["map","first"]]')).toBe(false);
  });
});
