import { AuthLoginRequestSchema } from "@map-migration/http-contracts/auth-http";

export interface MapAppAuthUpstreamLoginResult {
  readonly email: string;
  readonly name: string | null;
}

interface MapAppAuthUpstreamUser {
  readonly email: string | null;
  readonly name: string | null;
}

interface MapAppAuthUpstreamResponse {
  readonly user: MapAppAuthUpstreamUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalTrimmedString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readMapAppAuthUpstreamResponse(value: unknown): MapAppAuthUpstreamResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isRecord(value.user)) {
    return null;
  }

  const email = readOptionalTrimmedString(value.user.email);
  const name = readOptionalTrimmedString(value.user.name);
  if (typeof email === "undefined" || typeof name === "undefined") {
    return null;
  }

  return {
    user: {
      email,
      name,
    },
  };
}

export async function loginToMapAppAuthUpstream(args: {
  readonly allowedEmailDomain: string;
  readonly email: string;
  readonly password: string;
  readonly upstreamLoginUrl: string;
}): Promise<MapAppAuthUpstreamLoginResult> {
  const parsedCredentials = AuthLoginRequestSchema.safeParse({
    email: args.email,
    password: args.password,
  });
  if (!parsedCredentials.success) {
    throw new Error("Invalid login credentials payload");
  }

  const normalizedEmail = parsedCredentials.data.email.trim().toLowerCase();
  if (!normalizedEmail.endsWith(`@${args.allowedEmailDomain}`)) {
    const error = new Error("Only datacenterhawk.com accounts are allowed");
    error.name = "ForbiddenEmailDomainError";
    throw error;
  }

  const upstreamResponse = await fetch(args.upstreamLoginUrl, {
    method: "POST",
    body: new URLSearchParams({
      j_username: parsedCredentials.data.email,
      j_password: parsedCredentials.data.password,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const upstreamResponseBody = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    const message = upstreamResponseBody.trim();
    if (upstreamResponse.status === 401) {
      const error = new Error(message.length > 0 ? message : "Invalid email or password");
      error.name = "InvalidLoginCredentialsError";
      throw error;
    }

    const error = new Error(
      message.length > 0 ? message : "Unable to authenticate with the upstream login service"
    );
    error.name = "UpstreamAuthServiceError";
    throw error;
  }

  const parsedBody = readMapAppAuthUpstreamResponse(JSON.parse(upstreamResponseBody));
  if (parsedBody === null) {
    throw new Error("Upstream login service returned an unexpected response");
  }

  const resolvedEmail = (parsedBody.user.email ?? normalizedEmail).toLowerCase();
  if (!resolvedEmail.endsWith(`@${args.allowedEmailDomain}`)) {
    const error = new Error("Only datacenterhawk.com accounts are allowed");
    error.name = "ForbiddenEmailDomainError";
    throw error;
  }

  return {
    email: resolvedEmail,
    name: parsedBody.user.name,
  };
}
