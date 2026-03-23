<script setup lang="ts">
  import { computed, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import Button from "@/components/ui/button/button.vue";
  import Card from "@/components/ui/card/card.vue";
  import Input from "@/components/ui/input/input.vue";
  import { signInToMapApp, useMapAppAuthState } from "@/features/auth/auth-session.service";

  const router = useRouter();
  const route = useRoute();
  const authState = useMapAppAuthState();

  const email = ref("");
  const password = ref("");
  const errorMessage = ref<string | null>(null);

  const redirectTarget = computed(() => {
    const redirectQueryValue = route.query.redirect;
    return typeof redirectQueryValue === "string" && redirectQueryValue.length > 0
      ? redirectQueryValue
      : "/map";
  });

  const submitDisabled = computed(
    () =>
      authState.loading.value ||
      email.value.trim().length === 0 ||
      password.value.trim().length === 0
  );

  async function handleSubmit(): Promise<void> {
    errorMessage.value = null;

    try {
      await signInToMapApp({
        email: email.value.trim(),
        password: password.value,
      });
      await router.replace(redirectTarget.value);
    } catch (error) {
      if (error instanceof Error) {
        errorMessage.value = error.message;
        return;
      }

      errorMessage.value = "Unable to sign in";
    }
  }
</script>

<template>
  <main
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12"
  >
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.16),_transparent_38%)]"
    />
    <div
      class="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]"
    />

    <Card
      class="relative z-10 w-full max-w-md border-slate-800/80 bg-slate-950/85 shadow-2xl shadow-slate-950/40"
    >
      <div class="space-y-6 p-8">
        <div class="space-y-4">
          <img src="/dch-logo.svg" alt="datacenterHawk" class="h-8 w-auto">

          <div class="space-y-2">
            <h1 class="text-2xl font-semibold tracking-tight text-white">
              Sign in to map-playground
            </h1>
            <p class="text-sm leading-6 text-slate-300">
              Access is restricted to
              <span class="font-medium text-white">@datacenterhawk.com</span>
              accounts.
            </p>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-slate-200">Work email</label>
            <Input
              id="email"
              v-model="email"
              autocomplete="username"
              class="h-11 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
              placeholder="name@datacenterhawk.com"
              type="email"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <label for="password" class="text-sm font-medium text-slate-200">Password</label>
              <a
                class="text-xs font-medium text-sky-300 transition-colors hover:text-sky-200"
                href="https://app.datacenterhawk.com/login/forgot-password"
                rel="noreferrer"
                target="_blank"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              v-model="password"
              autocomplete="current-password"
              class="h-11 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
              placeholder="Enter your password"
              type="password"
            />
          </div>

          <p
            v-if="errorMessage !== null"
            class="rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          >
            {{ errorMessage }}
          </p>

          <Button
            class="h-11 w-full bg-sky-500 text-slate-950 hover:bg-sky-400"
            :disabled="submitDisabled"
            type="submit"
          >
            {{ authState.loading.value ? "Signing in..." : "Sign in" }}
          </Button>
        </form>
      </div>
    </Card>
  </main>
</template>
