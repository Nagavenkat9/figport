// Phase 3: maps a StyleInfo onto Figma auto-layout config, plus per-node
// sizing (FIXED/HUG/FILL) and absolute-positioning intent.

import { FigmaAutoLayout } from "../../shared/types";
import { StyleInfo } from "../parser/style-extractor";

export type SizingValue = "FIXED" | "HUG" | "FILL";

export interface ParentLayoutContext {
  isFlexParent: boolean;
  parentAlignItems: string;
}

export const NO_PARENT_CONTEXT: ParentLayoutContext = {
  isFlexParent: false,
  parentAlignItems: "normal",
};

function mapPrimaryAlign(v: string): FigmaAutoLayout["primaryAxisAlign"] {
  switch (v) {
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    case "space-between":
      return "SPACE_BETWEEN";
    default:
      return "MIN"; // flex-start and anything unrecognized
  }
}

function mapCounterAlign(v: string): FigmaAutoLayout["counterAxisAlign"] {
  // Figma's counterAxisAlignItems has no "STRETCH" value — CSS
  // align-items:stretch is instead expressed per-child via
  // layoutSizingHorizontal/Vertical = "FILL" (see computeSizing below).
  switch (v) {
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    default:
      return "MIN"; // flex-start and stretch (handled on the child instead)
  }
}

export function buildAutoLayout(style: StyleInfo): FigmaAutoLayout | undefined {
  const isFlex = style.display === "flex" || style.display === "inline-flex";
  const isBlock = style.display === "block" || style.display === "list-item";
  if (!isFlex && !isBlock) return undefined;

  const mode: FigmaAutoLayout["mode"] = isFlex
    ? style.flexDirection.startsWith("column")
      ? "VERTICAL"
      : "HORIZONTAL"
    : "VERTICAL"; // block fallback (task 3.5)

  const wrap: FigmaAutoLayout["wrap"] = isFlex && style.flexWrap === "wrap" ? "WRAP" : "NO_WRAP";

  // Main-axis gap: column-gap for a row, row-gap for a column (CSS spec).
  const gap = isFlex ? (mode === "HORIZONTAL" ? style.columnGap : style.rowGap) : style.rowGap;
  // Cross-axis gap, only meaningful once wrapping is enabled.
  const counterAxisSpacing =
    wrap === "WRAP" ? (mode === "HORIZONTAL" ? style.rowGap : style.columnGap) : undefined;

  return {
    mode,
    wrap,
    gap,
    counterAxisSpacing,
    padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
    primaryAxisAlign: isFlex ? mapPrimaryAlign(style.justifyContent) : "MIN",
    counterAxisAlign: isFlex ? mapCounterAlign(style.alignItems) : "MIN",
    // Whether this frame itself hugs/fixes around its own children is a
    // separate heuristic not yet implemented — always FIXED (using the
    // measured bounds) until a future phase adds intrinsic-size detection.
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
  };
}

function sizeFromSpecified(specified: string): SizingValue | undefined {
  const v = specified.trim();
  if (v === "100%") return "FILL";
  if (v === "auto" || v === "fit-content" || v.startsWith("fit-content(")) return "HUG";
  return "FIXED";
}

// CSS's "width/height: auto" default resolves very differently depending on
// context:
//  - normal block flow, horizontal axis: auto means "fill the container"
//  - normal block flow, vertical axis: auto means "hug content"
//  - a flex item's MAIN axis: auto means "hug content" UNLESS flex-grow > 0
//    (blockification does not apply along the main axis inside flex layout)
//  - a flex item's CROSS axis: auto means "stretch" (FILL) when the
//    container's align-items is its default ("normal"/"stretch"), else hug
// This function picks the right default for whichever axis is being sized;
// an explicit CSS value (100%, auto, fit-content, or a fixed unit) always
// wins over all of the above.
function sizeAxis(
  specified: string | undefined,
  isFlexItem: boolean,
  isMainAxis: boolean,
  flexGrow: number,
  stretches: boolean,
  blockFillsByDefault: boolean
): SizingValue {
  if (isFlexItem && isMainAxis && flexGrow > 0) return "FILL"; // grow overrides any basis

  if (specified) {
    const resolved = sizeFromSpecified(specified);
    if (resolved) return resolved;
  }

  if (isFlexItem) {
    return isMainAxis ? "HUG" : stretches ? "FILL" : "HUG";
  }
  return blockFillsByDefault ? "FILL" : "HUG";
}

export function computeSizing(
  style: StyleInfo,
  parentMode: "HORIZONTAL" | "VERTICAL" | undefined,
  parentCtx: ParentLayoutContext
): { horizontal: SizingValue; vertical: SizingValue } {
  const isFlexItem = parentCtx.isFlexParent && !!parentMode;
  // align-items' initial computed value is "normal", which behaves as
  // "stretch" for flex containers.
  const stretches = parentCtx.parentAlignItems === "stretch" || parentCtx.parentAlignItems === "normal";
  const horizontalIsMain = parentMode === "HORIZONTAL";

  const horizontal = sizeAxis(
    style.specifiedWidth,
    isFlexItem,
    horizontalIsMain,
    style.flexGrow,
    stretches,
    style.display === "block" || style.display === "list-item" || style.display === "flex"
  );
  const vertical = sizeAxis(
    style.specifiedHeight,
    isFlexItem,
    !horizontalIsMain,
    style.flexGrow,
    stretches,
    false // unspecified height never fills by default in block flow
  );

  return { horizontal, vertical };
}
