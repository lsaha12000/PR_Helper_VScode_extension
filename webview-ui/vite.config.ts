import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "../extension/dist/webview"),
    emptyOutDir: true,
  },
  base: "./",
});
