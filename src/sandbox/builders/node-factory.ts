// Routes each FigmaNodeTree node to the right builder and recreates the
// tree's parent/child structure in Figma. FRAME (Phase 2-4) and TEXT
// (Phase 5) are implemented; image/shape land in Phase 6. Async throughout
// because text-builder.ts must await figma.loadFontAsync() before it can
// safely set characters or apply per-range styling.

import { FigmaNodeTree } from "../../shared/types";
import { buildFrameNode } from "./frame-builder";
import { buildTextNode } from "./text-builder";

async function createNode(node: FigmaNodeTree): Promise<SceneNode | null> {
  switch (node.type) {
    case "FRAME":
      return buildFrameNode(node);
    case "TEXT":
      return buildTextNode(node);
    default:
      console.warn(`FigPort: node type "${node.type}" not yet implemented, skipping`);
      return null;
  }
}

// layoutSizingHorizontal/Vertical and layoutPositioning only mean something
// (and are only settable without Figma throwing) once a node actually has
// an auto-layout parent, so this runs after appendChild, not before. Both
// FRAME and TEXT support these properties as auto-layout children.
function applyParentDependentLayout(
  created: SceneNode,
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): void {
  if (!("layoutMode" in parent) || parent.layoutMode === "NONE") return;
  if (created.type !== "FRAME" && created.type !== "TEXT") return;

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
