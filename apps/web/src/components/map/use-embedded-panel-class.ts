import { computed, type Ref } from "vue";

export function useEmbeddedPanelClass(embedded: Ref<boolean>) {
  return computed(() =>
    embedded.value
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 font-sans text-muted-foreground shadow-md"
  );
}
