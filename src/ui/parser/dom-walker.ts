// Traverses the rendered DOM inside the hidden iframe and produces a plain-
// object tree of geometry + tag/class + style info, plus extracted text
// runs for elements whose content is text (Phase 5).

import { extractStyle, StyleInfo } from "./style-extractor";
import { isTextLeaf, extractTextRuns } from "./text-extractor";
import { FigmaTextRun } from "../../shared/types";

export interface RawDomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawDomNode {
  tagName: string;
  className: string;
  rect: RawDomRect;
  style: StyleInfo;
  // Present (non-empty) when this element's content is text rather than
  // structural children — see text-extractor.ts's isTextLeaf(). When set,
  // `children` is always empty; the text is rendered as a single node
  // instead of being recursed into.
  textRuns?: FigmaTextRun[];
  children: RawDomNode[];
}

const SKIP_TAGS = new Set([
  "script",
  "style",
  "head",
  "meta",
  "link",
  "title",
  "noscript",
  "template",
]);

export function walkDom(element: Element): RawDomNode | null {
  const tagName = element.tagName.toLowerCase();
  if (SKIP_TAGS.has(tagName)) return null;

  const win = element.ownerDocument.defaultView;
  const computed = win ? win.getComputedStyle(element) : null;
  if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
    return null;
  }

  const domRect = element.getBoundingClientRect();
  const rect: RawDomRect = {
    x: domRect.x,
    y: domRect.y,
    width: domRect.width,
    height: domRect.height,
  };
  const style = extractStyle(element);
  const className = typeof element.className === "string" ? element.className : "";

  if (isTextLeaf(element)) {
    const textRuns = extractTextRuns(element);
    if (textRuns.length > 0) {
      return { tagName, className, rect, style, textRuns, children: [] };
    }
  }

  const children: RawDomNode[] = [];
  for (const child of Array.from(element.children)) {
    const walked = walkDom(child);
    if (walked) children.push(walked);
  }

  return { tagName, className, rect, style, children };
}
