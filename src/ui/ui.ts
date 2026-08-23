// Phase 2: loads pasted HTML into the hidden iframe, walks the rendered DOM,
// builds a FigmaNodeTree, and hands it to the sandbox.

import { PluginMessage } from "../shared/types";
import { walkDom } from "./parser/dom-walker";
import { buildTree } from "./transformer/tree-builder";

const htmlInput = document.getElementById("html-input") as HTMLTextAreaElement;
const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
const renderFrame = document.getElementById("render-frame") as HTMLIFrameElement;

function send(message: PluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function loadIntoIframe(html: string): Promise<Document> {
  return new Promise((resolve, reject) => {
    renderFrame.onload = () => {
      const doc = renderFrame.contentDocument;
      if (!doc) {
        reject(new Error("could not access the render frame's document"));
        return;
      }
      resolve(doc);
    };
    renderFrame.srcdoc = html;
  });
}

convertBtn.addEventListener("click", async () => {
  const html = htmlInput.value;
  if (!html.trim()) {
    send({ type: "CONVERT_ERROR", message: "paste some HTML first" });
    return;
  }

  try {
    const doc = await loadIntoIframe(html);
    const raw = walkDom(doc.body);
    if (!raw) {
      send({ type: "CONVERT_ERROR", message: "nothing visible found in that HTML" });
      return;
    }
    const tree = buildTree(raw);
    send({ type: "CREATE_NODES", tree });
  } catch (err) {
    send({ type: "CONVERT_ERROR", message: err instanceof Error ? err.message : String(err) });
  }
});
