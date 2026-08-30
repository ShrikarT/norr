import { createHash } from "node:crypto";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
export function validateImage(bytes: Uint8Array, mime: string): void {
  if (!ALLOWED_IMAGE_TYPES.has(mime)) throw new TypeError("unsupported image MIME type");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new RangeError("image must be 1 byte..5 MiB");
}
export function validateMetadataUri(uri: string): void {
  if (new TextEncoder().encode(uri).length > 200) throw new RangeError("metadata URI exceeds 200 bytes");
  if (uri.startsWith("data:")) throw new TypeError("data URIs are forbidden");
  const parsed = new URL(uri);
  if (!new Set(["https:", "ar:", "ipfs:"]).has(parsed.protocol)) throw new TypeError("metadata URI protocol");
}
export function metadataHash(bytes: Uint8Array): Uint8Array { return new Uint8Array(createHash("sha256").update(bytes).digest()); }
export function canonicalMetadata(input: Readonly<{ name: string; symbol: string; description: string; image: string; website?: string }>): Uint8Array {
  const ordered = { name: input.name, symbol: input.symbol, description: input.description, image: input.image, ...(input.website ? { website: input.website } : {}) };
  return new TextEncoder().encode(JSON.stringify(ordered));
}
