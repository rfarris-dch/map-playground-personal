<script setup lang="ts">
  import type { PipelineDashboardStateEventsProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
  import { formatRelativeDuration } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-format.service";
  import { formatCount, formatTimestamp } from "@/features/pipeline/pipeline.service";

  const props = defineProps<PipelineDashboardStateEventsProps>();
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">State Checkpoints</h2>
        <span class="text-xs text-muted-foreground">{{ props.stateRows.length }} states</span>
      </header>

      <div class="max-h-[30rem] overflow-auto rounded border border-border/60">
        <table class="min-w-full border-collapse text-xs">
          <thead class="sticky top-0 bg-muted/90 backdrop-blur">
            <tr>
              <th class="px-2 py-1 text-left font-semibold">State</th>
              <th class="px-2 py-1 text-right font-semibold">Completion</th>
              <th class="px-2 py-1 text-right font-semibold">Written</th>
              <th class="px-2 py-1 text-right font-semibold">Remaining</th>
              <th class="px-2 py-1 text-right font-semibold">Expected</th>
              <th class="px-2 py-1 text-right font-semibold">Pages</th>
              <th class="px-2 py-1 text-right font-semibold">Last ID</th>
              <th class="px-2 py-1 text-right font-semibold">Checkpoint Updated</th>
              <th class="px-2 py-1 text-right font-semibold">Age</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="props.stateRows.length === 0">
              <td class="px-2 py-2 text-muted-foreground" colspan="9">
                No checkpoint rows available.
              </td>
            </tr>
            <tr
              v-for="stateRow in props.stateRows"
              :key="stateRow.state"
              class="border-t border-border/50 font-mono"
            >
              <td class="px-2 py-1 font-semibold">{{ stateRow.state }}</td>
              <td class="px-2 py-1 text-right">
                {{ stateRow.completionPercent === null ? "n/a" : `${String(stateRow.completionPercent)}%` }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatCount(stateRow.writtenCount) }}</td>
              <td class="px-2 py-1 text-right">
                {{ stateRow.remainingRows === null ? "n/a" : formatCount(stateRow.remainingRows) }}
              </td>
              <td class="px-2 py-1 text-right">
                {{ stateRow.expectedForDisplay === null ? "n/a" : formatCount(stateRow.expectedForDisplay) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatCount(stateRow.pagesFetched) }}</td>
              <td class="px-2 py-1 text-right">
                {{ stateRow.lastSourceId === null ? "n/a" : formatCount(stateRow.lastSourceId) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatTimestamp(stateRow.updatedAt) }}</td>
              <td class="px-2 py-1 text-right">
                {{ formatRelativeDuration(stateRow.updatedAgeMs) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">Live Events</h2>
        <span class="text-xs text-muted-foreground">{{ props.eventFeedRows.length }} events</span>
      </header>

      <ul
        class="max-h-[30rem] space-y-2 overflow-auto rounded border border-border/60 bg-background/75 p-2"
      >
        <li v-if="props.eventFeedRows.length === 0" class="text-xs text-muted-foreground">
          No event activity yet.
        </li>
        <li
          v-for="(eventRow, index) in props.eventFeedRows"
          :key="`${eventRow.capturedAt}-${eventRow.requestId}-${String(index)}`"
          class="rounded border border-border/60 p-2 text-xs"
          :class="{
            'border-red-300 bg-red-50': eventRow.tone === 'critical',
            'border-emerald-300 bg-emerald-50': eventRow.tone === 'success',
          }"
        >
          <p class="m-0 break-words font-mono">{{ eventRow.message }}</p>
          <p class="mt-1 m-0 break-words font-mono text-[11px] text-muted-foreground">
            {{ formatTimestamp(eventRow.capturedAt) }}
            · requestId={{ eventRow.requestId }}
          </p>
        </li>
      </ul>
    </article>
  </div>
</template>
