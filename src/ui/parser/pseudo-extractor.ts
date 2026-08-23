// Phase 7 (task 7.5): best-effort extraction of ::before/::after content.
// Pseudo-elements have no DOM node and no getBoundingClientRect() of their
// own — there's no standard API to measure their real layout box — so this
// deliberately does not try to guess exact geometry. Instead it produces a
// small placeholder-sized text node and lets it hug its own content (same
// mechanism Phase 5 already relies on for ordinary text), which self-
// corrects once Figma actually renders the characters. Only the common
// "content: '...'" literal-string case is handled; counters/attr()/url()
// are out of scope, matching the blueprint's own "best-effort, warn" bar
// for this feature.

import { FigmaTextRun } from "../../shared/types";
import { parseColor } from "../transformer/color-parser";
import { StyleInfo } from "./style-extractor";
import type { RawDomNode, RawDomRect } from "./dom-walker";

function extractLiteralContent(computedContent: string): string | null {
  const trimmed = computedContent.trim();
  if (trimmed === "none" || trimmed === "" || trimmed === '""' || trimmed === "''") return null;
  const match = trimmed.match(/^["'](.*)["']$/);
  return match ? match[1] : null; // counter()/attr()/url() not supported
}

// A deliberately minimal StyleInfo for a pseudo-element: pseudo-element
// selectors (".foo::before") can't be matched against the real element via
// Element.matches() the way style-extractor.ts's specified-width lookup
// does, so layout stays simple (hug-sized, no flex/grid) rather than
// guessing. Visual properties (background/opacity/radius) that resolve
// unambiguously via getComputedStyle are still read for real.
function makePseudoStyleInfo(cs: CSSStyleDeclaration): StyleInfo {
  return {
    display: "inline-block",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
    alignItems: "normal",
    rowGap: 0,
    columnGap: 0,
    paddingTop: parseFloat(cs.paddingTop) || 0,
    paddingRight: parseFloat(cs.paddingRight) || 0,
    paddingBottom: parseFloat(cs.paddingBottom) || 0,
    paddingLeft: parseFloat(cs.paddingLeft) || 0,
    position: "static",
    flexGrow: 0,
    specifiedWidth: undefined,
    specifiedHeight: undefined,
    backgroundColor: cs.backgroundColor,
    backgroundImage: "none", // keep pseudo backgrounds to solid color — best-effort scope
    borderWidth: 0,
    borderColor: "rgb(0,0,0)",
    borderStyle: "none",
    cornerRadii: [
      parseFloat(cs.borderTopLeftRadius) || 0,
      parseFloat(cs.borderTopRightRadius) || 0,
      parseFloat(cs.borderBottomRightRadius) || 0,
      parseFloat(cs.borderBottomLeftRadius) || 0,
    ],
    boxShadow: "none",
    opacity: parseFloat(cs.opacity) || 1,
    mixBlendMode: "normal",
    overflowHidden: false,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    backgroundSize: "auto",
    objectFit: "fill",
  };
}

// The lower-level extraction, usable in two different shapes depending on
// where the host element ends up in dom-walker.ts:
//  - a text-leaf (e.g. <p class="quote">) merges this run directly into its
//    own single text node's run array, since CSS renders ::before/::after
//    content inline with the element's text, not as a separate box
//  - a structural container (e.g. a <div> with block children AND a
//    ::before) has no single text node to merge into, so it becomes its own
//    sibling FRAME+TEXT node instead — see buildPseudoNode below
export function extractPseudoRun(element: Element, pseudo: "::before" | "::after"): FigmaTextRun | null {
  const win = element.ownerDocument.defaultView;
  if (!win) return null;
  const cs = win.getComputedStyle(element, pseudo);
  const text = extractLiteralContent(cs.content);
  if (!text) return null;

  return {
    characters: text,
    color: parseColor(cs.color) ?? { r: 0, g: 0, b: 0, a: 1 },
    fontFamily: cs.fontFamily,
    fontWeight: parseFloat(cs.fontWeight) || 400,
    italic: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
    fontSize: parseFloat(cs.fontSize) || 16,
    underline: cs.textDecorationLine.includes("underline"),
    strikethrough: cs.textDecorationLine.includes("line-through"),
  };
}

function buildPseudoNode(element: Element, pseudo: "::before" | "::after", hostRect: RawDomRect): RawDomNode | null {
  const run = extractPseudoRun(element, pseudo);
  if (!run) return null;

  const win = element.ownerDocument.defaultView!;
  const cs = win.getComputedStyle(element, pseudo);

  // Placeholder box only — the TEXT child's own HUG sizing (set in
  // tree-builder.ts for every text leaf) replaces this with the real
  // rendered size once Figma actually lays out the characters. Position is
  // set to the host element's own absolute rect (not 0,0!) because
  // tree-builder.ts computes every node's x/y relative to its parent's
  // *absolute* rect — using an arbitrary absolute position here would
  // produce a huge bogus offset once that subtraction runs.
  const rect: RawDomRect = {
    x: hostRect.x,
    y: hostRect.y,
    width: Math.max(4, run.characters.length * run.fontSize * 0.6),
    height: run.fontSize * 1.2,
  };

  return {
    tagName: pseudo,
    className: "",
    rect,
    style: makePseudoStyleInfo(cs),
    textRuns: [run],
    children: [],
  };
}

export function extractPseudoNodes(
  element: Element,
  hostRect: RawDomRect
): { before: RawDomNode | null; after: RawDomNode | null } {
  return {
    before: buildPseudoNode(element, "::before", hostRect),
    after: buildPseudoNode(element, "::after", hostRect),
  };
}
