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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
      const language = resolveLanguage(languageHint);
      const grammar = Prism.languages[language];

      if (!grammar) {
        return `<pre class="language-${language}"><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
      }

      const highlighted = Prism.highlight(code, grammar, language);
      return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>`;
    },
  });

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
