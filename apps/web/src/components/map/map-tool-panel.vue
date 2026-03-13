<template>
  <aside
    class="map-glass-elevated pointer-events-auto absolute bottom-16 left-4 z-20 w-[min(28rem,calc(100%-2rem))] rounded-xl p-3"
    v-bind="$attrs"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <slot name="header" />
    </header>
    <div class="space-y-3">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="mt-3 flex items-center gap-2">
      <slot name="footer" />
    </footer>
  </aside>
</template>
