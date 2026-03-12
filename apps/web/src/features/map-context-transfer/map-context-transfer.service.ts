import {
  type FacilityPerspective,
  FacilityPerspectiveSchema,
  MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
  type MapContextHighlightTarget,
  type MapContextSurface,
  MapContextSurfaceSchema,
  type MapContextTransfer,
  MapContextTransferSchema,
  MapContextViewportSchema,
  parseBboxParam,
} from "@map-migration/contracts";
import { LAYER_IDS } from "@map-migration/map-layer-catalog";
import type {
  LocationQueryRaw,
  LocationQueryValue,
  RouteLocationNormalizedLoaded,
} from "vue-router";
import {
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  fiberLayerId,
  HYDRO_BASINS_LAYER_ID,
  PARCELS_LAYER_ID,
  powerLayerId,
  WATER_FEATURES_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import { basemapLayerIds } from "@/features/basemap/basemap.service";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type {
  ApplyMapContextTransferToAppShellArgs,
  BuildMapContextTransferFromAppShellArgs,
  MapContextTransferStore,
  ReadMapContextTransferFromRouteArgs,
} from "@/features/map-context-transfer/map-context-transfer.types";

const MAP_CONTEXT_STORAGE_KEY_PREFIX = "map.context-transfer";
const MAP_CONTEXT_STORAGE_TTL_MS = 1000 * 60 * 30;
const MAX_INLINE_QUERY_VALUE_LENGTH = 160;

const mapContextSurfaceRouteNames = new Map<string, MapContextSurface>([
  ["map", "global-map"],
  ["market-map", "market-map"],
  ["company-map", "company-map"],
  ["spatial-analysis-dashboard", "selection-dashboard"],
]);

const boundaryLayerIds: readonly BoundaryLayerId[] = ["country", "state", "county"];
const facilityPerspectives: readonly FacilityPerspective[] = ["colocation", "hyperscale"];

type MapContextQueryKey =
  | "basemapLayerIds"
  | "companyIds"
  | "contextToken"
  | "countryIds"
  | "countyIds"
  | "facilityIds"
  | "fiberLonghaulSourceLayerNames"
  | "fiberMetroSourceLayerNames"
  | "highlightTarget"
  | "mapBearing"
  | "mapBounds"
  | "mapCenter"
  | "mapPitch"
  | "mapZoom"
  | "marketIds"
  | "perspectives"
  | "providerIds"
  | "selectionGeometryToken"
  | "sourceSurface"
  | "stateIds"
  | "targetSurface"
  | "visibleLayerIds"
  | "version";

const mapContextQueryKeys: Record<MapContextQueryKey, string> = {
  basemapLayerIds: "basemapLayerIds",
  companyIds: "companyIds",
  contextToken: "mapContextToken",
  countryIds: "countryIds",
  countyIds: "countyIds",
  facilityIds: "facilityIds",
  fiberLonghaulSourceLayerNames: "fiberLonghaulSourceLayerNames",
  fiberMetroSourceLayerNames: "fiberMetroSourceLayerNames",
  highlightTarget: "highlightTarget",
  mapBearing: "mapBearing",
  mapBounds: "mapBounds",
  mapCenter: "mapCenter",
  mapPitch: "mapPitch",
  mapZoom: "mapZoom",
  marketIds: "marketIds",
  perspectives: "perspectives",
  providerIds: "providerIds",
  selectionGeometryToken: "selectionGeometryToken",
  sourceSurface: "mapSource",
  stateIds: "stateIds",
  targetSurface: "mapTarget",
  visibleLayerIds: "visibleLayerIds",
  version: "mapContextVersion",
};

interface StoredMapContextTransferRecord {
  readonly context: MapContextTransfer;
  readonly expiresAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFirstQueryValue(
  value: LocationQueryValue | readonly LocationQueryValue[] | undefined
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const firstValue = value.find((candidate) => typeof candidate === "string");
    return typeof firstValue === "string" ? firstValue : null;
  }

  return null;
}

function readStringList(
  value: LocationQueryValue | readonly LocationQueryValue[] | undefined
): readonly string[] | undefined {
  const rawValue = readFirstQueryValue(value);
  if (rawValue === null) {
    return undefined;
  }

  const items = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length === 0 ? undefined : items;
}

function formatStringList(values: readonly string[] | undefined): string | undefined {
  if (typeof values === "undefined" || values.length === 0) {
    return undefined;
  }

  return values.join(",");
}

function parseFiniteNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSurface(value: string | null): MapContextSurface | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = MapContextSurfaceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parsePerspectives(
  value: LocationQueryValue | readonly LocationQueryValue[] | undefined
): readonly FacilityPerspective[] | undefined {
  const rawPerspectives = readStringList(value);
  if (typeof rawPerspectives === "undefined") {
    return undefined;
  }

  const perspectives: FacilityPerspective[] = [];

  for (const rawPerspective of rawPerspectives) {
    const parsedPerspective = FacilityPerspectiveSchema.safeParse(rawPerspective);
    if (parsedPerspective.success) {
      perspectives.push(parsedPerspective.data);
    }
  }

  return perspectives.length === 0 ? undefined : perspectives;
}

function formatPerspectives(
  perspectives: readonly FacilityPerspective[] | undefined
): string | undefined {
  return formatStringList(perspectives);
}

function parseHighlightTarget(value: string | null): MapContextHighlightTarget | undefined {
  if (value === null) {
    return undefined;
  }

  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return undefined;
  }

  const kind = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  const parsed = MapContextTransferSchema.shape.highlightTarget.safeParse({ id, kind });

  return parsed.success ? parsed.data : undefined;
}

function formatHighlightTarget(target: MapContextHighlightTarget | undefined): string | undefined {
  if (typeof target === "undefined") {
    return undefined;
  }

  return `${target.kind}:${target.id}`;
}

function parseViewport(
  route: RouteLocationNormalizedLoaded
): MapContextTransfer["viewport"] | undefined {
  const bearing = parseFiniteNumber(
    readFirstQueryValue(route.query[mapContextQueryKeys.mapBearing])
  );
  const pitch = parseFiniteNumber(readFirstQueryValue(route.query[mapContextQueryKeys.mapPitch]));
  const bounds = readFirstQueryValue(route.query[mapContextQueryKeys.mapBounds]);
  if (bounds !== null) {
    const parsedBounds = parseBboxParam(bounds);
    if (parsedBounds !== null) {
      const viewport = {
        bounds: parsedBounds,
        type: "bounds",
        ...(bearing === null ? {} : { bearing }),
        ...(pitch === null ? {} : { pitch }),
      };
      const parsedViewport = MapContextViewportSchema.safeParse(viewport);
      return parsedViewport.success ? parsedViewport.data : undefined;
    }
  }

  const centerValue = readFirstQueryValue(route.query[mapContextQueryKeys.mapCenter]);
  const zoomValue = readFirstQueryValue(route.query[mapContextQueryKeys.mapZoom]);
  if (centerValue === null || zoomValue === null) {
    return undefined;
  }

  const centerParts = centerValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item));
  const zoom = parseFiniteNumber(zoomValue);
  if (centerParts.length !== 2 || zoom === null) {
    return undefined;
  }

  const longitude = centerParts[0];
  const latitude = centerParts[1];
  const parsedCenterViewport = MapContextViewportSchema.safeParse({
    ...(bearing === null ? {} : { bearing }),
    center: [longitude, latitude],
    ...(pitch === null ? {} : { pitch }),
    type: "center",
    zoom,
  });

  return parsedCenterViewport.success ? parsedCenterViewport.data : undefined;
}

function formatViewport(context: MapContextTransfer): {
  readonly mapBearing?: string;
  readonly mapBounds?: string;
  readonly mapCenter?: string;
  readonly mapPitch?: string;
  readonly mapZoom?: string;
} {
  if (typeof context.viewport === "undefined") {
    return {};
  }

  const cameraFields = {
    ...(typeof context.viewport.bearing === "number"
      ? { mapBearing: context.viewport.bearing.toString() }
      : {}),
    ...(typeof context.viewport.pitch === "number"
      ? { mapPitch: context.viewport.pitch.toString() }
      : {}),
  };

  if (context.viewport.type === "bounds") {
    const bounds = context.viewport.bounds;
    return {
      ...cameraFields,
      mapBounds: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    };
  }

  return {
    ...cameraFields,
    mapCenter: `${context.viewport.center[0]},${context.viewport.center[1]}`,
    mapZoom: context.viewport.zoom.toString(),
  };
}

function inferTargetSurface(route: RouteLocationNormalizedLoaded): MapContextSurface | undefined {
  if (typeof route.name !== "string") {
    return undefined;
  }

  return mapContextSurfaceRouteNames.get(route.name);
}

function mergeSelectedBoundaryIds(
  storedBoundaryIds: MapContextTransfer["selectedBoundaryIds"],
  shortBoundaryIds: MapContextTransfer["selectedBoundaryIds"]
): MapContextTransfer["selectedBoundaryIds"] {
  if (typeof storedBoundaryIds === "undefined") {
    return shortBoundaryIds;
  }

  if (typeof shortBoundaryIds === "undefined") {
    return storedBoundaryIds;
  }

  return {
    country: shortBoundaryIds.country ?? storedBoundaryIds.country,
    county: shortBoundaryIds.county ?? storedBoundaryIds.county,
    state: shortBoundaryIds.state ?? storedBoundaryIds.state,
  };
}

function isRouteScopedMapSurface(
  surface: MapContextSurface | undefined
): surface is "company-map" | "market-map" {
  return surface === "company-map" || surface === "market-map";
}

function assignMapContextField<
  TOutput extends Partial<MapContextTransfer>,
  TKey extends keyof TOutput,
>(output: TOutput, key: TKey, value: TOutput[TKey] | undefined): void {
  if (typeof value === "undefined") {
    return;
  }

  output[key] = value;
}

function assignMapContextStringField<
  TOutput extends Partial<MapContextTransfer>,
  TKey extends keyof TOutput,
>(output: TOutput, key: TKey, value: string | undefined): void {
  if (typeof value !== "string") {
    return;
  }

  output[key] = value as TOutput[TKey];
}

function buildMergedOptionalMapContextFields(
  storedContext: MapContextTransfer | null,
  shortContext: Partial<MapContextTransfer>
): Omit<MapContextTransfer, "schemaVersion" | "sourceSurface" | "targetSurface"> {
  const mergedFields: Omit<
    MapContextTransfer,
    "schemaVersion" | "sourceSurface" | "targetSurface"
  > = {};

  assignMapContextField(
    mergedFields,
    "companyIds",
    shortContext.companyIds ?? storedContext?.companyIds
  );
  assignMapContextField(
    mergedFields,
    "marketIds",
    shortContext.marketIds ?? storedContext?.marketIds
  );
  assignMapContextField(
    mergedFields,
    "providerIds",
    shortContext.providerIds ?? storedContext?.providerIds
  );
  assignMapContextField(
    mergedFields,
    "facilityIds",
    shortContext.facilityIds ?? storedContext?.facilityIds
  );
  assignMapContextField(
    mergedFields,
    "activePerspectives",
    shortContext.activePerspectives ?? storedContext?.activePerspectives
  );
  assignMapContextField(
    mergedFields,
    "visibleLayerIds",
    shortContext.visibleLayerIds ?? storedContext?.visibleLayerIds
  );
  assignMapContextField(
    mergedFields,
    "visibleBasemapLayerIds",
    shortContext.visibleBasemapLayerIds ?? storedContext?.visibleBasemapLayerIds
  );
  assignMapContextField(
    mergedFields,
    "selectedBoundaryIds",
    mergeSelectedBoundaryIds(storedContext?.selectedBoundaryIds, shortContext.selectedBoundaryIds)
  );
  assignMapContextField(
    mergedFields,
    "selectedFiberSourceLayerNames",
    shortContext.selectedFiberSourceLayerNames ?? storedContext?.selectedFiberSourceLayerNames
  );
  assignMapContextField(mergedFields, "viewport", shortContext.viewport ?? storedContext?.viewport);
  assignMapContextStringField(
    mergedFields,
    "selectionGeometryToken",
    shortContext.selectionGeometryToken ?? storedContext?.selectionGeometryToken
  );
  assignMapContextField(
    mergedFields,
    "highlightTarget",
    shortContext.highlightTarget ?? storedContext?.highlightTarget
  );
  assignMapContextStringField(
    mergedFields,
    "contextToken",
    shortContext.contextToken ?? storedContext?.contextToken
  );

  return mergedFields;
}

function mergeMapContextTransfer(
  storedContext: MapContextTransfer | null,
  shortContext: Partial<MapContextTransfer>,
  routeTargetSurface: MapContextSurface | undefined
): MapContextTransfer | null {
  if (storedContext === null && Object.keys(shortContext).length === 0) {
    if (isRouteScopedMapSurface(routeTargetSurface)) {
      return {
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: routeTargetSurface,
        targetSurface: routeTargetSurface,
      };
    }

    return null;
  }

  const sourceSurface =
    shortContext.sourceSurface ??
    storedContext?.sourceSurface ??
    routeTargetSurface ??
    "global-map";
  const targetSurface =
    routeTargetSurface ??
    shortContext.targetSurface ??
    storedContext?.targetSurface ??
    "global-map";

  return {
    schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
    sourceSurface,
    targetSurface,
    ...buildMergedOptionalMapContextFields(storedContext, shortContext),
  };
}

function buildRouteSelectedBoundaryIds(
  route: RouteLocationNormalizedLoaded
): MapContextTransfer["selectedBoundaryIds"] | undefined {
  const countryIds = readStringList(route.query[mapContextQueryKeys.countryIds]);
  const countyIds = readStringList(route.query[mapContextQueryKeys.countyIds]);
  const stateIds = readStringList(route.query[mapContextQueryKeys.stateIds]);
  if (
    typeof countryIds === "undefined" &&
    typeof countyIds === "undefined" &&
    typeof stateIds === "undefined"
  ) {
    return undefined;
  }

  return {
    country: typeof countryIds === "undefined" ? undefined : [...countryIds],
    county: typeof countyIds === "undefined" ? undefined : [...countyIds],
    state: typeof stateIds === "undefined" ? undefined : [...stateIds],
  };
}

function buildRouteSelectedFiberSourceLayerNames(
  route: RouteLocationNormalizedLoaded
): MapContextTransfer["selectedFiberSourceLayerNames"] | undefined {
  const metroFiberSourceLayerNames = readStringList(
    route.query[mapContextQueryKeys.fiberMetroSourceLayerNames]
  );
  const longhaulFiberSourceLayerNames = readStringList(
    route.query[mapContextQueryKeys.fiberLonghaulSourceLayerNames]
  );

  if (
    typeof metroFiberSourceLayerNames === "undefined" &&
    typeof longhaulFiberSourceLayerNames === "undefined"
  ) {
    return undefined;
  }

  return {
    ...(typeof longhaulFiberSourceLayerNames === "undefined"
      ? {}
      : { longhaul: [...longhaulFiberSourceLayerNames] }),
    ...(typeof metroFiberSourceLayerNames === "undefined"
      ? {}
      : { metro: [...metroFiberSourceLayerNames] }),
  };
}

function buildShortContextFieldsFromRoute(
  route: RouteLocationNormalizedLoaded
): Partial<MapContextTransfer> {
  const shortContext: Partial<MapContextTransfer> = {};

  assignMapContextField(
    shortContext,
    "sourceSurface",
    parseSurface(readFirstQueryValue(route.query[mapContextQueryKeys.sourceSurface]))
  );
  assignMapContextField(
    shortContext,
    "targetSurface",
    parseSurface(readFirstQueryValue(route.query[mapContextQueryKeys.targetSurface]))
  );
  assignMapContextField(
    shortContext,
    "marketIds",
    readStringList(route.query[mapContextQueryKeys.marketIds])?.slice()
  );
  assignMapContextField(
    shortContext,
    "companyIds",
    readStringList(route.query[mapContextQueryKeys.companyIds])?.slice()
  );
  assignMapContextField(
    shortContext,
    "providerIds",
    readStringList(route.query[mapContextQueryKeys.providerIds])?.slice()
  );
  assignMapContextField(
    shortContext,
    "facilityIds",
    readStringList(route.query[mapContextQueryKeys.facilityIds])?.slice()
  );
  assignMapContextField(
    shortContext,
    "activePerspectives",
    parsePerspectives(route.query[mapContextQueryKeys.perspectives])?.slice()
  );
  assignMapContextField(
    shortContext,
    "visibleLayerIds",
    readStringList(route.query[mapContextQueryKeys.visibleLayerIds])?.slice()
  );
  assignMapContextField(
    shortContext,
    "visibleBasemapLayerIds",
    readStringList(route.query[mapContextQueryKeys.basemapLayerIds])?.slice()
  );
  assignMapContextField(shortContext, "selectedBoundaryIds", buildRouteSelectedBoundaryIds(route));
  assignMapContextField(
    shortContext,
    "selectedFiberSourceLayerNames",
    buildRouteSelectedFiberSourceLayerNames(route)
  );
  assignMapContextField(shortContext, "viewport", parseViewport(route));
  assignMapContextStringField(
    shortContext,
    "selectionGeometryToken",
    readFirstQueryValue(route.query[mapContextQueryKeys.selectionGeometryToken]) ?? undefined
  );
  assignMapContextField(
    shortContext,
    "highlightTarget",
    parseHighlightTarget(readFirstQueryValue(route.query[mapContextQueryKeys.highlightTarget]))
  );
  assignMapContextStringField(
    shortContext,
    "contextToken",
    readFirstQueryValue(route.query[mapContextQueryKeys.contextToken]) ?? undefined
  );

  return shortContext;
}

function buildShortContextFromRoute(
  route: RouteLocationNormalizedLoaded
): Partial<MapContextTransfer> {
  const version = parseFiniteNumber(readFirstQueryValue(route.query[mapContextQueryKeys.version]));
  if (version !== null && version !== MAP_CONTEXT_TRANSFER_SCHEMA_VERSION) {
    return {};
  }

  return buildShortContextFieldsFromRoute(route);
}

function createStoredRecord(context: MapContextTransfer): StoredMapContextTransferRecord {
  return {
    context,
    expiresAt: Date.now() + MAP_CONTEXT_STORAGE_TTL_MS,
  };
}

function generateContextToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredRecord(rawValue: string): StoredMapContextTransferRecord | null {
  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) {
      return null;
    }

    const expiresAt = Reflect.get(parsedValue, "expiresAt");
    const context = Reflect.get(parsedValue, "context");
    if (typeof expiresAt !== "number" || expiresAt <= Date.now()) {
      return null;
    }

    const parsedContext = MapContextTransferSchema.safeParse(context);
    if (!parsedContext.success) {
      return null;
    }

    return {
      context: parsedContext.data,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function createSessionStorageMapContextTransferStore(): MapContextTransferStore {
  return {
    load(token: string): MapContextTransfer | null {
      if (typeof window === "undefined") {
        return null;
      }

      const rawRecord = window.sessionStorage.getItem(`${MAP_CONTEXT_STORAGE_KEY_PREFIX}.${token}`);
      if (rawRecord === null) {
        return null;
      }

      const storedRecord = readStoredRecord(rawRecord);
      if (storedRecord === null) {
        window.sessionStorage.removeItem(`${MAP_CONTEXT_STORAGE_KEY_PREFIX}.${token}`);
        return null;
      }

      return storedRecord.context;
    },
    save(context: MapContextTransfer): string {
      const parsedContext = MapContextTransferSchema.safeParse(context);
      if (!parsedContext.success) {
        throw new Error("Cannot persist an invalid map context transfer payload.");
      }

      const token = generateContextToken();
      if (typeof window === "undefined") {
        return token;
      }

      const record = createStoredRecord(parsedContext.data);
      window.sessionStorage.setItem(
        `${MAP_CONTEXT_STORAGE_KEY_PREFIX}.${token}`,
        JSON.stringify(record)
      );

      return token;
    },
  };
}

function inlineOrOmit(values: readonly string[] | undefined): readonly string[] | undefined {
  const formattedValues = formatStringList(values);
  if (typeof formattedValues === "undefined") {
    return undefined;
  }

  return formattedValues.length <= MAX_INLINE_QUERY_VALUE_LENGTH ? values : undefined;
}

export function readMapContextTransferFromRoute(
  args: ReadMapContextTransferFromRouteArgs
): MapContextTransfer | null {
  const store = args.store ?? createSessionStorageMapContextTransferStore();
  const routeTargetSurface = inferTargetSurface(args.route);
  const shortContext = buildShortContextFromRoute(args.route);
  const storedToken = shortContext.contextToken;
  const storedContext =
    typeof storedToken === "string" && storedToken.length > 0 ? store.load(storedToken) : null;
  const mergedContext = mergeMapContextTransfer(storedContext, shortContext, routeTargetSurface);

  if (mergedContext === null) {
    return null;
  }

  const parsedContext = MapContextTransferSchema.safeParse(mergedContext);
  return parsedContext.success ? parsedContext.data : null;
}

export function buildMapContextTransferQuery(
  context: MapContextTransfer,
  store: MapContextTransferStore = createSessionStorageMapContextTransferStore()
): LocationQueryRaw {
  const inlineMarketIds = inlineOrOmit(context.marketIds);
  const inlineCompanyIds = inlineOrOmit(context.companyIds);
  const inlineProviderIds = inlineOrOmit(context.providerIds);
  const inlineFacilityIds = inlineOrOmit(context.facilityIds);
  const inlineVisibleLayerIds = inlineOrOmit(context.visibleLayerIds);
  const inlineVisibleBasemapLayerIds = inlineOrOmit(context.visibleBasemapLayerIds);
  const inlineMetroFiberSourceLayerNames = inlineOrOmit(
    context.selectedFiberSourceLayerNames?.metro
  );
  const inlineLonghaulFiberSourceLayerNames = inlineOrOmit(
    context.selectedFiberSourceLayerNames?.longhaul
  );
  const requiresStoredContext =
    inlineMarketIds !== context.marketIds ||
    inlineCompanyIds !== context.companyIds ||
    inlineProviderIds !== context.providerIds ||
    inlineFacilityIds !== context.facilityIds ||
    inlineVisibleLayerIds !== context.visibleLayerIds ||
    inlineVisibleBasemapLayerIds !== context.visibleBasemapLayerIds ||
    inlineMetroFiberSourceLayerNames !== context.selectedFiberSourceLayerNames?.metro ||
    inlineLonghaulFiberSourceLayerNames !== context.selectedFiberSourceLayerNames?.longhaul;
  let contextToken: string | undefined;
  if (typeof context.contextToken === "string") {
    contextToken = context.contextToken;
  } else if (requiresStoredContext) {
    contextToken = store.save(context);
  }
  const viewportQuery = formatViewport(context);

  return {
    [mapContextQueryKeys.version]: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION.toString(),
    [mapContextQueryKeys.sourceSurface]: context.sourceSurface,
    [mapContextQueryKeys.targetSurface]: context.targetSurface,
    [mapContextQueryKeys.marketIds]: formatStringList(inlineMarketIds),
    [mapContextQueryKeys.companyIds]: formatStringList(inlineCompanyIds),
    [mapContextQueryKeys.providerIds]: formatStringList(inlineProviderIds),
    [mapContextQueryKeys.facilityIds]: formatStringList(inlineFacilityIds),
    [mapContextQueryKeys.perspectives]: formatPerspectives(context.activePerspectives),
    [mapContextQueryKeys.visibleLayerIds]: formatStringList(inlineVisibleLayerIds),
    [mapContextQueryKeys.basemapLayerIds]: formatStringList(inlineVisibleBasemapLayerIds),
    [mapContextQueryKeys.countryIds]: formatStringList(context.selectedBoundaryIds?.country),
    [mapContextQueryKeys.countyIds]: formatStringList(context.selectedBoundaryIds?.county),
    [mapContextQueryKeys.stateIds]: formatStringList(context.selectedBoundaryIds?.state),
    [mapContextQueryKeys.fiberMetroSourceLayerNames]: formatStringList(
      inlineMetroFiberSourceLayerNames
    ),
    [mapContextQueryKeys.fiberLonghaulSourceLayerNames]: formatStringList(
      inlineLonghaulFiberSourceLayerNames
    ),
    [mapContextQueryKeys.selectionGeometryToken]: context.selectionGeometryToken,
    [mapContextQueryKeys.highlightTarget]: formatHighlightTarget(context.highlightTarget),
    [mapContextQueryKeys.contextToken]: contextToken,
    [mapContextQueryKeys.mapBearing]: viewportQuery.mapBearing,
    [mapContextQueryKeys.mapBounds]: viewportQuery.mapBounds,
    [mapContextQueryKeys.mapCenter]: viewportQuery.mapCenter,
    [mapContextQueryKeys.mapPitch]: viewportQuery.mapPitch,
    [mapContextQueryKeys.mapZoom]: viewportQuery.mapZoom,
  };
}

export function replaceMapContextTransferQuery(
  currentQuery: LocationQueryRaw,
  nextMapContextQuery: LocationQueryRaw
): LocationQueryRaw {
  const nextQuery = {
    ...currentQuery,
  };

  for (const queryKey of Object.values(mapContextQueryKeys)) {
    delete nextQuery[queryKey];
  }

  for (const [queryKey, queryValue] of Object.entries(nextMapContextQuery)) {
    if (typeof queryValue === "undefined") {
      continue;
    }

    nextQuery[queryKey] = queryValue;
  }

  return nextQuery;
}

export function normalizeMapContextTransferQuery(
  query: LocationQueryRaw
): Readonly<Record<string, string>> {
  const normalizedQuery: Record<string, string> = {};

  for (const queryKey of Object.values(mapContextQueryKeys)) {
    const rawQueryValue = query[queryKey];
    let queryValue: string | null = null;
    if (typeof rawQueryValue === "string") {
      queryValue = rawQueryValue;
    } else if (Array.isArray(rawQueryValue)) {
      queryValue =
        rawQueryValue.find((value): value is string => typeof value === "string") ?? null;
    }

    if (queryValue === null) {
      continue;
    }

    normalizedQuery[queryKey] = queryValue;
  }

  return normalizedQuery;
}

function selectedBoundaryIdsPresent(
  selection: BuildMapContextTransferFromAppShellArgs["boundaryFacetSelection"]
): boolean {
  return boundaryLayerIds.some((boundaryId) => {
    const selectedIds = selection[boundaryId];
    return Array.isArray(selectedIds) && selectedIds.length > 0;
  });
}

function buildSelectedBoundaryIds(
  selection: BuildMapContextTransferFromAppShellArgs["boundaryFacetSelection"]
): MapContextTransfer["selectedBoundaryIds"] | undefined {
  if (!selectedBoundaryIdsPresent(selection)) {
    return undefined;
  }

  const selectedBoundaryIds: NonNullable<MapContextTransfer["selectedBoundaryIds"]> = {};

  for (const boundaryId of boundaryLayerIds) {
    const selectedIds = selection[boundaryId];
    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      selectedBoundaryIds[boundaryId] = [...selectedIds];
    }
  }

  return selectedBoundaryIds;
}

function roundViewportValue(value: number): number {
  return Number(value.toFixed(6));
}

function resolveVisibleLayerIds(
  snapshot: BuildMapContextTransferFromAppShellArgs["layerRuntimeSnapshot"]
): readonly string[] | undefined {
  if (snapshot === null || typeof snapshot === "undefined") {
    return undefined;
  }

  const visibleLayerIds = Object.entries(snapshot.userVisibility)
    .filter((entry): entry is [string, boolean] => entry[1] === true)
    .map(([layerId]) => layerId)
    .sort();

  return visibleLayerIds.length > 0 ? visibleLayerIds : undefined;
}

function applyBooleanVisibilityLayer(
  visibleLayerIds: Set<string>,
  layerId: string,
  visible: boolean | undefined
): void {
  if (typeof visible !== "boolean") {
    return;
  }

  if (visible) {
    visibleLayerIds.add(layerId);
    return;
  }

  visibleLayerIds.delete(layerId);
}

function applyBoundaryVisibilityLayers(
  visibleLayerIds: Set<string>,
  boundaryVisibility: BuildMapContextTransferFromAppShellArgs["boundaryVisibility"]
): void {
  if (typeof boundaryVisibility === "undefined") {
    return;
  }

  for (const boundaryId of boundaryLayerIds) {
    applyBooleanVisibilityLayer(visibleLayerIds, boundaryId, boundaryVisibility[boundaryId]);
  }
}

function applyPerspectiveVisibilityLayers(
  visibleLayerIds: Set<string>,
  visiblePerspectives: BuildMapContextTransferFromAppShellArgs["visiblePerspectives"]
): void {
  applyBooleanVisibilityLayer(
    visibleLayerIds,
    "facilities.colocation",
    visiblePerspectives.colocation
  );
  applyBooleanVisibilityLayer(
    visibleLayerIds,
    "facilities.hyperscale",
    visiblePerspectives.hyperscale
  );
}

function applyFloodVisibilityLayers(
  visibleLayerIds: Set<string>,
  floodVisibility: BuildMapContextTransferFromAppShellArgs["floodVisibility"]
): void {
  if (typeof floodVisibility === "undefined") {
    return;
  }

  applyBooleanVisibilityLayer(visibleLayerIds, FLOOD_100_LAYER_ID, floodVisibility.flood100);
  applyBooleanVisibilityLayer(visibleLayerIds, FLOOD_500_LAYER_ID, floodVisibility.flood500);
}

function applyPowerVisibilityLayers(
  visibleLayerIds: Set<string>,
  powerVisibility: BuildMapContextTransferFromAppShellArgs["powerVisibility"]
): void {
  if (typeof powerVisibility === "undefined") {
    return;
  }

  for (const powerId of ["transmission", "substations", "plants"] as const) {
    applyBooleanVisibilityLayer(visibleLayerIds, powerLayerId(powerId), powerVisibility[powerId]);
  }
}

function applyFiberVisibilityLayers(
  visibleLayerIds: Set<string>,
  fiberVisibility: BuildMapContextTransferFromAppShellArgs["fiberVisibility"]
): void {
  if (typeof fiberVisibility === "undefined") {
    return;
  }

  for (const lineId of ["metro", "longhaul"] as const) {
    applyBooleanVisibilityLayer(visibleLayerIds, fiberLayerId(lineId), fiberVisibility[lineId]);
  }
}

function resolveVisibleLayerIdsFromAppShell(
  args: BuildMapContextTransferFromAppShellArgs
): readonly string[] | undefined {
  const visibleLayerIds = new Set<string>(resolveVisibleLayerIds(args.layerRuntimeSnapshot) ?? []);

  applyBoundaryVisibilityLayers(visibleLayerIds, args.boundaryVisibility);
  applyPerspectiveVisibilityLayers(visibleLayerIds, args.visiblePerspectives);
  applyFloodVisibilityLayers(visibleLayerIds, args.floodVisibility);
  applyBooleanVisibilityLayer(visibleLayerIds, HYDRO_BASINS_LAYER_ID, args.hydroBasinsVisible);
  applyBooleanVisibilityLayer(visibleLayerIds, PARCELS_LAYER_ID, args.parcelsVisible);
  applyBooleanVisibilityLayer(visibleLayerIds, WATER_FEATURES_LAYER_ID, args.waterVisible);
  applyPowerVisibilityLayers(visibleLayerIds, args.powerVisibility);
  applyFiberVisibilityLayers(visibleLayerIds, args.fiberVisibility);

  const nextVisibleLayerIds = [...visibleLayerIds].sort((left, right) => left.localeCompare(right));
  return nextVisibleLayerIds.length > 0 ? nextVisibleLayerIds : undefined;
}

function resolveVisibleBasemapLayerIds(
  basemapVisibility: BuildMapContextTransferFromAppShellArgs["basemapVisibility"]
): readonly string[] | undefined {
  if (typeof basemapVisibility === "undefined") {
    return undefined;
  }

  const visibleBasemapLayerIds = Object.entries(basemapVisibility)
    .filter((entry): entry is [string, boolean] => entry[1] === true)
    .map(([layerId]) => layerId)
    .sort();

  return visibleBasemapLayerIds.length > 0 ? visibleBasemapLayerIds : undefined;
}

function resolveSelectedFiberSourceLayerNames(
  selectedFiberSourceLayerNames: BuildMapContextTransferFromAppShellArgs["selectedFiberSourceLayerNames"]
): MapContextTransfer["selectedFiberSourceLayerNames"] | undefined {
  if (typeof selectedFiberSourceLayerNames === "undefined") {
    return undefined;
  }

  const longhaul =
    selectedFiberSourceLayerNames.longhaul.length > 0
      ? [...selectedFiberSourceLayerNames.longhaul].sort((left, right) => left.localeCompare(right))
      : undefined;
  const metro =
    selectedFiberSourceLayerNames.metro.length > 0
      ? [...selectedFiberSourceLayerNames.metro].sort((left, right) => left.localeCompare(right))
      : undefined;

  if (typeof longhaul === "undefined" && typeof metro === "undefined") {
    return undefined;
  }

  return {
    ...(typeof longhaul === "undefined" ? {} : { longhaul }),
    ...(typeof metro === "undefined" ? {} : { metro }),
  };
}

function resolveViewportFromMap(
  map: BuildMapContextTransferFromAppShellArgs["map"]
): MapContextTransfer["viewport"] | undefined {
  if (map === null) {
    return undefined;
  }

  return {
    bearing: roundViewportValue(map.getBearing()),
    center: [roundViewportValue(map.getCenter()[0]), roundViewportValue(map.getCenter()[1])],
    pitch: roundViewportValue(map.getPitch()),
    type: "center",
    zoom: roundViewportValue(map.getZoom()),
  };
}

export function buildMapContextTransferFromAppShell(
  args: BuildMapContextTransferFromAppShellArgs
): MapContextTransfer {
  const activePerspectives = facilityPerspectives.filter(
    (perspective) => args.visiblePerspectives[perspective]
  );
  const visibleLayerIds = resolveVisibleLayerIdsFromAppShell(args);
  const visibleBasemapLayerIds = resolveVisibleBasemapLayerIds(args.basemapVisibility);
  const selectedBoundaryIds = buildSelectedBoundaryIds(args.boundaryFacetSelection);
  const selectedFiberSourceLayerNames = resolveSelectedFiberSourceLayerNames(
    args.selectedFiberSourceLayerNames
  );
  const viewport = resolveViewportFromMap(args.map);
  const context: MapContextTransfer = {
    schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
    sourceSurface: args.sourceSurface,
    targetSurface: args.targetSurface,
  };

  if (activePerspectives.length > 0) {
    context.activePerspectives = activePerspectives;
  }

  if (typeof visibleLayerIds !== "undefined") {
    context.visibleLayerIds = [...visibleLayerIds];
  }

  if (typeof visibleBasemapLayerIds !== "undefined") {
    context.visibleBasemapLayerIds = [...visibleBasemapLayerIds];
  }

  if (typeof selectedBoundaryIds !== "undefined") {
    context.selectedBoundaryIds = selectedBoundaryIds;
  }

  if (typeof selectedFiberSourceLayerNames !== "undefined") {
    context.selectedFiberSourceLayerNames = selectedFiberSourceLayerNames;
  }

  if (typeof viewport !== "undefined") {
    context.viewport = viewport;
  }

  if (typeof args.marketIds !== "undefined" && args.marketIds.length > 0) {
    context.marketIds = [...args.marketIds];
  }

  if (typeof args.companyIds !== "undefined" && args.companyIds.length > 0) {
    context.companyIds = [...args.companyIds];
  }

  if (typeof args.providerIds !== "undefined" && args.providerIds.length > 0) {
    context.providerIds = [...args.providerIds];
  }

  if (typeof args.facilityIds !== "undefined" && args.facilityIds.length > 0) {
    context.facilityIds = [...args.facilityIds];
  }

  if (typeof args.selectionGeometryToken === "string") {
    context.selectionGeometryToken = args.selectionGeometryToken;
  }

  if (typeof args.highlightTarget !== "undefined") {
    context.highlightTarget = args.highlightTarget;
  }

  return context;
}

function applyMapViewportContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.viewport === "undefined") {
    return;
  }

  args.setMapViewport?.(args.context.viewport);
}

function applyBasemapVisibilityContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.visibleBasemapLayerIds === "undefined") {
    return;
  }

  const visibleBasemapLayerIds = new Set(args.context.visibleBasemapLayerIds);
  for (const layerId of basemapLayerIds()) {
    args.setBasemapLayerVisible?.(layerId, visibleBasemapLayerIds.has(layerId));
  }
}

function applyPerspectiveVisibilityContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.activePerspectives === "undefined") {
    return;
  }

  for (const perspective of facilityPerspectives) {
    args.setPerspectiveVisibility(
      perspective,
      args.context.activePerspectives.includes(perspective)
    );
  }
}

const mapContextLayerVisibilityAppliers = {
  [FLOOD_100_LAYER_ID]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setFloodLayerVisible?.("flood100", visible);
  },
  [FLOOD_500_LAYER_ID]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setFloodLayerVisible?.("flood500", visible);
  },
  [HYDRO_BASINS_LAYER_ID]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setHydroBasinsVisible?.(visible);
  },
  [PARCELS_LAYER_ID]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setParcelsVisible?.(visible);
  },
  [WATER_FEATURES_LAYER_ID]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setWaterVisible?.(visible);
  },
  [powerLayerId("transmission")]: (
    args: ApplyMapContextTransferToAppShellArgs,
    visible: boolean
  ) => {
    args.setPowerLayerVisible?.("transmission", visible);
  },
  [powerLayerId("substations")]: (
    args: ApplyMapContextTransferToAppShellArgs,
    visible: boolean
  ) => {
    args.setPowerLayerVisible?.("substations", visible);
  },
  [powerLayerId("plants")]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setPowerLayerVisible?.("plants", visible);
  },
  [fiberLayerId("metro")]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setFiberLayerVisibility?.("metro", visible);
  },
  [fiberLayerId("longhaul")]: (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => {
    args.setFiberLayerVisibility?.("longhaul", visible);
  },
} satisfies Partial<
  Record<string, (args: ApplyMapContextTransferToAppShellArgs, visible: boolean) => void>
>;

function applyLayerVisibilityContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.visibleLayerIds === "undefined") {
    return;
  }

  const visibleLayerIds = new Set(args.context.visibleLayerIds);
  for (const layerId of LAYER_IDS) {
    mapContextLayerVisibilityAppliers[layerId]?.(args, visibleLayerIds.has(layerId));
  }
}

function applyFiberSourceLayerSelectionContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.selectedFiberSourceLayerNames === "undefined") {
    return;
  }

  if (typeof args.context.selectedFiberSourceLayerNames.metro !== "undefined") {
    args.setFiberSourceLayerSelection?.("metro", args.context.selectedFiberSourceLayerNames.metro);
  }

  if (typeof args.context.selectedFiberSourceLayerNames.longhaul !== "undefined") {
    args.setFiberSourceLayerSelection?.(
      "longhaul",
      args.context.selectedFiberSourceLayerNames.longhaul
    );
  }
}

function applySelectedBoundaryIdsContext(args: ApplyMapContextTransferToAppShellArgs): void {
  if (args.context === null || typeof args.context.selectedBoundaryIds === "undefined") {
    return;
  }

  for (const boundaryId of boundaryLayerIds) {
    const selectedRegionIds = args.context.selectedBoundaryIds[boundaryId];
    if (typeof selectedRegionIds === "undefined") {
      continue;
    }

    args.setBoundaryVisible(boundaryId, true);
    args.setBoundarySelectedRegionIds(boundaryId, selectedRegionIds);
  }
}

export function applyMapContextTransferToAppShell(
  args: ApplyMapContextTransferToAppShellArgs
): void {
  if (args.context === null) {
    return;
  }

  applyMapViewportContext(args);
  applyBasemapVisibilityContext(args);
  applyPerspectiveVisibilityContext(args);
  applyLayerVisibilityContext(args);
  applyFiberSourceLayerSelectionContext(args);
  applySelectedBoundaryIdsContext(args);
}

export function inferMapContextSurfaceFromRoute(
  route: RouteLocationNormalizedLoaded
): MapContextSurface | null {
  return inferTargetSurface(route) ?? null;
}
