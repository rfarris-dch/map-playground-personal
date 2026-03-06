<script setup lang="ts">
  import Button from "@/components/ui/button/button.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import DropdownMenu from "@/components/ui/dropdown-menu/dropdown-menu.vue";
  import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.vue";
  import DropdownMenuLabel from "@/components/ui/dropdown-menu/dropdown-menu-label.vue";
  import DropdownMenuSeparator from "@/components/ui/dropdown-menu/dropdown-menu-separator.vue";
  import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.vue";
  import Input from "@/components/ui/input/input.vue";
  import { toCheckboxBoolean } from "./data-table.service";
  import type { GroupableColumnOption, HideableColumnOption } from "./data-table.types";

  defineProps<{
    readonly clearAllFilters: () => void;
    readonly filteredRowCount: number;
    readonly globalFilterPlaceholder?: string;
    readonly globalQuery: string;
    readonly groupableColumns: readonly GroupableColumnOption[];
    readonly groupingCount: number;
    readonly hideableColumns: readonly HideableColumnOption[];
    readonly isColumnGrouped: (columnId: string) => boolean;
    readonly isTableFiltered: boolean;
    readonly selectedRowCount: number;
    readonly setGlobalQuery: (value: unknown) => void;
    readonly toggleGrouping: (columnId: string) => void;
  }>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center space-x-2">
        <Input
          :model-value="globalQuery"
          class="h-8 w-[150px] lg:w-[250px]"
          :placeholder="globalFilterPlaceholder"
          @update:model-value="setGlobalQuery"
        />
        <Button
          v-if="isTableFiltered"
          size="sm"
          variant="ghost"
          class="h-8 px-2 lg:px-3"
          @click="clearAllFilters"
        >
          Reset
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="whitespace-nowrap text-sm text-muted-foreground">
          {{ filteredRowCount.toLocaleString() }}
          rows
        </span>
        <DropdownMenu v-if="groupableColumns.length > 0">
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline" class="h-8">
              Group by
              <span
                v-if="groupingCount > 0"
                class="ml-2 rounded-sm bg-muted px-1 font-normal text-[10px] leading-4 text-muted-foreground"
              >
                {{ groupingCount }}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56 p-2">
            <DropdownMenuLabel class="px-1 py-1.5">Grouping</DropdownMenuLabel>
            <DropdownMenuSeparator class="my-1" />
            <div class="space-y-1">
              <label
                v-for="groupColumn in groupableColumns"
                :key="groupColumn.columnId"
                class="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
              >
                <span class="truncate">{{ groupColumn.columnLabel }}</span>
                <Checkbox
                  :checked="isColumnGrouped(groupColumn.columnId)"
                  @update:checked="toggleGrouping(groupColumn.columnId)"
                />
              </label>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu v-if="hideableColumns.length > 0">
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline" class="h-8">Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56 p-2">
            <DropdownMenuLabel class="px-1 py-1.5">Visible Columns</DropdownMenuLabel>
            <DropdownMenuSeparator class="my-1" />
            <div class="space-y-1">
              <label
                v-for="column in hideableColumns"
                :key="column.columnId"
                class="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
              >
                <span class="truncate">{{ column.columnLabel }}</span>
                <Checkbox
                  :checked="column.visible"
                  @update:checked="column.setVisible(toCheckboxBoolean($event))"
                />
              </label>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="selectedRowCount > 0" class="text-xs text-muted-foreground">
        {{ selectedRowCount.toLocaleString() }}
        selected
      </span>
    </div>
  </div>
</template>
