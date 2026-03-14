import type { Warning } from "@map-migration/geo-kernel";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import type {
  PageSizeResolution,
  PaginatedEnrichFeatures,
} from "./parcels-route-enrich.service.types";

const PARCELS_MAX_PAGE_SIZE = parsePositiveIntFlag(process.env.PARCELS_MAX_PAGE_SIZE, 20_000);

export function coerceCursor(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

export function resolvePageSize(requestedPageSize: number): PageSizeResolution {
  const warnings: Warning[] = [];
  const pageSize = Math.min(requestedPageSize, PARCELS_MAX_PAGE_SIZE);
  if (pageSize < requestedPageSize) {
    warnings.push({
      code: "PAGE_SIZE_CLAMPED",
      message: `pageSize reduced to ${String(PARCELS_MAX_PAGE_SIZE)} due to server policy`,
    });
  }

  return {
    pageSize,
    warnings,
  };
}

export function paginateEnrichFeatures(
  mappedFeatures: ParcelsFeatureCollection["features"],
  pageSize: number,
  warnings: Warning[]
): PaginatedEnrichFeatures {
  const hasMore = mappedFeatures.length > pageSize;
  const features = hasMore ? mappedFeatures.slice(0, pageSize) : mappedFeatures;
  const nextCursor = hasMore ? (features.at(-1)?.properties.parcelId ?? null) : null;

  if (hasMore) {
    warnings.push({
      code: "POSSIBLY_TRUNCATED",
      message: `Returned pageSize=${String(pageSize)} rows. Continue with meta.nextCursor for more records.`,
    });
  }

  return {
    features,
    hasMore,
    nextCursor,
  };
}
