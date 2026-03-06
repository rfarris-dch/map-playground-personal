<script setup lang="ts">
  import Button from "@/components/ui/button/button.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import DropdownMenu from "@/components/ui/dropdown-menu/dropdown-menu.vue";
  import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.vue";
  import DropdownMenuLabel from "@/components/ui/dropdown-menu/dropdown-menu-label.vue";
  import DropdownMenuSeparator from "@/components/ui/dropdown-menu/dropdown-menu-separator.vue";
  import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.vue";
  import { toCheckboxBoolean } from "./data-table.service";
  import type { FacetValue } from "./data-table.types";

  defineProps<{
    readonly clear: () => void;
    readonly columnId: string;
    readonly columnLabel: string;
    readonly isChecked: (token: string) => boolean;
    readonly isOpen: boolean;
    readonly selectedCount: number;
    readonly setChecked: (token: string, checked: boolean) => void;
    readonly setOpen: (open: boolean) => void;
    readonly values: readonly FacetValue[];
  }>();
</script>

<template>
  <DropdownMenu :open="isOpen" @update:open="setOpen">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="truncate text-left transition-colors hover:text-foreground"
        :class="selectedCount > 0 ? 'text-primary underline' : undefined"
        :aria-label="`Filter ${columnLabel}`"
      >
        <slot />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-64 p-0">
      <DropdownMenuLabel
        class="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5"
      >
        <span>{{ columnLabel }}</span>
        <Button size="sm" variant="ghost" class="h-6 px-2 text-[11px]" @click="clear">
          Clear
        </Button>
      </DropdownMenuLabel>
      <DropdownMenuSeparator class="my-0" />
      <div class="max-h-64 space-y-1 overflow-y-auto p-2">
        <label
          v-for="facetOption in values"
          :key="`${columnId}:${facetOption.token}`"
          class="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/40"
        >
          <span class="inline-flex items-center gap-2">
            <Checkbox
              :checked="isChecked(facetOption.token)"
              @update:checked="setChecked(facetOption.token, toCheckboxBoolean($event))"
            />
            <span class="truncate">{{ facetOption.label }}</span>
          </span>
          <span class="text-[11px] text-muted-foreground">{{ facetOption.count }}</span>
        </label>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
