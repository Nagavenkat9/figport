// Phase 1: proof-of-life. Listens for the UI's message and creates a single
// rectangle on canvas to prove the UI <-> sandbox <-> Figma API bridge works.

figma.showUI(__html__, { width: 320, height: 360 });

figma.ui.onmessage = (msg: { type: string }) => {
  if (msg.type === "CONVERT_PROOF_OF_LIFE") {
    const rect = figma.createRectangle();
    rect.x = figma.viewport.center.x;
    rect.y = figma.viewport.center.y;
    rect.resize(200, 120);
    rect.fills = [{ type: "SOLID", color: { r: 0.094, g: 0.627, b: 0.984 } }];
    rect.name = "FigPort Proof of Life";
    figma.currentPage.appendChild(rect);
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.notify("FigPort: proof-of-life rectangle created");
  }
};
