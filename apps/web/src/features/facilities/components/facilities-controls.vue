<script setup lang="ts">
  import { computed } from "vue";

  interface FacilitiesControlsProps {
    readonly colocationStatus: string;
    readonly colocationVisible: boolean;
    readonly embedded?: boolean;
    readonly hyperscaleStatus: string;
    readonly hyperscaleVisible: boolean;
  }

  const props = withDefaults(defineProps<FacilitiesControlsProps>(), {
    embedded: false,
  });

  const containerClass = computed(() =>
    props.embedded
      ? "w-full [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
      : "w-full rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
  );

  const emit = defineEmits<{
    "update:colocationVisible": [value: boolean];
    "update:hyperscaleVisible": [value: boolean];
  }>();

  function onToggleColocation(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    emit("update:colocationVisible", target.checked);
  }

  function onToggleHyperscale(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    emit("update:hyperscaleVisible", target.checked);
  }

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-[#CBD5E1] bg-[#F8FAFC] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Facilities layers">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-[10px] font-semibold tracking-wide text-[#94A3B8]">Facilities</h2>
      <span class="text-[10px] text-[#94A3B8]">Colocation and hyperscale visibility</span>
    </header>

    <div class="grid gap-2">
      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.colocationVisible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.colocationVisible"
          @change="onToggleColocation"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#3B82F6]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.colocationVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >Colocation</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.colocationVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ props.colocationStatus }}
          </p>
        </div>
      </label>

      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.hyperscaleVisible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.hyperscaleVisible"
          @change="onToggleHyperscale"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#F97316]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.hyperscaleVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
              >Hyperscale</span
            >
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.hyperscaleVisible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ props.hyperscaleStatus }}
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
