import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [crx({ manifest })],
  base: "",
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  css: {
    postcss: "./postcss.config.js",
  },
  build: {
    sourcemap: process.env.NODE_ENV === "development",
    minify: "esbuild",
    target: "es2020",
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "src/devtools/devtools.html"),
        panel: resolve(__dirname, "src/devtools/panel.html"),
      },
    },
  },
});
