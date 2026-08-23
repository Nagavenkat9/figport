// Traverses the rendered DOM inside the hidden iframe and produces a plain-
// object tree of geometry + tag/class + style info. Text extraction is a
// separate concern added in a later phase.

import { extractStyle, StyleInfo } from "./style-extractor";

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

  const children: RawDomNode[] = [];
  for (const child of Array.from(element.children)) {
    const walked = walkDom(child);
    if (walked) children.push(walked);
  }

  return {
    tagName,
    className: typeof element.className === "string" ? element.className : "",
    rect: {
      x: domRect.x,
      y: domRect.y,
      width: domRect.width,
      height: domRect.height,
    },
    style: extractStyle(element),
    children,
  };
}
