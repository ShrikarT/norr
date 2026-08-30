import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const allowAllHosts = process.env.NORR_DEV_ALLOW_HOSTS === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      buffer: require.resolve("buffer/"),
    },
  },
  define: {
    "process.env": {},
  },
  build: { target: "es2022", sourcemap: true },
  ...(allowAllHosts ? { server: { allowedHosts: true as const }, preview: { allowedHosts: true as const } } : {}),
});
