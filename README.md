# FigPort

A free, private, rule-based Figma plugin that converts HTML/CSS into editable
Figma nodes — no AI, no subscription, no external API calls. See
[html-to-figma-blueprint.md](./html-to-figma-blueprint.md) for the full
architecture and phased plan.

## Status

Phase 1 (Scaffold & Proof of Life) complete. See the blueprint for the full
8-phase roadmap.

## Dev setup

```bash
npm install
npm run build     # one-off build -> build/code.js, build/ui.html
npm run watch     # rebuild on file changes
```

## Load in Figma

Figma desktop app → **Plugins → Development → Import plugin from manifest…**
→ select `manifest.json` in this folder.
