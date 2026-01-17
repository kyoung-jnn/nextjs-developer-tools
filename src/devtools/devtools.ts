/**
 * DevTools page entry point
 * Creates the "Next.js Payload" panel in Chrome DevTools
 */

// Create the DevTools panel
chrome.devtools.panels.create(
  "Next.js Payload", // Panel title
  "", // Icon path (empty for default)
  "devtools/panel.html", // Panel HTML page
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
