import { formatDurationMs } from "../../pipeline.service";

export function formatRelativeDuration(valueMs: number | null): string {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs) || valueMs < 0) {
    return "n/a";
  }

  const totalSeconds = Math.floor(valueMs / 1000);
  if (totalSeconds < 1) {
    return "<1s";
  }

  if (totalSeconds < 60) {
    return `${String(totalSeconds)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${String(minutes)}m ${String(seconds)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours)}h ${String(remainingMinutes)}m`;
}

export function formatRowsPerSecondValue(rowsPerSecond: number | null): string {
  if (typeof rowsPerSecond !== "number" || !Number.isFinite(rowsPerSecond)) {
    return "n/a";
  }

  return `${Math.round(rowsPerSecond).toLocaleString("en-US")} rows/s`;
}

export function formatRate(
  rowsPerSecond: number | null,
  basis: "average" | "recent" | null
): string {
  const value = formatRowsPerSecondValue(rowsPerSecond);
  if (value === "n/a") {
    return value;
  }

  if (basis === "average") {
    return `${value} (avg)`;
  }

  if (basis === "recent") {
    return `${value} (recent)`;
  }

  return value;
}

export function formatBuildRate(
  percentPerSecond: number | null,
  basis: "average" | "recent" | null
): string {
  if (typeof percentPerSecond !== "number" || !Number.isFinite(percentPerSecond)) {
    return "n/a";
  }

  let value = `${percentPerSecond.toFixed(2)}%/s`;
  if (Math.abs(percentPerSecond) < 0.01) {
    value = `${(percentPerSecond * 60).toFixed(2)}%/min`;
  }
  if (Math.abs(percentPerSecond) < 0.001) {
    value = `${(percentPerSecond * 3600).toFixed(2)}%/hr`;
  }

  if (basis === "average") {
    return `${value} (avg)`;
  }

  if (basis === "recent") {
    return `${value} (recent)`;
  }

  return value;
}

export function formatEta(etaMs: number | null): string {
  if (etaMs === 0) {
    return "0s";
  }

  return formatDurationMs(etaMs);
}

export function formatBytes(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "n/a";
  }

  if (value < 1024) {
    return `${String(value)} B`;
  }

  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(1)} MiB`;
  }

  const gib = mib / 1024;
  return `${gib.toFixed(1)} GiB`;
}
