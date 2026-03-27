import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";

function titleCasePart(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatCodeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => titleCasePart(part.toLowerCase()))
    .join(" ");
}

export function countyLabel(
  row: Pick<CountyScore, "countyFips" | "countyName" | "stateAbbrev">
): string {
  const countyName = row.countyName ?? row.countyFips;
  return row.stateAbbrev === null ? countyName : `${countyName}, ${row.stateAbbrev}`;
}

export function formatMetric(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  });
}

export function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString();
}

export function formatShare(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}%`;
}

export function formatDateTime(value: string | null): string {
  if (value === null) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function formatFeatureFamily(value: string): string {
  return value
    .split("_")
    .map((part) => titleCasePart(part.trim()))
    .join(" ");
}

export function formatCoverageFieldLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    avgRtCongestionComponent: "Avg RT Congestion",
    meteoZone: "Meteo Zone",
    operatorWeatherZone: "Operator Weather Zone",
    operatorZoneLabel: "Operator Zone",
    p95ShadowPrice: "P95 Shadow Price",
    queueMwActive: "Queue MW Active",
    queueProjectCountActive: "Queue Projects",
  };

  return labels[value] ?? value;
}

export function formatCoverageCount(populatedCount: number, totalCount: number): string {
  if (!(Number.isFinite(populatedCount) && Number.isFinite(totalCount)) || totalCount <= 0) {
    return "-";
  }

  return `${populatedCount.toLocaleString()} / ${totalCount.toLocaleString()}`;
}

export function formatCoveragePercent(populatedCount: number, totalCount: number): string {
  if (!(Number.isFinite(populatedCount) && Number.isFinite(totalCount)) || totalCount <= 0) {
    return "-";
  }

  return `${((populatedCount / totalCount) * 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}%`;
}

export function formatSourceSystem(value: string): string {
  return formatCodeLabel(value);
}

export function formatDeferredReason(value: string): string {
  return formatCodeLabel(value);
}

export function formatNullableText(value: string | null | undefined, fallback = "-"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function formatBooleanPresence(
  value: boolean | null | undefined,
  labels: {
    readonly falseLabel?: string;
    readonly nullLabel?: string;
    readonly trueLabel?: string;
  } = {}
): string {
  if (value === true) {
    return labels.trueLabel ?? "Yes";
  }

  if (value === false) {
    return labels.falseLabel ?? "No";
  }

  return labels.nullLabel ?? "-";
}

export function formatPillarValueState(value: CountyScore["pillarValueStates"]["demand"]): string {
  return formatCodeLabel(value);
}

export function formatTier(value: CountyScore["attractivenessTier"]): string {
  return value
    .split("_")
    .map((part) => titleCasePart(part))
    .join(" ");
}

export function formatRankStatus(value: CountyScore["rankStatus"]): string {
  return titleCasePart(value);
}

export function formatSourceVolatility(value: CountyScore["sourceVolatility"]): string {
  return formatCodeLabel(value);
}

export function formatSuppressionState(
  value: CountyScore["confidence"]["suppressionState"]
): string {
  return formatCodeLabel(value);
}

export function formatMarketStructure(
  value: CountyScore["powerMarketContext"]["marketStructure"]
): string {
  return formatCodeLabel(value);
}

export function formatRetailChoiceStatus(
  value: CountyScore["retailStructure"]["retailChoiceStatus"]
): string {
  return formatCodeLabel(value);
}

export function formatCompetitiveAreaType(
  value: CountyScore["retailStructure"]["competitiveAreaType"]
): string {
  return formatCodeLabel(value);
}

export function confidenceToneClass(value: CountyScore["confidenceBadge"]): string {
  if (value === "high") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-950";
  }

  if (value === "medium") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-950";
  }

  return "border-rose-400/40 bg-rose-500/10 text-rose-950";
}

export function rankToneClass(value: CountyScore["rankStatus"]): string {
  if (value === "ranked") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-950";
  }

  if (value === "blocked") {
    return "border-rose-400/40 bg-rose-500/10 text-rose-950";
  }

  return "border-amber-400/40 bg-amber-500/10 text-amber-950";
}

export function suppressionToneClass(value: CountyScore["confidence"]["suppressionState"]): string {
  if (value === "suppressed") {
    return "border-rose-400/40 bg-rose-500/10 text-rose-950";
  }

  if (value === "review_required") {
    return "border-orange-400/40 bg-orange-500/10 text-orange-950";
  }

  if (value === "downgraded") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-950";
  }

  return "border-border/60 bg-background text-foreground/70";
}
