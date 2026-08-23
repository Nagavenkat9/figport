// Converts the raw DOM tree into a FigmaNodeTree: geometry (Phase 2) plus
// auto-layout, sizing, and absolute-positioning intent (Phase 3). Fills,
// strokes, and text come in later phases and will extend this same function.

import { FigmaNodeTree, SizingValue } from "../../shared/types";
import { RawDomNode, RawDomRect } from "../parser/dom-walker";
import {
  buildAutoLayout,
  computeSizing,
  ParentLayoutContext,
  NO_PARENT_CONTEXT,
} from "./layout-mapper";

function nodeName(node: RawDomNode): string {
  const classes = node.className.trim();
  if (!classes) return node.tagName;
  return `${node.tagName}.${classes.split(/\s+/).join(".")}`;
}

function clampHug(value: SizingValue, hasOwnAutoLayout: boolean): SizingValue {
  // Figma only allows "hug" on a node that has its own auto-layout content
  // to hug (a frame with layoutMode set, or a text node). Anything else
  // falls back to its measured fixed size to avoid a runtime error.
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

  const autoLayout = buildAutoLayout(node.style);
  const sizing = computeSizing(node.style, parentMode, parentLayout);

  const childParentLayout: ParentLayoutContext = {
    isFlexParent: node.style.display === "flex" || node.style.display === "inline-flex",
    parentAlignItems: node.style.alignItems,
  };

  return {
    type: "FRAME",
    name: nodeName(node),
    x: node.rect.x - originX,
    y: node.rect.y - originY,
    width: Math.max(1, Math.round(node.rect.width)),
    height: Math.max(1, Math.round(node.rect.height)),
    autoLayout,
    layoutSizingHorizontal: clampHug(sizing.horizontal, !!autoLayout),
    layoutSizingVertical: clampHug(sizing.vertical, !!autoLayout),
    layoutPositioning: node.style.position === "absolute" ? "ABSOLUTE" : undefined,
    children: node.children.map((child) =>
      buildTree(child, node.rect, childParentLayout, autoLayout?.mode as "HORIZONTAL" | "VERTICAL" | undefined)
    ),
  };
}
