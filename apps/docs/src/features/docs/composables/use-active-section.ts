import { computed, onMounted, onUnmounted, shallowRef, watch } from "vue";
import type { TocSection } from "@/features/docs/docs-content.types";

interface ResolvedHeading {
  readonly id: string;
  readonly top: number;
}

export function useActiveSection(sections: () => readonly TocSection[]) {
  const currentSectionId = shallowRef("");

  const flattenedIds = computed(() => {
    return sections().flatMap((section) => [
      section.id,
      ...section.children.map((child) => child.id),
    ]);
  });

  function getHeadings(): readonly ResolvedHeading[] {
    return flattenedIds.value
      .map((id) => {
        const element = document.getElementById(id);
        if (!element) {
          return undefined;
        }

        const styles = window.getComputedStyle(element);
        const scrollMarginTop = Number.parseFloat(styles.scrollMarginTop || "0");

        return {
          id,
          top: window.scrollY + element.getBoundingClientRect().top - scrollMarginTop,
        };
      })
      .filter((heading): heading is ResolvedHeading => typeof heading !== "undefined");
  }

  function updateCurrentSection(): void {
    const headings = getHeadings();
    if (headings.length === 0) {
      currentSectionId.value = "";
      return;
    }

    const firstHeading = headings[0];
    if (!firstHeading) {
      currentSectionId.value = "";
      return;
    }

    let activeHeadingId = firstHeading.id;

    for (const heading of headings) {
      if (window.scrollY >= heading.top - 10) {
        activeHeadingId = heading.id;
        continue;
      }

      break;
    }

    currentSectionId.value = activeHeadingId;
  }

  function isActive(id: string, children: readonly { id: string }[] = []): boolean {
    return (
      currentSectionId.value === id || children.some((child) => child.id === currentSectionId.value)
    );
  }

  watch(
    flattenedIds,
    (ids) => {
      currentSectionId.value = ids[0] ?? "";

      if (typeof window !== "undefined") {
        updateCurrentSection();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    window.addEventListener("scroll", updateCurrentSection, { passive: true });
    updateCurrentSection();
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", updateCurrentSection);
  });

  return {
    currentSectionId,
    isActive,
  };
}
