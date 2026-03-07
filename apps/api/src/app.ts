import { ApiHeaders, ApiRoutes, type HealthResponse, HealthSchema } from "@map-migration/contracts";
import { createRequestId } from "@map-migration/ops";
import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { timeout } from "hono/timeout";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import { registerBoundariesRoute } from "@/geo/boundaries/boundaries.route";
import { registerFacilitiesRoute } from "@/geo/facilities/facilities.route";
import { registerFiberLocatorRoute } from "@/geo/fiber-locator/fiber-locator.route";
import { registerMarketsRoute } from "@/geo/markets/markets.route";
import { registerParcelsRoute } from "@/geo/parcels/parcels.route";
import { registerProvidersRoute } from "@/geo/providers/providers.route";
import {
  getOrCreateRequestId,
  jsonError,
  jsonOk,
  normalizeRequestIdHeader,
  REQUEST_ID_MAX_LENGTH,
  toDebugDetails,
} from "@/http/api-response";
import { registerTilesRoute } from "@/http/tiles.route";
import type { ApiAppOptions, CreateApiAppOptions } from "./app.types";

const DEFAULT_REQUEST_BODY_LIMIT_BYTES = parsePositiveIntFlag(
  process.env.API_REQUEST_BODY_LIMIT_BYTES,
  1024 * 1024
);
const DEFAULT_REQUEST_TIMEOUT_MS = parsePositiveIntFlag(process.env.API_REQUEST_TIMEOUT_MS, 30_000);
const DEFAULT_SELECTION_REQUEST_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_SELECTION_REQUEST_TIMEOUT_MS,
  180_000
);
const DEFAULT_PARCELS_REQUEST_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_PARCELS_REQUEST_TIMEOUT_MS,
  180_000
);

const SELECTION_TIMEOUT_ROUTES = new Set<string>([
  ApiRoutes.facilitiesSelection,
  ApiRoutes.marketsSelection,
]);
const PARCELS_TIMEOUT_ROUTES = new Set<string>([
  `${ApiRoutes.parcels}/enrich`,
  `${ApiRoutes.parcels}/lookup`,
]);

function resolvePositiveIntOverride(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function resolveApiAppOptions(options: CreateApiAppOptions): ApiAppOptions {
  return {
    requestBodyLimitBytes: resolvePositiveIntOverride(
      options.requestBodyLimitBytes,
      DEFAULT_REQUEST_BODY_LIMIT_BYTES
    ),
    requestTimeoutMs: resolvePositiveIntOverride(
      options.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS
    ),
    selectionRequestTimeoutMs: resolvePositiveIntOverride(
      options.selectionRequestTimeoutMs,
      DEFAULT_SELECTION_REQUEST_TIMEOUT_MS
    ),
    parcelsRequestTimeoutMs: resolvePositiveIntOverride(
      options.parcelsRequestTimeoutMs,
      DEFAULT_PARCELS_REQUEST_TIMEOUT_MS
    ),
  };
}

function resolveRequestTimeoutMsForPath(path: string, options: ApiAppOptions): number {
  if (PARCELS_TIMEOUT_ROUTES.has(path)) {
    return options.parcelsRequestTimeoutMs;
  }

  if (SELECTION_TIMEOUT_ROUTES.has(path)) {
    return options.selectionRequestTimeoutMs;
  }

  return options.requestTimeoutMs;
}

function resolveInboundRequestId(c: Context): string {
  const headerValue = c.req.header(ApiHeaders.requestId);
  const normalized = normalizeRequestIdHeader(headerValue);
  if (typeof normalized === "string") {
    return normalized;
  }

  return createRequestId("api");
}

function healthPayload(): HealthResponse {
  return {
    status: "ok",
    service: "@map-migration/api",
    now: new Date().toISOString(),
  };
}

export function createApiApp(options: CreateApiAppOptions = {}): Hono {
  const resolvedOptions = resolveApiAppOptions(options);
  const app = new Hono();

  app.use(
    "*",
    requestId({
      headerName: ApiHeaders.requestId,
      limitLength: REQUEST_ID_MAX_LENGTH,
      generator: resolveInboundRequestId,
    })
  );

  app.use(
    "/api/*",
    bodyLimit({
      maxSize: resolvedOptions.requestBodyLimitBytes,
      onError: (c) => {
        const requestIdValue = getOrCreateRequestId(c, "api");
        return jsonError(c, {
          requestId: requestIdValue,
          httpStatus: 413,
          code: "REQUEST_BODY_TOO_LARGE",
          message: "request body exceeds configured limit",
        });
      },
    })
  );

  app.use("/api/*", (c, next) => {
    const requestTimeoutMs = resolveRequestTimeoutMsForPath(c.req.path, resolvedOptions);
    const timeoutMiddleware = timeout(
      requestTimeoutMs,
      () =>
        new HTTPException(408, {
          message: "request timeout",
        })
    );

    return timeoutMiddleware(c, next);
  });

  app.onError((error, c) => {
    const requestIdValue = getOrCreateRequestId(c, "api");
    if (error instanceof HTTPException) {
      return jsonError(c, {
        requestId: requestIdValue,
        httpStatus: error.status,
        code: error.status === 408 ? "REQUEST_TIMEOUT" : "HTTP_EXCEPTION",
        message: error.message,
        details: toDebugDetails(error),
      });
    }

    return jsonError(c, {
      requestId: requestIdValue,
      httpStatus: 500,
      code: "UNHANDLED_EXCEPTION",
      message: "internal server error",
      details: toDebugDetails(error),
    });
  });

  app.notFound((c) => {
    const requestIdValue = getOrCreateRequestId(c, "api");
    return jsonError(c, {
      requestId: requestIdValue,
      httpStatus: 404,
      code: "NOT_FOUND",
      message: "route not found",
    });
  });

  app.get("/health", (c) => {
    const requestIdValue = getOrCreateRequestId(c, "api");
    const payload = healthPayload();
    return jsonOk(c, HealthSchema, payload, requestIdValue);
  });

  app.get(ApiRoutes.health, (c) => {
    const requestIdValue = getOrCreateRequestId(c, "api");
    const payload = healthPayload();
    return jsonOk(c, HealthSchema, payload, requestIdValue);
  });

  registerFacilitiesRoute(app);
  registerFiberLocatorRoute(app);
  registerParcelsRoute(app);
  registerBoundariesRoute(app);
  registerMarketsRoute(app);
  registerProvidersRoute(app);
  registerTilesRoute(app);

  return app;
}
