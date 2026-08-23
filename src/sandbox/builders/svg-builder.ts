// Builds a node from inline SVG markup (Phase 6). figma.createNodeFromSvg
// can throw on malformed/unsupported SVG (multiple root elements,
// unsupported filters, etc.) — caught here so one bad inline icon doesn't
// abort the whole conversion; falls back to a neutral placeholder rectangle.

import { FigmaNodeTree } from "../../shared/types";

export function buildSvgNode(node: FigmaNodeTree): SceneNode {
  try {
    const svgNode = figma.createNodeFromSvg(node.svgString ?? "");
    svgNode.name = node.name;
    svgNode.x = node.x;
    svgNode.y = node.y;
    if ("resize" in svgNode) {
      (svgNode as FrameNode).resize(node.width, node.height);
    }
    return svgNode;
  } catch (e) {
    console.warn("FigPort: failed to parse inline SVG, using a placeholder", e);
    const rect = figma.createRectangle();
    rect.name = node.name;
    rect.x = node.x;
    rect.y = node.y;
    rect.resize(node.width, node.height);
    rect.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
    return rect;
  }
}
