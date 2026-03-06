import type {
  DocsCollection,
  DocsPage,
  SearchResultItem,
} from "@/features/docs/docs-content.types";
import {
  buildNavigationGroups,
  derivePageMeta,
  findPrevNextLink,
  sortDocsPages,
} from "@/features/docs/docs-navigation.service";
import { renderMarkdown } from "@/features/docs/markdown.service";

interface RawPageData {
  description?: unknown;
  order?: unknown;
  searchTerms?: unknown;
  sectionOrder?: unknown;
  sectionTitle?: unknown;
  slug?: unknown;
  sources?: unknown;
  title?: unknown;
}

interface ParsedFrontmatter {
  readonly content: string;
  readonly data: RawPageData;
}

const integerPattern = /^-?\d+$/;
const frontmatterArrayItemPattern = /^\s*-\s+(.*)$/;

function normalizeArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function requireString(value: unknown, fieldName: string, sourceFile: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required \`${fieldName}\` in ${sourceFile}`);
  }

  return value.trim();
}

function requireNumber(value: unknown, fieldName: string, sourceFile: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing required numeric \`${fieldName}\` in ${sourceFile}`);
  }

  return value;
}

function parseScalarValue(value: string): unknown {
  const normalized = value.trim();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  if (integerPattern.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  if (!raw.startsWith("---\n")) {
    return {
      data: {},
      content: raw,
    };
  }

  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return {
      data: {},
      content: raw,
    };
  }

  const frontmatterBlock = raw.slice(4, endIndex);
  const content = raw.slice(endIndex + 5);
  const data: Record<string, unknown> = {};
  let currentArrayKey: string | undefined;

  for (const line of frontmatterBlock.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    const arrayItemMatch = line.match(frontmatterArrayItemPattern);
    if (arrayItemMatch && currentArrayKey) {
      const existing = data[currentArrayKey];
      const nextValue = parseScalarValue(arrayItemMatch[1] ?? "");

      if (Array.isArray(existing)) {
        data[currentArrayKey] = [...existing, nextValue];
      } else {
        data[currentArrayKey] = [nextValue];
      }
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      currentArrayKey = undefined;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue.length === 0) {
      data[key] = [];
      currentArrayKey = key;
      continue;
    }

    data[key] = parseScalarValue(rawValue);
    currentArrayKey = undefined;
  }

  return {
    data,
    content,
  };
}

function loadRawContentFiles(): readonly {
  readonly sourceFile: string;
  readonly raw: string;
}[] {
  const modules = import.meta.glob("../../content/**/*.{md,qmd}", {
    eager: true,
    import: "default",
    query: "?raw",
  });

  const documents: {
    sourceFile: string;
    raw: string;
  }[] = [];

  for (const [sourceFile, rawValue] of Object.entries(modules)) {
    if (typeof rawValue !== "string") {
      throw new Error(`Expected raw string content for ${sourceFile}`);
    }

    documents.push({
      sourceFile,
      raw: rawValue,
    });
  }

  return documents;
}

function createDocsPage(sourceFile: string, raw: string): DocsPage {
  const parsed = parseFrontmatter(raw);
  const data = parsed.data satisfies RawPageData;
  const derivedMeta = derivePageMeta(sourceFile);
  const title = requireString(data.title, "title", sourceFile);
  const rendered = renderMarkdown(parsed.content, {
    pageTitle: title,
  });
  const slug =
    typeof data.slug === "string" && data.slug.trim().length > 0
      ? data.slug.trim()
      : derivedMeta.slug;
  const description = requireString(data.description, "description", sourceFile);
  const sectionTitle =
    typeof data.sectionTitle === "string" && data.sectionTitle.trim().length > 0
      ? data.sectionTitle.trim()
      : derivedMeta.sectionTitle;
  const sectionOrder =
    typeof data.sectionOrder === "number"
      ? requireNumber(data.sectionOrder, "sectionOrder", sourceFile)
      : derivedMeta.sectionOrder;
  const order =
    typeof data.order === "number"
      ? requireNumber(data.order, "order", sourceFile)
      : derivedMeta.order;
  const searchTerms = normalizeArray(data.searchTerms);
  const sources = normalizeArray(data.sources);

  return {
    title,
    slug,
    description,
    sectionTitle,
    sectionOrder,
    order,
    searchSections: rendered.searchSections,
    searchTerms,
    sources,
    sourceFile,
    html: rendered.html,
    headings: rendered.headings,
    tocSections: rendered.tocSections,
    excerpt: description,
    searchText: [title, description, rendered.plainText, ...searchTerms, ...sources].join(" "),
  };
}

const pages = sortDocsPages(
  loadRawContentFiles().map((document) => createDocsPage(document.sourceFile, document.raw))
);

export const docsCollection: DocsCollection = {
  pages,
  groups: buildNavigationGroups(pages),
};

export function findDocsPageBySlug(slug: string): DocsPage | undefined {
  return docsCollection.pages.find((page) => page.slug === slug);
}

export function findPrevNextLinkForSlug(slug: string) {
  return findPrevNextLink(slug, docsCollection.pages);
}

interface SearchIndexEntry {
  readonly description: string;
  readonly pageTitle: string | undefined;
  readonly scoreText: string;
  readonly sectionTitle: string;
  readonly slug: string;
  readonly title: string;
}

function createSearchIndexEntry(
  page: DocsPage,
  section: DocsPage["searchSections"][number]
): SearchIndexEntry {
  return {
    slug: typeof section.hash === "string" ? `${page.slug}#${section.hash}` : page.slug,
    title: section.title,
    pageTitle: typeof section.hash === "string" ? page.title : undefined,
    description: page.description,
    sectionTitle: page.sectionTitle,
    scoreText: [
      section.title,
      section.content,
      page.title,
      page.description,
      ...page.searchTerms,
      ...page.sources,
    ].join(" "),
  };
}

const docsSearchIndex = docsCollection.pages.flatMap((page) =>
  page.searchSections.map((section) => createSearchIndexEntry(page, section))
);

function scoreSearchEntry(query: string, entry: SearchIndexEntry): number {
  const normalizedQuery = query.toLowerCase();
  const title = entry.title.toLowerCase();
  const pageTitle = entry.pageTitle?.toLowerCase() ?? "";
  const description = entry.description.toLowerCase();
  const searchText = entry.scoreText.toLowerCase();

  let score = 0;

  if (title === normalizedQuery) {
    score += 100;
  }

  if (title.startsWith(normalizedQuery)) {
    score += 50;
  }

  if (title.includes(normalizedQuery)) {
    score += 20;
  }

  if (pageTitle === normalizedQuery) {
    score += 40;
  }

  if (pageTitle.startsWith(normalizedQuery)) {
    score += 20;
  }

  if (pageTitle.includes(normalizedQuery)) {
    score += 10;
  }

  if (description.includes(normalizedQuery)) {
    score += 10;
  }

  if (searchText.includes(normalizedQuery)) {
    score += 5;
  }

  return score;
}

export function searchDocsPages(query: string): readonly SearchResultItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  return docsSearchIndex
    .map((entry) => ({
      ...entry,
      score: scoreSearchEntry(normalizedQuery, entry),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 8);
}
