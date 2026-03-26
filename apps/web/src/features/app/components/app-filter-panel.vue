<script setup lang="ts">
  import { ChevronDown, Search } from "lucide-vue-next";
  import { computed, ref } from "vue";
  import Accordion from "@/components/ui/accordion/accordion.vue";
  import AccordionContent from "@/components/ui/accordion/accordion-content.vue";
  import AccordionItem from "@/components/ui/accordion/accordion-item.vue";
  import AccordionTrigger from "@/components/ui/accordion/accordion-trigger.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";

  export interface FilterOption {
    readonly id: string;
    readonly label: string;
  }

  interface ParcelDropdownState {
    readonly dataset: string;
    readonly davPercent: string;
    readonly styleAcres: string;
  }

  interface AppFilterPanelProps {
    readonly activeFloodZones: ReadonlySet<string>;
    readonly activeGasCapacities: ReadonlySet<string>;
    readonly activeGasStatuses: ReadonlySet<string>;
    readonly activeMarkets: ReadonlySet<string>;
    readonly activePowerTypes: ReadonlySet<string>;
    readonly activeProviders: ReadonlySet<string>;
    readonly activeStatuses: ReadonlySet<string>;
    readonly activeUsers: ReadonlySet<string>;
    readonly activeVoltages: ReadonlySet<string>;
    readonly activeZoningTypes: ReadonlySet<string>;

    readonly floodZoneOptions: readonly FilterOption[];
    readonly gasCapacityOptions: readonly FilterOption[];
    readonly gasStatusOptions: readonly FilterOption[];
    readonly interconnectivityHub: boolean;
    readonly marketOptions: readonly FilterOption[];
    readonly parcelDatasetOptions: readonly FilterOption[];
    readonly parcelDavOptions: readonly FilterOption[];
    readonly parcelDropdowns: ParcelDropdownState;
    readonly parcelStyleOptions: readonly FilterOption[];
    readonly powerTypeOptions: readonly FilterOption[];
    readonly providerOptions: readonly FilterOption[];
    readonly statusOptions: readonly FilterOption[];
    readonly userOptions: readonly FilterOption[];
    readonly voltageOptions: readonly FilterOption[];
    readonly zoningTypeOptions: readonly FilterOption[];
  }

  type ToggleFilterEmit =
    | "toggle:power-type"
    | "toggle:status"
    | "toggle:market"
    | "toggle:provider"
    | "toggle:user"
    | "toggle:voltage"
    | "toggle:gas-capacity"
    | "toggle:gas-status"
    | "toggle:zoning-type"
    | "toggle:flood-zone";

  type StringValueEmit =
    | ToggleFilterEmit
    | "update:parcel-dataset"
    | "update:parcel-style"
    | "update:parcel-dav";

  interface AppFilterPanelEmits {
    (e: StringValueEmit, value: string): void;
    (e: "update:interconnectivity-hub", value: boolean): void;
  }

  const props = defineProps<AppFilterPanelProps>();
  const emit = defineEmits<AppFilterPanelEmits>();

  const marketSearch = ref("");
  const providerSearch = ref("");
  const userSearch = ref("");

  const filteredMarkets = computed(() => filterOptions(props.marketOptions, marketSearch.value));
  const filteredProviders = computed(() =>
    filterOptions(props.providerOptions, providerSearch.value)
  );
  const filteredUsers = computed(() => filterOptions(props.userOptions, userSearch.value));

  function filterOptions(options: readonly FilterOption[], query: string): readonly FilterOption[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }

  const openSections = ref<string[]>([]);
  const openBottomSections = ref<string[]>([]);

  const openInfraSections = ref<string[]>([]);

  const openParcelSections = ref<string[]>([]);
</script>

<template>
  <div class="flex flex-col bg-card font-sans">
    <Accordion v-model="openSections" type="multiple" class="flex flex-col">
      <AccordionItem value="power-type" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Power Type (MW)
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-1)] px-3 pb-2">
            <label
              v-for="opt in props.powerTypeOptions"
              :key="opt.id"
              class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
            >
              <Checkbox
                :checked="props.activePowerTypes.has(opt.id)"
                @update:checked="emit('toggle:power-type', opt.id)"
              />
              <span
                class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                >{{ opt.label }}</span
              >
            </label>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="status" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Status
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-1)] px-3 pb-2">
            <label
              v-for="opt in props.statusOptions"
              :key="opt.id"
              class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
            >
              <Checkbox
                :checked="props.activeStatuses.has(opt.id)"
                @update:checked="emit('toggle:status', opt.id)"
              />
              <span
                class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                >{{ opt.label }}</span
              >
            </label>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="markets" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Markets
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-1)] px-3 pb-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                v-model="marketSearch"
                type="text"
                placeholder="Search markets..."
                class="h-7 w-full rounded-sm border border-border bg-background pl-7 pr-2 text-[length:var(--size-2)] text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
            </div>
            <div class="flex max-h-[180px] flex-col gap-[var(--space-1)] overflow-y-auto">
              <label
                v-for="opt in filteredMarkets"
                :key="opt.id"
                class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
              >
                <Checkbox
                  :checked="props.activeMarkets.has(opt.id)"
                  @update:checked="emit('toggle:market', opt.id)"
                />
                <span
                  class="truncate text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                  >{{ opt.label }}</span
                >
              </label>
              <p
                v-if="filteredMarkets.length === 0 && marketSearch.length > 0"
                class="py-1 text-[length:var(--size-2)] italic text-muted-foreground"
              >
                No markets match "{{ marketSearch }}"
              </p>
              <p
                v-else-if="filteredMarkets.length === 0"
                class="py-1 text-[length:var(--size-2)] italic text-muted-foreground"
              >
                Zoom in to load markets
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="providers" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Providers
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-1)] px-3 pb-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                v-model="providerSearch"
                type="text"
                placeholder="Search providers..."
                class="h-7 w-full rounded-sm border border-border bg-background pl-7 pr-2 text-[length:var(--size-2)] text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
            </div>
            <div class="flex max-h-[180px] flex-col gap-[var(--space-1)] overflow-y-auto">
              <label
                v-for="opt in filteredProviders"
                :key="opt.id"
                class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
              >
                <Checkbox
                  :checked="props.activeProviders.has(opt.id)"
                  @update:checked="emit('toggle:provider', opt.id)"
                />
                <span
                  class="truncate text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                  >{{ opt.label }}</span
                >
              </label>
              <p
                v-if="filteredProviders.length === 0 && providerSearch.length > 0"
                class="py-1 text-[length:var(--size-2)] italic text-muted-foreground"
              >
                No providers match "{{ providerSearch }}"
              </p>
              <p
                v-else-if="filteredProviders.length === 0"
                class="py-1 text-[length:var(--size-2)] italic text-muted-foreground"
              >
                Zoom in to load providers
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        v-if="props.userOptions.length > 0"
        value="users"
        class="border-b border-border"
      >
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Users
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-1)] px-3 pb-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                v-model="userSearch"
                type="text"
                placeholder="Search users..."
                class="h-7 w-full rounded-sm border border-border bg-background pl-7 pr-2 text-[length:var(--size-2)] text-foreground/85 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
            </div>
            <div class="flex max-h-[180px] flex-col gap-[var(--space-1)] overflow-y-auto">
              <label
                v-for="opt in filteredUsers"
                :key="opt.id"
                class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
              >
                <Checkbox
                  :checked="props.activeUsers.has(opt.id)"
                  @update:checked="emit('toggle:user', opt.id)"
                />
                <span
                  class="truncate text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                  >{{ opt.label }}</span
                >
              </label>
              <p
                v-if="filteredUsers.length === 0"
                class="py-1 text-[length:var(--size-2)] italic text-muted-foreground"
              >
                No users match "{{ userSearch }}"
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div class="flex items-center justify-between border-b border-border px-3 py-2">
      <span
        class="text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground"
      >
        Interconnectivity Hub
      </span>
      <button
        type="button"
        aria-label="Interconnectivity Hub"
        :aria-pressed="props.interconnectivityHub"
        class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        :class="props.interconnectivityHub ? 'bg-primary' : 'bg-muted'"
        @click="emit('update:interconnectivity-hub', !props.interconnectivityHub)"
      >
        <span
          class="pointer-events-none inline-block h-3 w-3 rounded-full bg-card shadow-sm transition-transform"
          :class="props.interconnectivityHub ? 'translate-x-3' : 'translate-x-0.5'"
        />
      </button>
    </div>

    <Accordion v-model="openBottomSections" type="multiple">
      <AccordionItem value="infrastructure" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Infrastructure
        </AccordionTrigger>
        <AccordionContent>
          <Accordion v-model="openInfraSections" type="multiple" class="flex flex-col">
            <AccordionItem value="voltage" class="border-b-0">
              <AccordionTrigger
                class="flex h-7 items-center justify-between px-3 pl-5 text-[length:var(--size-2)] font-[number:var(--weight-2)] text-foreground/70 hover:no-underline"
              >
                Transmission Lines Voltage (kV)
              </AccordionTrigger>
              <AccordionContent>
                <div class="flex flex-col gap-[var(--space-1)] px-3 pl-5 pb-2">
                  <label
                    v-for="opt in props.voltageOptions"
                    :key="opt.id"
                    class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
                  >
                    <input
                      type="radio"
                      name="transmission-voltage"
                      class="h-3.5 w-3.5 accent-primary"
                      :checked="props.activeVoltages.has(opt.id)"
                      @change="emit('toggle:voltage', opt.id)"
                    >
                    <span
                      class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                      >{{ opt.label }}</span
                    >
                  </label>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gas-capacity" class="border-b-0">
              <AccordionTrigger
                class="flex h-7 items-center justify-between px-3 pl-5 text-[length:var(--size-2)] font-[number:var(--weight-2)] text-foreground/70 hover:no-underline"
              >
                Natural Gas Lines Capacity (BWh)
              </AccordionTrigger>
              <AccordionContent>
                <div class="flex flex-col gap-[var(--space-1)] px-3 pl-5 pb-2">
                  <label
                    v-for="opt in props.gasCapacityOptions"
                    :key="opt.id"
                    class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
                  >
                    <Checkbox
                      :checked="props.activeGasCapacities.has(opt.id)"
                      @update:checked="emit('toggle:gas-capacity', opt.id)"
                    />
                    <span
                      class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                      >{{ opt.label }}</span
                    >
                  </label>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gas-status" class="border-b-0">
              <AccordionTrigger
                class="flex h-7 items-center justify-between px-3 pl-5 text-[length:var(--size-2)] font-[number:var(--weight-2)] text-foreground/70 hover:no-underline"
              >
                Natural Gas Lines Status
              </AccordionTrigger>
              <AccordionContent>
                <div class="flex flex-col gap-[var(--space-1)] px-3 pl-5 pb-2">
                  <label
                    v-for="opt in props.gasStatusOptions"
                    :key="opt.id"
                    class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
                  >
                    <Checkbox
                      :checked="props.activeGasStatuses.has(opt.id)"
                      @update:checked="emit('toggle:gas-status', opt.id)"
                    />
                    <span
                      class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                      >{{ opt.label }}</span
                    >
                  </label>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="parcels" class="border-b border-border">
        <AccordionTrigger
          class="flex h-8 items-center justify-between px-3 text-[length:var(--size-2)] font-[number:var(--weight-3)] uppercase tracking-wide text-muted-foreground hover:no-underline"
        >
          Parcels
        </AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-[var(--space-2)] px-3 pb-2">
            <div class="flex flex-col gap-1">
              <span
                class="text-[length:var(--size-2)] font-[number:var(--weight-2)] leading-none text-foreground/70"
                >Parcel Dataset</span
              >
              <select
                :value="props.parcelDropdowns.dataset"
                class="h-7 w-full rounded-sm border border-border bg-background px-2 text-[length:var(--size-2)] text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                @change="emit('update:parcel-dataset', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in props.parcelDatasetOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <span
                class="text-[length:var(--size-2)] font-[number:var(--weight-2)] leading-none text-foreground/70"
                >Parcel Style (Acres)</span
              >
              <select
                :value="props.parcelDropdowns.styleAcres"
                class="h-7 w-full rounded-sm border border-border bg-background px-2 text-[length:var(--size-2)] text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                @change="emit('update:parcel-style', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in props.parcelStyleOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <span
                class="text-[length:var(--size-2)] font-[number:var(--weight-2)] leading-none text-foreground/70"
                >Display at % Down-Assessed Value (DAV)</span
              >
              <select
                :value="props.parcelDropdowns.davPercent"
                class="h-7 w-full rounded-sm border border-border bg-background px-2 text-[length:var(--size-2)] text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                @change="emit('update:parcel-dav', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in props.parcelDavOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <Accordion v-model="openParcelSections" type="multiple" class="flex flex-col">
              <AccordionItem value="zoning-type" class="border-b-0">
                <AccordionTrigger
                  class="flex h-7 items-center justify-between text-[length:var(--size-2)] font-[number:var(--weight-2)] text-foreground/70 hover:no-underline"
                >
                  Zoning Type
                </AccordionTrigger>
                <AccordionContent>
                  <div class="flex flex-col gap-[var(--space-1)] pb-1">
                    <label
                      v-for="opt in props.zoningTypeOptions"
                      :key="opt.id"
                      class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
                    >
                      <Checkbox
                        :checked="props.activeZoningTypes.has(opt.id)"
                        @update:checked="emit('toggle:zoning-type', opt.id)"
                      />
                      <span
                        class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                        >{{ opt.label }}</span
                      >
                    </label>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="flood-zone" class="border-b-0">
                <AccordionTrigger
                  class="flex h-7 items-center justify-between text-[length:var(--size-2)] font-[number:var(--weight-2)] text-foreground/70 hover:no-underline"
                >
                  Flood Zone
                </AccordionTrigger>
                <AccordionContent>
                  <div class="flex flex-col gap-[var(--space-1)] pb-1">
                    <label
                      v-for="opt in props.floodZoneOptions"
                      :key="opt.id"
                      class="flex cursor-pointer items-center gap-2 py-1 transition-colors hover:bg-background"
                    >
                      <Checkbox
                        :checked="props.activeFloodZones.has(opt.id)"
                        @update:checked="emit('toggle:flood-zone', opt.id)"
                      />
                      <span
                        class="text-[length:var(--size-2)] font-[number:var(--weight-1)] leading-none text-muted-foreground"
                        >{{ opt.label }}</span
                      >
                    </label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
