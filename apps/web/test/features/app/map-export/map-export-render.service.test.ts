import { describe, expect, it, mock } from "bun:test";

mock.restore();

mock.module("@html2canvas/html2canvas", () => ({
  default: mock(),
}));

const { shouldIgnoreMapExportElement } = await import(
  "../../../../src/features/app/map-export/map-export-render.service.ts?map-export-render-test"
);

const WHITESPACE_PATTERN = /\s+/;

class TestClassList {
  private readonly values: Set<string>;

  constructor(value = "") {
    this.values = new Set(value.split(WHITESPACE_PATTERN).filter((entry) => entry.length > 0));
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

class TestElement {
  readonly tagName: string;
  readonly classList: TestClassList;
  parentElement: TestElement | null;
  private readonly attributes: Map<string, string>;

  constructor(tagName: string, className = "") {
    this.tagName = tagName.toUpperCase();
    this.classList = new TestClassList(className);
    this.parentElement = null;
    this.attributes = new Map();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  append(child: TestElement): void {
    child.parentElement = this;
  }

  closest(selector: string): TestElement | null {
    if (selector !== "[data-map-export-ignore='true']") {
      return null;
    }

    let current: TestElement | null = this;
    while (current !== null) {
      if (current.attributes.get("data-map-export-ignore") === "true") {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }
}

describe("map export render service", () => {
  it("ignores controls and the live map canvas while keeping overlay content", () => {
    Reflect.set(globalThis, "HTMLElement", TestElement);

    const ignoredControls = new TestElement("div");
    ignoredControls.setAttribute("data-map-export-ignore", "true");

    const mapControl = new TestElement("div", "maplibregl-ctrl");

    const liveCanvas = new TestElement("canvas", "maplibregl-canvas");

    const overlayMarker = new TestElement("div", "maplibregl-marker");

    expect(shouldIgnoreMapExportElement(ignoredControls)).toBe(true);
    expect(shouldIgnoreMapExportElement(mapControl)).toBe(true);
    expect(shouldIgnoreMapExportElement(liveCanvas)).toBe(true);
    expect(shouldIgnoreMapExportElement(overlayMarker)).toBe(false);
  });
});
