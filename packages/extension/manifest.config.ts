import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Next.js Developer Tools",
  version: packageJson.version,
  description:
    "Detect Next.js router type and view SSR payloads in Chrome DevTools",
  icons: {
    "16": "icon-16.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
  action: {
    default_icon: {
      "16": "icon-gray-16.png",
      "48": "icon-gray-48.png",
      "128": "icon-gray-128.png",
    },
    default_title: "Next.js Developer Tools",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  devtools_page: "src/devtools/devtools.html",
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: ["<all_urls>"],
  web_accessible_resources: [
    {
      resources: [
        "icon-16.png",
        "icon-48.png",
        "icon-128.png",
        "icon-gray-16.png",
        "icon-gray-48.png",
        "icon-gray-128.png",
      ],
      matches: ["<all_urls>"],
    },
  ],
  minimum_chrome_version: "88",
});
