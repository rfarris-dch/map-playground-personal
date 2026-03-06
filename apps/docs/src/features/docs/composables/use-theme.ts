import { computed, onMounted, shallowRef, watch } from "vue";

type ThemeValue = "light" | "dark" | "system";

const themeStorageKey = "map-docs-theme";
const currentTheme = shallowRef<ThemeValue>("system");
const systemTheme = shallowRef<"light" | "dark">("dark");
const hasMounted = shallowRef(false);

function applyThemeClass(): void {
  const rootElement = document.documentElement;
  rootElement.classList.remove("light", "dark");
  const resolvedTheme = currentTheme.value === "system" ? systemTheme.value : currentTheme.value;
  rootElement.classList.add(resolvedTheme);
}

function initializeTheme(): void {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
    currentTheme.value = storedTheme;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemTheme.value = mediaQuery.matches ? "dark" : "light";
  mediaQuery.addEventListener("change", (event) => {
    systemTheme.value = event.matches ? "dark" : "light";
  });

  applyThemeClass();
}

watch([currentTheme, systemTheme], () => {
  if (!hasMounted.value) {
    return;
  }

  window.localStorage.setItem(themeStorageKey, currentTheme.value);
  applyThemeClass();
});

export function useTheme() {
  onMounted(() => {
    if (!hasMounted.value) {
      initializeTheme();
      hasMounted.value = true;
      return;
    }

    applyThemeClass();
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
