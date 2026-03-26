import { onMounted, shallowRef } from "vue";
import { fetchLaunchPolicy } from "./launch-policy.api";
import type { LaunchPolicyModel } from "./launch-policy.types";

const launchPolicy = shallowRef<LaunchPolicyModel | null>(null);
const launchPolicyError = shallowRef<string | null>(null);
const launchPolicyLoading = shallowRef(false);

let launchPolicyRequest: Promise<void> | null = null;

async function ensureLaunchPolicy(): Promise<void> {
  if (launchPolicy.value !== null) {
    return;
  }

  if (launchPolicyRequest !== null) {
    return launchPolicyRequest;
  }

  launchPolicyLoading.value = true;
  launchPolicyError.value = null;

  launchPolicyRequest = (async () => {
    const result = await fetchLaunchPolicy();
    if (result.ok) {
      launchPolicy.value = result.data;
      launchPolicyError.value = null;
      return;
    }

    launchPolicy.value = null;
    launchPolicyError.value = result.message ?? "Unable to load launch posture.";
  })().finally(() => {
    launchPolicyLoading.value = false;
    launchPolicyRequest = null;
  });

  try {
    await launchPolicyRequest;
  } catch (error) {
    launchPolicy.value = null;
    launchPolicyError.value = "Unable to load launch posture.";
    console.error("[launch-policy] unexpected fetch failure", error);
  }
}

export function useLaunchPolicy() {
  onMounted(() => {
    ensureLaunchPolicy().catch((error: unknown) => {
      console.error("[launch-policy] fetch failed", error);
    });
  });

  return {
    launchPolicy,
    launchPolicyError,
    launchPolicyLoading,
    ensureLaunchPolicy,
  };
}
