import type { MarketTableRow } from "@map-migration/http-contracts";
import type { MarketListRow } from "@/geo/markets/markets.repo";

function readNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function readRequiredText(value: string | null | undefined, field: string): string {
  const parsed = readNullableText(value);
  if (parsed === null) {
    throw new Error(`Missing required market field: ${field}`);
  }

  return parsed;
}

function readNullableTimestamp(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return readNullableText(value ?? null);
}

export function mapMarketRowsToTableRows(rows: readonly MarketListRow[]): MarketTableRow[] {
  return rows.map((row) => ({
    marketId: String(row.market_id),
    name: readRequiredText(row.name, "name"),
    region: readNullableText(row.region),
    country: readNullableText(row.country),
    state: readNullableText(row.state),
    absorption: readNullableNumber(row.absorption),
    vacancy: readNullableNumber(row.vacancy),
    updatedAt: readNullableTimestamp(row.updated_at),
  }));
}
