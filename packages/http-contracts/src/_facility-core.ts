/**
 * Shared facility property shapes and HTTP-level perspective subset.
 *
 * This module defines the canonical facility core shape that all facility
 * projections (bbox, detail, table, spatial-analysis) derive from. It also
 * defines the HTTP-supported perspective subset for endpoints whose response
 * model only supports colocation | hyperscale.
 */
import {
  CommissionedSemanticSchema,
  LeaseOrOwnSchema,
} from "@map-migration/geo-kernel/commissioned-semantic";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { z } from "zod";

// ---------------------------------------------------------------------------
// HTTP perspective subset
// ---------------------------------------------------------------------------

/**
 * The subset of facility perspectives that HTTP response models can faithfully
 * represent. Many endpoints structurally only support colocation + hyperscale
 * in their summary/aggregation shapes, even though request schemas accept the
 * full FacilityPerspectiveSchema.
 *
 * Use this for response-side contracts. Use FacilityPerspectiveSchema from
 * geo-kernel for request-side contracts that accept all four values.
 */
export const FacilityHttpPerspectiveSchema = z.enum(["colocation", "hyperscale"]);
export type FacilityHttpPerspective = z.infer<typeof FacilityHttpPerspectiveSchema>;

// ---------------------------------------------------------------------------
// Shared facility core property shapes
// ---------------------------------------------------------------------------

/**
 * The shape object (not a schema) for properties common to all facility
 * representations. Individual schemas use `.pick()`, `.extend()`, or spread
 * to derive their specific projection.
 */
export const FacilityCorePropertiesShape = {
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  facilityName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  countyFips: z.string().nullable(),
  stateAbbrev: z.string().nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
  squareFootage: z.number().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  statusLabel: z.string().nullable(),
  facilityCode: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  marketName: z.string().nullable(),
} as const;

/**
 * Full facility core schema — all fields required-nullable as the canonical
 * source of truth. Use `.pick()` and `.extend()` for projections.
 */
export const FacilityCorePropertiesSchema = z.object(FacilityCorePropertiesShape);
export type FacilityCoreProperties = z.infer<typeof FacilityCorePropertiesSchema>;
