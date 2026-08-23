# HTML → Figma Converter Plugin — Architecture Blueprint

## Project Codename: **FigPort**

---

## 1. Problem Statement

Importing AI-generated HTML into Figma currently requires html.to.design ($20/month).
This plugin replaces that with a free, private, rule-based engine that converts
any HTML/CSS into editable Figma nodes — no AI, no subscription, no external API calls.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FIGMA DESKTOP APP                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PLUGIN UI (iframe)                       │  │
│  │                                                       │  │
│  │  ┌─────────────┐    ┌──────────────────────────────┐  │  │
│  │  │  Input Zone  │    │     Hidden Render Iframe     │  │  │
│  │  │             │    │                              │  │  │
│  │  │ • Paste HTML │    │  HTML loaded here silently   │  │  │
│  │  │ • Upload     │    │  to compute real layout via  │  │  │
│  │  │   .html file │    │  getComputedStyle() +        │  │  │
│  │  │ • URL fetch  │    │  getBoundingClientRect()     │  │  │
│  │  │   (optional) │    │                              │  │  │
│  │  └──────┬───────┘    └──────────┬───────────────────┘  │  │
│  │         │                       │                      │  │
│  │         │    ┌──────────────────┘                      │  │
│  │         ▼    ▼                                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │          DOM WALKER + STYLE EXTRACTOR             │  │  │
│  │  │                                                  │  │  │
│  │  │  TreeWalker traverses every visible element      │  │  │
│  │  │  Extracts: tag, text, computedStyle, bounds,     │  │  │
│  │  │  children[], image src, input type               │  │  │
│  │  │                                                  │  │  │
│  │  │  Output: FigmaNodeTree (JSON)                    │  │  │
│  │  └──────────────────┬───────────────────────────────┘  │  │
│  │                     │                                  │  │
│  │                     │ postMessage(FigmaNodeTree)        │  │
│  └─────────────────────┼──────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PLUGIN SANDBOX (main thread)              │  │
│  │                                                       │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │            NODE BUILDER ENGINE                   │  │  │
│  │  │                                                  │  │  │
│  │  │  Walks FigmaNodeTree recursively                 │  │  │
│  │  │  Creates Figma nodes via Plugin API:             │  │  │
│  │  │  • figma.createFrame()                           │  │  │
│  │  │  • figma.createText()                            │  │  │
│  │  │  • figma.createRectangle()                       │  │  │
│  │  │  • figma.createImage()                           │  │  │
│  │  │  Applies: fills, strokes, effects, auto-layout,  │  │  │
│  │  │  corner radius, opacity, blend modes             │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│              ▼ Result: Fully editable Figma design          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
figport/
├── manifest.json              ← Plugin metadata, permissions, entry points
├── package.json               ← Dev dependencies (TypeScript, esbuild)
├── tsconfig.json              ← TypeScript config
│
├── src/
│   ├── ui/                    ← Runs in the iframe (has DOM, no Figma API)
│   │   ├── ui.html            ← Plugin panel: paste area, file upload, convert button
│   │   ├── ui.ts              ← Event handlers, orchestrates parsing pipeline
│   │   ├── parser/
│   │   │   ├── dom-walker.ts      ← TreeWalker traversal, skips invisible nodes
│   │   │   ├── style-extractor.ts ← getComputedStyle() → normalized style object
│   │   │   ├── image-extractor.ts ← <img> src, background-image → base64 bytes
│   │   │   └── text-extractor.ts  ← innerText, font props, inline formatting
│   │   └── transformer/
│   │       ├── layout-mapper.ts   ← CSS flex/block/inline → Figma auto-layout config
│   │       ├── style-mapper.ts    ← CSS props → Figma fills/strokes/effects/radius
│   │       └── tree-builder.ts    ← Assembles the final FigmaNodeTree JSON
│   │
│   ├── sandbox/               ← Runs in main thread (has Figma API, no DOM)
│   │   ├── code.ts            ← Entry point, listens for postMessage
│   │   ├── builders/
│   │   │   ├── frame-builder.ts   ← createFrame + auto-layout properties
│   │   │   ├── text-builder.ts    ← createText + loadFontAsync + character styles
│   │   │   ├── image-builder.ts   ← createImage from bytes, apply as fill
│   │   │   ├── shape-builder.ts   ← createRectangle/Ellipse for decorative elements
│   │   │   └── node-factory.ts    ← Routes each tree node to the right builder
│   │   └── utils/
│   │       ├── color-parser.ts    ← rgb/rgba/hex/hsl → Figma {r,g,b,a} (0-1 range)
│   │       └── unit-parser.ts     ← px/rem/em/% → absolute pixel values
│   │
│   └── shared/
│       └── types.ts           ← FigmaNodeTree type definitions, shared interfaces
│
├── build/                     ← esbuild output (bundled JS)
│   ├── ui.js
│   └── code.js
│
└── README.md
```

---

## 4. Data Flow — Step by Step

```
Step 1: INPUT
   User pastes HTML string or uploads .html file
          │
          ▼
Step 2: RENDER
   HTML loaded into a hidden <iframe> inside the plugin UI
   Browser computes real layout (resolves CSS, calculates positions)
          │
          ▼
Step 3: WALK
   TreeWalker visits every element in DOM order (depth-first)
   For each visible element:
      ├── getComputedStyle()     → all resolved CSS values
      ├── getBoundingClientRect() → x, y, width, height
      ├── tagName, className     → semantic hints
      ├── childNodes             → recurse for children
      ├── textContent            → if leaf text node
      └── <img>.src / bg-image   → if has image
          │
          ▼
Step 4: TRANSFORM
   Raw DOM data mapped to Figma-compatible structure:
      ├── CSS display/flex-direction   → layoutMode, primaryAxisAlign, etc.
      ├── CSS gap/padding/margin       → itemSpacing, padding
      ├── CSS colors/gradients         → fills[]
      ├── CSS border                   → strokes[], strokeWeight
      ├── CSS box-shadow               → effects[]
      ├── CSS border-radius            → cornerRadius / individual corners
      ├── CSS opacity                  → opacity
      ├── CSS font-*                   → fontName, fontSize, lineHeight, etc.
      └── width/height from bounds     → explicit sizing
          │
          ▼
Step 5: SERIALIZE
   Assembled into FigmaNodeTree JSON:
   {
     type: "FRAME",
     name: "div.container",
     width: 1440, height: 900,
     fills: [{ type: "SOLID", color: {r:1,g:1,b:1} }],
     autoLayout: { mode: "VERTICAL", gap: 16, padding: [24,24,24,24] },
     children: [
       { type: "TEXT", characters: "Hello", fontName: {family:"Inter", style:"Regular"}, ... },
       { type: "FRAME", ..., children: [...] }
     ]
   }
          │
          ▼
Step 6: BRIDGE
   parent.postMessage({ type: "CREATE_NODES", tree: FigmaNodeTree }, "*")
   Plugin UI → Plugin Sandbox
          │
          ▼
Step 7: BUILD
   Sandbox receives tree, walks it recursively:
      For each node:
         ├── "FRAME"  → figma.createFrame(), set autoLayout, fills, strokes, effects
         ├── "TEXT"   → figma.createText(), loadFontAsync(), set characters + styles
         ├── "IMAGE"  → figma.createRectangle(), figma.createImage(bytes), apply as fill
         └── "SHAPE"  → figma.createRectangle/Ellipse(), set fills/radius
      Append child to parent frame
          │
          ▼
Step 8: OUTPUT
   Fully editable Figma node tree on canvas
   User can immediately modify, detach, restyle
```

---

## 5. Core Mapping Table — CSS → Figma

### 5.1 Layout

| CSS Property | CSS Value | Figma Property | Figma Value |
|---|---|---|---|
| `display` | `flex` | `layoutMode` | `"HORIZONTAL"` or `"VERTICAL"` (from `flex-direction`) |
| `display` | `block` | `layoutMode` | `"VERTICAL"` (block = vertical stack) |
| `display` | `inline`, `inline-block` | `layoutMode` | `"HORIZONTAL"` on parent |
| `flex-direction` | `row` | `layoutMode` | `"HORIZONTAL"` |
| `flex-direction` | `column` | `layoutMode` | `"VERTICAL"` |
| `flex-wrap` | `wrap` | `layoutWrap` | `"WRAP"` |
| `justify-content` | `center` | `primaryAxisAlignItems` | `"CENTER"` |
| `justify-content` | `space-between` | `primaryAxisAlignItems` | `"SPACE_BETWEEN"` |
| `justify-content` | `flex-end` | `primaryAxisAlignItems` | `"MAX"` |
| `align-items` | `center` | `counterAxisAlignItems` | `"CENTER"` |
| `align-items` | `flex-start` | `counterAxisAlignItems` | `"MIN"` |
| `align-items` | `stretch` | `counterAxisAlignItems` | `"STRETCH"` |
| `gap` | `16px` | `itemSpacing` | `16` |
| `padding` | `24px` | `paddingTop/Right/Bottom/Left` | `24` each |
| `position` | `absolute` | `layoutPositioning` | `"ABSOLUTE"` |
| `width` | `100%` | `layoutSizingHorizontal` | `"FILL"` |
| `width` | `auto` / `fit-content` | `layoutSizingHorizontal` | `"HUG"` |
| `width` | `300px` | `width` | `300` (fixed) |
| `height` | `100%` | `layoutSizingVertical` | `"FILL"` |
| `overflow` | `hidden` | `clipsContent` | `true` |

### 5.2 Visual Styling

| CSS Property | Figma Property | Conversion |
|---|---|---|
| `background-color` | `fills[0]` | Parse rgba → `{type:"SOLID", color:{r,g,b}, opacity}` |
| `linear-gradient()` | `fills[0]` | `{type:"GRADIENT_LINEAR", gradientStops:[...]}` |
| `border` | `strokes[]` + `strokeWeight` | Parse color + width |
| `border-radius` | `cornerRadius` | Single value; or `topLeftRadius` etc. for individual |
| `box-shadow` | `effects[]` | `{type:"DROP_SHADOW", offset:{x,y}, radius, color}` |
| `box-shadow: inset` | `effects[]` | `{type:"INNER_SHADOW", ...}` |
| `opacity` | `opacity` | Direct (0-1 range) |
| `backdrop-filter: blur()` | `effects[]` | `{type:"BACKGROUND_BLUR", radius}` |
| `filter: blur()` | `effects[]` | `{type:"LAYER_BLUR", radius}` |
| `mix-blend-mode` | `blendMode` | Map CSS name → Figma enum (`multiply`→`"MULTIPLY"`) |
| `transform: rotate()` | `rotation` | Parse degrees (Figma uses counter-clockwise) |
| `visibility: hidden` | `visible` | `false` |

### 5.3 Typography

| CSS Property | Figma Property | Notes |
|---|---|---|
| `font-family` | `fontName.family` | First family in stack; fallback to "Inter" |
| `font-weight` | `fontName.style` | 400→"Regular", 500→"Medium", 600→"Semi Bold", 700→"Bold" |
| `font-style: italic` | `fontName.style` | Append "Italic" to style string |
| `font-size` | `fontSize` | px value |
| `line-height` | `lineHeight` | `{value, unit:"PIXELS"}` or `{unit:"AUTO"}` |
| `letter-spacing` | `letterSpacing` | `{value, unit:"PIXELS"}` |
| `text-align` | `textAlignHorizontal` | `left`→`"LEFT"`, `center`→`"CENTER"`, `right`→`"RIGHT"` |
| `text-decoration` | `textDecoration` | `underline`→`"UNDERLINE"`, `line-through`→`"STRIKETHROUGH"` |
| `text-transform` | — | Apply transform to the text string itself before setting |
| `color` | `fills[0]` on TextNode | Text color is a fill, not a stroke |

### 5.4 Images

| Source | Extraction | Figma Creation |
|---|---|---|
| `<img src="...">` | Fetch → ArrayBuffer → Uint8Array | `figma.createImage(bytes)` → apply as fill on Rectangle |
| `background-image: url(...)` | Same fetch pipeline | Same — Rectangle with image fill |
| Inline `data:` URI | Decode base64 → Uint8Array | Same |
| `<svg>` inline | Serialize outerHTML | `figma.createNodeFromSvg(svgString)` |

---

## 6. FigmaNodeTree Schema (shared/types.ts)

```typescript
interface FigmaNodeTree {
  type: "FRAME" | "TEXT" | "IMAGE" | "SHAPE" | "SVG" | "COMPONENT";
  name: string;                          // e.g. "div.hero-section"

  // Geometry
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;                     // degrees

  // Layout (frames only)
  autoLayout?: {
    mode: "HORIZONTAL" | "VERTICAL" | "NONE";
    wrap?: "WRAP" | "NO_WRAP";
    gap: number;
    padding: [number, number, number, number]; // T, R, B, L
    primaryAxisAlign: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
    counterAxisAlign: "MIN" | "CENTER" | "MAX" | "STRETCH";
    primaryAxisSizing: "FIXED" | "HUG" | "FILL";
    counterAxisSizing: "FIXED" | "HUG" | "FILL";
  };
  clipsContent?: boolean;
  positioning?: "AUTO" | "ABSOLUTE";

  // Visual
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  cornerRadius?: number | [number, number, number, number];
  effects?: FigmaEffect[];
  opacity?: number;
  visible?: boolean;
  blendMode?: string;

  // Text (TEXT type only)
  characters?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  lineHeight?: { value?: number; unit: "PIXELS" | "PERCENT" | "AUTO" };
  letterSpacing?: { value: number; unit: "PIXELS" | "PERCENT" };
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";

  // Image (IMAGE type only)
  imageBytes?: Uint8Array;

  // SVG (SVG type only)
  svgString?: string;

  // Children
  children?: FigmaNodeTree[];
}

interface FigmaFill {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: { r: number; g: number; b: number };  // 0-1 range
  opacity?: number;
  gradientStops?: { position: number; color: { r: number; g: number; b: number; a: number } }[];
  imageBytes?: Uint8Array;
  scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
}

interface FigmaStroke {
  type: "SOLID";
  color: { r: number; g: number; b: number };
  opacity?: number;
}

interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  radius: number;
  offset?: { x: number; y: number };
  color?: { r: number; g: number; b: number; a: number };
  spread?: number;
}
```

---

## 7. Phased Development Plan

### PHASE 1 — Scaffold & Proof of Life (Days 1-2)

**Goal:** Plugin loads in Figma, accepts HTML, creates one rectangle on canvas.

| Task | Detail |
|---|---|
| 1.1 `manifest.json` | Set `"name"`, `"id"`, `"api"`, `"main": "build/code.js"`, `"ui": "build/ui.html"`, `"networkAccess": { "allowedDomains": ["*"] }` |
| 1.2 `ui.html` | Textarea for pasting HTML, "Convert" button, hidden iframe for rendering |
| 1.3 `code.ts` | Listen for `postMessage`, create a single `figma.createRectangle()` as proof of life |
| 1.4 Dev tooling | `package.json` with esbuild, TypeScript config, watch mode |
| 1.5 Load in Figma | Plugins → Development → Import from manifest |

**Exit Criteria:** Clicking "Convert" in the plugin UI creates a colored rectangle on the Figma canvas.

---

### PHASE 2 — DOM Walker + Basic Frames (Days 3-5)

**Goal:** HTML with nested `<div>`s becomes nested Figma frames with correct sizes.

| Task | Detail |
|---|---|
| 2.1 Hidden iframe loader | Load pasted HTML into the hidden `<iframe>`, wait for render |
| 2.2 `dom-walker.ts` | TreeWalker traversal; skip `<script>`, `<style>`, `<head>`, invisible elements |
| 2.3 Bounds extraction | `getBoundingClientRect()` for every element → x, y, width, height |
| 2.4 Tree serialization | Build recursive `FigmaNodeTree` JSON from DOM structure |
| 2.5 `frame-builder.ts` | Sandbox receives tree, creates nested `figma.createFrame()` with correct sizes |
| 2.6 `postMessage` bridge | Wire UI→Sandbox communication with typed messages |

**Exit Criteria:** A 3-level nested HTML div structure appears as 3-level nested Figma frames with matching dimensions.

---

### PHASE 3 — Auto-Layout Engine (Days 6-9)

**Goal:** Flexbox layouts in HTML produce correct auto-layout in Figma.

| Task | Detail |
|---|---|
| 3.1 `layout-mapper.ts` | Detect `display:flex`, read `flex-direction`, `justify-content`, `align-items`, `gap`, `flex-wrap` |
| 3.2 Auto-layout application | Map to `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, `layoutWrap` |
| 3.3 Padding extraction | Parse `padding` (shorthand + individual) → `paddingTop/Right/Bottom/Left` |
| 3.4 Sizing logic | `width:100%` → FILL, `width:auto` → HUG, explicit px → FIXED |
| 3.5 `display:block` fallback | Non-flex containers default to vertical auto-layout |
| 3.6 Absolute positioning | `position:absolute` → `layoutPositioning: "ABSOLUTE"` with x/y from bounds |

**Exit Criteria:** A flex row with 3 children (space-between, centered) appears correctly auto-laid-out in Figma.

---

### PHASE 4 — Visual Styling (Days 10-13)

**Goal:** Colors, borders, shadows, radius, opacity all transfer correctly.

| Task | Detail |
|---|---|
| 4.1 `color-parser.ts` | Parse `rgb()`, `rgba()`, `#hex`, `hsl()` → Figma `{r,g,b}` (0-1 range) |
| 4.2 Background fills | `background-color` → solid fill; `linear-gradient` → gradient fill |
| 4.3 Borders → strokes | Parse `border` shorthand → `strokes[]`, `strokeWeight`, `strokeAlign` |
| 4.4 Border radius | `border-radius` → `cornerRadius` or per-corner values |
| 4.5 Box shadows → effects | Parse `box-shadow` → `DROP_SHADOW` / `INNER_SHADOW` effects |
| 4.6 Opacity + blend modes | Direct mapping for both |
| 4.7 `overflow:hidden` | → `clipsContent: true` |

**Exit Criteria:** A card component with gradient background, rounded corners, drop shadow, and border renders visually identical in Figma.

---

### PHASE 5 — Typography (Days 14-17)

**Goal:** All text renders with correct font, size, weight, color, alignment.

| Task | Detail |
|---|---|
| 5.1 `text-builder.ts` | `figma.createText()` + `figma.loadFontAsync()` before setting characters |
| 5.2 Font resolution | Map `font-family` stack → first available Figma font; fallback to Inter |
| 5.3 Weight → style string | Build `fontName.style` from weight (400→Regular, 700→Bold) + italic |
| 5.4 Text properties | `fontSize`, `lineHeight`, `letterSpacing`, `textAlignHorizontal` |
| 5.5 Text decoration | `underline` → `UNDERLINE`, `line-through` → `STRIKETHROUGH` |
| 5.6 `text-transform` | Apply `uppercase`/`lowercase`/`capitalize` to the string itself |
| 5.7 Multi-style text | Handle `<span>` inside `<p>` — use `setRangeFontName()` etc. for mixed styling |

**Exit Criteria:** A heading (bold, 32px), paragraph (regular, 16px, line-height 1.5), and styled link (underlined, colored) all render correctly.

---

### PHASE 6 — Images & SVG (Days 18-20)

**Goal:** Images appear in Figma as rectangles with image fills; inline SVGs become vector nodes.

| Task | Detail |
|---|---|
| 6.1 `image-extractor.ts` | Detect `<img>`, `background-image`, inline `data:` URIs |
| 6.2 Image fetching | Fetch URL → ArrayBuffer → Uint8Array; handle CORS via plugin `networkAccess` |
| 6.3 `image-builder.ts` | `figma.createImage(bytes)` → apply as fill on a Rectangle with correct aspect ratio |
| 6.4 SVG handling | Inline `<svg>` → `figma.createNodeFromSvg(outerHTML)` |
| 6.5 `object-fit` mapping | `cover`→`scaleMode:"FILL"`, `contain`→`"FIT"`, `fill`→`"CROP"` |

**Exit Criteria:** An HTML page with a hero image, inline SVG icon, and CSS background image all appear correctly in Figma.

---

### PHASE 7 — Edge Cases & Polish (Days 21-25)

**Goal:** Handle real-world HTML patterns, error recovery, UX polish.

| Task | Detail |
|---|---|
| 7.1 `<input>`/`<button>` handling | Render as styled frames (text + fill + border) since Figma has no form elements |
| 7.2 `<table>` handling | Convert to grid of frames with auto-layout |
| 7.3 `<ul>`/`<ol>` handling | List items → vertical auto-layout frame, prepend bullet/number text |
| 7.4 `display:none` / `visibility:hidden` | Skip invisible elements entirely (or mark `visible: false`) |
| 7.5 Pseudo-elements (`::before`/`::after`) | Extract via `getComputedStyle(el, "::before")` if `content` is not `none` |
| 7.6 Font fallback system | If `loadFontAsync` fails, gracefully fall back to Inter |
| 7.7 Progress UI | Show conversion progress bar in plugin panel |
| 7.8 Error handling | Wrap every builder in try/catch; log failures but don't abort the whole tree |
| 7.9 Naming convention | Name Figma nodes as `tag.class` (e.g. "div.hero-section") for navigability |
| 7.10 Layer ordering | Maintain DOM source order = Figma layer order |

**Exit Criteria:** A real AI-generated HTML page (from actual hackathon workflow) converts end-to-end with no crashes and < 5% visual discrepancy.

---

### PHASE 8 — Optimization & Packaging (Days 26-28)

**Goal:** Fast enough for real use, clean enough to maintain.

| Task | Detail |
|---|---|
| 8.1 Performance profiling | Benchmark on a 200-element page; target < 5 seconds |
| 8.2 Batch node creation | Group `figma.createX()` calls to minimize Figma redraws |
| 8.3 Image deduplication | Hash image bytes; reuse same `figma.createImage()` for repeated images |
| 8.4 Bundle optimization | esbuild minification, tree-shake unused code |
| 8.5 README + usage docs | Clear instructions for installing as a private dev plugin |
| 8.6 Test suite | 5 representative HTML fixtures, visual regression checks |

**Exit Criteria:** Plugin handles a full landing page in < 5 seconds, bundled JS < 100KB, README complete.

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| `getComputedStyle` doesn't match browser rendering | Layout mismatches | Use explicit px values; avoid em/rem/vh/vw in AI output |
| `loadFontAsync` fails for custom fonts | Text won't render | Fallback to Inter; warn user in UI |
| Large images slow down conversion | Timeout / memory | Resize images > 2048px before creating `figma.createImage()` |
| `postMessage` size limit for huge pages | Data loss | Chunk the tree if > 50MB; batch images separately |
| CSS Grid layouts | No direct Figma equivalent | Detect grid → fall back to absolute positioning from bounds |
| CORS blocks image fetching | Broken images | Use `networkAccess: { allowedDomains: ["*"] }` in manifest; fallback to placeholder |
| Pseudo-elements with complex content | Missed visual elements | Best-effort extraction; warn user |

---

## 9. Tech Stack

| Component | Technology | Reason |
|---|---|---|
| Language | TypeScript | Type safety for the mapping engine; Figma Plugin API has TS types |
| Bundler | esbuild | Fast, zero-config; Figma plugins need single-file JS bundles |
| Plugin API | Figma Plugin API (latest) | Required for creating nodes |
| DOM Parsing | Native browser APIs | TreeWalker, getComputedStyle, getBoundingClientRect — free, accurate |
| Testing | Manual fixture-based | Load 5 representative HTML pages, compare visual output |

---

## 10. Future Scope (Not in V1)

- CSS Grid → auto-layout approximation
- `@media` query handling (pick one viewport and convert)
- Animation/transition properties → Figma prototype connections
- Figma component detection (identify repeated patterns → convert to Figma components)
- Reverse: Figma → HTML export
- Browser extension version (right-click any page → send to Figma)

---

## 11. Timeline Summary

| Phase | Days | Milestone |
|---|---|---|
| 1. Scaffold | 1-2 | Plugin loads, proof of life |
| 2. DOM Walker | 3-5 | Nested frames with sizes |
| 3. Auto-Layout | 6-9 | Flex → auto-layout working |
| 4. Visual Styling | 10-13 | Colors, shadows, borders |
| 5. Typography | 14-17 | Text rendering correct |
| 6. Images & SVG | 18-20 | All media types handled |
| 7. Edge Cases | 21-25 | Real-world HTML works |
| 8. Optimization | 26-28 | Production-ready |
| **Total** | **~28 days** | **Full working plugin** |

---

*This is the complete V1 blueprint. Each phase has clear exit criteria —
skip to the next phase only when the current one's exit criteria pass.*
