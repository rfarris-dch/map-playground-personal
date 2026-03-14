import type { FacilityPerspective } from "@map-migration/geo-kernel";
import type { MapRenderedFeature } from "@map-migration/map-engine";
import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";
import type {
  FacilityClusterMarkerModel,
  FacilityClusterMarkerReconciliation,
  FacilityClusterMarkerUpdate,
  FacilityClusterPowerSegment,
  FacilityClusterSummary,
} from "./facilities-cluster.types";

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
const MARKER_BACKGROUND = "rgba(255, 255, 255, 0.96)";
const MARKER_BORDER = "rgba(15, 23, 42, 0.18)";
const MARKER_TEXT = "#0f172a";
const MARKER_MUTED_TEXT = "#475569";
const MARKER_RING_BACKGROUND = "rgba(148, 163, 184, 0.24)";

function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

function readNullableNumberProperty(properties: unknown, key: string): number | null {
  const value = readProperty(properties, key);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function clusterMarkerSize(facilityCount: number): number {
  if (facilityCount >= 100) {
    return 94;
  }

  if (facilityCount >= 50) {
    return 86;
  }

  if (facilityCount >= 25) {
    return 78;
  }

  if (facilityCount >= 10) {
    return 70;
  }

  return 62;
}

function formatCompactMw(value: number): string {
  if (value >= 1000) {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 0 : 1 })} MW`;
}

function formatCompactCount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function createSvgElement(name: string): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

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

function readPointCenter(coordinates: unknown): readonly [number, number] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  return [longitude, latitude];
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

export function buildFacilityClusterMarkerModel(
  feature: Pick<MapRenderedFeature, "geometry" | "properties">,
  perspective: FacilityPerspective
): FacilityClusterMarkerModel | null {
  const summary = readFacilityClusterSummary(feature, perspective);
  if (summary === null) {
    return null;
  }

  return {
    ...summary,
    sizePx: clusterMarkerSize(summary.facilityCount),
  };
}

export function createFacilityClusterMarkerSignature(model: FacilityClusterMarkerModel): string {
  return [
    model.perspective,
    model.facilityCount,
    model.commissionedPowerMw,
    model.underConstructionPowerMw,
    model.plannedPowerMw,
    model.availablePowerMw,
    model.sizePx,
  ].join(":");
}

function toFacilityClusterMarkerUpdate(
  model: FacilityClusterMarkerModel
): FacilityClusterMarkerUpdate {
  return {
    ...model,
    signature: createFacilityClusterMarkerSignature(model),
  };
}

export function reconcileFacilityClusterMarkers(args: {
  readonly current: ReadonlyMap<number, string>;
  readonly nextModels: readonly FacilityClusterMarkerModel[];
}): FacilityClusterMarkerReconciliation {
  const additions: FacilityClusterMarkerUpdate[] = [];
  const moves: FacilityClusterMarkerUpdate[] = [];
  const removals: number[] = [];
  const replacements: FacilityClusterMarkerUpdate[] = [];
  const seenClusterIds = new Set<number>();

  for (const model of args.nextModels) {
    if (seenClusterIds.has(model.clusterId)) {
      continue;
    }

    seenClusterIds.add(model.clusterId);
    const nextMarker = toFacilityClusterMarkerUpdate(model);
    const currentSignature = args.current.get(model.clusterId);

    if (typeof currentSignature === "undefined") {
      additions.push(nextMarker);
      continue;
    }

    if (currentSignature === nextMarker.signature) {
      moves.push(nextMarker);
      continue;
    }

    replacements.push(nextMarker);
  }

  for (const clusterId of args.current.keys()) {
    if (!seenClusterIds.has(clusterId)) {
      removals.push(clusterId);
    }
  }

  return {
    additions,
    moves,
    removals,
    replacements,
  };
}

function buildMarkerSupplementalText(summary: FacilityClusterSummary): string {
  if (summary.perspective === "colocation" && summary.availablePowerMw > 0) {
    return `Avail. ${formatCompactMw(summary.availablePowerMw)}`;
  }

  return `${getFacilityClusterPrimaryShortLabel(summary.perspective)} ${formatCompactMw(summary.commissionedPowerMw)}`;
}

export function createFacilityClusterMarkerElement(model: FacilityClusterMarkerModel): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.pointerEvents = "none";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "center";
  root.style.gap = "4px";
  root.style.transform = "translateY(-2px)";

  const badge = document.createElement("div");
  badge.style.position = "relative";
  badge.style.width = `${String(model.sizePx)}px`;
  badge.style.height = `${String(model.sizePx)}px`;
  badge.style.borderRadius = "999px";
  badge.style.background = MARKER_BACKGROUND;
  badge.style.border = `1px solid ${MARKER_BORDER}`;
  badge.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.16)";
  badge.style.backdropFilter = "blur(6px)";

  const svg = createSvgElement("svg");
  svg.setAttribute("width", String(model.sizePx));
  svg.setAttribute("height", String(model.sizePx));
  svg.setAttribute("viewBox", `0 0 ${String(model.sizePx)} ${String(model.sizePx)}`);
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const ring = createSvgElement("circle");
  const center = model.sizePx / 2;
  const radius = model.sizePx / 2 - 8;
  ring.setAttribute("cx", String(center));
  ring.setAttribute("cy", String(center));
  ring.setAttribute("r", String(radius));
  ring.setAttribute("stroke", MARKER_RING_BACKGROUND);
  ring.setAttribute("stroke-width", "10");
  svg.append(ring);

  const donutSegments = buildDonutChartArcSegments({
    centerX: center,
    centerY: center,
    radius,
    segments: buildFacilityClusterPowerSegments(model),
  });

  for (const segment of donutSegments) {
    if (segment.path === null) {
      const fullCircle = createSvgElement("circle");
      fullCircle.setAttribute("cx", String(center));
      fullCircle.setAttribute("cy", String(center));
      fullCircle.setAttribute("r", String(radius));
      fullCircle.setAttribute("stroke", segment.color);
      fullCircle.setAttribute("stroke-width", "10");
      svg.append(fullCircle);
      continue;
    }

    const path = createSvgElement("path");
    path.setAttribute("d", segment.path);
    path.setAttribute("stroke", segment.color);
    path.setAttribute("stroke-width", "10");
    path.setAttribute("stroke-linecap", "butt");
    svg.append(path);
  }

  const centerText = document.createElement("div");
  centerText.style.position = "absolute";
  centerText.style.inset = "0";
  centerText.style.display = "flex";
  centerText.style.flexDirection = "column";
  centerText.style.alignItems = "center";
  centerText.style.justifyContent = "center";
  centerText.style.padding = "0 14px";
  centerText.style.textAlign = "center";
  centerText.style.lineHeight = "1.1";

  const mwText = document.createElement("div");
  mwText.textContent = formatCompactMw(model.totalPowerMw);
  mwText.style.color = MARKER_TEXT;
  mwText.style.fontSize = model.sizePx >= 86 ? "11px" : "10px";
  mwText.style.fontWeight = "700";
  mwText.style.letterSpacing = "-0.02em";
  centerText.append(mwText);

  const countBadge = document.createElement("div");
  countBadge.textContent = formatCompactCount(model.facilityCount);
  countBadge.style.position = "absolute";
  countBadge.style.top = "-4px";
  countBadge.style.right = "-4px";
  countBadge.style.minWidth = "22px";
  countBadge.style.height = "22px";
  countBadge.style.padding = "0 7px";
  countBadge.style.borderRadius = "999px";
  countBadge.style.display = "flex";
  countBadge.style.alignItems = "center";
  countBadge.style.justifyContent = "center";
  countBadge.style.background =
    model.perspective === "hyperscale" ? "rgba(5, 150, 105, 0.92)" : "rgba(37, 99, 235, 0.92)";
  countBadge.style.color = "#ffffff";
  countBadge.style.fontSize = "10px";
  countBadge.style.fontWeight = "700";
  countBadge.style.boxShadow = "0 6px 16px rgba(15, 23, 42, 0.16)";

  badge.append(svg, centerText, countBadge);

  const supplemental = document.createElement("div");
  supplemental.textContent = buildMarkerSupplementalText(model);
  supplemental.style.maxWidth = `${String(model.sizePx + 12)}px`;
  supplemental.style.padding = "3px 8px";
  supplemental.style.borderRadius = "999px";
  supplemental.style.background = MARKER_BACKGROUND;
  supplemental.style.border = `1px solid ${MARKER_BORDER}`;
  supplemental.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.12)";
  supplemental.style.color = MARKER_MUTED_TEXT;
  supplemental.style.fontSize = "10px";
  supplemental.style.fontWeight = "600";
  supplemental.style.lineHeight = "1";

  root.title = [
    `${formatCompactCount(model.facilityCount)} facilities`,
    `${getFacilityClusterPrimaryLabel(model.perspective)} ${formatCompactMw(model.commissionedPowerMw)}`,
    `Under Construction ${formatCompactMw(model.underConstructionPowerMw)}`,
    `Planned ${formatCompactMw(model.plannedPowerMw)}`,
  ].join(" • ");

  root.append(badge, supplemental);
  return root;
}
