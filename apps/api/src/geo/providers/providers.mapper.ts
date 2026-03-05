import type { ProviderTableRow } from "@map-migration/contracts";
import type { ProviderListRow } from "./providers.repo";

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
    throw new Error(`Missing required provider field: ${field}`);
  }

  return parsed;
}

function readNullableInteger(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function readBooleanFlag(value: number | string | boolean | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "t" || normalized === "true" || normalized === "y";
  }

  return false;
}

function readNullableTimestamp(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return readNullableText(value ?? null);
}

export function mapProviderRowsToTableRows(rows: readonly ProviderListRow[]): ProviderTableRow[] {
  return rows.map((row) => ({
    providerId: String(row.provider_id),
    name: readRequiredText(row.name, "name"),
    category: readNullableText(row.category),
    country: readNullableText(row.country),
    state: readNullableText(row.state),
    listingCount: readNullableInteger(row.listing_count),
    supportsHyperscale: readBooleanFlag(row.supports_hyperscale),
    supportsRetail: readBooleanFlag(row.supports_retail),
    supportsWholesale: readBooleanFlag(row.supports_wholesale),
    updatedAt: readNullableTimestamp(row.updated_at),
  }));
}
