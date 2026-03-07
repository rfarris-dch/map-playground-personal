import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import {
  readMapOverlaysQueryState,
  writeMapOverlaysQueryState,
} from "@/features/app/overlays/map-overlays.service";
import type { UseMapOverlaysShortcutsOptions } from "@/features/app/overlays/use-map-overlays-shortcuts.types";

function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function useMapOverlaysShortcuts(options: UseMapOverlaysShortcutsOptions) {
  const quickViewActive = shallowRef<boolean>(false);
  const scannerActive = shallowRef<boolean>(false);
  const quickViewObjectCount = shallowRef<number>(0);
  const overlaysQueryHydrated = shallowRef<boolean>(false);

  function setQuickViewActive(active: boolean): void {
    quickViewActive.value = active;
    if (!active) {
      quickViewObjectCount.value = 0;
    }
  }

  function toggleQuickView(): void {
    if (options.quickViewDisabledReason.value !== null) {
      return;
    }

    setQuickViewActive(!quickViewActive.value);
  }

  function setScannerActive(active: boolean): void {
    scannerActive.value = active;
  }

  function toggleScanner(): void {
    setScannerActive(!scannerActive.value);
  }

  function setQuickViewObjectCount(count: number): void {
    quickViewObjectCount.value = count;
  }

  function handleEnterShortcut(event: KeyboardEvent): void {
    const sketchMeasureState = options.sketchMeasureState.value;
    if (
      sketchMeasureState.mode === "area" &&
      sketchMeasureState.canFinishArea &&
      !sketchMeasureState.isAreaComplete
    ) {
      event.preventDefault();
      options.finishSketchMeasureArea();
    }
  }

  function handleEscapeShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    const sketchMeasureState = options.sketchMeasureState.value;

    if (sketchMeasureState.mode === "area" && sketchMeasureState.isAreaComplete) {
      options.clearSketchMeasure();
      return;
    }

    if (sketchMeasureState.mode !== "off") {
      options.setSketchMeasureMode("off");
      return;
    }

    if (scannerActive.value) {
      setScannerActive(false);
      return;
    }

    if (quickViewActive.value) {
      setQuickViewActive(false);
    }
  }

  function onWindowKeyDown(event: KeyboardEvent): void {
    if (isKeyboardInputTarget(event.target)) {
      return;
    }

    const key = event.key;
    if (key === "g" || key === "G") {
      event.preventDefault();
      toggleQuickView();
      return;
    }

    if (key === "v" || key === "V") {
      event.preventDefault();
      toggleScanner();
      return;
    }

    if (key === "Enter") {
      handleEnterShortcut(event);
      return;
    }

    if (key === "Escape") {
      handleEscapeShortcut(event);
    }
  }

  watch(
    options.quickViewDisabledReason,
    (nextQuickViewDisabledReason) => {
      if (nextQuickViewDisabledReason !== null && quickViewActive.value) {
        setQuickViewActive(false);
      }
    },
    { immediate: false }
  );

  watch(
    [quickViewActive, scannerActive],
    ([nextQuickView, nextScanner]) => {
      if (!overlaysQueryHydrated.value) {
        return;
      }

      writeMapOverlaysQueryState({
        quickView: nextQuickView,
        scanner: nextScanner,
      });
    },
    { immediate: false }
  );

  onMounted(() => {
    const queryState = readMapOverlaysQueryState();
    quickViewActive.value = queryState.quickView;
    scannerActive.value = queryState.scanner;
    overlaysQueryHydrated.value = true;

    window.addEventListener("keydown", onWindowKeyDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onWindowKeyDown);
    overlaysQueryHydrated.value = false;
  });

  return {
    quickViewActive,
    scannerActive,
    quickViewObjectCount,
    setQuickViewActive,
    toggleQuickView,
    setScannerActive,
    toggleScanner,
    setQuickViewObjectCount,
  };
}
