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
import type { HeadingItem, TocSection } from "@/features/docs/docs-content.types";

interface RenderedMarkdown {
  readonly headings: readonly HeadingItem[];
  readonly html: string;
  readonly plainText: string;
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
      continue;
    }

    currentSection.children = [...currentSection.children, heading];
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

export function renderMarkdown(content: string): RenderedMarkdown {
  const headings: HeadingItem[] = [];
  const slugger = createSlugger();

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
      return slugger(value);
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

  const html = markdown.render(content);

  return {
    html,
    headings,
    tocSections: buildTableOfContents(headings),
    plainText: stripMarkdownSyntax(content),
  };
}
