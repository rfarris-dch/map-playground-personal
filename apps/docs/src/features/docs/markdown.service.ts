import slugify from "@sindresorhus/slugify";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";
import type {
  DocsSearchSection,
  HeadingItem,
  TocSection,
} from "@/features/docs/docs-content.types";

interface RenderedMarkdown {
  readonly headings: readonly HeadingItem[];
  readonly html: string;
  readonly plainText: string;
  readonly searchSections: readonly DocsSearchSection[];
  readonly tocSections: readonly TocSection[];
}

interface AnchorCallbackInfo {
  readonly slug: string;
  readonly title: string;
}

interface AnchorCallbackToken {
  readonly tag: string;
}

interface MutableTocSection {
  children: HeadingItem[];
  id: string;
  title: string;
}

interface MutableSearchSection {
  content: string;
  hash: string | undefined;
  title: string;
}

interface MarkdownToken {
  readonly content: string;
  readonly tag: string;
  readonly type: string;
}

interface MarkdownParserToken {
  attrSet(name: string, value: string): void;
  block: boolean;
  children: MarkdownParserToken[] | null;
  content: string;
  map: [number, number] | null;
}

interface MarkdownBlockState {
  readonly blkIndent: number;
  readonly bMarks: readonly number[];
  readonly eMarks: readonly number[];
  line: number;
  lineMax: number;
  readonly md: {
    readonly block: {
      tokenize(state: MarkdownBlockState, startLine: number, endLine: number): void;
    };
  };
  parentType: string;
  push(type: string, tag: string, nesting: -1 | 0 | 1): MarkdownParserToken;
  readonly sCount: readonly number[];
  readonly src: string;
  readonly tShift: readonly number[];
}

interface MarkdownTokenRenderer {
  renderToken(tokens: readonly MarkdownParserToken[], index: number, options: unknown): string;
}

type CalloutKind = "note" | "warning";

interface CalloutDirective {
  readonly kind: CalloutKind;
  readonly markerCount: number;
  readonly title: string;
}

interface MarkdownLineRange {
  readonly max: number;
  readonly start: number;
}

const whitespaceSplitPattern = /\s+/u;
type MarkdownBlockRule = (
  state: MarkdownBlockState,
  startLine: number,
  endLine: number,
  silent: boolean
) => boolean;
type MarkdownRenderRule = (
  tokens: readonly MarkdownParserToken[],
  index: number,
  rendererOptions: unknown,
  environment: unknown,
  self: MarkdownTokenRenderer
) => string;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function createMermaidBlockMarkup(code: string): string {
  const encodedDefinition = encodeURIComponent(code.trim());

  return [
    '<div class="docs-mermaid-shell not-prose">',
    `<div class="docs-mermaid" data-mermaid-definition="${encodedDefinition}">`,
    '<div class="docs-mermaid-loading">Rendering diagram...</div>',
    "</div>",
    "</div>",
  ].join("");
}

function defaultCalloutTitle(kind: CalloutKind): string {
  switch (kind) {
    case "note":
      return "Note";
    case "warning":
      return "Warning";
    default:
      return "Note";
  }
}

function parseCalloutDirective(line: string): CalloutDirective | undefined {
  const trimmed = line.trim();

  if (!trimmed.startsWith(":::")) {
    return undefined;
  }

  let markerCount = 0;
  while (trimmed[markerCount] === ":") {
    markerCount += 1;
  }

  if (markerCount < 3) {
    return undefined;
  }

  const body = trimmed.slice(markerCount).trim();
  if (body.length === 0) {
    return undefined;
  }

  const [rawKind, ...titleParts] = body.split(whitespaceSplitPattern);
  if (rawKind !== "note" && rawKind !== "warning") {
    return undefined;
  }

  const title = titleParts.join(" ").trim();

  return {
    kind: rawKind,
    markerCount,
    title: title.length > 0 ? title : defaultCalloutTitle(rawKind),
  };
}

function isCalloutClose(line: string, markerCount: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < markerCount) {
    return false;
  }

  return trimmed === ":".repeat(markerCount);
}

function getMarkdownLineRange(state: MarkdownBlockState, line: number): MarkdownLineRange {
  const startMark = state.bMarks[line] ?? 0;
  const shift = state.tShift[line] ?? 0;
  const start = startMark + shift;

  return {
    start,
    max: state.eMarks[line] ?? start,
  };
}

function findCalloutCloseLine(
  state: MarkdownBlockState,
  startLine: number,
  endLine: number,
  markerCount: number
): number | undefined {
  let nextLine = startLine;

  while (nextLine + 1 < endLine) {
    nextLine += 1;
    const lineRange = getMarkdownLineRange(state, nextLine);

    if (lineRange.start < lineRange.max && (state.sCount[nextLine] ?? 0) < state.blkIndent) {
      return undefined;
    }

    if (isCalloutClose(state.src.slice(lineRange.start, lineRange.max), markerCount)) {
      return nextLine;
    }
  }

  return undefined;
}

function pushCalloutTokens(
  state: MarkdownBlockState,
  startLine: number,
  closeLine: number,
  directive: CalloutDirective
): void {
  const previousParentType = state.parentType;
  const previousLineMax = state.lineMax;
  state.parentType = "container";
  state.lineMax = closeLine;

  const containerOpen = state.push("docs_callout_open", "div", 1);
  containerOpen.block = true;
  containerOpen.map = [startLine, closeLine];
  containerOpen.attrSet("class", `docs-callout docs-callout-${directive.kind}`);

  const titleOpen = state.push("docs_callout_title_open", "p", 1);
  titleOpen.block = true;
  titleOpen.attrSet("class", "docs-callout-title");

  const titleInline = state.push("inline", "", 0);
  titleInline.content = directive.title;
  titleInline.map = [startLine, startLine + 1];
  titleInline.children = [];

  const titleClose = state.push("docs_callout_title_close", "p", -1);
  titleClose.block = true;

  state.md.block.tokenize(state, startLine + 1, closeLine);

  const containerClose = state.push("docs_callout_close", "div", -1);
  containerClose.block = true;

  state.parentType = previousParentType;
  state.lineMax = previousLineMax;
}

function createSlugger(): (value: string) => string {
  const seen = new Map<string, number>();

  return (value: string) => {
    const normalized = slugify(value);
    const current = seen.get(normalized) ?? 0;
    seen.set(normalized, current + 1);

    if (current === 0) {
      return normalized;
    }

    return `${normalized}-${current + 1}`;
  };
}

function resolveLanguage(languageHint: string): string {
  const normalized = languageHint.trim().toLowerCase();

  if (normalized.length === 0) {
    return "text";
  }

  if (normalized === "shell" || normalized === "sh" || normalized === "zsh") {
    return "bash";
  }

  if (normalized === "yml") {
    return "yaml";
  }

  if (normalized in Prism.languages) {
    return normalized;
  }

  return "text";
}

function buildTableOfContents(headings: readonly HeadingItem[]): readonly TocSection[] {
  const sections: MutableTocSection[] = [];

  for (const heading of headings) {
    if (heading.level === 2) {
      sections.push({
        id: heading.id,
        title: heading.title,
        children: [],
      });
      continue;
    }

    const currentSection = sections.at(-1);
    if (!currentSection) {
      throw new Error(
        `Cannot add \`h3\` heading \`${heading.title}\` to table of contents without a preceding \`h2\`.`
      );
    }

    currentSection.children = [...currentSection.children, heading];
  }

  return sections;
}

function appendSectionContent(section: MutableSearchSection | undefined, content: string): void {
  if (!section) {
    return;
  }

  const normalizedContent = content.trim();
  if (normalizedContent.length === 0) {
    return;
  }

  section.content =
    section.content.length > 0 ? `${section.content}\n${normalizedContent}` : normalizedContent;
}

function collectInlineContent(tokens: readonly MarkdownToken[], startIndex: number): string {
  const inlineToken = tokens[startIndex];
  if (!inlineToken || inlineToken.type !== "inline") {
    return "";
  }

  return inlineToken.content.trim();
}

function buildSearchSections(
  tokens: readonly MarkdownToken[],
  pageTitle: string,
  slugger: (value: string) => string
): readonly DocsSearchSection[] {
  const sections: MutableSearchSection[] = [
    {
      title: pageTitle,
      hash: undefined,
      content: "",
    },
  ];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    if (token.type === "heading_open") {
      const level = Number(token.tag.replace("h", ""));
      const title = collectInlineContent(tokens, index + 1);

      if (title.length === 0) {
        continue;
      }

      const hash = slugger(title);
      if (level <= 2) {
        sections.push({
          title,
          hash,
          content: "",
        });
      }

      continue;
    }

    if (token.type === "paragraph_open") {
      appendSectionContent(sections.at(-1), collectInlineContent(tokens, index + 1));
    }
  }

  return sections;
}

function stripMarkdownSyntax(content: string): string {
  return content
    .replaceAll(/:::(note|warning)([^\n]*)\n/g, " ")
    .replaceAll(/\n:::\s*$/gmu, " ")
    .replaceAll(/```[\s\S]*?```/g, " ")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replaceAll(/[#>*_-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function renderMarkdown(
  content: string,
  options?: {
    readonly pageTitle?: string;
  }
): RenderedMarkdown {
  const headings: HeadingItem[] = [];
  const headingSlugger = createSlugger();
  const searchSlugger = createSlugger();

  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    highlight(code: string, languageHint: string) {
      if (languageHint.trim().toLowerCase() === "mermaid") {
        return createMermaidBlockMarkup(code);
      }

      const language = resolveLanguage(languageHint);
      const grammar = Prism.languages[language];

      if (!grammar) {
        return `<pre class="language-${language}"><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
      }

      const highlighted = Prism.highlight(code, grammar, language);
      return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>`;
    },
  });

  const calloutBlockRule: MarkdownBlockRule = (state, startLine, endLine, silent) => {
    const lineRange = getMarkdownLineRange(state, startLine);
    const directive = parseCalloutDirective(state.src.slice(lineRange.start, lineRange.max));

    if (typeof directive === "undefined") {
      return false;
    }

    if (silent) {
      return true;
    }

    const closeLine = findCalloutCloseLine(state, startLine, endLine, directive.markerCount);
    if (typeof closeLine === "undefined") {
      return false;
    }

    pushCalloutTokens(state, startLine, closeLine, directive);
    state.line = closeLine + 1;

    return true;
  };

  const renderCalloutToken: MarkdownRenderRule = (
    tokens,
    index,
    rendererOptions,
    _environment,
    self
  ) => self.renderToken(tokens, index, rendererOptions);

  markdown.block.ruler.before("blockquote", "docs-callout", calloutBlockRule);
  markdown.renderer.rules.docs_callout_open = renderCalloutToken;
  markdown.renderer.rules.docs_callout_close = renderCalloutToken;
  markdown.renderer.rules.docs_callout_title_open = renderCalloutToken;
  markdown.renderer.rules.docs_callout_title_close = renderCalloutToken;

  markdown.use(markdownItAnchor, {
    level: [2, 3],
    slugify(value: string) {
      return headingSlugger(value);
    },
    callback(token: AnchorCallbackToken, info: AnchorCallbackInfo) {
      const level = Number(token.tag.replace("h", ""));

      if (level !== 2 && level !== 3) {
        return;
      }

      headings.push({
        id: info.slug,
        title: info.title,
        level,
      });
    },
  });

  const tokens = markdown.parse(content, {});
  const html = markdown.render(content);
  const searchSections =
    typeof options?.pageTitle === "string" && options.pageTitle.trim().length > 0
      ? buildSearchSections(tokens, options.pageTitle.trim(), searchSlugger)
      : [];

  return {
    html,
    headings,
    tocSections: buildTableOfContents(headings),
    plainText: stripMarkdownSyntax(content),
    searchSections,
  };
}
