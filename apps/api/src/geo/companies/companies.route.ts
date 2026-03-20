import type { Env, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getHyperscaleLeasedByYear,
  getHyperscaleMarketLeased,
  getProviderCapacityTotals,
} from "./companies.service";

function readCompanyName(value: string | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, {
      message: "invalid companyName query parameter",
    });
  }

  return value;
}

export function registerCompaniesRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/companies/colocation/provider-capacity-totals", async (c) => {
    const companyName = readCompanyName(c.req.query("companyName"));
    const payload = await getProviderCapacityTotals(companyName);
    if (Object.keys(payload).length === 0) {
      throw new HTTPException(404, {
        message: "provider capacity totals not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/companies/hyperscale/leased", async (c) => {
    const companyName = readCompanyName(c.req.query("companyName"));
    const payload = await getHyperscaleLeasedByYear(companyName);
    if (Object.keys(payload).length === 0) {
      throw new HTTPException(404, {
        message: "hyperscale leased totals not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/companies/hyperscale/market-leased", async (c) => {
    const companyName = readCompanyName(c.req.query("companyName"));
    const payload = await getHyperscaleMarketLeased(companyName);
    if (Object.keys(payload).length === 0) {
      throw new HTTPException(404, {
        message: "hyperscale market leased totals not found",
      });
    }

    return c.json(payload);
  });
}
