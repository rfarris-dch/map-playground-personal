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
import type {
  LocationQueryRaw,
  LocationQueryValue,
  RouteLocationNormalizedLoaded,
} from "vue-router";
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
  | "companyIds"
  | "contextToken"
  | "countryIds"
  | "countyIds"
  | "facilityIds"
  | "highlightTarget"
  | "mapBounds"
  | "mapCenter"
  | "mapZoom"
  | "marketIds"
  | "perspectives"
  | "providerIds"
  | "selectionGeometryToken"
  | "sourceSurface"
  | "stateIds"
  | "targetSurface"
  | "version";

const mapContextQueryKeys: Record<MapContextQueryKey, string> = {
  companyIds: "companyIds",
  contextToken: "mapContextToken",
  countryIds: "countryIds",
  countyIds: "countyIds",
  facilityIds: "facilityIds",
  highlightTarget: "highlightTarget",
  mapBounds: "mapBounds",
  mapCenter: "mapCenter",
  mapZoom: "mapZoom",
  marketIds: "marketIds",
  perspectives: "perspectives",
  providerIds: "providerIds",
  selectionGeometryToken: "selectionGeometryToken",
  sourceSurface: "mapSource",
  stateIds: "stateIds",
  targetSurface: "mapTarget",
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
  const bounds = readFirstQueryValue(route.query[mapContextQueryKeys.mapBounds]);
  if (bounds !== null) {
    const parsedBounds = parseBboxParam(bounds);
    if (parsedBounds !== null) {
      return {
        bounds: parsedBounds,
        type: "bounds",
      };
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
    center: [longitude, latitude],
    type: "center",
    zoom,
  });

  return parsedCenterViewport.success ? parsedCenterViewport.data : undefined;
}

function formatViewport(context: MapContextTransfer): {
  readonly mapBounds?: string;
  readonly mapCenter?: string;
  readonly mapZoom?: string;
} {
  if (typeof context.viewport === "undefined") {
    return {};
  }

  if (context.viewport.type === "bounds") {
    const bounds = context.viewport.bounds;
    return {
      mapBounds: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    };
  }

  return {
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

function buildMergedOptionalMapContextFields(
  storedContext: MapContextTransfer | null,
  shortContext: Partial<MapContextTransfer>
): Omit<MapContextTransfer, "schemaVersion" | "sourceSurface" | "targetSurface"> {
  const companyIds = shortContext.companyIds ?? storedContext?.companyIds;
  const marketIds = shortContext.marketIds ?? storedContext?.marketIds;
  const providerIds = shortContext.providerIds ?? storedContext?.providerIds;
  const facilityIds = shortContext.facilityIds ?? storedContext?.facilityIds;
  const activePerspectives = shortContext.activePerspectives ?? storedContext?.activePerspectives;
  const selectedBoundaryIds = mergeSelectedBoundaryIds(
    storedContext?.selectedBoundaryIds,
    shortContext.selectedBoundaryIds
  );
  const viewport = shortContext.viewport ?? storedContext?.viewport;
  const selectionGeometryToken =
    shortContext.selectionGeometryToken ?? storedContext?.selectionGeometryToken;
  const highlightTarget = shortContext.highlightTarget ?? storedContext?.highlightTarget;
  const contextToken = shortContext.contextToken ?? storedContext?.contextToken;

  return {
    ...(typeof companyIds === "undefined" ? {} : { companyIds }),
    ...(typeof marketIds === "undefined" ? {} : { marketIds }),
    ...(typeof providerIds === "undefined" ? {} : { providerIds }),
    ...(typeof facilityIds === "undefined" ? {} : { facilityIds }),
    ...(typeof activePerspectives === "undefined" ? {} : { activePerspectives }),
    ...(typeof selectedBoundaryIds === "undefined" ? {} : { selectedBoundaryIds }),
    ...(typeof viewport === "undefined" ? {} : { viewport }),
    ...(typeof selectionGeometryToken === "string" ? { selectionGeometryToken } : {}),
    ...(typeof highlightTarget === "undefined" ? {} : { highlightTarget }),
    ...(typeof contextToken === "string" ? { contextToken } : {}),
  };
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

function buildShortContextFieldsFromRoute(
  route: RouteLocationNormalizedLoaded
): Partial<MapContextTransfer> {
  const selectedBoundaryIds = buildRouteSelectedBoundaryIds(route);
  const sourceSurface = parseSurface(
    readFirstQueryValue(route.query[mapContextQueryKeys.sourceSurface])
  );
  const targetSurface = parseSurface(
    readFirstQueryValue(route.query[mapContextQueryKeys.targetSurface])
  );
  const marketIds = readStringList(route.query[mapContextQueryKeys.marketIds]);
  const companyIds = readStringList(route.query[mapContextQueryKeys.companyIds]);
  const providerIds = readStringList(route.query[mapContextQueryKeys.providerIds]);
  const facilityIds = readStringList(route.query[mapContextQueryKeys.facilityIds]);
  const activePerspectives = parsePerspectives(route.query[mapContextQueryKeys.perspectives]);
  const viewport = parseViewport(route);
  const selectionGeometryToken = readFirstQueryValue(
    route.query[mapContextQueryKeys.selectionGeometryToken]
  );
  const highlightTarget = parseHighlightTarget(
    readFirstQueryValue(route.query[mapContextQueryKeys.highlightTarget])
  );
  const contextToken = readFirstQueryValue(route.query[mapContextQueryKeys.contextToken]);

  return {
    ...(typeof sourceSurface === "undefined" ? {} : { sourceSurface }),
    ...(typeof targetSurface === "undefined" ? {} : { targetSurface }),
    ...(typeof marketIds === "undefined" ? {} : { marketIds: [...marketIds] }),
    ...(typeof companyIds === "undefined" ? {} : { companyIds: [...companyIds] }),
    ...(typeof providerIds === "undefined" ? {} : { providerIds: [...providerIds] }),
    ...(typeof facilityIds === "undefined" ? {} : { facilityIds: [...facilityIds] }),
    ...(typeof activePerspectives === "undefined"
      ? {}
      : { activePerspectives: [...activePerspectives] }),
    ...(typeof selectedBoundaryIds === "undefined"
      ? {}
      : {
          selectedBoundaryIds: {
            country:
              typeof selectedBoundaryIds.country === "undefined"
                ? undefined
                : [...selectedBoundaryIds.country],
            county:
              typeof selectedBoundaryIds.county === "undefined"
                ? undefined
                : [...selectedBoundaryIds.county],
            state:
              typeof selectedBoundaryIds.state === "undefined"
                ? undefined
                : [...selectedBoundaryIds.state],
          },
        }),
    ...(typeof viewport === "undefined" ? {} : { viewport }),
    ...(typeof selectionGeometryToken === "string" ? { selectionGeometryToken } : {}),
    ...(typeof highlightTarget === "undefined" ? {} : { highlightTarget }),
    ...(typeof contextToken === "string" ? { contextToken } : {}),
  };
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
  const requiresStoredContext =
    inlineMarketIds !== context.marketIds ||
    inlineCompanyIds !== context.companyIds ||
    inlineProviderIds !== context.providerIds ||
    inlineFacilityIds !== context.facilityIds;
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
    [mapContextQueryKeys.countryIds]: formatStringList(context.selectedBoundaryIds?.country),
    [mapContextQueryKeys.countyIds]: formatStringList(context.selectedBoundaryIds?.county),
    [mapContextQueryKeys.stateIds]: formatStringList(context.selectedBoundaryIds?.state),
    [mapContextQueryKeys.selectionGeometryToken]: context.selectionGeometryToken,
    [mapContextQueryKeys.highlightTarget]: formatHighlightTarget(context.highlightTarget),
    [mapContextQueryKeys.contextToken]: contextToken,
    [mapContextQueryKeys.mapBounds]: viewportQuery.mapBounds,
    [mapContextQueryKeys.mapCenter]: viewportQuery.mapCenter,
    [mapContextQueryKeys.mapZoom]: viewportQuery.mapZoom,
  };
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

function resolveViewportFromMap(
  map: BuildMapContextTransferFromAppShellArgs["map"]
): MapContextTransfer["viewport"] | undefined {
  if (map === null) {
    return undefined;
  }

  const bounds = map.getBounds();
  const longitudeSpan = bounds.east - bounds.west;
  const latitudeSpan = bounds.north - bounds.south;

  const center: [number, number] = [
    roundViewportValue(bounds.west + longitudeSpan / 2),
    roundViewportValue(bounds.south + latitudeSpan / 2),
  ];
  const type = "center";

  return {
    center,
    type,
    zoom: roundViewportValue(map.getZoom()),
  };
}

export function buildMapContextTransferFromAppShell(
  args: BuildMapContextTransferFromAppShellArgs
): MapContextTransfer {
  const activePerspectives = facilityPerspectives.filter(
    (perspective) => args.visiblePerspectives[perspective]
  );
  const selectedBoundaryIds = buildSelectedBoundaryIds(args.boundaryFacetSelection);
  const viewport = resolveViewportFromMap(args.map);
  const context: MapContextTransfer = {
    schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
    sourceSurface: args.sourceSurface,
    targetSurface: args.targetSurface,
  };

  if (activePerspectives.length > 0) {
    context.activePerspectives = activePerspectives;
  }

  if (typeof selectedBoundaryIds !== "undefined") {
    context.selectedBoundaryIds = selectedBoundaryIds;
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

export function applyMapContextTransferToAppShell(
  args: ApplyMapContextTransferToAppShellArgs
): void {
  if (args.context === null) {
    return;
  }

  if (typeof args.context.activePerspectives !== "undefined") {
    for (const perspective of facilityPerspectives) {
      args.setPerspectiveVisibility(
        perspective,
        args.context.activePerspectives.includes(perspective)
      );
    }
  }

  if (typeof args.context.selectedBoundaryIds === "undefined") {
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

export function inferMapContextSurfaceFromRoute(
  route: RouteLocationNormalizedLoaded
): MapContextSurface | null {
  return inferTargetSurface(route) ?? null;
}
