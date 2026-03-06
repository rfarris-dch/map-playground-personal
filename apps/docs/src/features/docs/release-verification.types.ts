export interface ReleaseVerificationItemDefinition {
  readonly label: string;
  readonly searchQuery: string;
  readonly slug: string;
}

export interface ReleaseVerificationGroupDefinition {
  readonly description: string;
  readonly items: readonly ReleaseVerificationItemDefinition[];
  readonly title: string;
}

export interface ReleaseVerificationItemResult extends ReleaseVerificationItemDefinition {
  readonly navigationReady: boolean;
  readonly searchReady: boolean;
}

export interface ReleaseVerificationGroupResult {
  readonly description: string;
  readonly items: readonly ReleaseVerificationItemResult[];
  readonly title: string;
}
