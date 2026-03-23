import { MapAppAuthRequiredEventName } from "@map-migration/core-runtime/api";
import type { AuthSession } from "@map-migration/http-contracts/auth-http";
import { computed, readonly, ref } from "vue";
import { loginToMapApp, logoutFromMapApp, readMapAppAuthSession } from "@/features/auth/auth.api";
import type { MapAppLoginCredentials } from "@/features/auth/auth.types";

const currentAuthSession = ref<AuthSession | null>(null);
const authSessionInitialized = ref(false);
const authSessionLoading = ref(false);

let inflightAuthSessionRequest: Promise<AuthSession | null> | null = null;
let authRequiredListenerRegistered = false;

function setMapAppAuthSession(session: AuthSession | null): void {
  currentAuthSession.value = session;
  authSessionInitialized.value = true;
}

function clearMapAppAuthSession(): void {
  setMapAppAuthSession(null);
}

function ensureAuthRequiredListenerRegistered(): void {
  if (authRequiredListenerRegistered || typeof window === "undefined") {
    return;
  }

  window.addEventListener(MapAppAuthRequiredEventName, () => {
    clearMapAppAuthSession();
  });
  authRequiredListenerRegistered = true;
}

export function useMapAppAuthState() {
  ensureAuthRequiredListenerRegistered();

  return {
    initialized: readonly(authSessionInitialized),
    isAuthenticated: computed(() => currentAuthSession.value !== null),
    loading: readonly(authSessionLoading),
    session: readonly(currentAuthSession),
    snapshot: computed(() => ({
      initialized: authSessionInitialized.value,
      loading: authSessionLoading.value,
      session: currentAuthSession.value,
    })),
  };
}

export function ensureMapAppAuthSessionLoaded(forceRefresh = false): Promise<AuthSession | null> {
  ensureAuthRequiredListenerRegistered();

  if (!forceRefresh && authSessionInitialized.value) {
    return Promise.resolve(currentAuthSession.value);
  }

  if (inflightAuthSessionRequest !== null) {
    return inflightAuthSessionRequest;
  }

  authSessionLoading.value = true;
  inflightAuthSessionRequest = readMapAppAuthSession()
    .then((session) => {
      setMapAppAuthSession(session);
      return session;
    })
    .finally(() => {
      authSessionLoading.value = false;
      inflightAuthSessionRequest = null;
    });

  return inflightAuthSessionRequest;
}

export async function signInToMapApp(credentials: MapAppLoginCredentials): Promise<AuthSession> {
  ensureAuthRequiredListenerRegistered();
  authSessionLoading.value = true;

  try {
    const session = await loginToMapApp(credentials);
    setMapAppAuthSession(session);
    return session;
  } finally {
    authSessionLoading.value = false;
  }
}

export async function signOutOfMapApp(): Promise<void> {
  ensureAuthRequiredListenerRegistered();

  authSessionLoading.value = true;
  try {
    await logoutFromMapApp();
  } finally {
    clearMapAppAuthSession();
    authSessionLoading.value = false;
  }
}
