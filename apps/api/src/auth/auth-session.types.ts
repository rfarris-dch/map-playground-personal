export interface MapAppAuthSessionPayload {
  readonly email: string;
  readonly expiresAtEpochMs: number;
  readonly issuedAtEpochMs: number;
  readonly name: string | null;
}
