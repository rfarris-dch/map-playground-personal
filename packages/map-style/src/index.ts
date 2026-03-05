import { LAYER_ORDER_INVARIANTS } from "@/manifests/layer-order";
import type { StyleDocument } from "./index.types";

export type { StyleDocument, StyleLayer } from "./index.types";

export function createBaseStyle(name = "Map Platform Core"): StyleDocument {
  return {
    version: 8,
    name,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#f8f7f3",
        },
      },
    ],
  };
}

export function validateLayerOrder(layerIds: string[]): string[] {
  const failures: string[] = [];

  for (const [key, [mustComeFirst, mustComeSecond]] of Object.entries(LAYER_ORDER_INVARIANTS)) {
    const first = layerIds.indexOf(mustComeFirst);
    const second = layerIds.indexOf(mustComeSecond);

    if (first >= 0 && second >= 0 && first >= second) {
      failures.push(`${key} failed: ${mustComeFirst} must be before ${mustComeSecond}`);
    }
  }

  return failures;
}
