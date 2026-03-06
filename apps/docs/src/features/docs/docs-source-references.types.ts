export type DocsPageSourceRole = "authored-doc" | "authoritative-source" | "imported-artifact";

export type DocsSourceKind =
  | "application"
  | "artifact"
  | "docs"
  | "package"
  | "script"
  | "workspace";

export interface RelatedDocsLink {
  readonly slug: string;
  readonly title: string;
}

export interface DocsSourceReferenceItem {
  readonly description: string;
  readonly kind: DocsSourceKind;
  readonly path: string;
  readonly relatedDocs: RelatedDocsLink | undefined;
  readonly role: DocsPageSourceRole;
}

export interface DocsSourceReferenceSummary {
  readonly authoritativeSources: readonly DocsSourceReferenceItem[];
  readonly pageSource: DocsSourceReferenceItem;
}
