import type { CountyPowerStoryId } from "@map-migration/http-contracts/county-power-story-http";
import type { MapExpression } from "@map-migration/map-engine";
import {
  getCountyPowerStoryExtrusionLayerId,
  getCountyPowerStoryStyleLayerIds,
} from "@map-migration/map-style";
import { countyPowerStoryLayerId } from "@/features/app/core/app-shell.constants";
import type {
  CountyPowerStoryCatalogLayerId,
  CountyPowerStoryVisibleLayerId,
} from "./county-power-story.types";

export const COUNTY_POWER_STORY_SOURCE_ID = "county-power-story.source";
export const COUNTY_POWER_STORY_PHASE_STATE = "countyPowerStoryPhase";
export const COUNTY_POWER_STORY_MORPH_STATE = "countyPowerStoryMorphT";
export const COUNTY_POWER_STORY_STATUS_POLL_MS = 60_000;

const TAU = Math.PI * 2;

export function countyPowerStoryCatalogLayerIds(): readonly CountyPowerStoryCatalogLayerId[] {
  return [
    "models.county-power-grid-stress",
    "models.county-power-queue-pressure",
    "models.county-power-market-structure",
    "models.county-power-policy-watch",
    "models.county-power-3d",
  ];
}

export function countyPowerStoryVisibleLayerIds(): readonly CountyPowerStoryVisibleLayerId[] {
  return [
    "models.county-power-grid-stress",
    "models.county-power-queue-pressure",
    "models.county-power-market-structure",
    "models.county-power-policy-watch",
  ];
}

export function storyIdFromCatalogLayerId(
  layerId: CountyPowerStoryCatalogLayerId
): CountyPowerStoryId | null {
  if (layerId === "models.county-power-grid-stress") {
    return "grid-stress";
  }

  if (layerId === "models.county-power-queue-pressure") {
    return "queue-pressure";
  }

  if (layerId === "models.county-power-market-structure") {
    return "market-structure";
  }

  if (layerId === "models.county-power-policy-watch") {
    return "policy-watch";
  }

  return null;
}

export function countyPowerStoryStyleLayerIds(
  storyId: CountyPowerStoryId
): ReturnType<typeof getCountyPowerStoryStyleLayerIds> {
  return getCountyPowerStoryStyleLayerIds(countyPowerStoryLayerId(storyId));
}

export function countyPowerStoryExtrusionLayerId(): string {
  return getCountyPowerStoryExtrusionLayerId();
}

export function countyPowerStoryEmptySourceData(): {
  readonly features: never[];
  readonly type: "FeatureCollection";
} {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function morphValue(propertyName: string): MapExpression {
  return [
    "+",
    [
      "*",
      ["-", 1, ["coalesce", ["global-state", COUNTY_POWER_STORY_MORPH_STATE], 1]],
      ["coalesce", ["feature-state", `previous${propertyName}`], 0],
    ],
    [
      "*",
      ["coalesce", ["global-state", COUNTY_POWER_STORY_MORPH_STATE], 1],
      [
        "coalesce",
        ["feature-state", propertyName.charAt(0).toLowerCase() + propertyName.slice(1)],
        0,
      ],
    ],
  ];
}

function pulseWaveExpression(): MapExpression {
  return [
    "max",
    0,
    [
      "sin",
      [
        "+",
        ["coalesce", ["global-state", COUNTY_POWER_STORY_PHASE_STATE], 0],
        ["*", ["coalesce", ["feature-state", "seed"], 0], TAU],
      ],
    ],
  ];
}

function morphedNormalizedScoreExpression(): MapExpression {
  return morphValue("NormalizedScore");
}

function morphedOutlineIntensityExpression(): MapExpression {
  return morphValue("OutlineIntensity");
}

function morphedPulseAmplitudeExpression(): MapExpression {
  return morphValue("PulseAmplitude");
}

function pulseOpacityExpression(baseOpacity: number): MapExpression {
  return ["+", baseOpacity, ["*", 0.28, morphedPulseAmplitudeExpression(), pulseWaveExpression()]];
}

function warmScaleExpression(): MapExpression {
  return [
    "interpolate",
    ["linear"],
    morphedNormalizedScoreExpression(),
    0,
    "#fde68a",
    0.55,
    "#f59e0b",
    1,
    "#b91c1c",
  ];
}

function coolScaleExpression(): MapExpression {
  return [
    "interpolate",
    ["linear"],
    morphedNormalizedScoreExpression(),
    0,
    "#dbeafe",
    0.55,
    "#38bdf8",
    1,
    "#0f766e",
  ];
}

function neutralScaleExpression(): MapExpression {
  return [
    "interpolate",
    ["linear"],
    morphedNormalizedScoreExpression(),
    0,
    "#e5e7eb",
    1,
    "#6b7280",
  ];
}

function queueScaleExpression(colorLow: string, colorHigh: string): MapExpression {
  return ["interpolate", ["linear"], morphedNormalizedScoreExpression(), 0, colorLow, 1, colorHigh];
}

function marketStructureFillColorExpression(): MapExpression {
  return [
    "match",
    ["coalesce", ["feature-state", "marketStructure"], "unknown"],
    "organized_market",
    "#2563eb",
    "traditional_vertical",
    "#f59e0b",
    "mixed",
    "#db2777",
    "#6b7280",
  ];
}

function policyFillColorExpression(): MapExpression {
  return [
    "match",
    ["coalesce", ["feature-state", "moratoriumStatus"], "unknown"],
    "active",
    "#b91c1c",
    "watch",
    "#f59e0b",
    "none",
    "#f1f5f9",
    "#9ca3af",
  ];
}

function interactionAdjustedWidthExpression(baseWidth: MapExpression): MapExpression {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    ["+", baseWidth, 1.3],
    ["boolean", ["feature-state", "hover"], false],
    ["+", baseWidth, 0.65],
    baseWidth,
  ];
}

export function countyPowerStoryFillColorExpression(storyId: CountyPowerStoryId): MapExpression {
  if (storyId === "grid-stress") {
    return [
      "case",
      ["==", ["coalesce", ["feature-state", "direction"], "neutral"], "warm"],
      warmScaleExpression(),
      ["==", ["coalesce", ["feature-state", "direction"], "neutral"], "cool"],
      coolScaleExpression(),
      neutralScaleExpression(),
    ];
  }

  if (storyId === "queue-pressure") {
    return [
      "match",
      ["coalesce", ["feature-state", "categoryKey"], "mixed"],
      "solar",
      queueScaleExpression("#fef3c7", "#f59e0b"),
      "storage",
      queueScaleExpression("#dbeafe", "#2563eb"),
      "wind",
      queueScaleExpression("#dcfce7", "#15803d"),
      queueScaleExpression("#f3e8ff", "#7c3aed"),
    ];
  }

  if (storyId === "market-structure") {
    return marketStructureFillColorExpression();
  }

  return policyFillColorExpression();
}

export function countyPowerStoryFillOpacityExpression(storyId: CountyPowerStoryId): MapExpression {
  if (storyId === "market-structure") {
    return ["+", 0.2, ["*", morphedNormalizedScoreExpression(), 0.3]];
  }

  return pulseOpacityExpression(0.18);
}

export function countyPowerStoryOutlineColorExpression(storyId: CountyPowerStoryId): MapExpression {
  if (storyId === "grid-stress") {
    return [
      "case",
      ["==", ["coalesce", ["feature-state", "direction"], "neutral"], "warm"],
      "#7c2d12",
      ["==", ["coalesce", ["feature-state", "direction"], "neutral"], "cool"],
      "#155e75",
      "#334155",
    ];
  }

  if (storyId === "queue-pressure") {
    return [
      "match",
      ["coalesce", ["feature-state", "categoryKey"], "mixed"],
      "solar",
      "#92400e",
      "storage",
      "#1d4ed8",
      "wind",
      "#166534",
      "#6d28d9",
    ];
  }

  if (storyId === "market-structure") {
    return [
      "case",
      ["boolean", ["coalesce", ["feature-state", "isSeamCounty"], false], false],
      "#0f172a",
      "#475569",
    ];
  }

  return [
    "match",
    ["coalesce", ["feature-state", "moratoriumStatus"], "unknown"],
    "active",
    "#7f1d1d",
    "watch",
    "#92400e",
    "#64748b",
  ];
}

export function countyPowerStoryOutlineWidthExpression(storyId: CountyPowerStoryId): MapExpression {
  const multiplier = storyId === "market-structure" ? 1.15 : 1;

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    3,
    interactionAdjustedWidthExpression([
      "+",
      0.4 * multiplier,
      ["*", morphedOutlineIntensityExpression(), 0.7 * multiplier],
    ]),
    8,
    interactionAdjustedWidthExpression([
      "+",
      0.8 * multiplier,
      ["*", morphedOutlineIntensityExpression(), 1.2 * multiplier],
    ]),
    14,
    interactionAdjustedWidthExpression([
      "+",
      1.1 * multiplier,
      ["*", morphedOutlineIntensityExpression(), 1.9 * multiplier],
    ]),
  ];
}

export function countyPowerStoryOutlineDashExpression(
  storyId: CountyPowerStoryId
): MapExpression | undefined {
  if (storyId === "market-structure") {
    return [
      "case",
      ["boolean", ["coalesce", ["feature-state", "isSeamCounty"], false], false],
      ["literal", [1.5, 1.5]],
      ["literal", [1, 0]],
    ];
  }

  if (storyId === "policy-watch") {
    return [
      "case",
      [
        "match",
        ["coalesce", ["feature-state", "moratoriumStatus"], "unknown"],
        "active",
        true,
        "watch",
        true,
        false,
      ],
      ["literal", [2, 1.5]],
      ["literal", [1, 0]],
    ];
  }

  return undefined;
}

export function countyPowerStoryExtrusionHeightExpression(): MapExpression {
  return ["*", 65_000, ["+", 0.1, ["*", morphedNormalizedScoreExpression(), 0.9]]];
}
