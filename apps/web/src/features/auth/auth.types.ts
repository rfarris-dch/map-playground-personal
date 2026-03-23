import type { AuthSession } from "@map-migration/http-contracts/auth-http";

export interface MapAppLoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface MapAppAuthState {
  readonly initialized: boolean;
  readonly loading: boolean;
  readonly session: AuthSession | null;
}
