import { type ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { getRpcUrl } from "../lib/config";
import "@solana/wallet-adapter-react-ui/styles.css";

/** Wallet Standard wallets (Phantom, Solflare, Backpack, …) register
 *  themselves — an empty adapter list is intentional. */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getRpcUrl(), []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
