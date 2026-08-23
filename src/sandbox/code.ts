// Receives a FigmaNodeTree from the UI and builds it into nested frames,
// text, image, and SVG nodes on canvas.

import { PluginMessage } from "../shared/types";
import { buildTreeIntoFigma } from "./builders/node-factory";

figma.showUI(__html__, { width: 360, height: 420 });

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "CREATE_NODES") {
    try {
      const root = await buildTreeIntoFigma(msg.tree, figma.currentPage);
      if (!root) {
        figma.notify("FigPort: nothing visible to convert");
        return;
      }
      root.x = figma.viewport.center.x;
      root.y = figma.viewport.center.y;
      figma.viewport.scrollAndZoomIntoView([root]);
      figma.notify(`FigPort: created "${root.name}"`);
    } catch (e) {
      // node-factory.ts already isolates per-node failures; this is the
      // last-resort catch for anything unexpected at the top level, so a
      // bug never fails silently with just a console warning no one sees.
      console.error("FigPort: conversion failed", e);
      figma.notify("FigPort: conversion failed — see console for details", { error: true });
    }
  } else if (msg.type === "CONVERT_ERROR") {
    figma.notify(`FigPort: ${msg.message}`, { error: true });
  }
};
