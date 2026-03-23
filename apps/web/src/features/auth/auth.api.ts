import { ApiErrorResponseSchema } from "@map-migration/http-contracts/api-error";
import {
  buildAuthLoginRoute,
  buildAuthLogoutRoute,
  buildAuthSessionRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  AuthLoginRequestSchema,
  AuthLogoutResponseSchema,
  type AuthSession,
  AuthSessionSchema,
} from "@map-migration/http-contracts/auth-http";
import type { MapAppLoginCredentials } from "@/features/auth/auth.types";

export class MapAppAuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MapAppAuthApiError";
    this.status = status;
  }
}

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const responseBody = await response.text();
  if (responseBody.trim().length === 0) {
    return fallbackMessage;
  }

  try {
    const parsedError = ApiErrorResponseSchema.safeParse(JSON.parse(responseBody));
    if (parsedError.success) {
      return parsedError.data.error.message;
    }
  } catch {
    // Fall through to plain-text response handling.
  }

  return responseBody.trim();
}

async function readJsonResponse<TValue>(
  response: Response,
  schema: {
    readonly safeParse: (value: unknown) => { readonly success: boolean; readonly data?: TValue };
  }
): Promise<TValue> {
  const responseBody = await response.json();
  const parsedResponse = schema.safeParse(responseBody);
  if (!parsedResponse.success || typeof parsedResponse.data === "undefined") {
    throw new Error("Auth endpoint returned an unexpected response");
  }

  return parsedResponse.data;
}

export async function readMapAppAuthSession(): Promise<AuthSession | null> {
  const response = await fetch(buildAuthSessionRoute(), {
    credentials: "same-origin",
    method: "GET",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new MapAppAuthApiError(
      await readApiErrorMessage(response, "Unable to load the current session"),
      response.status
    );
  }

  return readJsonResponse(response, AuthSessionSchema);
}

export async function loginToMapApp(credentials: MapAppLoginCredentials): Promise<AuthSession> {
  const parsedCredentials = AuthLoginRequestSchema.safeParse(credentials);
  if (!parsedCredentials.success) {
    throw new MapAppAuthApiError("Enter a valid email and password", 400);
  }

  const response = await fetch(buildAuthLoginRoute(), {
    credentials: "same-origin",
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedCredentials.data),
  });

  if (!response.ok) {
    throw new MapAppAuthApiError(
      await readApiErrorMessage(response, "Unable to sign in"),
      response.status
    );
  }

  return readJsonResponse(response, AuthSessionSchema);
}

export async function logoutFromMapApp(): Promise<void> {
  const response = await fetch(buildAuthLogoutRoute(), {
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new MapAppAuthApiError(
      await readApiErrorMessage(response, "Unable to sign out"),
      response.status
    );
  }

  await readJsonResponse(response, AuthLogoutResponseSchema);
}
