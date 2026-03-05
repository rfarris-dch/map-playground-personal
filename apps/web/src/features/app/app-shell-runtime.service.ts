export function resolveDisableParcelsGuardrails(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  return import.meta.env.VITE_DISABLE_PARCELS_GUARDRAILS === "true";
}
