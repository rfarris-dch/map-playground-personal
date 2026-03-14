import { z } from "zod";

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const ApiErrorResponseSchema = z.object({
  status: z.literal("error"),
  requestId: z.string().min(1),
  error: ApiErrorSchema,
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
