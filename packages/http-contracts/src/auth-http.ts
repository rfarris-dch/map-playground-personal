import { z } from "zod";

export const AuthSessionUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).nullable(),
});

export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;

export const AuthSessionSchema = z.object({
  authenticated: z.literal(true),
  user: AuthSessionUserSchema,
});

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const AuthLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

export const AuthLogoutResponseSchema = z.object({
  ok: z.literal(true),
});

export type AuthLogoutResponse = z.infer<typeof AuthLogoutResponseSchema>;
