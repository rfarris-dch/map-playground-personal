export interface HeadingItem {
  readonly id: string;
  readonly level: 2 | 3;
  readonly title: string;
}

export interface DocsSearchSection {
  readonly content: string;
  readonly hash: string | undefined;
  readonly title: string;
}

export interface TocSection {
  readonly children: readonly HeadingItem[];
  readonly id: string;
  readonly title: string;
}

export interface DocsPage {
  readonly description: string;
  readonly excerpt: string;
  readonly headings: readonly HeadingItem[];
  readonly html: string;
  readonly order: number;
  readonly searchSections: readonly DocsSearchSection[];
  readonly searchTerms: readonly string[];
  readonly searchText: string;
  readonly sectionOrder: number;
  readonly sectionTitle: string;
  readonly slug: string;
  readonly sourceFile: string;
  readonly sources: readonly string[];
  readonly title: string;
  readonly tocSections: readonly TocSection[];
}

export interface DocsNavigationGroup {
  readonly order: number;
  readonly pages: readonly DocsPage[];
  readonly title: string;
}

export interface DocsPrevNextLink {
  readonly next: DocsPage | undefined;
  readonly previous: DocsPage | undefined;
}

export interface DocsCollection {
  readonly groups: readonly DocsNavigationGroup[];
  readonly pages: readonly DocsPage[];
}

export interface SearchResultItem {
  readonly description: string;
  readonly pageTitle: string | undefined;
  readonly score: number;
  readonly sectionTitle: string;
  readonly slug: string;
  readonly title: string;
}
