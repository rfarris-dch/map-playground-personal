<script setup lang="ts">
  import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
  import { shallowRef } from "vue";
  import { useTheme } from "@/features/docs/composables/use-theme";

  interface ThemeOption {
    readonly name: string;
    readonly value: "light" | "dark" | "system";
  }

  const { currentTheme, setTheme } = useTheme();
  const themeOptions = shallowRef<readonly ThemeOption[]>([
    { name: "Light", value: "light" },
    { name: "Dark", value: "dark" },
    { name: "System", value: "system" },
  ]);

  function resolveOptionClass(focus: boolean, selected: boolean): string {
    if (selected) {
      return "text-sky-500";
    }

    if (focus) {
      return "bg-slate-100 text-slate-900 dark:bg-slate-900/40 dark:text-white";
    }

    return "text-slate-700 dark:text-slate-400";
  }
</script>

<template>
  <Listbox as="div" :model-value="currentTheme" @update:model-value="setTheme">
    <span class="sr-only">Theme</span>
    <ListboxButton
      class="flex h-6 w-6 items-center justify-center rounded-lg shadow-md ring-1 shadow-black/5 ring-black/5 dark:bg-slate-700 dark:ring-white/5 dark:ring-inset"
      aria-label="Theme"
    >
      <svg
        v-if="currentTheme !== 'dark'"
        aria-hidden="true"
        viewBox="0 0 16 16"
        class="h-4 w-4 fill-sky-400"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M7 1a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0V1Zm4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm2.657-5.657a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm-1.415 11.313-.707-.707a1 1 0 0 1 1.415-1.415l.707.708a1 1 0 0 1-1.415 1.414ZM16 7.999a1 1 0 0 0-1-1h-1a1 1 0 1 0 0 2h1a1 1 0 0 0 1-1ZM7 14a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1Zm-2.536-2.464a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm0-8.486A1 1 0 0 1 3.05 4.464l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707ZM3 8a1 1 0 0 0-1-1H1a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1Z"
        />
      </svg>
      <svg v-else aria-hidden="true" viewBox="0 0 16 16" class="h-4 w-4 fill-sky-400">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M7.23 3.333C7.757 2.905 7.68 2 7 2a6 6 0 1 0 0 12c.68 0 .758-.905.23-1.332A5.989 5.989 0 0 1 5 8c0-1.885.87-3.568 2.23-4.668ZM12 5a1 1 0 0 1 1 1 1 1 0 0 0 1 1 1 1 0 1 1 0 2 1 1 0 0 0-1 1 1 1 0 1 1-2 0 1 1 0 0 0-1-1 1 1 0 1 1 0-2 1 1 0 0 0 1-1 1 1 0 0 1 1-1Z"
        />
      </svg>
    </ListboxButton>
    <ListboxOptions
      class="absolute top-full left-1/2 mt-3 w-36 -translate-x-1/2 space-y-1 rounded-xl bg-white p-3 text-sm font-medium shadow-md ring-1 shadow-black/5 ring-black/5 dark:bg-slate-800 dark:ring-white/5"
    >
      <ListboxOption
        v-for="themeOption in themeOptions"
        :key="themeOption.value"
        :value="themeOption.value"
        v-slot="{ focus, selected }"
      >
        <div
          class="flex cursor-pointer items-center rounded-[0.625rem] p-1 select-none"
          :class="resolveOptionClass(focus, selected)"
        >
          <div
            class="rounded-md bg-white p-1 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-700 dark:ring-white/5 dark:ring-inset"
          >
            <span
              class="block h-4 w-4 rounded-full"
              :class="selected ? 'bg-sky-400' : 'bg-slate-400'"
            />
          </div>
          <div class="ml-3">{{ themeOption.name }}</div>
        </div>
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>
