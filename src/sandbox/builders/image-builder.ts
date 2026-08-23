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

// A hero image reused as a background elsewhere on the same page (or the
// same icon repeated many times) shouldn't be fetched/decoded and handed to
// figma.createImage() more than once — that call stores a full copy of the
// image internally each time. Cache by URL (cheap, exact) or by a fast
// fingerprint of the bytes for data: URIs, and reuse the resulting image
// hash across every fill that resolves to the same source (task 8.3).
const imageHashCache = new Map<string, string>();

function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return `${bytes.length}:${(hash >>> 0).toString(16)}`;
}

function cacheKeyFor(fill: FigmaFill): string | null {
  if (fill.imageUrl) return `url:${fill.imageUrl}`;
  if (fill.imageBytes) return `bytes:${fnv1a(fill.imageBytes)}`;
  return null;
}

export async function resolvePaint(fill: FigmaFill): Promise<Paint> {
  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops && fill.gradientTransform) {
    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: fill.gradientTransform,
      gradientStops: fill.gradientStops.map((s) => ({ position: s.position, color: s.color })),
    } as GradientPaint;
  }

  if (fill.type === "IMAGE") {
    const cacheKey = cacheKeyFor(fill);
    let imageHash = cacheKey ? imageHashCache.get(cacheKey) : undefined;

    if (!imageHash) {
      const bytes = fill.imageBytes ?? (fill.imageUrl ? await fetchImageBytes(fill.imageUrl) : null);
      if (!bytes) return PLACEHOLDER_FILL; // fetch/decode failed — don't crash the whole conversion
      try {
        imageHash = figma.createImage(bytes).hash;
        if (cacheKey) imageHashCache.set(cacheKey, imageHash);
      } catch (e) {
        console.warn("FigPort: failed to create image from bytes", e);
        return PLACEHOLDER_FILL;
      }
    }

    return { type: "IMAGE", imageHash, scaleMode: fill.scaleMode ?? "FILL" } as ImagePaint;
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
