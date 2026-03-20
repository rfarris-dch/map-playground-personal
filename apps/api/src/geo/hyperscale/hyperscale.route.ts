import type { Env, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getHyperscaleCompanyCapacityGlobal,
  getHyperscaleCompanyCapacityRegional,
  getHyperscaleLeasedByMarket,
  getHyperscaleMarketCapacity,
} from "./hyperscale.service";

function readMarketIdQuery(value: string | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, {
      message: "invalid marketId query parameter",
    });
  }

  return value;
}

export function registerHyperscaleRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/hyperscale/market/:externalId/capacity", async (c) => {
    const externalId = c.req.param("externalId");
    const payload = await getHyperscaleMarketCapacity(externalId);
    if (payload.length === 0) {
      throw new HTTPException(404, {
        message: "hyperscale market capacity not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/hyperscale/capacity/company/:externalId/global", async (c) => {
    const externalId = c.req.param("externalId");
    const payload = await getHyperscaleCompanyCapacityGlobal(externalId);
    if (payload === null || payload.length === 0) {
      throw new HTTPException(404, {
        message: "hyperscale company global capacity not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/hyperscale/capacity/company/:externalId/region", async (c) => {
    const externalId = c.req.param("externalId");
    const payload = await getHyperscaleCompanyCapacityRegional(externalId);
    if (payload === null || payload.length === 0) {
      throw new HTTPException(404, {
        message: "hyperscale company regional capacity not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/hyperscale/leased", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    const payload = await getHyperscaleLeasedByMarket(marketId);
    if (payload === null) {
      throw new HTTPException(404, {
        message: "hyperscale leased totals not found",
      });
    }

    return c.json(payload);
  });
}
