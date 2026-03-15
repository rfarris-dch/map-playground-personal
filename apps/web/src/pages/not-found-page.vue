<template>
  <div class="flex h-full items-center justify-center bg-card p-8">
    <div class="flex max-w-md flex-col items-center gap-4 text-center">
      <h1 class="text-lg font-semibold text-foreground">Page not found</h1>
      <p class="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <RouterLink
        to="/map"
        class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to Map
      </RouterLink>
    </div>
  </div>
</template>
