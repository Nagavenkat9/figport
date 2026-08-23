// Phase 3: extracts the CSS properties needed to map an element's layout
// (flex/block config) and sizing intent onto Figma auto-layout.
//
// Most of these resolve unambiguously via getComputedStyle (keyword and
// length properties). width/height are the exception: getComputedStyle
// always returns a resolved pixel value for them, which can't tell "300px"
// apart from "100%" or "auto" — and that distinction is exactly what
// decides FIXED vs FILL vs HUG. To recover it, we walk the stylesheet rules
// that match the element (plus inline style, which wins) and read the
// *specified* width/height text instead. This is a best-effort mini-cascade
// — it doesn't account for selector specificity or !important, just source
// order — which covers the common case of a single <style> block in
// AI-generated HTML, but can be wrong for complex stylesheets.

export interface StyleInfo {
  display: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  rowGap: number;
  columnGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  position: string;
  flexGrow: number;
  specifiedWidth?: string;
  specifiedHeight?: string;

  // Visual (Phase 4) — all resolve unambiguously via getComputedStyle, no
  // specified-vs-computed ambiguity like width/height has.
  backgroundColor: string;
  backgroundImage: string; // "none" or e.g. "linear-gradient(...)"
  borderWidth: number;
  borderColor: string;
  borderStyle: string;
  cornerRadii: [number, number, number, number]; // TL, TR, BR, BL
  boxShadow: string; // "none" or a comma-separated shadow list
  opacity: number;
  mixBlendMode: string;
  overflowHidden: boolean;

  // Text (Phase 5)
  lineHeight: string; // e.g. "24px" or "normal"
  letterSpacing: string; // e.g. "0.5px" or "normal"
  textAlign: string;

  // Images (Phase 6)
  backgroundSize: string; // e.g. "cover", "contain", "auto"
  objectFit: string; // only meaningful on <img>/<video>, harmless elsewhere
}

function getSpecifiedLength(el: Element, prop: "width" | "height"): string | undefined {
  const htmlEl = el as HTMLElement;
  const doc = el.ownerDocument;
  let found: string | undefined;

  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet, unreadable — skip it
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      let matches = false;
      try {
        matches = htmlEl.matches(rule.selectorText);
      } catch {
        continue; // unsupported selector syntax
      }
      if (!matches) continue;
      const value = rule.style.getPropertyValue(prop);
      if (value) found = value; // later matching rules win (source order only)
    }
  }

  const inline = htmlEl.style.getPropertyValue(prop);
  if (inline) found = inline; // inline style always wins

  return found;
}

export function extractStyle(el: Element): StyleInfo {
  const win = el.ownerDocument.defaultView;
  const cs = win!.getComputedStyle(el);

  return {
    display: cs.display,
    flexDirection: cs.flexDirection,
    flexWrap: cs.flexWrap,
    justifyContent: cs.justifyContent,
    alignItems: cs.alignItems,
    rowGap: parseFloat(cs.rowGap) || 0,
    columnGap: parseFloat(cs.columnGap) || 0,
    paddingTop: parseFloat(cs.paddingTop) || 0,
    paddingRight: parseFloat(cs.paddingRight) || 0,
    paddingBottom: parseFloat(cs.paddingBottom) || 0,
    paddingLeft: parseFloat(cs.paddingLeft) || 0,
    position: cs.position,
    flexGrow: parseFloat(cs.flexGrow) || 0,
    specifiedWidth: getSpecifiedLength(el, "width"),
    specifiedHeight: getSpecifiedLength(el, "height"),

    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    // Representative of all four sides — Figma strokes don't support
    // differing per-side widths/colors in a single strokes[] array any more
    // simply than this, so a uniform border is the practical target here.
    borderWidth: parseFloat(cs.borderTopWidth) || 0,
    borderColor: cs.borderTopColor,
    borderStyle: cs.borderTopStyle,
    cornerRadii: [
      parseFloat(cs.borderTopLeftRadius) || 0,
      parseFloat(cs.borderTopRightRadius) || 0,
      parseFloat(cs.borderBottomRightRadius) || 0,
      parseFloat(cs.borderBottomLeftRadius) || 0,
    ],
    boxShadow: cs.boxShadow,
    opacity: parseFloat(cs.opacity),
    mixBlendMode: cs.mixBlendMode,
    overflowHidden: cs.overflowX === "hidden" || cs.overflowY === "hidden",

    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,

    backgroundSize: cs.backgroundSize,
    objectFit: cs.objectFit,
  };
}
