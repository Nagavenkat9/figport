# FigPort

A free, private, rule-based Figma plugin that converts HTML/CSS into editable
Figma nodes — no AI, no subscription, no external API calls. See
[html-to-figma-blueprint.md](./html-to-figma-blueprint.md) for the full
architecture and phased plan.

## Status

All 8 phases of the V1 blueprint are complete:

1. Scaffold & proof of life
2. DOM walker → nested frames
3. Flexbox → Figma auto-layout
4. Visual styling (fills, gradients, borders, radius, shadows, opacity, blend modes)
5. Typography (fonts, weight/style, mixed-style text runs)
6. Images & inline SVG
7. Edge cases (buttons, tables, lists, pseudo-elements) & resilience
8. Optimization & packaging

Current bundle size: `build/code.js` ~7KB, `build/ui.html` ~15KB (minified),
well under the 100KB target.

## Dev setup

```bash
npm install
npm run build     # one-off build -> build/code.js, build/ui.html
npm run watch     # rebuild on file changes
npx tsc --noEmit  # type-check without emitting
```

## Load in Figma

Figma desktop app → **Plugins → Development → Import plugin from manifest…**
→ select `manifest.json` in this folder.

Paste or type HTML into the plugin panel and click **Convert**. The hidden
render iframe loads it, computes real layout, and the result is built as
nested Figma frames/text/images on the current page.

## Trying it out — fixture pages

`fixtures/` has 5 representative HTML pages exercising different feature
combinations — paste each into the plugin panel and compare the result
against what a browser renders:

| File | Exercises |
|---|---|
| `01-hero-section.html` | Gradient background, centered flex column, button |
| `02-pricing-cards.html` | Nested cards, border+shadow, price typography, lists |
| `03-typography-article.html` | Headings, bold/italic runs, a link, `::before`, ordered list |
| `04-navbar-and-table.html` | Flex navbar, `<table>`/`<tr>`/`<td>` grid |
| `05-full-landing-page.html` | Combines flex layout, an `<img>`, inline SVG icons, buttons |

This is intentionally manual (load + eyeball), matching the project's
"rule-based, no automated visual-diff pipeline" scope for V1.

## What it doesn't do (yet)

See the blueprint's own risk register and each phase's Obsidian notes for
the full list; the highlights:

- CSS Grid has no direct Figma equivalent — falls back to fixed positioning.
- Gradient *angle* is snapped to the nearest of 4 cardinal directions, not
  computed exactly.
- Block-level children spaced via CSS `margin` (rather than `gap`) lose that
  spacing once auto-layout takes over.
- `::before`/`::after` only handle literal string `content` — not
  `counter()`/`attr()`/`url()`.
- No CSS Grid, `@media` query, or animation/prototype-connection support.
