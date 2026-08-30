import { createPdaRegistry, type ProgramAddresses } from "./pda.js";
import {
  buildMarketBuyInstruction,
  buildMarketSellInstruction,
  buildSocialPostInstruction,
  type Instruction,
} from "./instructions.js";
import { TransactionPlan, type TransactionPlanStep } from "./tx.js";
import { quoteBuy, quoteSell } from "./math.js";

export type CurveStateInput = Readonly<{
  virtualBase: bigint;
  baseReserve: bigint;
  tokenReserve: bigint;
  feeBps: number;
}>;

export class NorrClient {
  readonly pdas: ReturnType<typeof createPdaRegistry>;

  constructor(
    readonly programs: ProgramAddresses,
    readonly derivePda: (programAddress: string, seeds: readonly Uint8Array[]) => Promise<{ address: string; bump: number }>
  ) {
    this.pdas = createPdaRegistry(programs, derivePda);
  }

  quoteBuyTrade(state: CurveStateInput, baseIn: bigint) {
    return quoteBuy({ ...state, baseIn });
  }

  quoteSellTrade(state: CurveStateInput, tokensIn: bigint) {
    return quoteSell({ ...state, tokensIn });
  }

  async buildBuyPlan(params: {
    user: string;
    projectMint: Uint8Array;
    userBaseToken: string;
    userProjectToken: string;
    routerVault: string;
    router: string;
    tokenProgram: string;
    minTokensOut: bigint;
    maxBaseIn: bigint;
  }): Promise<TransactionPlan<Instruction>> {
    const curve = await this.pdas.curve(params.projectMint);
    const baseVault = await this.pdas.curveBaseVault(params.projectMint);
    const tokenVault = await this.pdas.curveTokenVault(params.projectMint);

    const ix = buildMarketBuyInstruction(
      this.programs.market,
      {
        user: params.user,
        curve: curve.address,
        userBaseToken: params.userBaseToken,
        userProjectToken: params.userProjectToken,
        baseVault: baseVault.address,
        tokenVault: tokenVault.address,
        routerVault: params.routerVault,
        router: params.router,
        tokenProgram: params.tokenProgram,
      },
      params.minTokensOut,
      params.maxBaseIn
    );

    const step: TransactionPlanStep<Instruction> = {
      id: "market-buy",
      label: "Buy tokens from curve",
      instructions: [ix],
    };

    return new TransactionPlan([step]);
  }

  async buildSellPlan(params: {
    user: string;
    projectMint: Uint8Array;
    userBaseToken: string;
    userProjectToken: string;
    routerVault: string;
    router: string;
    tokenProgram: string;
    tokensIn: bigint;
    minBaseOut: bigint;
  }): Promise<TransactionPlan<Instruction>> {
    const curve = await this.pdas.curve(params.projectMint);
    const baseVault = await this.pdas.curveBaseVault(params.projectMint);
    const tokenVault = await this.pdas.curveTokenVault(params.projectMint);

    const ix = buildMarketSellInstruction(
      this.programs.market,
      {
        user: params.user,
        curve: curve.address,
        userBaseToken: params.userBaseToken,
        userProjectToken: params.userProjectToken,
        baseVault: baseVault.address,
        tokenVault: tokenVault.address,
        routerVault: params.routerVault,
        router: params.router,
        tokenProgram: params.tokenProgram,
      },
      params.tokensIn,
      params.minBaseOut
    );

    const step: TransactionPlanStep<Instruction> = {
      id: "market-sell",
      label: "Sell tokens to curve",
      instructions: [ix],
    };

    return new TransactionPlan([step]);
  }

  async buildPostCommentPlan(params: {
    author: string;
    subject: Uint8Array;
    authorWallet: Uint8Array;
    commentIndex: number;
    body: string;
    parentIndex?: number;
    systemProgram: string;
  }): Promise<TransactionPlan<Instruction>> {
    const thread = await this.pdas.thread(params.subject);
    const comment = await this.pdas.comment(params.subject, params.commentIndex);
    const profile = await this.pdas.profile(params.authorWallet);

    const ix = buildSocialPostInstruction(
      this.programs.social,
      {
        author: params.author,
        thread: thread.address,
        comment: comment.address,
        profile: profile.address,
        systemProgram: params.systemProgram,
      },
      params.body,
      params.parentIndex ?? 0
    );

    const step: TransactionPlanStep<Instruction> = {
      id: "social-post",
      label: "Post comment on thread",
      instructions: [ix],
    };

    return new TransactionPlan([step]);
  }
}
