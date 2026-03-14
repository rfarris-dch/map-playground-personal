import { type FacilityPerspective, parseFacilityPerspectiveParam } from "@map-migration/geo-kernel/facility-perspective";
import { ApiQueryDefaults } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitySortBy,
  FacilitySortBySchema,
  type SortDirection,
  SortDirectionSchema,
} from "@map-migration/http-contracts/table-contracts";
import type { PerspectiveResolution } from "./facilities-route-param.service.types";

export type { PerspectiveResolution } from "./facilities-route-param.service.types";

export function clampLimit(raw: string | undefined, max: number, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }

  return Math.min(Math.floor(value), max);
}

function defaultFacilityPerspective(): FacilityPerspective {
  return ApiQueryDefaults.facilities.perspective;
}

export function resolvePerspectiveParam(value: string | undefined): PerspectiveResolution {
  const parsed = parseFacilityPerspectiveParam(value);
  if (parsed !== null) {
    return {
      ok: true,
      perspective: parsed,
    };
  }

  if (typeof value !== "undefined") {
    return {
      ok: false,
      error: "perspective query param must be one of: colocation, hyperscale",
    };
  }

  return {
    ok: true,
    perspective: defaultFacilityPerspective(),
  };
}

export function resolveFacilitySortBy(value: string | undefined): FacilitySortBy | null {
  if (typeof value === "undefined") {
    return "facilityName";
  }

  const parsed = FacilitySortBySchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function resolveSortDirection(value: string | undefined): SortDirection | null {
  if (typeof value === "undefined") {
    return "asc";
  }

  const parsed = SortDirectionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
