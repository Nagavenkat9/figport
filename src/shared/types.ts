// Shared FigmaNodeTree schema (see blueprint section 6).
// Populated in Phase 2 as the DOM walker starts producing real trees.
// Kept as a stub in Phase 1 so the src/shared/ path exists per the file layout.

export type FigmaNodeType =
  | "FRAME"
  | "TEXT"
  | "IMAGE"
  | "SHAPE"
  | "SVG"
  | "COMPONENT";
