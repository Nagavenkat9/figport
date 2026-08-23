// Creates a FrameNode from geometry (Phase 2), applies its own auto-layout
// config (Phase 3), and applies fills/strokes/effects/corner radius/
// opacity/blend mode/clipping (Phase 4).

import { FigmaNodeTree, FigmaFill, FigmaEffect } from "../../shared/types";

// Figma's real primaryAxisSizingMode/counterAxisSizingMode use "AUTO" for
// hug (not "HUG" — that spelling is only used by layoutSizingHorizontal/
// Vertical on children). Translate at the point of use to avoid mixing the
// two vocabularies up in the shared schema.
function toSizingMode(v: "FIXED" | "HUG"): "FIXED" | "AUTO" {
  return v === "HUG" ? "AUTO" : "FIXED";
}

function toPaint(fill: FigmaFill): Paint {
  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops && fill.gradientTransform) {
    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: fill.gradientTransform,
      gradientStops: fill.gradientStops.map((s) => ({ position: s.position, color: s.color })),
    } as GradientPaint;
  }
  // SOLID, and a neutral-gray fallback for fill kinds not implemented yet
  // (IMAGE/GRADIENT_RADIAL land in a later phase).
  return {
    type: "SOLID",
    color: fill.color ?? { r: 0.8, g: 0.8, b: 0.8 },
    opacity: fill.opacity ?? 1,
  } as SolidPaint;
}

function toEffect(effect: FigmaEffect): Effect {
  return {
    type: effect.type,
    visible: effect.visible,
    radius: effect.radius,
    color: effect.color ?? { r: 0, g: 0, b: 0, a: 1 },
    offset: effect.offset ?? { x: 0, y: 0 },
    spread: effect.spread ?? 0,
    blendMode: "NORMAL",
  } as Effect;
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

  if (node.fills) {
    frame.fills = node.fills.map(toPaint);
  }

  if (node.strokes && node.strokes.length > 0) {
    frame.strokes = node.strokes.map((s) => ({
      type: "SOLID",
      color: s.color,
      opacity: s.opacity ?? 1,
    }));
    if (node.strokeWeight !== undefined) frame.strokeWeight = node.strokeWeight;
  }

  if (node.cornerRadius !== undefined) {
    if (typeof node.cornerRadius === "number") {
      frame.cornerRadius = node.cornerRadius;
    } else {
      const [tl, tr, br, bl] = node.cornerRadius;
      frame.topLeftRadius = tl;
      frame.topRightRadius = tr;
      frame.bottomRightRadius = br;
      frame.bottomLeftRadius = bl;
    }
  }

  if (node.effects && node.effects.length > 0) {
    frame.effects = node.effects.map(toEffect);
  }

  if (node.opacity !== undefined) frame.opacity = node.opacity;
  if (node.blendMode) frame.blendMode = node.blendMode as BlendMode;

  // Figma frames clip their contents by default; CSS elements don't unless
  // overflow:hidden is set. Always set this explicitly rather than only
  // when true, or every frame would silently clip.
  frame.clipsContent = node.clipsContent ?? false;

  return frame;
}
