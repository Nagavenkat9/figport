// Phase 2: routes each FigmaNodeTree node to the right builder and recreates
// the tree's parent/child structure in Figma. Only "FRAME" is implemented so
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

export function buildTreeIntoFigma(
  node: FigmaNodeTree,
  parent: FrameNode | PageNode
): SceneNode | null {
  const created = createNode(node);
  if (!created) return null;

  parent.appendChild(created);

  if (node.children && node.children.length > 0 && created.type === "FRAME") {
    for (const child of node.children) {
      buildTreeIntoFigma(child, created);
    }
  }

  return created;
}
