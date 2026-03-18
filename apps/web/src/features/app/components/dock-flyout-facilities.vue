<script setup lang="ts">
  import { Search } from "lucide-vue-next";
  import { computed, ref } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
  import MapNavViewModes from "@/features/app/components/map-nav-view-modes.vue";
  import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";
  import Switch from "@/components/ui/switch/switch.vue";

  interface DockFlyoutFacilitiesProps {
    readonly perspective: "colocation" | "hyperscale";
    readonly activeViewMode: MapNavViewModeId;
    readonly powerTypeOptions: readonly FilterOption[];
    readonly activePowerTypes: ReadonlySet<string>;
    readonly statusOptions: readonly FilterOption[];
    readonly activeStatuses: ReadonlySet<string>;
    readonly marketOptions: readonly FilterOption[];
    readonly activeMarkets: ReadonlySet<string>;
    readonly providerOptions: readonly FilterOption[];
    readonly activeProviders: ReadonlySet<string>;
    readonly userOptions: readonly FilterOption[];
    readonly activeUsers: ReadonlySet<string>;
    readonly interconnectivityHub: boolean;
  }

  interface DockFlyoutFacilitiesEmits {
    "update:view-mode": [mode: MapNavViewModeId];
    "toggle:power-type": [id: string];
    "toggle:status": [id: string];
    "toggle:market": [id: string];
    "toggle:provider": [id: string];
    "toggle:user": [id: string];
    "update:interconnectivity-hub": [value: boolean];
  }

  const props = defineProps<DockFlyoutFacilitiesProps>();
  const emit = defineEmits<DockFlyoutFacilitiesEmits>();

  const marketSearch = ref("");
  const providerSearch = ref("");
  const userSearch = ref("");

  const filteredMarkets = computed(() => filterList(props.marketOptions, marketSearch.value));
  const filteredProviders = computed(() => filterList(props.providerOptions, providerSearch.value));
  const filteredUsers = computed(() => filterList(props.userOptions, userSearch.value));

  function filterList(options: readonly FilterOption[], query: string): readonly FilterOption[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">View Mode</span>
      <div class="dock-view-modes -mx-1 overflow-x-auto scrollbar-hide">
        <MapNavViewModes
          :active-mode="props.activeViewMode"
          @update:active-mode="emit('update:view-mode', $event)"
        />
      </div>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Power Type</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in props.powerTypeOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="props.activePowerTypes.has(opt.id)"
            @update:checked="emit('toggle:power-type', opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
      </div>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Status</span>
      <div class="mt-1 flex flex-col gap-0.5">
        <label
          v-for="opt in props.statusOptions"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="props.activeStatuses.has(opt.id)"
            @update:checked="emit('toggle:status', opt.id)"
          />
          <span class="text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
      </div>
    </div>

    <div v-if="props.perspective === 'colocation'">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Interconnectivity Hub</span>
        <Switch
          :checked="props.interconnectivityHub"
          aria-label="Interconnectivity Hub"
          @update:checked="emit('update:interconnectivity-hub', $event)"
        />
      </div>
    </div>

    <div v-if="props.userOptions.length > 0 || props.perspective === 'hyperscale'">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Users</span>
      <div class="relative mt-1">
        <Search class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="userSearch"
          type="text"
          placeholder="Search users..."
          class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
      </div>
      <div class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto scrollbar-hide">
        <label
          v-for="opt in filteredUsers"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="props.activeUsers.has(opt.id)"
            @update:checked="emit('toggle:user', opt.id)"
          />
          <span class="truncate text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
        <p
          v-if="filteredUsers.length === 0 && userSearch.length > 0"
          class="py-1 text-xs italic text-muted-foreground"
        >
          No users match "{{ userSearch }}"
        </p>
      </div>
    </div>

    <div>
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Markets</span>
      <div class="relative mt-1">
        <Search class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="marketSearch"
          type="text"
          placeholder="Search markets..."
          class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
      </div>
      <div class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto scrollbar-hide">
        <label
          v-for="opt in filteredMarkets"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="props.activeMarkets.has(opt.id)"
            @update:checked="emit('toggle:market', opt.id)"
          />
          <span class="truncate text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
        <p
          v-if="filteredMarkets.length === 0 && marketSearch.length > 0"
          class="py-1 text-xs italic text-muted-foreground"
        >
          No markets match "{{ marketSearch }}"
        </p>
        <p
          v-else-if="filteredMarkets.length === 0"
          class="py-1 text-xs italic text-muted-foreground"
        >
          Zoom in to load markets
        </p>
      </div>
    </div>

    <div v-if="props.perspective === 'colocation'">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Providers</span>
      <div class="relative mt-1">
        <Search class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="providerSearch"
          type="text"
          placeholder="Search providers..."
          class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
      </div>
      <div class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto scrollbar-hide">
        <label
          v-for="opt in filteredProviders"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
        >
          <Checkbox
            :checked="props.activeProviders.has(opt.id)"
            @update:checked="emit('toggle:provider', opt.id)"
          />
          <span class="truncate text-xs font-medium leading-none text-foreground/75">{{ opt.label }}</span>
        </label>
        <p
          v-if="filteredProviders.length === 0 && providerSearch.length > 0"
          class="py-1 text-xs italic text-muted-foreground"
        >
          No providers match "{{ providerSearch }}"
        </p>
        <p
          v-else-if="filteredProviders.length === 0"
          class="py-1 text-xs italic text-muted-foreground"
        >
          Zoom in to load providers
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .dock-view-modes :deep(> div) {
    background: transparent;
  }

  .dock-view-modes :deep(> div > div) {
    background: transparent;
    box-shadow: none;
    border: none;
  }

  .dock-view-modes :deep(button) {
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
</style>
