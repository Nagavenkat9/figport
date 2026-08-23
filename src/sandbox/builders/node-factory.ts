// Routes each FigmaNodeTree node to the right builder and recreates the
// tree's parent/child structure in Figma. FRAME (Phase 2-4), TEXT (Phase 5),
// and IMAGE/SVG (Phase 6) are implemented. Async throughout because font
// loading and image fetching both require it.

import { FigmaNodeTree } from "../../shared/types";
import { buildFrameNode } from "./frame-builder";
import { buildTextNode } from "./text-builder";
import { buildImageNode } from "./image-builder";
import { buildSvgNode } from "./svg-builder";

async function createNode(node: FigmaNodeTree): Promise<SceneNode | null> {
  switch (node.type) {
    case "FRAME":
      return buildFrameNode(node);
    case "TEXT":
      return buildTextNode(node);
    case "IMAGE":
      return buildImageNode(node);
    case "SVG":
      return buildSvgNode(node);
    default:
      console.warn(`FigPort: node type "${node.type}" not yet implemented, skipping`);
      return null;
  }
}

// layoutSizingHorizontal/Vertical and layoutPositioning only mean something
// (and are only settable without Figma throwing) once a node actually has
// an auto-layout parent, so this runs after appendChild, not before.
// FRAME/TEXT/RECTANGLE (the three concrete types this codebase creates,
// covering the createRectangle() used for <img>) all support these
// properties as auto-layout children; whatever createNodeFromSvg() returns
// (Phase 6) is left with its fixed create-time position/size instead, since
// its concrete type isn't guaranteed.
function applyParentDependentLayout(
  created: SceneNode,
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): void {
  if (!("layoutMode" in parent) || parent.layoutMode === "NONE") return;
  if (created.type !== "FRAME" && created.type !== "TEXT" && created.type !== "RECTANGLE") return;

  if (node.layoutPositioning === "ABSOLUTE") {
    created.layoutPositioning = "ABSOLUTE";
    return; // FILL sizing doesn't apply to absolutely positioned children
  }
  if (node.layoutSizingHorizontal) {
    created.layoutSizingHorizontal = node.layoutSizingHorizontal;
  }
  if (node.layoutSizingVertical) {
    created.layoutSizingVertical = node.layoutSizingVertical;
  }
}

export async function buildTreeIntoFigma(
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): Promise<SceneNode | null> {
  const created = await createNode(node);
  if (!created) return null;

  parent.appendChild(created);
  applyParentDependentLayout(created, node, parent);

  if (node.children && node.children.length > 0 && created.type === "FRAME") {
    for (const child of node.children) {
      await buildTreeIntoFigma(child, created);
    }
  }

  return created;
}
