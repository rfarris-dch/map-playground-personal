import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";

function titleCasePart(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
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

export function formatDeferredReason(value: string): string {
  return value
    .split("_")
    .map((part) => titleCasePart(part.toLowerCase()))
    .join(" ");
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
