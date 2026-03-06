<script setup lang="ts">
  import { useActiveSection } from "@/features/docs/composables/use-active-section";
  import type { TocSection } from "@/features/docs/docs-content.types";

  const props = defineProps<{
    sections: readonly TocSection[];
  }>();

  const { currentSectionId, isActive } = useActiveSection(() => props.sections);
</script>

<template>
  <div
    class="hidden xl:sticky xl:top-19 xl:-mr-6 xl:block xl:h-[calc(100vh-4.75rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6"
  >
    <nav aria-labelledby="on-this-page-title" class="w-56">
      <template v-if="sections.length > 0">
        <h2
          id="on-this-page-title"
          class="font-display text-sm font-medium text-slate-900 dark:text-white"
        >
          On this page
        </h2>
        <ol role="list" class="mt-4 space-y-3 text-sm">
          <li v-for="section in sections" :key="section.id">
            <h3>
              <a
                :href="`#${section.id}`"
                :class="
                  isActive(section.id, section.children)
                    ? 'text-sky-500'
                    : 'font-normal text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                "
              >
                {{ section.title }}
              </a>
            </h3>
            <ol
              v-if="section.children.length > 0"
              role="list"
              class="mt-2 space-y-3 pl-5 text-slate-500 dark:text-slate-400"
            >
              <li v-for="child in section.children" :key="child.id">
                <a
                  :href="`#${child.id}`"
                  :class="currentSectionId === child.id ? 'text-sky-500' : 'hover:text-slate-600 dark:hover:text-slate-300'"
                >
                  {{ child.title }}
                </a>
              </li>
            </ol>
          </li>
        </ol>
      </template>
    </nav>
  </div>
</template>
