import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  docsCollection,
  findDocsPageBySlug,
  findPrevNextLinkForSlug,
  searchDocsPages,
} from "@/features/docs/docs-content.service";

function normalizeSlug(path: string): string {
  if (path === "/") {
    return path;
  }

  if (path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function useDocsContent() {
  const route = useRoute();

  const currentSlug = computed(() => normalizeSlug(route.path));
  const currentPage = computed(() => findDocsPageBySlug(currentSlug.value));
  const prevNext = computed(() => findPrevNextLinkForSlug(currentSlug.value));

  return {
    currentSlug,
    currentPage,
    prevNext,
    groups: computed(() => docsCollection.groups),
    pages: computed(() => docsCollection.pages),
    search(query: string) {
      return searchDocsPages(query);
    },
  };
}
