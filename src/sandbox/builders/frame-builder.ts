// Phase 2: creates a bare FrameNode from geometry only. Auto-layout, fills,
// strokes, and effects are added by later phases as FigmaNodeTree gains
// those fields.

import { FigmaNodeTree } from "../../shared/types";

export function buildFrameNode(node: FigmaNodeTree): FrameNode {
  const frame = figma.createFrame();
  frame.name = node.name;
  frame.resize(node.width, node.height);
  frame.x = node.x;
  frame.y = node.y;
  return frame;
}
