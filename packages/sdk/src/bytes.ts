const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((char, index) => [char, index] as const));

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }

export function u32le(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new RangeError("u32");
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

export function u64le(value: bigint): Uint8Array {
  if (value < 0n || value > ((1n << 64n) - 1n)) throw new RangeError("u64");
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 || !/^[0-9a-f]*$/i.test(clean)) throw new TypeError("invalid hex");
  return Uint8Array.from(clean.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
}

export function decodeBase58(value: string): Uint8Array {
  if (!value.length) return new Uint8Array();
  let number = 0n;
  for (const char of value) {
    const digit = INDEX.get(char);
    if (digit === undefined) throw new TypeError(`invalid base58 character: ${char}`);
    number = number * 58n + BigInt(digit);
  }
  const body: number[] = [];
  while (number > 0n) { body.push(Number(number & 0xffn)); number >>= 8n; }
  body.reverse();
  let zeroes = 0;
  while (value[zeroes] === "1") zeroes += 1;
  return Uint8Array.from([...new Array(zeroes).fill(0), ...body]);
}

export function encodeBase58(bytes: Uint8Array): string {
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) | BigInt(byte);
  let body = "";
  while (number > 0n) {
    const digit = Number(number % 58n);
    body = (ALPHABET[digit] ?? "") + body;
    number /= 58n;
  }
  let zeroes = 0;
  while (bytes[zeroes] === 0) zeroes += 1;
  return "1".repeat(zeroes) + body;
}

export function addressBytes(value: string): Uint8Array {
  const bytes = decodeBase58(value);
  if (bytes.length !== 32) throw new RangeError(`address must decode to 32 bytes, got ${bytes.length}`);
  return bytes;
}
