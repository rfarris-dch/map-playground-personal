/**
 * Shared pagination and sort direction schemas.
 *
 * This is an internal module. Consumers should import from table-contracts
 * or the domain-specific table modules.
 */
import { z } from "zod";

export const PaginationSchema = z.object({
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const SortDirectionSchema = z.enum(["asc", "desc"]);

export type Pagination = z.infer<typeof PaginationSchema>;
export type SortDirection = z.infer<typeof SortDirectionSchema>;
