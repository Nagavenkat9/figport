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

export interface FigmaAutoLayout {
  mode: "HORIZONTAL" | "VERTICAL" | "NONE";
  wrap?: "WRAP" | "NO_WRAP";
  gap: number;
  padding: [number, number, number, number]; // T, R, B, L
  primaryAxisAlign: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlign: "MIN" | "CENTER" | "MAX" | "STRETCH";
  primaryAxisSizing: "FIXED" | "HUG" | "FILL";
  counterAxisSizing: "FIXED" | "HUG" | "FILL";
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
  positioning?: "AUTO" | "ABSOLUTE";

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
