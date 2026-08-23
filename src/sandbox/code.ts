// Receives a FigmaNodeTree from the UI and builds it into nested frames
// (and, since Phase 5, text nodes) on canvas.

import { PluginMessage } from "../shared/types";
import { buildTreeIntoFigma } from "./builders/node-factory";

figma.showUI(__html__, { width: 360, height: 420 });

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "CREATE_NODES") {
    const root = await buildTreeIntoFigma(msg.tree, figma.currentPage);
    if (!root) {
      figma.notify("FigPort: nothing visible to convert");
      return;
    }
    root.x = figma.viewport.center.x;
    root.y = figma.viewport.center.y;
    figma.viewport.scrollAndZoomIntoView([root]);
    figma.notify(`FigPort: created "${root.name}"`);
  } else if (msg.type === "CONVERT_ERROR") {
    figma.notify(`FigPort: ${msg.message}`, { error: true });
  }
};
