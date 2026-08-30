import { Buffer } from "buffer";
// @solana/web3.js expects a Node-style Buffer global in the browser.
if (typeof (globalThis as { Buffer?: unknown }).Buffer === "undefined") {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ClusterProvider } from "./lib/status";
import { ToastProvider } from "./components/toast-context";
import { WalletContextProvider } from "./components/WalletContextProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletContextProvider>
        <ClusterProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ClusterProvider>
      </WalletContextProvider>
    </BrowserRouter>
  </StrictMode>
);
