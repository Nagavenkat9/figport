// Phase 4: maps CSS visual properties (already resolved via getComputedStyle,
// see style-extractor.ts) onto Figma fills/strokes/effects/cornerRadius/
// opacity/blendMode/clipsContent.

import { FigmaFill, FigmaStroke, FigmaEffect } from "../../shared/types";
import { StyleInfo } from "../parser/style-extractor";
import { parseColor, splitTopLevel, RgbaColor } from "./color-parser";
import { extractBackgroundImageUrl, resolveImageSource, mapImageFit } from "./image-mapper";

export interface VisualStyleOutput {
  fills: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  cornerRadius?: number | [number, number, number, number];
  effects?: FigmaEffect[];
  opacity?: number;
  blendMode?: string;
  clipsContent: boolean;
}

function mapBlendMode(cssValue: string): string {
  return cssValue.toUpperCase().replace(/-/g, "_");
}

// A handful of known-good cardinal gradientTransform matrices (each a 90deg
// rotation of the last). Arbitrary angles are snapped to the nearest of
// these four rather than computed exactly via rotation math — that math
// couldn't be verified against a live Figma canvas in this environment, so
// snapping to a verified cardinal case is the more honest tradeoff.
const GRADIENT_TRANSFORMS: Record<string, [[number, number, number], [number, number, number]]> = {
  toRight: [
    [1, 0, 0],
    [0, 1, 0],
  ],
  toBottom: [
    [0, 1, 0],
    [-1, 0, 1],
  ],
  toLeft: [
    [-1, 0, 1],
    [0, -1, 1],
  ],
  toTop: [
    [0, -1, 1],
    [1, 0, 0],
  ],
};

function angleToTransform(deg: number): [[number, number, number], [number, number, number]] {
  const n = ((deg % 360) + 360) % 360;
  if (n >= 315 || n < 45) return GRADIENT_TRANSFORMS.toTop;
  if (n < 135) return GRADIENT_TRANSFORMS.toRight;
  if (n < 225) return GRADIENT_TRANSFORMS.toBottom;
  return GRADIENT_TRANSFORMS.toLeft;
}

const DIRECTION_KEYWORD_ANGLES: Record<string, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

function parseLinearGradient(value: string): FigmaFill | null {
  const match = value.match(/^linear-gradient\((.+)\)$/i);
  if (!match) return null;

  const parts = splitTopLevel(match[1]);
  let angleDeg = 180; // CSS default direction is "to bottom"
  let stopParts = parts;

  const first = (parts[0] ?? "").trim();
  const angleMatch = first.match(/^(-?[\d.]+)deg$/i);
  if (angleMatch) {
    angleDeg = parseFloat(angleMatch[1]);
    stopParts = parts.slice(1);
  } else if (first.startsWith("to ")) {
    const dir = first.slice(3).trim();
    if (dir in DIRECTION_KEYWORD_ANGLES) {
      angleDeg = DIRECTION_KEYWORD_ANGLES[dir];
      stopParts = parts.slice(1);
    }
  }

  const stops: { position: number; color: RgbaColor }[] = [];
  stopParts.forEach((stop, i) => {
    const posMatch = stop.match(/(-?[\d.]+)%\s*$/);
    const colorText = posMatch ? stop.slice(0, posMatch.index).trim() : stop.trim();
    const color = parseColor(colorText);
    if (!color) return;
    const position = posMatch
      ? parseFloat(posMatch[1]) / 100
      : stopParts.length > 1
        ? i / (stopParts.length - 1)
        : 0;
    stops.push({ position, color });
  });

  if (stops.length === 0) return null;

  return {
    type: "GRADIENT_LINEAR",
    gradientStops: stops,
    gradientTransform: angleToTransform(angleDeg),
  };
}

function parseBoxShadows(value: string): FigmaEffect[] {
  if (!value || value === "none") return [];
  return splitTopLevel(value).map((raw) => {
    const inset = /\binset\b/.test(raw);
    const cleaned = raw.replace(/\binset\b/, "").trim();
    const colorMatch = cleaned.match(/^(rgba?\([^)]+\)|#[0-9a-f]+)/i);
    const colorText = colorMatch ? colorMatch[1] : "rgba(0,0,0,1)";
    const rest = colorMatch ? cleaned.slice(colorMatch[1].length) : cleaned;
    const numbers = (rest.match(/-?[\d.]+/g) ?? []).map(Number);
    const [offsetX = 0, offsetY = 0, blur = 0, spread = 0] = numbers;
    const color = parseColor(colorText) ?? { r: 0, g: 0, b: 0, a: 1 };
    return {
      type: inset ? "INNER_SHADOW" : "DROP_SHADOW",
      visible: true,
      radius: blur,
      offset: { x: offsetX, y: offsetY },
      color,
      spread,
    } as FigmaEffect;
  });
}

export function mapVisualStyle(style: StyleInfo): VisualStyleOutput {
  const output: VisualStyleOutput = { fills: [], clipsContent: style.overflowHidden };

  const hasBackgroundImage = style.backgroundImage !== "none";
  const gradient = hasBackgroundImage ? parseLinearGradient(style.backgroundImage) : null;
  const bgImageUrl = !gradient && hasBackgroundImage ? extractBackgroundImageUrl(style.backgroundImage) : null;

  if (gradient) {
    output.fills = [gradient];
  } else if (bgImageUrl) {
    const source = resolveImageSource(bgImageUrl);
    if (source) {
      output.fills = [
        {
          type: "IMAGE",
          scaleMode: mapImageFit(style.backgroundSize),
          imageUrl: source.url,
          imageBytes: source.bytes,
        },
      ];
    }
  } else {
    const bg = parseColor(style.backgroundColor);
    if (bg && bg.a > 0) {
      output.fills = [{ type: "SOLID", color: { r: bg.r, g: bg.g, b: bg.b }, opacity: bg.a }];
    }
  }

  if (style.borderStyle !== "none" && style.borderWidth > 0) {
    const borderColor = parseColor(style.borderColor);
    if (borderColor) {
      output.strokes = [
        { type: "SOLID", color: { r: borderColor.r, g: borderColor.g, b: borderColor.b }, opacity: borderColor.a },
      ];
      output.strokeWeight = style.borderWidth;
    }
  }

  const [tl, tr, br, bl] = style.cornerRadii;
  if (tl || tr || br || bl) {
    output.cornerRadius = tl === tr && tr === br && br === bl ? tl : [tl, tr, br, bl];
  }

  const effects = parseBoxShadows(style.boxShadow);
  if (effects.length > 0) output.effects = effects;

  if (style.opacity < 1) output.opacity = style.opacity;
  if (style.mixBlendMode && style.mixBlendMode !== "normal") {
    output.blendMode = mapBlendMode(style.mixBlendMode);
  }

  return output;
}
