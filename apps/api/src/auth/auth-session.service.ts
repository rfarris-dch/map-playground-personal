import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { MapAppAuthSessionPayload } from "./auth-session.types";

const SESSION_TOKEN_VERSION = "v1";
const SESSION_IV_BYTES = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readMapAppAuthSessionPayload(value: unknown): MapAppAuthSessionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const email = readNonEmptyString(value.email);
  const issuedAtEpochMs = readFiniteNumber(value.issuedAtEpochMs);
  const expiresAtEpochMs = readFiniteNumber(value.expiresAtEpochMs);
  const name = readNullableString(value.name);

  if (email === null || issuedAtEpochMs === null || expiresAtEpochMs === null) {
    return null;
  }

  if (typeof name === "undefined") {
    return null;
  }

  return {
    email,
    expiresAtEpochMs,
    issuedAtEpochMs,
    name,
  };
}

function deriveSessionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function createMapAppAuthSessionToken(
  payload: MapAppAuthSessionPayload,
  sessionSecret: string
): string {
  const initializationVector = randomBytes(SESSION_IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveSessionKey(sessionSecret),
    initializationVector
  );
  const encryptedPayload = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    SESSION_TOKEN_VERSION,
    toBase64Url(initializationVector),
    toBase64Url(authTag),
    toBase64Url(encryptedPayload),
  ].join(".");
}

export function readMapAppAuthSessionToken(
  token: string,
  sessionSecret: string,
  nowEpochMs: number = Date.now()
): MapAppAuthSessionPayload | null {
  const tokenParts = token.split(".");
  const versionToken = tokenParts[0];
  const initializationVectorToken = tokenParts[1];
  const authTagToken = tokenParts[2];
  const encryptedPayloadToken = tokenParts[3];

  if (
    tokenParts.length !== 4 ||
    versionToken !== SESSION_TOKEN_VERSION ||
    typeof initializationVectorToken !== "string" ||
    typeof authTagToken !== "string" ||
    typeof encryptedPayloadToken !== "string"
  ) {
    return null;
  }

  try {
    const initializationVector = fromBase64Url(initializationVectorToken);
    const authTag = fromBase64Url(authTagToken);
    const encryptedPayload = fromBase64Url(encryptedPayloadToken);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveSessionKey(sessionSecret),
      initializationVector
    );

    decipher.setAuthTag(authTag);

    const decryptedPayload = Buffer.concat([
      decipher.update(encryptedPayload),
      decipher.final(),
    ]).toString("utf8");
    const parsedPayload = readMapAppAuthSessionPayload(JSON.parse(decryptedPayload));
    if (parsedPayload === null) {
      return null;
    }

    if (parsedPayload.expiresAtEpochMs <= nowEpochMs) {
      return null;
    }

    return parsedPayload;
  } catch {
    return null;
  }
}
