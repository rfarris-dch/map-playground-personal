import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { MapRenderedFeature } from "@map-migration/map-engine";
import { readNullableNumberProperty, readPointCenter } from "@/lib/map-feature-readers";
import type { FacilityClusterPowerSegment, FacilityClusterSummary } from "./facilities-cluster.types";

const COLOCATION_SEGMENT_COLORS = [
  "oklch(0.62 0.14 250)",
  "oklch(0.76 0.1 250)",
  "oklch(0.9 0.05 250)",
];
const HYPERSCALE_SEGMENT_COLORS = [
  "oklch(0.65 0.15 162)",
  "oklch(0.78 0.1 162)",
  "oklch(0.92 0.05 162)",
];

export function buildFacilitiesClusterProperties(): Record<string, unknown> {
  return {
    commissionedPowerMw: ["+", ["to-number", ["coalesce", ["get", "commissionedPowerMw"], 0]]],
    underConstructionPowerMw: [
      "+",
      ["to-number", ["coalesce", ["get", "underConstructionPowerMw"], 0]],
    ],
    plannedPowerMw: ["+", ["to-number", ["coalesce", ["get", "plannedPowerMw"], 0]]],
    availablePowerMw: ["+", ["to-number", ["coalesce", ["get", "availablePowerMw"], 0]]],
  };
}

export function getFacilityClusterPrimaryLabel(perspective: FacilityPerspective): string {
  if (perspective === "hyperscale") {
    return "Operational";
  }

  return "Leased";
}

function getFacilityClusterPrimaryShortLabel(perspective: FacilityPerspective): string {
  if (perspective === "hyperscale") {
    return "Oper.";
  }

  return "Leased";
}

export function buildFacilityClusterPowerSegments(
  summary: Pick<
    FacilityClusterSummary,
    "commissionedPowerMw" | "perspective" | "plannedPowerMw" | "underConstructionPowerMw"
  >
): readonly FacilityClusterPowerSegment[] {
  const colors =
    summary.perspective === "hyperscale" ? HYPERSCALE_SEGMENT_COLORS : COLOCATION_SEGMENT_COLORS;

  return [
    {
      color: colors[0] ?? "#3b82f6",
      label: getFacilityClusterPrimaryLabel(summary.perspective),
      shortLabel: getFacilityClusterPrimaryShortLabel(summary.perspective),
      value: summary.commissionedPowerMw,
    },
    {
      color: colors[1] ?? "#60a5fa",
      label: "Under Construction",
      shortLabel: "UC",
      value: summary.underConstructionPowerMw,
    },
    {
      color: colors[2] ?? "#bfdbfe",
      label: "Planned",
      shortLabel: "Planned",
      value: summary.plannedPowerMw,
    },
  ];
}

export function readFacilityClusterSummary(
  feature: Pick<MapRenderedFeature, "geometry" | "properties">,
  perspective: FacilityPerspective
): FacilityClusterSummary | null {
  if (feature.geometry.type !== "Point") {
    return null;
  }

  const clusterId = readNullableNumberProperty(feature.properties, "cluster_id");
  const facilityCount = readNullableNumberProperty(feature.properties, "point_count");
  const center = readPointCenter(feature.geometry.coordinates);
  if (clusterId === null || facilityCount === null || center === null) {
    return null;
  }

  return createFacilityClusterSummary({
    center,
    clusterId,
    facilityCount,
    perspective,
    properties: feature.properties,
  });
}

export function createFacilityClusterSummary(args: {
  readonly center: readonly [number, number];
  readonly clusterId: number;
  readonly facilityCount: number;
  readonly perspective: FacilityPerspective;
  readonly properties: unknown;
}): FacilityClusterSummary {
  const commissionedPowerMw =
    readNullableNumberProperty(args.properties, "commissionedPowerMw") ?? 0;
  const underConstructionPowerMw =
    readNullableNumberProperty(args.properties, "underConstructionPowerMw") ?? 0;
  const plannedPowerMw = readNullableNumberProperty(args.properties, "plannedPowerMw") ?? 0;
  const availablePowerMw = readNullableNumberProperty(args.properties, "availablePowerMw") ?? 0;

  return {
    availablePowerMw,
    center: args.center,
    clusterId: args.clusterId,
    commissionedPowerMw,
    facilityCount: args.facilityCount,
    perspective: args.perspective,
    plannedPowerMw,
    totalPowerMw: commissionedPowerMw + underConstructionPowerMw + plannedPowerMw,
    underConstructionPowerMw,
  };
}
