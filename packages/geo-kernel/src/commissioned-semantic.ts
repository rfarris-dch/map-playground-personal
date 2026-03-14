import { z } from "zod";

export const CommissionedSemanticSchema = z.enum([
  "leased",
  "operational",
  "under_construction",
  "planned",
  "unknown",
]);

export const LeaseOrOwnSchema = z.enum(["lease", "own", "unknown"]);

export type CommissionedSemantic = z.infer<typeof CommissionedSemanticSchema>;
export type LeaseOrOwn = z.infer<typeof LeaseOrOwnSchema>;

export function parseCommissionedSemantic(value: unknown): CommissionedSemantic | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = CommissionedSemanticSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function parseLeaseOrOwn(value: unknown): LeaseOrOwn | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = LeaseOrOwnSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
