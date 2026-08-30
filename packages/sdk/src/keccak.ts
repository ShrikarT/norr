import { bytesToHex } from "./bytes.js";

const MASK = (1n << 64n) - 1n;
const ROTATION = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
] as const;
const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
] as const;

function rotate(value: bigint, shift: number): bigint {
  if (shift === 0) return value & MASK;
  const amount = BigInt(shift);
  return ((value << amount) | (value >> (64n - amount))) & MASK;
}

function permute(state: bigint[]): void {
  for (const roundConstant of ROUND_CONSTANTS) {
    const c = new Array<bigint>(5).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      c[x] = state[x]! ^ state[x + 5]! ^ state[x + 10]! ^ state[x + 15]! ^ state[x + 20]!;
    }
    for (let x = 0; x < 5; x += 1) {
      const d = c[(x + 4) % 5]! ^ rotate(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 5; y += 1) state[x + 5 * y] = state[x + 5 * y]! ^ d;
    }
    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const destinationX = y;
        const destinationY = (2 * x + 3 * y) % 5;
        b[destinationX + 5 * destinationY] = rotate(state[x + 5 * y]!, ROTATION[x + 5 * y]!);
      }
    }
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const current = b[x + 5 * y]!;
        const next = b[((x + 1) % 5) + 5 * y]!;
        const after = b[((x + 2) % 5) + 5 * y]!;
        state[x + 5 * y] = (current ^ ((~next) & after)) & MASK;
      }
    }
    state[0] = state[0]! ^ roundConstant;
  }
}

export function keccak256(input: Uint8Array): Uint8Array {
  const rate = 136;
  const paddedLength = Math.ceil((input.length + 1) / rate) * rate;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[paddedLength - 1] = (padded[paddedLength - 1] ?? 0) | 0x80;
  const state = new Array<bigint>(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane += 1) {
      let value = 0n;
      for (let byte = 0; byte < 8; byte += 1) {
        value |= BigInt(padded[offset + lane * 8 + byte] ?? 0) << BigInt(byte * 8);
      }
      state[lane] = state[lane]! ^ value;
    }
    permute(state);
  }
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number((state[Math.floor(index / 8)]! >> BigInt((index % 8) * 8)) & 0xffn);
  }
  return output;
}

export function keccakHex(input: Uint8Array): string { return bytesToHex(keccak256(input)); }
