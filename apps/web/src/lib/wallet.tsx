import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type WalletState = Readonly<{
  connected: boolean;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction?: (tx: any) => Promise<any>;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
}>;

const defaultWallet: WalletState = {
  connected: false,
  publicKey: null,
  connect: async () => {},
  disconnect: async () => {},
};

const WalletContext = createContext<WalletState>(defaultWallet);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = async () => {
    if (typeof window !== "undefined" && (window as any).solana) {
      try {
        const resp = await (window as any).solana.connect();
        const pk = resp.publicKey ? resp.publicKey.toString() : "ConnectedWallet11111111111111111111111111";
        setPublicKey(pk);
        setConnected(true);
      } catch {
        // User rejected or canceled
      }
    } else {
      // Fallback sandbox/mock connection for local testing
      setPublicKey("DemoWallet11111111111111111111111111111111111");
      setConnected(true);
    }
  };

  const disconnect = async () => {
    if (typeof window !== "undefined" && (window as any).solana) {
      await (window as any).solana.disconnect();
    }
    setPublicKey(null);
    setConnected(false);
  };

  return (
    <WalletContext.Provider value={{ connected, publicKey, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
