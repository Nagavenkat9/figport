// Resolves any FigmaFill (solid, gradient, or image) into a real Figma
// Paint. Image fills are the only async case — fetching a remote URL (the
// sandbox is the only side with the plugin's declared network-access
// permission) or using already-decoded bytes for data: URIs. Also builds
// the Rectangle node used for a plain <img> element (Phase 6).

import { FigmaFill, FigmaNodeTree } from "../../shared/types";

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (e) {
    console.warn(`FigPort: failed to fetch image "${url}"`, e);
    return null;
  }
}

const PLACEHOLDER_FILL: SolidPaint = { type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } };

export async function resolvePaint(fill: FigmaFill): Promise<Paint> {
  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops && fill.gradientTransform) {
    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: fill.gradientTransform,
      gradientStops: fill.gradientStops.map((s) => ({ position: s.position, color: s.color })),
    } as GradientPaint;
  }

  if (fill.type === "IMAGE") {
    const bytes = fill.imageBytes ?? (fill.imageUrl ? await fetchImageBytes(fill.imageUrl) : null);
    if (!bytes) return PLACEHOLDER_FILL; // fetch/decode failed — don't crash the whole conversion
    try {
      const image = figma.createImage(bytes);
      return { type: "IMAGE", imageHash: image.hash, scaleMode: fill.scaleMode ?? "FILL" } as ImagePaint;
    } catch (e) {
      console.warn("FigPort: failed to create image from bytes", e);
      return PLACEHOLDER_FILL;
    }
  }

  return {
    type: "SOLID",
    color: fill.color ?? { r: 0.8, g: 0.8, b: 0.8 },
    opacity: fill.opacity ?? 1,
  } as SolidPaint;
}

export async function resolvePaints(fills: FigmaFill[]): Promise<Paint[]> {
  return Promise.all(fills.map(resolvePaint));
}

export async function buildImageNode(node: FigmaNodeTree): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name = node.name;
  rect.resize(node.width, node.height);
  rect.x = node.x;
  rect.y = node.y;

  if (node.fills && node.fills.length > 0) {
    rect.fills = await resolvePaints(node.fills);
  }
  if (node.opacity !== undefined) rect.opacity = node.opacity;

  return rect;
}
