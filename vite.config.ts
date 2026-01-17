import { defineConfig } from "vite";
import { resolve } from "path";
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "fs";

// Plugin to copy static files after build
const copyStaticFiles = () => ({
  name: "copy-static-files",
  closeBundle() {
    // Ensure directories exist
    const dirs = ["dist/devtools", "dist/assets/icons"];
    dirs.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    // Copy manifest
    copyFileSync("src/manifest.json", "dist/manifest.json");

    // Copy HTML files
    copyFileSync("src/devtools/devtools.html", "dist/devtools/devtools.html");

    // Copy and modify panel.html to include CSS
    let panelHtml = readFileSync("src/devtools/panel.html", "utf-8");

    // Find the generated CSS file
    const assetsDir = "dist/assets";
    let cssFileName = "panel.css";
    if (existsSync(assetsDir)) {
      const files = readdirSync(assetsDir);
      const cssFile = files.find((f: string) => f.endsWith(".css"));
      if (cssFile) {
        cssFileName = cssFile;
      }
    }

    // Add CSS link and fix JS path
    panelHtml = panelHtml.replace(
      "</head>",
      `  <link rel="stylesheet" href="../assets/${cssFileName}" />\n  </head>`
    );
    panelHtml = panelHtml.replace(
      'src="./panel.ts"',
      'src="../panel/index.js"'
    );

    writeFileSync("dist/devtools/panel.html", panelHtml);

    // Copy icons
    const iconSizes = ["16", "48", "128"];
    iconSizes.forEach((size) => {
      const src = `assets/icons/icon${size}.png`;
      const dest = `dist/assets/icons/icon${size}.png`;
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    });

    console.log("Static files copied to dist/");
  },
});

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
        devtools: resolve(__dirname, "src/devtools/devtools.ts"),
        panel: resolve(__dirname, "src/devtools/panel.ts"),
      },
      output: {
        entryFileNames: "[name]/index.js",
        chunkFileNames: "shared/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
    sourcemap: process.env.NODE_ENV === "development",
    minify: "esbuild",
    target: "es2020",
    cssCodeSplit: true,
  },
  plugins: [copyStaticFiles()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  css: {
    postcss: "./postcss.config.js",
  },
});
