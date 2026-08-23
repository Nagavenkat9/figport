// Phase 5: detects whether an element's content should become a single
// Figma TEXT node (rather than being recursed into as more frames), and
// extracts per-character-range styling for mixed-formatting text (a bold
// word inside a paragraph, a differently-styled link, etc).

import { FigmaTextRun } from "../../shared/types";
import { parseColor } from "../transformer/color-parser";

// Elements that carry inline formatting without breaking the surrounding
// text flow. An element is treated as a "text leaf" only if every element
// child is one of these (or <br>) — anything else (a nested <div>,
// <section>, ...) means this is a structural container instead, and gets
// recursed into as frames as usual.
const INLINE_TAGS = new Set([
  "span",
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "small",
  "mark",
  "code",
  "sub",
  "sup",
  "abbr",
  "label",
]);

export function isTextLeaf(element: Element): boolean {
  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag !== "br" && !INLINE_TAGS.has(tag)) return false;
  }
  return (element.textContent ?? "").trim().length > 0;
}

function applyTextTransform(text: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

function makeRun(text: string, el: Element, isBreak: boolean): FigmaTextRun {
  const win = el.ownerDocument.defaultView!;
  const cs = win.getComputedStyle(el);
  const characters = isBreak ? text : applyTextTransform(text, cs.textTransform);
  const color = parseColor(cs.color) ?? { r: 0, g: 0, b: 0, a: 1 };
  return {
    characters,
    color,
    fontFamily: cs.fontFamily,
    fontWeight: parseFloat(cs.fontWeight) || 400,
    italic: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
    fontSize: parseFloat(cs.fontSize) || 16,
    underline: cs.textDecorationLine.includes("underline"),
    strikethrough: cs.textDecorationLine.includes("line-through"),
  };
}

// Walks the leaf element's actual child nodes (not just .children) so each
// text run picks up the computed style of its immediate parent — which
// already reflects CSS inheritance/overrides at that exact point, however
// deeply the inline tags are nested (a <b> inside an <a> inside a <span>
// all resolve correctly without any manual inheritance logic here).
export function extractTextRuns(element: Element): FigmaTextRun[] {
  const runs: FigmaTextRun[] = [];

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim().length > 0 && node.parentElement) {
        runs.push(makeRun(text, node.parentElement, false));
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName.toLowerCase() === "br") {
        runs.push(makeRun("\n", el.parentElement ?? element, true));
        return;
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  }

  for (const child of Array.from(element.childNodes)) walk(child);
  return runs;
}
