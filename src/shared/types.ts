// FigmaNodeTree schema — see blueprint section 6.
// Phase 2 populates type/name/geometry/children only. Visual, text, and
// media fields are declared now (so the contract is stable) but stay
// unused until Phases 3-6 fill them in.

export type FigmaNodeType =
  | "FRAME"
  | "TEXT"
  | "IMAGE"
  | "SHAPE"
  | "SVG"
  | "COMPONENT";

export interface FigmaFill {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: { r: number; g: number; b: number };
  opacity?: number;
  gradientStops?: {
    position: number;
    color: { r: number; g: number; b: number; a: number };
  }[];
  // Required by Figma's GradientPaint to know direction/extent — not in the
  // blueprint's original schema, added because GRADIENT_LINEAR fills can't
  // actually be applied without it.
  gradientTransform?: [[number, number, number], [number, number, number]];
  imageBytes?: Uint8Array;
  scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
}

export interface FigmaStroke {
  type: "SOLID";
  color: { r: number; g: number; b: number };
  opacity?: number;
}

export interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  radius: number;
  offset?: { x: number; y: number };
  color?: { r: number; g: number; b: number; a: number };
  spread?: number;
}

// Sizing for a node inside ITS OWN parent's auto-layout (the real Figma API
// property is `layoutSizingHorizontal`/`layoutSizingVertical`).
export type SizingValue = "FIXED" | "HUG" | "FILL";

export interface FigmaAutoLayout {
  mode: "HORIZONTAL" | "VERTICAL" | "NONE";
  wrap?: "WRAP" | "NO_WRAP";
  gap: number;
  counterAxisSpacing?: number; // spacing between wrapped lines, only used when wrap is "WRAP"
  padding: [number, number, number, number]; // T, R, B, L
  primaryAxisAlign: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  // No "STRETCH" here — Figma's counterAxisAlignItems doesn't support it.
  // CSS align-items:stretch is expressed per-child instead, via this node's
  // own layoutSizingHorizontal/Vertical = "FILL" (see SizingValue above).
  counterAxisAlign: "MIN" | "CENTER" | "MAX";
  // Whether THIS frame hugs/fixes around its own children. Figma's real API
  // calls this primaryAxisSizingMode/counterAxisSizingMode with values
  // "FIXED" | "AUTO" (not "HUG") — translated at the point of use.
  primaryAxisSizing: "FIXED" | "HUG";
  counterAxisSizing: "FIXED" | "HUG";
}

export interface FigmaTextRun {
  characters: string;
  color: { r: number; g: number; b: number; a: number };
  fontFamily: string; // raw CSS font-family text; resolved against Figma's
                       // available fonts sandbox-side, since only the
                       // sandbox can call figma.listAvailableFontsAsync()
  fontWeight: number;
  italic: boolean;
  fontSize: number;
  underline: boolean;
  strikethrough: boolean;
}

export interface FigmaNodeTree {
  type: FigmaNodeType;
  name: string;

  // Geometry (Phase 2+)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;

  // Layout (Phase 3+, frames only)
  autoLayout?: FigmaAutoLayout;
  clipsContent?: boolean;
  // How this node sizes itself inside ITS PARENT's auto-layout (distinct
  // from autoLayout.primaryAxisSizing/counterAxisSizing above, which is
  // about this node's OWN children).
  layoutSizingHorizontal?: SizingValue;
  layoutSizingVertical?: SizingValue;
  // Takes this node out of the parent's auto-layout flow, using its
  // explicit x/y instead (CSS position:absolute).
  layoutPositioning?: "AUTO" | "ABSOLUTE";

  // Visual (Phase 4+)
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  cornerRadius?: number | [number, number, number, number];
  effects?: FigmaEffect[];
  opacity?: number;
  visible?: boolean;
  blendMode?: string;

  // Text (Phase 5+, TEXT type only)
  characters?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  lineHeight?: { value?: number; unit: "PIXELS" | "PERCENT" | "AUTO" };
  letterSpacing?: { value: number; unit: "PIXELS" | "PERCENT" };
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  // Per-character-range styling (a bolded word inside a paragraph, a
  // differently-colored link, etc). The base characters/fontSize/etc.
  // fields above are a single-style fallback; when this is present the
  // sandbox applies each run's own font/size/color/decoration across its
  // slice of `characters` instead.
  textRuns?: FigmaTextRun[];

  // Image (Phase 6+, IMAGE type only)
  imageBytes?: Uint8Array;

  // SVG (Phase 6+, SVG type only)
  svgString?: string;

  // Children
  children?: FigmaNodeTree[];
}

// UI <-> Sandbox message bridge
export type PluginMessage =
  | { type: "CREATE_NODES"; tree: FigmaNodeTree }
  | { type: "CONVERT_ERROR"; message: string };
