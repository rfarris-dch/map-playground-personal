import { ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  AuthLogoutResponseSchema,
  type AuthSession,
  AuthSessionSchema,
} from "@map-migration/http-contracts/auth-http";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getMapAppAuthConfig } from "@/auth/auth-config.service";
import {
  createMapAppAuthSessionToken,
  readMapAppAuthSessionToken,
} from "@/auth/auth-session.service";
import { loginToMapAppAuthUpstream } from "@/auth/auth-upstream.service";
import { jsonError, jsonOk, resolveRequestId, withHeaders } from "@/http/api-response";

const AUTH_RESPONSE_HEADERS = Object.freeze({
  "cache-control": "no-store",
});

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (typeof hostHeader !== "string") {
    return false;
  }

  const normalizedHost = hostHeader.trim().toLowerCase();
  return normalizedHost.startsWith("127.0.0.1") || normalizedHost.startsWith("localhost");
}

function isLoopbackRequest(c: Context): boolean {
  if (isLoopbackHost(c.req.header("host"))) {
    return true;
  }

  const requestUrl = new URL(c.req.url);
  return isLoopbackHost(requestUrl.host);
}

function useSecureCookies(c: Context): boolean {
  const requestUrl = new URL(c.req.url);
  return requestUrl.protocol === "https:" && !isLoopbackRequest(c);
}

export function readMapAppAuthSession(c: Context): AuthSession | null {
  const config = getMapAppAuthConfig();
  const sessionToken = getCookie(c, config.sessionCookieName);
  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    return null;
  }

  const payload = readMapAppAuthSessionToken(sessionToken, config.sessionSecret);
  if (payload === null) {
    return null;
  }

  return {
    authenticated: true,
    user: {
      email: payload.email,
      name: payload.name,
    },
  };
}

function clearMapAppAuthSessionCookie(c: Context): void {
  const config = getMapAppAuthConfig();
  deleteCookie(c, config.sessionCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: useSecureCookies(c),
  });
}

function writeMapAppAuthSessionCookie(c: Context, session: AuthSession): void {
  const config = getMapAppAuthConfig();
  const nowEpochMs = Date.now();
  const sessionToken = createMapAppAuthSessionToken(
    {
      email: session.user.email,
      expiresAtEpochMs: nowEpochMs + config.sessionTtlSeconds * 1000,
      issuedAtEpochMs: nowEpochMs,
      name: session.user.name,
    },
    config.sessionSecret
  );

  setCookie(c, config.sessionCookieName, sessionToken, {
    httpOnly: true,
    maxAge: config.sessionTtlSeconds,
    path: "/",
    sameSite: "Lax",
    secure: useSecureCookies(c),
  });
}

async function readLoginBody(c: Context): Promise<{ email: string; password: string }> {
  const rawBody = await c.req.json();
  if (typeof rawBody !== "object" || rawBody === null) {
    throw new Error("Request body must be a JSON object");
  }

  const rawEmail = Reflect.get(rawBody, "email");
  const rawPassword = Reflect.get(rawBody, "password");
  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    throw new Error("Request body must include email and password");
  }

  return {
    email: rawEmail,
    password: rawPassword,
  };
}

function unauthorizedAuthResponse(c: Context, message: string): Response {
  const requestId = resolveRequestId(c, "api");
  clearMapAppAuthSessionCookie(c);
  return withHeaders(
    jsonError(c, {
      requestId,
      httpStatus: 401,
      code: "AUTH_SESSION_REQUIRED",
      message,
    }),
    AUTH_RESPONSE_HEADERS
  );
}

export function registerAuthRoute(app: Hono): void {
  app.post(ApiRoutes.authLogin, async (c) => {
    const requestId = resolveRequestId(c, "api");

    try {
      const requestBody = await readLoginBody(c);
      const config = getMapAppAuthConfig();
      const authUser = await loginToMapAppAuthUpstream({
        allowedEmailDomain: config.allowedEmailDomain,
        email: requestBody.email,
        password: requestBody.password,
        upstreamLoginUrl: config.upstreamLoginUrl,
      });

      const session: AuthSession = {
        authenticated: true,
        user: {
          email: authUser.email,
          name: authUser.name,
        },
      };

      writeMapAppAuthSessionCookie(c, session);
      return withHeaders(jsonOk(c, AuthSessionSchema, session, requestId), AUTH_RESPONSE_HEADERS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in";
      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "ForbiddenEmailDomainError") {
        clearMapAppAuthSessionCookie(c);
        return withHeaders(
          jsonError(c, {
            requestId,
            httpStatus: 403,
            code: "AUTH_EMAIL_DOMAIN_FORBIDDEN",
            message,
          }),
          AUTH_RESPONSE_HEADERS
        );
      }

      if (errorName === "InvalidLoginCredentialsError") {
        clearMapAppAuthSessionCookie(c);
        return withHeaders(
          jsonError(c, {
            requestId,
            httpStatus: 401,
            code: "INVALID_LOGIN_CREDENTIALS",
            message,
          }),
          AUTH_RESPONSE_HEADERS
        );
      }

      return withHeaders(
        jsonError(c, {
          requestId,
          httpStatus: 500,
          code: "AUTH_LOGIN_FAILED",
          message,
        }),
        AUTH_RESPONSE_HEADERS
      );
    }
  });

  app.get(ApiRoutes.authSession, (c) => {
    const requestId = resolveRequestId(c, "api");
    const session = readMapAppAuthSession(c);
    if (session === null) {
      return unauthorizedAuthResponse(c, "sign in required");
    }

    return withHeaders(jsonOk(c, AuthSessionSchema, session, requestId), AUTH_RESPONSE_HEADERS);
  });

  app.post(ApiRoutes.authLogout, (c) => {
    const requestId = resolveRequestId(c, "api");
    clearMapAppAuthSessionCookie(c);
    return withHeaders(
      jsonOk(c, AuthLogoutResponseSchema, { ok: true }, requestId),
      AUTH_RESPONSE_HEADERS
    );
  });
}

export function createMapAppAuthMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    if (isLoopbackRequest(c)) {
      await next();
      return;
    }

    const session = readMapAppAuthSession(c);
    if (session === null) {
      const response = unauthorizedAuthResponse(c, "sign in required");
      return response;
    }

    await next();
  };
}
