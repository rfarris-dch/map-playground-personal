import { parsePositiveIntFlag } from "@/config/env-parsing.service";

const TRAILING_SLASH_PATTERN = /\/+$/;

export interface MapAppAuthConfig {
  readonly allowedEmailDomain: string;
  readonly sessionCookieName: string;
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
  readonly upstreamLoginUrl: string;
}

function readNonEmptyEnvVar(
  env: Readonly<Record<string, string | undefined>>,
  envKey: string
): string {
  const rawValue = env[envKey];
  if (typeof rawValue !== "string") {
    throw new Error(`[api] missing required auth env var ${envKey}`);
  }

  const normalizedValue = rawValue.trim();
  if (normalizedValue.length === 0) {
    throw new Error(`[api] missing required auth env var ${envKey}`);
  }

  return normalizedValue;
}

function readNormalizedEmailDomain(
  env: Readonly<Record<string, string | undefined>>,
  envKey: string
): string {
  const normalizedDomain = readNonEmptyEnvVar(env, envKey).toLowerCase();
  if (normalizedDomain.includes("@")) {
    throw new Error(`[api] ${envKey} must be a bare domain name`);
  }

  return normalizedDomain;
}

let cachedAuthConfig: MapAppAuthConfig | null = null;

export function getMapAppAuthConfig(): MapAppAuthConfig {
  if (cachedAuthConfig !== null) {
    return cachedAuthConfig;
  }

  const upstreamBaseUrl = readNonEmptyEnvVar(process.env, "MAP_APP_AUTH_IAM_BASE_URL").replace(
    TRAILING_SLASH_PATTERN,
    ""
  );
  const sessionTtlSeconds = parsePositiveIntFlag(
    process.env.MAP_APP_AUTH_SESSION_TTL_SECONDS,
    43_200
  );

  cachedAuthConfig = Object.freeze<MapAppAuthConfig>({
    allowedEmailDomain: readNormalizedEmailDomain(process.env, "MAP_APP_AUTH_ALLOWED_EMAIL_DOMAIN"),
    sessionCookieName: readNonEmptyEnvVar(process.env, "MAP_APP_AUTH_SESSION_COOKIE_NAME"),
    sessionSecret: readNonEmptyEnvVar(process.env, "MAP_APP_AUTH_SESSION_SECRET"),
    sessionTtlSeconds,
    upstreamLoginUrl: `${upstreamBaseUrl}/login_post.htm`,
  });

  return cachedAuthConfig;
}
