import type {
  LaunchPolicyMarketTreatment,
  LaunchPolicyModel,
  LaunchPolicyValidatedMarket,
} from "./launch-policy.types";

function findValidatedCorridorMarket(
  policy: Readonly<LaunchPolicyModel>,
  marketId: string | null | undefined
): LaunchPolicyValidatedMarket | null {
  if (typeof marketId !== "string" || marketId.trim().length === 0) {
    return null;
  }

  return policy.validatedCorridorMarkets.find((market) => market.marketId === marketId) ?? null;
}

export function listValidatedCorridorMarketLabels(
  policy: Readonly<LaunchPolicyModel>
): readonly string[] {
  return policy.validatedCorridorMarkets.map((market) => market.displayName);
}

export function resolveLaunchPolicyMarketTreatment(
  policy: Readonly<LaunchPolicyModel>,
  marketId: string | null | undefined
): LaunchPolicyMarketTreatment {
  const validatedMarket = findValidatedCorridorMarket(policy, marketId);
  if (validatedMarket !== null) {
    return {
      isValidated: true,
      label: "Validated market",
      marketId: validatedMarket.marketId,
      marketName: validatedMarket.displayName,
      summary:
        "This county maps to a validated corridor market. Corridor outputs still require explicit confidence labels and derived-corridor caveats.",
    };
  }

  return {
    isValidated: false,
    label: policy.copy.corridorDerivedLabel,
    marketId: typeof marketId === "string" && marketId.trim().length > 0 ? marketId : null,
    marketName: null,
    summary: policy.copy.countyNonPriorityCorridorCopy,
  };
}
