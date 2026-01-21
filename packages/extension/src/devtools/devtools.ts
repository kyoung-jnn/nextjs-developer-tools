/**
 * DevTools page entry point
 * Creates the "Next.js Payload" panel in Chrome DevTools
 */

// Create the DevTools panel
chrome.devtools.panels.create(
  "Payload", // Panel title
  "/icon-48.png", // Icon path (from public folder)
  "src/devtools/panel.html", // Panel HTML page
  (panel) => {
    console.log("[Next.js DevTools] DevTools panel created");

    // Optional: Handle panel show/hide events
    panel.onShown.addListener(() => {
      console.log("[Next.js DevTools] Panel shown");
    });

    panel.onHidden.addListener(() => {
      console.log("[Next.js DevTools] Panel hidden");
    });
  }
);
