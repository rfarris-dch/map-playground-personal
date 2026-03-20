<script setup lang="ts">
  import { ChevronUp, Search } from "lucide-vue-next";
  import { computed, ref } from "vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Switch from "@/components/ui/switch/switch.vue";
  import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
  import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";
  import MapNavViewModes from "@/features/app/components/map-nav-view-modes.vue";

  interface DockFlyoutFacilitiesProps {
    readonly activeMarkets: ReadonlySet<string>;
    readonly activePowerTypes: ReadonlySet<string>;
    readonly activeProviders: ReadonlySet<string>;
    readonly activeStatuses: ReadonlySet<string>;
    readonly activeUsers: ReadonlySet<string>;
    readonly activeViewMode: MapNavViewModeId;
    readonly interconnectivityHub: boolean;
    readonly marketOptions: readonly FilterOption[];
    readonly perspective: "colocation" | "hyperscale";
    readonly powerTypeOptions: readonly FilterOption[];
    readonly providerOptions: readonly FilterOption[];
    readonly statusOptions: readonly FilterOption[];
    readonly userOptions: readonly FilterOption[];
  }

  interface DockFlyoutFacilitiesEmits {
    "toggle:market": [id: string];
    "toggle:power-type": [id: string];
    "toggle:provider": [id: string];
    "toggle:status": [id: string];
    "toggle:user": [id: string];
    "update:interconnectivity-hub": [value: boolean];
    "update:view-mode": [mode: MapNavViewModeId];
  }

  const props = defineProps<DockFlyoutFacilitiesProps>();
  const emit = defineEmits<DockFlyoutFacilitiesEmits>();

  const marketSearch = ref("");
  const providerSearch = ref("");
  const userSearch = ref("");

  const expandedSections = ref(new Set<string>());

  function toggleSection(section: string): void {
    if (expandedSections.value.has(section)) {
      expandedSections.value.delete(section);
    } else {
      expandedSections.value.add(section);
    }
  }

  function isSectionOpen(section: string): boolean {
    return expandedSections.value.has(section);
  }

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
  <div class="flyout-sections flex flex-col">
    <!-- View Mode -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('viewMode')"
      >
        <span class="text-xs font-semibold text-foreground/50">View Mode</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('viewMode') }"
        />
      </button>
      <div
        v-if="isSectionOpen('viewMode')"
        class="dock-view-modes -mx-1 overflow-x-auto scrollbar-hide"
      >
        <MapNavViewModes
          :active-mode="props.activeViewMode"
          stacked
          @update:active-mode="emit('update:view-mode', $event)"
        />
      </div>
    </div>

    <!-- Power Type (MW) -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('powerType')"
      >
        <span class="text-xs font-semibold text-foreground/50">Power Type (MW)</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('powerType') }"
        />
      </button>
      <div v-if="isSectionOpen('powerType')" class="mt-1 flex flex-col gap-0.5">
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

    <!-- Status -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('status')"
      >
        <span class="text-xs font-semibold text-foreground/50">Status</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('status') }"
        />
      </button>
      <div v-if="isSectionOpen('status')" class="mt-1 flex flex-col gap-0.5">
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

    <!-- Users (hyperscale only, or when options exist) -->
    <div
      v-if="props.userOptions.length > 0 || props.perspective === 'hyperscale'"
      data-flyout-section
    >
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('users')"
      >
        <span class="text-xs font-semibold text-foreground/50">Users</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('users') }"
        />
      </button>
      <template v-if="isSectionOpen('users')">
        <div class="relative mt-1">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            v-model="userSearch"
            type="text"
            placeholder="Search users..."
            class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
        </div>
        <div
          class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto rounded-lg bg-white/30 p-1 scrollbar-hide"
        >
          <label
            v-for="opt in filteredUsers"
            :key="opt.id"
            class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
          >
            <Checkbox
              :checked="props.activeUsers.has(opt.id)"
              @update:checked="emit('toggle:user', opt.id)"
            />
            <span class="truncate text-xs font-medium leading-none text-foreground/75"
              >{{ opt.label }}</span
            >
          </label>
          <p
            v-if="filteredUsers.length === 0 && userSearch.length > 0"
            class="py-1 text-xs italic text-muted-foreground"
          >
            No users match "{{ userSearch }}"
          </p>
        </div>
      </template>
    </div>

    <!-- Providers (colocation only) -->
    <div v-if="props.perspective === 'colocation'" data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('providers')"
      >
        <span class="text-xs font-semibold text-foreground/50">Providers</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('providers') }"
        />
      </button>
      <template v-if="isSectionOpen('providers')">
        <div class="relative mt-1">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            v-model="providerSearch"
            type="text"
            placeholder="Search providers..."
            class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
        </div>
        <div
          class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto rounded-lg bg-white/30 p-1 scrollbar-hide"
        >
          <label
            v-for="opt in filteredProviders"
            :key="opt.id"
            class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
          >
            <Checkbox
              :checked="props.activeProviders.has(opt.id)"
              @update:checked="emit('toggle:provider', opt.id)"
            />
            <span class="truncate text-xs font-medium leading-none text-foreground/75"
              >{{ opt.label }}</span
            >
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
      </template>
    </div>

    <!-- Markets -->
    <div data-flyout-section>
      <button
        type="button"
        class="section-toggle flex w-full cursor-pointer items-center justify-between"
        @click="toggleSection('markets')"
      >
        <span class="text-xs font-semibold text-foreground/50">Markets</span>
        <ChevronUp
          class="h-3.5 w-3.5 text-foreground/30 transition-transform"
          :class="{ 'rotate-180': !isSectionOpen('markets') }"
        />
      </button>
      <template v-if="isSectionOpen('markets')">
        <div class="relative mt-1">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            v-model="marketSearch"
            type="text"
            placeholder="Search markets..."
            class="h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
        </div>
        <div
          class="mt-1 flex max-h-[140px] flex-col gap-0.5 overflow-y-auto rounded-lg bg-white/30 p-1 scrollbar-hide"
        >
          <label
            v-for="opt in filteredMarkets"
            :key="opt.id"
            class="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-black/[0.07]"
          >
            <Checkbox
              :checked="props.activeMarkets.has(opt.id)"
              @update:checked="emit('toggle:market', opt.id)"
            />
            <span class="truncate text-xs font-medium leading-none text-foreground/75"
              >{{ opt.label }}</span
            >
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
      </template>
    </div>

    <!-- Interconnectivity Hub (colocation only, at the end) -->
    <div v-if="props.perspective === 'colocation'" data-flyout-section>
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-foreground/50">Interconnectivity Hub</span>
        <Switch
          :checked="props.interconnectivityHub"
          aria-label="Interconnectivity Hub"
          @update:checked="emit('update:interconnectivity-hub', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
  .flyout-sections > * {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .flyout-sections > *:first-child {
    padding-top: 0;
  }

  .flyout-sections > *:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .section-toggle {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }

  .dock-view-modes :deep(> div) {
    background: transparent;
  }

  .dock-view-modes :deep(> div > div) {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .dock-view-modes :deep(button) {
    border: none;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
</style>
