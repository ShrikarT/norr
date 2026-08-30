import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCRIMINATORS,
  buildMarketBuyInstruction,
  NorrClient,
  type ProgramAddresses,
} from "../src/index.js";

const DUMMY_PROGRAMS: ProgramAddresses = {
  launch: "11111111111111111111111111111111",
  claim: "22222222222222222222222222222222",
  fees: "33333333333333333333333333333333",
  market: "44444444444444444444444444444444",
  boards: "55555555555555555555555555555555",
  social: "66666666666666666666666666666666",
  wrap: "77777777777777777777777777777777",
};

const mockDeriver = async (prog: string, seeds: readonly Uint8Array[]) => ({
  address: "MockPda11111111111111111111111111111111111",
  bump: 255,
});

test("market buy instruction encoding includes discriminator and amounts", () => {
  const ix = buildMarketBuyInstruction(
    DUMMY_PROGRAMS.market,
    {
      user: "User11111111111111111111111111111111111111",
      curve: "Curve1111111111111111111111111111111111111",
      userBaseToken: "UBT111111111111111111111111111111111111111",
      userProjectToken: "UPT111111111111111111111111111111111111111",
      baseVault: "BV1111111111111111111111111111111111111111",
      tokenVault: "TV1111111111111111111111111111111111111111",
      routerVault: "RV1111111111111111111111111111111111111111",
      router: "Router111111111111111111111111111111111111",
      tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
    1000000n,
    500000n
  );

  assert.equal(ix.programId, DUMMY_PROGRAMS.market);
  assert.equal(ix.accounts.length, 9);
  assert.deepEqual(ix.data.subarray(0, 8), DISCRIMINATORS.market.buy);
  assert.equal(ix.data.length, 24);
});

test("NorrClient constructs valid buy plan and calculates quotes", async () => {
  const client = new NorrClient(DUMMY_PROGRAMS, mockDeriver);
  const state = { virtualBase: 1000000n, baseReserve: 0n, tokenReserve: 10000000000n, feeBps: 30 };
  const quote = client.quoteBuyTrade(state, 100000n);
  assert.ok(quote.tokensOut > 0n);
  assert.equal(quote.fee, 300n);

  const plan = await client.buildBuyPlan({
    user: "User11111111111111111111111111111111111111",
    projectMint: new Uint8Array(32).fill(1),
    userBaseToken: "UBT111111111111111111111111111111111111111",
    userProjectToken: "UPT111111111111111111111111111111111111111",
    routerVault: "RV1111111111111111111111111111111111111111",
    router: "Router111111111111111111111111111111111111",
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    minTokensOut: quote.tokensOut,
    maxBaseIn: 100000n,
  });

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.id, "market-buy");
});
