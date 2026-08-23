// Creates a FrameNode from geometry (Phase 2) and applies its own
// auto-layout config if the node has one (Phase 3). Fills, strokes, and
// effects are added by later phases as FigmaNodeTree gains those fields.

import { FigmaNodeTree } from "../../shared/types";

// Figma's real primaryAxisSizingMode/counterAxisSizingMode use "AUTO" for
// hug (not "HUG" — that spelling is only used by layoutSizingHorizontal/
// Vertical on children). Translate at the point of use to avoid mixing the
// two vocabularies up in the shared schema.
function toSizingMode(v: "FIXED" | "HUG"): "FIXED" | "AUTO" {
  return v === "HUG" ? "AUTO" : "FIXED";
}

export function buildFrameNode(node: FigmaNodeTree): FrameNode {
  const frame = figma.createFrame();
  frame.name = node.name;
  frame.resize(node.width, node.height);
  frame.x = node.x;
  frame.y = node.y;

  if (node.autoLayout) {
    const layout = node.autoLayout;
    frame.layoutMode = layout.mode;
    frame.layoutWrap = layout.wrap ?? "NO_WRAP";
    frame.itemSpacing = layout.gap;
    if (layout.counterAxisSpacing !== undefined) {
      frame.counterAxisSpacing = layout.counterAxisSpacing;
    }
    frame.paddingTop = layout.padding[0];
    frame.paddingRight = layout.padding[1];
    frame.paddingBottom = layout.padding[2];
    frame.paddingLeft = layout.padding[3];
    frame.primaryAxisAlignItems = layout.primaryAxisAlign;
    frame.counterAxisAlignItems = layout.counterAxisAlign;
    frame.primaryAxisSizingMode = toSizingMode(layout.primaryAxisSizing);
    frame.counterAxisSizingMode = toSizingMode(layout.counterAxisSizing);
  }

  return frame;
}
