// Phase 5: maps CSS text properties (already resolved via getComputedStyle)
// onto Figma's TextNode property shapes.

import { FigmaNodeTree } from "../../shared/types";

export function mapTextAlign(v: string): NonNullable<FigmaNodeTree["textAlignHorizontal"]> {
  switch (v) {
    case "center":
      return "CENTER";
    case "right":
    case "end":
      return "RIGHT";
    case "justify":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
}

export function mapLineHeight(v: string): NonNullable<FigmaNodeTree["lineHeight"]> {
  if (v === "normal") return { unit: "AUTO" };
  const px = parseFloat(v);
  return Number.isFinite(px) ? { value: px, unit: "PIXELS" } : { unit: "AUTO" };
}

export function mapLetterSpacing(v: string): NonNullable<FigmaNodeTree["letterSpacing"]> {
  if (v === "normal") return { value: 0, unit: "PIXELS" };
  const px = parseFloat(v);
  return { value: Number.isFinite(px) ? px : 0, unit: "PIXELS" };
}
