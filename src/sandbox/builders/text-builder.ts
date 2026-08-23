// Creates a TextNode from extracted runs (Phase 5): resolves each run's
// requested font against what's actually installed in this Figma instance
// (figma.listAvailableFontsAsync() only exists sandbox-side, which is why
// this resolution can't happen in the UI where the CSS was read), loads
// fonts before use (a hard Figma API requirement), and applies per-range
// font/size/color/decoration for mixed-style text.

import { FigmaNodeTree, FigmaTextRun } from "../../shared/types";

const WEIGHT_TO_STYLE: [number, string][] = [
  [100, "Thin"],
  [200, "Extra Light"],
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "Semi Bold"],
  [700, "Bold"],
  [800, "Extra Bold"],
  [900, "Black"],
];

function weightToStyleName(weight: number, italic: boolean): string {
  let closest = WEIGHT_TO_STYLE[0];
  let bestDiff = Infinity;
  for (const entry of WEIGHT_TO_STYLE) {
    const diff = Math.abs(entry[0] - weight);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = entry;
    }
  }
  return italic ? `${closest[1]} Italic` : closest[1];
}

const FALLBACK_FONT: FontName = { family: "Inter", style: "Regular" };

// figma.listAvailableFontsAsync() is a relatively expensive call and every
// text node/run needs it — fetch it once per conversion and reuse.
let availableFontsPromise: Promise<Font[]> | null = null;
function getAvailableFonts(): Promise<Font[]> {
  if (!availableFontsPromise) {
    availableFontsPromise = figma.listAvailableFontsAsync();
  }
  return availableFontsPromise;
}

function firstFamily(cssFontFamily: string): string {
  const first = cssFontFamily.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

async function resolveFont(cssFontFamily: string, weight: number, italic: boolean): Promise<FontName> {
  const requestedFamily = firstFamily(cssFontFamily);
  const requestedStyle = weightToStyleName(weight, italic);
  const available = await getAvailableFonts();

  const familyMatches = available.filter(
    (f) => f.fontName.family.toLowerCase() === requestedFamily.toLowerCase()
  );
  if (familyMatches.length === 0) return FALLBACK_FONT;

  const exactStyle = familyMatches.find((f) => f.fontName.style.toLowerCase() === requestedStyle.toLowerCase());
  if (exactStyle) return exactStyle.fontName;

  // Family exists but not in the requested weight/style — fall back to
  // Regular within that same family, else whatever style it does have.
  const regular = familyMatches.find((f) => f.fontName.style === "Regular");
  return (regular ?? familyMatches[0]).fontName;
}

// Real pages commonly reuse the same 2-3 font/style combinations across
// dozens of text nodes. figma.loadFontAsync() for a font already loaded is
// cheap but not free — skip the repeat call entirely (Phase 8, task 8.2:
// minimize redundant work across a page's worth of node creation).
const loadedFontKeys = new Set<string>();
function fontKey(f: FontName): string {
  return `${f.family}::${f.style}`;
}

async function loadFontSafe(fontName: FontName): Promise<FontName> {
  const key = fontKey(fontName);
  if (loadedFontKeys.has(key)) return fontName;

  try {
    await figma.loadFontAsync(fontName);
    loadedFontKeys.add(key);
    return fontName;
  } catch {
    const fallbackKey = fontKey(FALLBACK_FONT);
    if (!loadedFontKeys.has(fallbackKey)) {
      await figma.loadFontAsync(FALLBACK_FONT);
      loadedFontKeys.add(fallbackKey);
    }
    return FALLBACK_FONT;
  }
}

function defaultRun(node: FigmaNodeTree): FigmaTextRun {
  return {
    characters: node.characters ?? "",
    color: { r: 0, g: 0, b: 0, a: 1 },
    fontFamily: node.fontName?.family ?? "Inter",
    fontWeight: 400,
    italic: false,
    fontSize: node.fontSize ?? 16,
    underline: false,
    strikethrough: false,
  };
}

export async function buildTextNode(node: FigmaNodeTree): Promise<TextNode> {
  const text = figma.createText();
  text.name = node.name;
  // Must be NONE before resize(); Figma throws on manual resize while
  // textAutoResize hugs both dimensions (the createText() default).
  text.textAutoResize = "NONE";

  const runs: FigmaTextRun[] = node.textRuns && node.textRuns.length > 0 ? node.textRuns : [defaultRun(node)];
  const fullText = runs.map((r) => r.characters).join("");

  // A font must be loaded before `characters` can be set at all, even
  // before any per-range styling is applied.
  const baseFont = await loadFontSafe(await resolveFont(runs[0].fontFamily, runs[0].fontWeight, runs[0].italic));
  text.fontName = baseFont;
  text.characters = fullText;

  if (node.textAlignHorizontal) text.textAlignHorizontal = node.textAlignHorizontal;
  if (node.lineHeight) {
    text.lineHeight =
      node.lineHeight.unit === "AUTO"
        ? { unit: "AUTO" }
        : { value: node.lineHeight.value ?? 0, unit: node.lineHeight.unit };
  }
  if (node.letterSpacing) text.letterSpacing = node.letterSpacing;

  // Per-run overrides across each run's character range — this is what
  // renders a bolded word inside a paragraph, or a differently-colored link,
  // correctly instead of forcing the whole block to one style.
  let offset = 0;
  for (const run of runs) {
    const start = offset;
    const end = offset + run.characters.length;
    offset = end;
    if (start === end) continue;

    const runFont = await loadFontSafe(await resolveFont(run.fontFamily, run.fontWeight, run.italic));
    text.setRangeFontName(start, end, runFont);
    text.setRangeFontSize(start, end, run.fontSize);
    text.setRangeFills(start, end, [
      { type: "SOLID", color: { r: run.color.r, g: run.color.g, b: run.color.b }, opacity: run.color.a },
    ]);
    text.setRangeTextDecoration(
      start,
      end,
      run.underline ? "UNDERLINE" : run.strikethrough ? "STRIKETHROUGH" : "NONE"
    );
  }

  text.resize(node.width, node.height);
  text.x = node.x;
  text.y = node.y;

  if (node.opacity !== undefined) text.opacity = node.opacity;

  return text;
}
