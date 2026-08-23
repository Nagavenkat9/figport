// Converts the raw DOM tree into a FigmaNodeTree: geometry (Phase 2), auto-
// layout/sizing/absolute-positioning (Phase 3), fills/strokes/effects/
// corner radius/opacity/blend mode (Phase 4), text (Phase 5), and images/SVG
// (Phase 6).

import { FigmaNodeTree, SizingValue } from "../../shared/types";
import { RawDomNode, RawDomRect } from "../parser/dom-walker";
import {
  buildAutoLayout,
  computeSizing,
  ParentLayoutContext,
  NO_PARENT_CONTEXT,
} from "./layout-mapper";
import { mapVisualStyle } from "./style-mapper";
import { mapTextAlign, mapLineHeight, mapLetterSpacing } from "./text-mapper";
import { resolveImageSource, mapImageFit } from "./image-mapper";

function nodeName(node: RawDomNode): string {
  const classes = node.className.trim();
  if (!classes) return node.tagName;
  return `${node.tagName}.${classes.split(/\s+/).join(".")}`;
}

function clampHug(value: SizingValue, hasOwnAutoLayout: boolean): SizingValue {
  // Figma only allows "hug" on a FRAME that has its own auto-layout content
  // to hug. Anything else falls back to its measured fixed size to avoid a
  // runtime error. (TEXT nodes hug natively regardless — see the text-child
  // construction below, which never calls this.)
  return value === "HUG" && !hasOwnAutoLayout ? "FIXED" : value;
}

export function buildTree(
  node: RawDomNode,
  parentRect?: RawDomRect,
  parentLayout: ParentLayoutContext = NO_PARENT_CONTEXT,
  parentMode?: "HORIZONTAL" | "VERTICAL"
): FigmaNodeTree {
  // Figma frame children use parent-relative coordinates, so every node's
  // x/y is measured against its own parent's rect, not the page origin.
  const originX = parentRect ? parentRect.x : node.rect.x;
  const originY = parentRect ? parentRect.y : node.rect.y;
  const x = node.rect.x - originX;
  const y = node.rect.y - originY;
  const width = Math.max(1, Math.round(node.rect.width));
  const height = Math.max(1, Math.round(node.rect.height));

  const autoLayout = buildAutoLayout(node.style);
  const sizing = computeSizing(node.style, parentMode, parentLayout);
  const visual = mapVisualStyle(node.style);
  const layoutPositioning = node.style.position === "absolute" ? ("ABSOLUTE" as const) : undefined;
  const opacity = node.style.opacity < 1 ? node.style.opacity : undefined;

  if (node.imageSrc) {
    const source = resolveImageSource(node.imageSrc);
    return {
      type: "IMAGE",
      name: nodeName(node),
      x,
      y,
      width,
      height,
      fills: source
        ? [
            {
              type: "IMAGE",
              scaleMode: mapImageFit(node.style.objectFit),
              imageUrl: source.url,
              imageBytes: source.bytes,
            },
          ]
        : [],
      // A Rectangle can't hug content (nothing to hug) — same clamp reason
      // as a FRAME without its own auto-layout.
      layoutSizingHorizontal: clampHug(sizing.horizontal, false),
      layoutSizingVertical: clampHug(sizing.vertical, false),
      layoutPositioning,
      opacity,
      children: [],
    };
  }

  if (node.svgString) {
    return {
      type: "SVG",
      name: nodeName(node),
      x,
      y,
      width,
      height,
      svgString: node.svgString,
      layoutSizingHorizontal: clampHug(sizing.horizontal, false),
      layoutSizingVertical: clampHug(sizing.vertical, false),
      layoutPositioning,
      opacity,
      children: [],
    };
  }

  // A text-bearing leaf still gets its normal FRAME wrapper — same
  // auto-layout/background/border/padding/shadow handling as any other
  // element — but instead of recursing into DOM children, it gets exactly
  // one synthesized TEXT child carrying the extracted runs. This is what
  // lets something like `<p style="background:yellow; padding:10px">`
  // keep its background/padding (which a bare TEXT node has no concept of)
  // while still rendering real, editable text.
  if (node.textRuns && node.textRuns.length > 0) {
    const base = node.textRuns[0];
    const textChild: FigmaNodeTree = {
      type: "TEXT",
      name: "text",
      x: 0,
      y: 0,
      width,
      height,
      characters: node.textRuns.map((r) => r.characters).join(""),
      fontSize: base.fontSize,
      textAlignHorizontal: mapTextAlign(node.style.textAlign),
      lineHeight: mapLineHeight(node.style.lineHeight),
      letterSpacing: mapLetterSpacing(node.style.letterSpacing),
      textDecoration: base.underline ? "UNDERLINE" : base.strikethrough ? "STRIKETHROUGH" : "NONE",
      textRuns: node.textRuns,
      // Fill the wrapper's available width, hug its own content height —
      // the natural default for a text block. Only takes effect when the
      // wrapper frame actually has auto-layout (see node-factory.ts's
      // guard); otherwise it's silently ignored and this fixed width/height
      // is used instead.
      layoutSizingHorizontal: "FILL",
      layoutSizingVertical: "HUG",
      children: [],
    };

    return {
      type: "FRAME",
      name: nodeName(node),
      x,
      y,
      width,
      height,
      autoLayout,
      layoutSizingHorizontal: clampHug(sizing.horizontal, !!autoLayout),
      layoutSizingVertical: clampHug(sizing.vertical, !!autoLayout),
      layoutPositioning,
      ...visual,
      children: [textChild],
    };
  }

  const childParentLayout: ParentLayoutContext = {
    isFlexParent: node.style.display === "flex" || node.style.display === "inline-flex",
    parentAlignItems: node.style.alignItems,
  };

  return {
    type: "FRAME",
    name: nodeName(node),
    x,
    y,
    width,
    height,
    autoLayout,
    layoutSizingHorizontal: clampHug(sizing.horizontal, !!autoLayout),
    layoutSizingVertical: clampHug(sizing.vertical, !!autoLayout),
    layoutPositioning,
    ...visual,
    children: node.children.map((child) =>
      buildTree(child, node.rect, childParentLayout, autoLayout?.mode as "HORIZONTAL" | "VERTICAL" | undefined)
    ),
  };
}
