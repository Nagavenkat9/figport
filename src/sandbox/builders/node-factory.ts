// Routes each FigmaNodeTree node to the right builder and recreates the
// tree's parent/child structure in Figma. Only "FRAME" is implemented so
// far; other node types are added as their builders land (text-builder in
// Phase 5, image-builder/shape-builder in Phase 6).

import { FigmaNodeTree } from "../../shared/types";
import { buildFrameNode } from "./frame-builder";

function createNode(node: FigmaNodeTree): SceneNode | null {
  switch (node.type) {
    case "FRAME":
      return buildFrameNode(node);
    default:
      console.warn(`FigPort: node type "${node.type}" not yet implemented, skipping`);
      return null;
  }
}

// layoutSizingHorizontal/Vertical and layoutPositioning only mean something
// (and are only settable without Figma throwing) once a node actually has
// an auto-layout parent, so this runs after appendChild, not before.
function applyParentDependentLayout(
  created: SceneNode,
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): void {
  if (!("layoutMode" in parent) || parent.layoutMode === "NONE") return;
  if (created.type !== "FRAME") return; // only frames support this so far

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

export function buildTreeIntoFigma(
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): SceneNode | null {
  const created = createNode(node);
  if (!created) return null;

  parent.appendChild(created);
  applyParentDependentLayout(created, node, parent);

  if (node.children && node.children.length > 0 && created.type === "FRAME") {
    for (const child of node.children) {
      buildTreeIntoFigma(child, created);
    }
  }

  return created;
}
