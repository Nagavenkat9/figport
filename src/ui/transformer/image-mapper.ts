// Phase 6: converts a raw image source (an <img> src attribute, or a CSS
// background-image url()) into Figma-ready fill data. data: URIs are
// decoded to bytes directly here — cheap, synchronous, no network needed.
// Remote http(s) URLs are left as strings for the sandbox to fetch; only
// the sandbox has the plugin's declared network-access permission, and
// fetching from this UI iframe would be subject to the target's CORS
// policy in a way the sandbox's fetch is not.

export interface ImageSource {
  url?: string;
  bytes?: Uint8Array;
}

function decodeDataUri(dataUri: string): Uint8Array | undefined {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) return undefined;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function resolveImageSource(src: string): ImageSource | null {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const bytes = decodeDataUri(src);
    return bytes ? { bytes } : null;
  }
  return { url: src };
}

export function extractBackgroundImageUrl(backgroundImage: string): string | null {
  const match = backgroundImage.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
  return match ? match[2] : null;
}

// Used for both CSS object-fit (on <img>) and background-size (on any
// element with background-image) — same cover/contain/fill vocabulary.
export function mapImageFit(value: string): "FILL" | "FIT" | "CROP" {
  switch (value) {
    case "contain":
      return "FIT";
    case "fill":
      return "CROP"; // per the blueprint's own mapping table (5.4)
    case "cover":
    default:
      return "FILL";
  }
}
