import type { Env, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  getMarketForecast,
  getMarketInsight,
  getMarketPricing,
  getMarketPricingAverage,
  getMarketPricingForecast,
  getMarketPricingRatio,
  getMarketSizeHistory,
  getMarketSizeReport,
  getPreleasingPercentage,
  getSubmarketCapacity,
  getSubmarketTtm,
  getTtmGrowth,
} from "./insight.service";

function readMarketIdQuery(value: string | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, {
      message: "invalid marketId query parameter",
    });
  }

  return value;
}

function readMarketQuery(value: string | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HTTPException(400, {
      message: "invalid market query parameter",
    });
  }

  return value;
}

export function registerInsightRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/insight/preleasing-percentage", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    const payload = await getPreleasingPercentage(marketId);
    if (payload === null) {
      throw new HTTPException(404, {
        message: "preleasing percentage not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/insight/market-size-report", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    const payload = await getMarketSizeReport(marketId);
    if (payload === null) {
      throw new HTTPException(404, {
        message: "market size report not found",
      });
    }

    return c.json(payload);
  });

  app.get("/api/insight/ttm-growth", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getTtmGrowth(marketId));
  });

  app.get("/api/insight/:marketId/submarket-capacity", async (c) => {
    const marketId = c.req.param("marketId");
    return c.json(await getSubmarketCapacity(marketId));
  });

  app.get("/api/insight/submarket-ttm", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getSubmarketTtm(marketId));
  });

  app.get("/api/insight/forecast", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getMarketForecast(marketId));
  });

  app.get("/api/insight/market-size", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getMarketSizeHistory(marketId));
  });

  app.get("/api/insight/pricing", async (c) => {
    const marketId = readMarketQuery(c.req.query("market"));
    return c.json(await getMarketPricing(marketId));
  });

  app.get("/api/insight/pricing/avg/:marketId", async (c) => {
    const marketId = c.req.param("marketId");
    return c.json(await getMarketPricingAverage(marketId));
  });

  app.get("/api/insight/pricing-ratio", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getMarketPricingRatio(marketId));
  });

  app.get("/api/insight/pricing-forecast", async (c) => {
    const marketId = readMarketIdQuery(c.req.query("marketId"));
    return c.json(await getMarketPricingForecast(marketId));
  });

  app.get("/api/insight/:marketId", async (c) => {
    const marketId = c.req.param("marketId");
    const insight = await getMarketInsight(marketId);
    if (insight === null) {
      throw new HTTPException(404, {
        message: "market insight not found",
      });
    }

    return c.json(insight);
  });
}
