import { nextTick, onMounted, onUnmounted, type Ref, watch } from "vue";

interface MermaidRenderResult {
  readonly bindFunctions?: (element: Element) => void;
  readonly svg: string;
}

interface MermaidModule {
  initialize(config: MermaidConfig): void;
  render(id: string, definition: string): Promise<MermaidRenderResult>;
}

interface MermaidConfig {
  readonly securityLevel: "strict";
  readonly startOnLoad: false;
  readonly theme: "base";
  readonly themeVariables: MermaidThemeVariables;
}

interface MermaidThemeVariables {
  readonly edgeLabelBackground: string;
  readonly fontFamily: string;
  readonly lineColor: string;
  readonly mainBkg: string;
  readonly nodeBorder: string;
  readonly primaryBorderColor: string;
  readonly primaryColor: string;
  readonly primaryTextColor: string;
  readonly secondaryBorderColor: string;
  readonly secondaryColor: string;
  readonly tertiaryBorderColor: string;
  readonly tertiaryColor: string;
}

const mermaidBlockSelector = ".docs-mermaid[data-mermaid-definition]";
let mermaidRenderCounter = 0;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function resolveThemeVariables(isDark: boolean): MermaidThemeVariables {
  if (isDark) {
    return {
      primaryColor: "#0f172a",
      primaryBorderColor: "#38bdf8",
      primaryTextColor: "#e2e8f0",
      secondaryColor: "#111827",
      secondaryBorderColor: "#6366f1",
      tertiaryColor: "#082f49",
      tertiaryBorderColor: "#7dd3fc",
      mainBkg: "#0f172a",
      nodeBorder: "#475569",
      lineColor: "#94a3b8",
      edgeLabelBackground: "#0f172a",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    };
  }

  return {
    primaryColor: "#f8fafc",
    primaryBorderColor: "#0ea5e9",
    primaryTextColor: "#0f172a",
    secondaryColor: "#eef2ff",
    secondaryBorderColor: "#6366f1",
    tertiaryColor: "#e0f2fe",
    tertiaryBorderColor: "#38bdf8",
    mainBkg: "#ffffff",
    nodeBorder: "#cbd5e1",
    lineColor: "#475569",
    edgeLabelBackground: "#ffffff",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  };
}

function createMermaidConfig(): MermaidConfig {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: resolveThemeVariables(isDark),
  };
}

function decodeMermaidDefinition(value: string): string {
  return decodeURIComponent(value);
}

function createMermaidFailureMarkup(definition: string): string {
  return [
    '<div class="docs-mermaid-error">',
    "Unable to render Mermaid diagram. Showing source instead.",
    "</div>",
    `<pre class="language-mermaid"><code class="language-mermaid">${escapeHtml(definition)}</code></pre>`,
  ].join("");
}

async function loadMermaidModule(): Promise<MermaidModule> {
  const mermaidImport = await import("mermaid");
  return mermaidImport.default;
}

export function useProseMermaid(rootElement: Ref<HTMLElement | null>, html: Ref<string>) {
  let themeObserver: MutationObserver | undefined;
  let renderRunId = 0;

  function queueRender(): void {
    renderMermaidDiagrams().catch(() => undefined);
  }

  async function renderMermaidDiagrams(): Promise<void> {
    renderRunId += 1;
    const activeRunId = renderRunId;

    await nextTick();

    const proseRoot = rootElement.value;
    if (!proseRoot) {
      return;
    }

    const diagramBlocks = Array.from(proseRoot.querySelectorAll<HTMLElement>(mermaidBlockSelector));
    if (diagramBlocks.length === 0) {
      return;
    }

    const mermaid = await loadMermaidModule();

    if (activeRunId !== renderRunId) {
      return;
    }

    mermaid.initialize(createMermaidConfig());

    for (const diagramBlock of diagramBlocks) {
      const encodedDefinition = diagramBlock.dataset.mermaidDefinition;

      if (typeof encodedDefinition !== "string" || encodedDefinition.length === 0) {
        continue;
      }

      const definition = decodeMermaidDefinition(encodedDefinition);

      try {
        const renderResult = await mermaid.render(
          `docs-mermaid-${mermaidRenderCounter}`,
          definition
        );

        mermaidRenderCounter += 1;

        if (activeRunId !== renderRunId) {
          return;
        }

        diagramBlock.innerHTML = renderResult.svg;
        renderResult.bindFunctions?.(diagramBlock);
      } catch {
        diagramBlock.innerHTML = createMermaidFailureMarkup(definition);
      }
    }
  }

  onMounted(() => {
    queueRender();

    themeObserver = new MutationObserver(() => {
      queueRender();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });

  onUnmounted(() => {
    themeObserver?.disconnect();
  });

  watch(html, () => {
    queueRender();
  });
}
