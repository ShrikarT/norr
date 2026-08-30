import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// NORR_DEV_ALLOW_HOSTS=1 relaxes the dev/preview host check for tunneled
// environments (sandboxes, ngrok). Never affects the production bundle.
const allowAllHosts = process.env.NORR_DEV_ALLOW_HOSTS === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: "es2022", sourcemap: true },
  ...(allowAllHosts ? { server: { allowedHosts: true as const }, preview: { allowedHosts: true as const } } : {}),
});
