import {
  BPS_DENOMINATOR, MAX_FEE_BPS, MAX_RESERVE, MAX_SLIPPAGE_BPS, MAX_U64,
  MIN_TOKEN_RESERVE, Q64,
} from "./constants.js";

export type BuyQuote = Readonly<{ fee: bigint; net: bigint; tokensOut: bigint; newTokenReserve: bigint }>;
export type SellQuote = Readonly<{ gross: bigint; fee: bigint; baseOut: bigint; newEffectiveBase: bigint }>;
export type Split = Readonly<{ recipient: string; bps: number; category: number }>;
export type SplitAccrual = Split & Readonly<{ accrued: bigint; released: bigint }>;

export function assertU64(value: bigint, label = "amount"): bigint {
  if (value < 0n || value > MAX_U64) throw new RangeError(`${label} is outside u64`);
  return value;
}

export function checkedAdd(a: bigint, b: bigint, label = "sum"): bigint { return assertU64(a + b, label); }
export function checkedSub(a: bigint, b: bigint, label = "difference"): bigint {
  if (b > a) throw new RangeError(`${label} underflow`);
  return a - b;
}
export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new RangeError("ceilDiv requires n >= 0 and d > 0");
  return numerator / denominator + (numerator % denominator === 0n ? 0n : 1n);
}

function assertCurveBounds(effectiveBase: bigint, tokenReserve: bigint): void {
  if (effectiveBase <= 0n || effectiveBase > MAX_RESERVE) throw new RangeError("effective base bound");
  if (tokenReserve < MIN_TOKEN_RESERVE || tokenReserve > MAX_RESERVE) throw new RangeError("token reserve bound");
}
function assertBps(value: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new RangeError(`${label} bps`);
}

export function quoteBuy(args: Readonly<{ virtualBase: bigint; baseReserve: bigint; tokenReserve: bigint; baseIn: bigint; feeBps: number }>): BuyQuote {
  const { virtualBase, baseReserve, tokenReserve, baseIn, feeBps } = args;
  assertBps(feeBps, MAX_FEE_BPS, "fee");
  assertU64(baseIn, "base in");
  if (baseIn === 0n) throw new RangeError("zero amount");
  const effectiveBase = checkedAdd(virtualBase, baseReserve, "effective base");
  assertCurveBounds(effectiveBase, tokenReserve);
  const fee = baseIn * BigInt(feeBps) / BPS_DENOMINATOR;
  const net = checkedSub(baseIn, fee, "net input");
  const invariant = effectiveBase * tokenReserve;
  const newTokenReserve = ceilDiv(invariant, checkedAdd(effectiveBase, net, "post-buy base"));
  if (newTokenReserve < MIN_TOKEN_RESERVE) throw new RangeError("insufficient token reserve");
  const tokensOut = checkedSub(tokenReserve, newTokenReserve, "tokens out");
  if (tokensOut === 0n) throw new RangeError("zero output");
  return { fee, net, tokensOut, newTokenReserve };
}

export function quoteSell(args: Readonly<{ virtualBase: bigint; baseReserve: bigint; tokenReserve: bigint; tokensIn: bigint; feeBps: number }>): SellQuote {
  const { virtualBase, baseReserve, tokenReserve, tokensIn, feeBps } = args;
  assertBps(feeBps, MAX_FEE_BPS, "fee");
  assertU64(tokensIn, "tokens in");
  if (tokensIn === 0n) throw new RangeError("zero amount");
  const effectiveBase = checkedAdd(virtualBase, baseReserve, "effective base");
  assertCurveBounds(effectiveBase, tokenReserve);
  const newTokenReserve = checkedAdd(tokenReserve, tokensIn, "post-sell token reserve");
  if (newTokenReserve > MAX_RESERVE) throw new RangeError("token reserve bound");
  const invariant = effectiveBase * tokenReserve;
  const newEffectiveBase = ceilDiv(invariant, newTokenReserve);
  const curveGross = checkedSub(effectiveBase, newEffectiveBase, "curve gross");
  const gross = curveGross < baseReserve ? curveGross : baseReserve;
  if (gross === 0n) throw new RangeError("insufficient real reserve");
  const fee = gross * BigInt(feeBps) / BPS_DENOMINATOR;
  const baseOut = checkedSub(gross, fee, "base out");
  if (baseOut === 0n) throw new RangeError("zero output");
  return { gross, fee, baseOut, newEffectiveBase };
}

export function priceQ64(effectiveBase: bigint, tokenReserve: bigint): bigint {
  assertCurveBounds(effectiveBase, tokenReserve);
  return (effectiveBase << 64n) / tokenReserve;
}

export function formatProjectPrice(price: bigint, fractionDigits = 8): string {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 18) throw new RangeError("fraction digits");
  // USDC atoms/project atom × 10^9 project atoms / 10^6 USDC atoms.
  const numerator = price * 1_000n;
  const scale = 10n ** BigInt(fractionDigits);
  const scaled = numerator * scale / Q64;
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(fractionDigits, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function minimumOutput(quoted: bigint, slippageBps: number): bigint {
  assertBps(slippageBps, MAX_SLIPPAGE_BPS, "slippage");
  return quoted * BigInt(10_000 - slippageBps) / BPS_DENOMINATOR;
}

export function validateSplits(splits: readonly Split[]): readonly Split[] {
  if (splits.length < 1 || splits.length > 8) throw new RangeError("split count must be 1..8");
  const seen = new Set<string>();
  let total = 0;
  for (const split of splits) {
    if (!split.recipient) throw new TypeError("zero recipient");
    if (seen.has(split.recipient)) throw new TypeError("duplicate recipient");
    if (!Number.isInteger(split.bps) || split.bps <= 0 || split.bps > 10_000) throw new RangeError("zero or invalid bps");
    if (!Number.isInteger(split.category) || split.category < 0 || split.category > 7) throw new RangeError("category");
    seen.add(split.recipient); total += split.bps;
  }
  if (total !== 10_000) throw new RangeError("bps must total 10,000");
  return splits;
}

export function accrueDelta(current: readonly SplitAccrual[], newReceived: bigint): readonly SplitAccrual[] {
  validateSplits(current);
  assertU64(newReceived, "new received");
  if (newReceived === 0n) return current.map((entry) => ({ ...entry }));
  let remainderIndex = 0;
  for (let i = 1; i < current.length; i += 1) if (current[i]!.bps > current[remainderIndex]!.bps) remainderIndex = i;
  const additions = current.map((split, index) => index === remainderIndex ? 0n : newReceived * BigInt(split.bps) / BPS_DENOMINATOR);
  const allocated = additions.reduce((sum, value) => sum + value, 0n);
  additions[remainderIndex] = newReceived - allocated;
  return current.map((split, index) => ({ ...split, accrued: checkedAdd(split.accrued, additions[index]!, "accrued") }));
}

export function trackedBalance(totalReceived: bigint, totalReleased: bigint): bigint {
  return checkedSub(totalReceived, totalReleased, "tracked balance");
}

export function recognizedDelta(vaultAmount: bigint, totalReceived: bigint, totalReleased: bigint): bigint {
  return checkedSub(vaultAmount, trackedBalance(totalReceived, totalReleased), "recognized delta");
}
