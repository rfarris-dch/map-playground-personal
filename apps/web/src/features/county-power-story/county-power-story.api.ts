import { apiRequestJson } from "@map-migration/core-runtime/api";
import {
  buildCountyPowerStoryGeometryRoute,
  buildCountyPowerStorySnapshotRoute,
  buildCountyPowerStoryTimelineRoute,
  buildCountyPowerStoryVectorTileTemplateRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  CountyPowerStoryGeometryResponseSchema,
  type CountyPowerStoryId,
  CountyPowerStorySnapshotResponseSchema,
  CountyPowerStoryTimelineResponseSchema,
  type CountyPowerStoryWindow,
} from "@map-migration/http-contracts/county-power-story-http";
import type {
  CountyPowerStoryGeometryFetchResult,
  CountyPowerStorySnapshotFetchResult,
  CountyPowerStoryTimelineFetchResult,
} from "./county-power-story.types";

const TRAILING_SLASHES_RE = /\/+$/;

function toAbsoluteAppUrl(path: string): string {
  if (
    typeof window === "undefined" ||
    typeof window.location === "undefined" ||
    typeof window.location.origin !== "string"
  ) {
    return path;
  }

  const normalizedOrigin = window.location.origin.replace(TRAILING_SLASHES_RE, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedPath}`;
}

export function fetchCountyPowerStoryGeometry(
  init: RequestInit = {}
): Promise<CountyPowerStoryGeometryFetchResult> {
  return apiRequestJson(
    buildCountyPowerStoryGeometryRoute(),
    CountyPowerStoryGeometryResponseSchema,
    init
  );
}

export function readCountyPowerStoryVectorTileTemplate(): string {
  return toAbsoluteAppUrl(buildCountyPowerStoryVectorTileTemplateRoute());
}

export function fetchCountyPowerStorySnapshot(
  storyId: CountyPowerStoryId,
  options: {
    readonly publicationRunId?: string | undefined;
    readonly window?: CountyPowerStoryWindow | undefined;
  } = {},
  init: RequestInit = {}
): Promise<CountyPowerStorySnapshotFetchResult> {
  return apiRequestJson(
    buildCountyPowerStorySnapshotRoute(storyId, options),
    CountyPowerStorySnapshotResponseSchema,
    init
  );
}

export function fetchCountyPowerStoryTimeline(
  storyId: CountyPowerStoryId,
  options: {
    readonly publicationRunId?: string | undefined;
  } = {},
  init: RequestInit = {}
): Promise<CountyPowerStoryTimelineFetchResult> {
  return apiRequestJson(
    buildCountyPowerStoryTimelineRoute(storyId, options),
    CountyPowerStoryTimelineResponseSchema,
    init
  );
}
