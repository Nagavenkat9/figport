// Phase 2: traverses the rendered DOM inside the hidden iframe and produces
// a plain-object tree of geometry + tag/class info. Style extraction and
// text extraction are separate concerns added in later phases.

export interface RawDomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawDomNode {
  tagName: string;
  className: string;
  rect: RawDomRect;
  children: RawDomNode[];
}

const SKIP_TAGS = new Set([
  "script",
  "style",
  "head",
  "meta",
  "link",
  "title",
  "noscript",
  "template",
]);

export function walkDom(element: Element): RawDomNode | null {
  const tagName = element.tagName.toLowerCase();
  if (SKIP_TAGS.has(tagName)) return null;

  const win = element.ownerDocument.defaultView;
  const computed = win ? win.getComputedStyle(element) : null;
  if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
    return null;
  }

  const domRect = element.getBoundingClientRect();

  const children: RawDomNode[] = [];
  for (const child of Array.from(element.children)) {
    const walked = walkDom(child);
    if (walked) children.push(walked);
  }

  return {
    tagName,
    className: typeof element.className === "string" ? element.className : "",
    rect: {
      x: domRect.x,
      y: domRect.y,
      width: domRect.width,
      height: domRect.height,
    },
    children,
  };
}
