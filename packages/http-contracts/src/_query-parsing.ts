/**
 * Shared query-parsing primitives for HTTP contract request schemas.
 *
 * These helpers standardize how raw query-string values are preprocessed
 * before Zod validation. They handle blank strings, trimming, and numeric
 * coercion in one place so individual contract files don't duplicate logic.
 */
import { BBoxSchema, parseBboxParam } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Preprocessors
// ---------------------------------------------------------------------------

/** Trim a string value; treat blank strings as `undefined`. */
export function trimQueryValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Parse a numeric query-string value, returning the number or the original value for Zod to reject. */
function parseQueryInteger(value: unknown): unknown {
  const normalized = trimQueryValue(value);
  if (typeof normalized === "undefined") {
    return undefined;
  }

  if (typeof normalized === "number") {
    return normalized;
  }

  if (typeof normalized !== "string") {
    return normalized;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

/** Parse a comma-delimited bbox query param into a BBox object. */
function parseBboxQuery(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseBboxParam(value);
  return parsed ?? value;
}

/** Parse a comma-separated string into a string array. */
export function parseCommaSeparated(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// ---------------------------------------------------------------------------
// Reusable query schemas
// ---------------------------------------------------------------------------

/**
 * Trimmed enum with a default value.
 *
 * In Zod v4, `z.preprocess(trim, schema).default(v)` does not correctly
 * handle blank query params (the preprocess yields `undefined` which the
 * inner schema rejects before `.default()` can apply). Instead we bake
 * the default into the preprocessor so blank/missing values resolve to the
 * default before schema validation.
 */
export function trimmedEnumWithDefault<T extends z.ZodType>(
  schema: T,
  defaultValue: z.infer<T>
): z.ZodPipe<z.ZodTransform<unknown, unknown>, T> {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value ?? defaultValue;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : defaultValue;
  }, schema);
}

/** Query integer with a default value and bounds. */
export function queryIntegerWithDefault(
  defaultValue: number,
  opts: { min?: number; max?: number } = {}
) {
  let base = z.number().int();
  if (typeof opts.min === "number") {
    base = base.min(opts.min);
  }
  if (typeof opts.max === "number") {
    base = base.max(opts.max);
  }
  return z.preprocess((value) => {
    const normalized = parseQueryInteger(value);
    return typeof normalized === "undefined" ? defaultValue : normalized;
  }, base);
}

/** Bbox query param — parses comma-separated string into validated BBox. */
export const BboxQuerySchema = z.preprocess(parseBboxQuery, BBoxSchema);

/** Standard page query schema (non-negative integer, default 0). */
export const PageQuerySchema = z.preprocess((value) => {
  const normalized = parseQueryInteger(value);
  return typeof normalized === "undefined" ? 0 : normalized;
}, z.number().int().nonnegative());

/** Standard page size query schema (positive integer, max 500, default 100). */
export const PageSizeQuerySchema = z.preprocess((value) => {
  const normalized = parseQueryInteger(value);
  return typeof normalized === "undefined" ? 100 : normalized;
}, z.number().int().positive().max(500));

/** Standard pagination offset guard (superRefine to reject offset > 1M). */
export function paginationOffsetGuard(
  request: { page: number; pageSize: number },
  ctx: z.RefinementCtx
) {
  const offset = request.page * request.pageSize;
  if (offset > 1_000_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "pagination offset exceeds maximum of 1000000",
      path: ["page"],
    });
  }
}
