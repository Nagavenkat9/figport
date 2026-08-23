// Phase 2: converts the raw DOM tree into a FigmaNodeTree. Only geometry and
// naming are populated here — layout mode, fills, and text come in later
// phases and will extend this same function.

import { FigmaNodeTree } from "../../shared/types";
import { RawDomNode, RawDomRect } from "../parser/dom-walker";

function nodeName(node: RawDomNode): string {
  const classes = node.className.trim();
  if (!classes) return node.tagName;
  return `${node.tagName}.${classes.split(/\s+/).join(".")}`;
}

export function buildTree(node: RawDomNode, parentRect?: RawDomRect): FigmaNodeTree {
  // Figma frame children use parent-relative coordinates, so every node's
  // x/y is measured against its own parent's rect, not the page origin.
  const originX = parentRect ? parentRect.x : node.rect.x;
  const originY = parentRect ? parentRect.y : node.rect.y;

  return {
    type: "FRAME",
    name: nodeName(node),
    x: node.rect.x - originX,
    y: node.rect.y - originY,
    width: Math.max(1, Math.round(node.rect.width)),
    height: Math.max(1, Math.round(node.rect.height)),
    children: node.children.map((child) => buildTree(child, node.rect)),
  };
}
