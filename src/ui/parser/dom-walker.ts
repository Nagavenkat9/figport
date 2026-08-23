// Traverses the rendered DOM inside the hidden iframe and produces a plain-
// object tree of geometry + tag/class + style info, plus extracted text
// runs (Phase 5), image/SVG sources (Phase 6), and list markers /
// ::before/::after pseudo-content (Phase 7) for the elements that carry
// them.

import { extractStyle, StyleInfo } from "./style-extractor";
import { isTextLeaf, extractTextRuns, makeMarkerRun } from "./text-extractor";
import { extractPseudoNodes, extractPseudoRun } from "./pseudo-extractor";
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
  // Present for <img> elements — the browser-resolved absolute src URL (or
  // a data: URI). Also implies empty `children`.
  imageSrc?: string;
  // Present for inline <svg> elements — the element's own serialized
  // markup. Also implies empty `children`.
  svgString?: string;
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

// Real bullets/numbers are rendered by the browser's own ::marker box, not
// part of the DOM — there's no text node to walk for them, so a <li>'s
// marker text has to be synthesized based on which kind of list it's in.
interface ListMarkerContext {
  marker: string;
}

export function walkDom(element: Element, listContext?: ListMarkerContext): RawDomNode | null {
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

  if (tagName === "img") {
    const src = (element as HTMLImageElement).src;
    return { tagName, className, rect, style, imageSrc: src || undefined, children: [] };
  }

  if (tagName === "svg") {
    return { tagName, className, rect, style, svgString: (element as unknown as SVGSVGElement).outerHTML, children: [] };
  }

  if (isTextLeaf(element)) {
    // Order: list marker, then ::before content, then the real text, then
    // ::after content — ::before/::after render inline with an element's
    // text (not as separate boxes), so they're merged into this single
    // node's own run array rather than becoming sibling frames.
    const marker = listContext ? makeMarkerRun(listContext.marker, element) : null;
    const before = extractPseudoRun(element, "::before");
    const after = extractPseudoRun(element, "::after");
    const textRuns = [
      ...(marker ? [marker] : []),
      ...(before ? [before] : []),
      ...extractTextRuns(element),
      ...(after ? [after] : []),
    ];
    if (textRuns.length > 0) {
      return { tagName, className, rect, style, textRuns, children: [] };
    }
  }

  const { before, after } = extractPseudoNodes(element, rect);

  const children: RawDomNode[] = [];
  if (before) children.push(before);

  const isOrderedList = tagName === "ol";
  const isList = tagName === "ul" || tagName === "ol";
  let listIndex = 0;
  for (const child of Array.from(element.children)) {
    let childListContext: ListMarkerContext | undefined;
    if (isList && child.tagName.toLowerCase() === "li") {
      listIndex++;
      childListContext = { marker: isOrderedList ? `${listIndex}. ` : "• " };
    }
    const walked = walkDom(child, childListContext);
    if (walked) children.push(walked);
  }

  if (after) children.push(after);

  return { tagName, className, rect, style, children };
}
