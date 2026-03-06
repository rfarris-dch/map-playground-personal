import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";

type ThemeValue = "light" | "dark" | "system";

const themeStorageKey = "map-docs-theme";

function readStoredTheme(): ThemeValue {
  if (typeof window === "undefined") {
    return "system";
  }

  const rootPreference = document.documentElement.dataset.themePreference;
  if (rootPreference === "light" || rootPreference === "dark" || rootPreference === "system") {
    return rootPreference;
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);
  if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
    return storedTheme;
  }

  return "system";
}

function readSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const currentTheme = shallowRef<ThemeValue>(readStoredTheme());
const systemTheme = shallowRef<"light" | "dark">(readSystemTheme());
const hasMounted = shallowRef(false);
let activeThemeConsumerCount = 0;
let mediaQuery: MediaQueryList | null = null;
let mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

function applyThemeClass(): void {
  const rootElement = document.documentElement;
  rootElement.classList.remove("light", "dark");
  const resolvedTheme = currentTheme.value === "system" ? systemTheme.value : currentTheme.value;
  rootElement.classList.add(resolvedTheme);
}

function startSystemThemeTracking(): void {
  if (mediaQuery !== null) {
    return;
  }

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemTheme.value = mediaQuery.matches ? "dark" : "light";
  mediaQueryListener = (event) => {
    systemTheme.value = event.matches ? "dark" : "light";
  };
  mediaQuery.addEventListener("change", mediaQueryListener);
}

function stopSystemThemeTracking(): void {
  if (mediaQuery === null || mediaQueryListener === null) {
    return;
  }

  mediaQuery.removeEventListener("change", mediaQueryListener);
  mediaQuery = null;
  mediaQueryListener = null;
}

function initializeTheme(): void {
  currentTheme.value = readStoredTheme();
  startSystemThemeTracking();
  applyThemeClass();
}

watch([currentTheme, systemTheme], () => {
  if (!hasMounted.value) {
    return;
  }

  window.localStorage.setItem(themeStorageKey, currentTheme.value);
  document.documentElement.dataset.themePreference = currentTheme.value;
  applyThemeClass();
});

export function useTheme() {
  onMounted(() => {
    activeThemeConsumerCount += 1;
    if (!hasMounted.value) {
      initializeTheme();
      hasMounted.value = true;
      return;
    }

    applyThemeClass();
  });

  onBeforeUnmount(() => {
    activeThemeConsumerCount = Math.max(0, activeThemeConsumerCount - 1);
    if (activeThemeConsumerCount === 0) {
      stopSystemThemeTracking();
      hasMounted.value = false;
    }
  });

  return {
    currentTheme,
    resolvedTheme: computed(() => {
      return currentTheme.value === "system" ? systemTheme.value : currentTheme.value;
    }),
    setTheme(theme: ThemeValue) {
      currentTheme.value = theme;
    },
  };
}
