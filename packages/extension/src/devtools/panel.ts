/**
 * DevTools Panel entry point
 * Manages panel state and UI rendering
 */

import "@/globals.css";
import { MessageTypes } from "@/shared/messages";
import type { PageState, FilterState, PayloadEntry } from "@/shared/types";
import { DEFAULT_FILTER_STATE } from "@/shared/types";
import { applyFilterAndSort } from "@/shared/parser";
import { FilterBar } from "./components/FilterBar";
import { PayloadList } from "./components/PayloadList";
import { DetailPanel } from "./components/DetailPanel";

// Panel state
let currentFilter: FilterState = { ...DEFAULT_FILTER_STATE };
let selectedEntryIndex = -1;
let entries: PayloadEntry[] = [];
let filteredEntries: PayloadEntry[] = [];

// UI state flags (used by state functions)

let _isLoading = true;

let _errorMessage: string | null = null;

// Component instances
let filterBar: FilterBar | null = null;
let payloadList: PayloadList | null = null;
let detailPanel: DetailPanel | null = null;

// Port for background script communication
let port: chrome.runtime.Port | null = null;

/**
 * Initialize the panel
 */
const initialize = (): void => {
  console.log("[Next.js DevTools] Panel initialized");

  // Get current tab ID
  const tabId = chrome.devtools.inspectedWindow.tabId;

  // Show loading state
  showLoadingState();

  // Connect to background script
  connectToBackground(tabId);

  // Initialize UI components
  initializeComponents();

  // Setup keyboard navigation
  setupKeyboardNavigation();

  // Request initial state
  requestPageState(tabId);
};

/**
 * Connect to background script via port
 */
const connectToBackground = (tabId: number): void => {
  port = chrome.runtime.connect({ name: `devtools-${tabId}` });

  port.onMessage.addListener((message) => {
    if (message.type === MessageTypes.PAGE_STATE_UPDATED) {
      handlePageStateUpdate(message.payload as PageState);
    }
  });

  port.onDisconnect.addListener(() => {
    console.log("[Next.js DevTools] Disconnected from background");
    port = null;

    // Try to reconnect after a delay
    setTimeout(() => {
      if (!port) {
        connectToBackground(tabId);
      }
    }, 1000);
  });
};

/**
 * Request current page state from background
 */
const requestPageState = (tabId: number): void => {
  _isLoading = true;
  _errorMessage = null;
  showLoadingState();

  chrome.runtime.sendMessage(
    { type: MessageTypes.GET_PAGE_STATE, tabId },
    (response) => {
      _isLoading = false;
      hideLoadingState();

      if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError.message || "Connection error");
        return;
      }

      if (response?.type === MessageTypes.PAGE_STATE) {
        handlePageStateUpdate(response.payload as PageState);
      } else if (response?.type === MessageTypes.ERROR) {
        handleError(response.error.message);
      } else {
        // No state yet - show empty state
        showEmptyState(
          "Waiting for Next.js page...",
          "Navigate to a Next.js page to see SSR data"
        );
      }
    }
  );
};

/**
 * Handle page state update from background
 */
const handlePageStateUpdate = (state: PageState): void => {
  console.log("[Next.js DevTools] State update:", state);

  hideLoadingState();
  hideErrorState();

  // Check if this is a Next.js page
  if (!state.isNextJs) {
    showEmptyState(
      "Not a Next.js page",
      "Navigate to a Next.js application to see SSR data"
    );
    entries = [];
    filteredEntries = [];
    if (payloadList) {
      payloadList.setEntries([]);
    }
    updateStatusBar(state);
    return;
  }

  // Get payloads from state
  entries = state.payloads ?? [];

  // Show empty state if no entries
  if (entries.length === 0) {
    showEmptyState(
      "No SSR payload detected",
      "This page may be using client-side rendering"
    );
  } else {
    hideEmptyState();
  }

  // Apply filters and sorting
  applyFiltersAndSort();

  // Update status bar
  updateStatusBar(state);
};

/**
 * Handle filter change from FilterBar
 */
const handleFilterChange = (filter: FilterState): void => {
  currentFilter = filter;
  applyFiltersAndSort();
};

/**
 * Handle entry selection from PayloadList
 */
const handleEntrySelect = (index: number): void => {
  selectedEntryIndex = index;
  const entry = filteredEntries[index] || null;

  if (detailPanel) {
    detailPanel.setEntry(entry);
  }

  if (payloadList) {
    payloadList.setSelectedIndex(index);
  }
};

/**
 * Apply current filters and sorting to entries
 */
const applyFiltersAndSort = (): void => {
  // Apply filter and sort
  filteredEntries = applyFilterAndSort(entries, currentFilter);

  // Update PayloadList
  if (payloadList) {
    payloadList.setEntries(filteredEntries);
  }

  // Clear selection if filtered out
  if (selectedEntryIndex >= filteredEntries.length) {
    selectedEntryIndex = -1;
    if (detailPanel) {
      detailPanel.setEntry(null);
    }
  }
};

/**
 * Update the status bar with current state
 */
const updateStatusBar = (state: PageState): void => {
  const statusBar = document.getElementById("status-bar");
  if (!statusBar) return;

  const statusText = statusBar.querySelector(".status-text");
  if (!statusText) return;

  if (!state.isNextJs) {
    statusText.textContent = "Not a Next.js page";
    return;
  }

  const routerType =
    state.detection.routerType === "app" ? "App Router" : "Page Router";
  const entryCount = entries.length;
  const filteredCount = filteredEntries.length;

  if (entryCount === 0) {
    statusText.textContent = `${routerType} - No SSR payload`;
  } else if (filteredCount === entryCount) {
    statusText.textContent = `${routerType} - ${entryCount} item${
      entryCount !== 1 ? "s" : ""
    }`;
  } else {
    statusText.textContent = `${routerType} - ${filteredCount} of ${entryCount} items`;
  }
};

/**
 * Handle error
 */
const handleError = (message: string): void => {
  console.error("[Next.js DevTools] Error:", message);
  _errorMessage = message;
  _isLoading = false;

  hideLoadingState();
  showErrorState(message);

  const statusBar = document.getElementById("status-bar");
  if (statusBar) {
    const statusText = statusBar.querySelector(".status-text");
    if (statusText) {
      statusText.textContent = `Error: ${message}`;
    }
  }
};

/**
 * Show loading state overlay
 */
const showLoadingState = (): void => {
  let overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.className =
      "fixed inset-0 flex flex-col items-center justify-center bg-base-100/90 z-50";
    overlay.innerHTML = `
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="mt-3 text-sm text-base-content/60">Detecting Next.js...</p>
    `;
    document.body.appendChild(overlay);
  }
  overlay.classList.remove("hidden");
};

/**
 * Hide loading state overlay
 */
const hideLoadingState = (): void => {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
};

/**
 * Show empty state message
 */
const showEmptyState = (title: string, hint: string): void => {
  let emptyState = document.getElementById("empty-state-overlay");
  if (!emptyState) {
    emptyState = document.createElement("div");
    emptyState.id = "empty-state-overlay";
    emptyState.className =
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[300px] text-center";

    const payloadSection = document.querySelector(
      ".payload-list-section, section:first-of-type"
    );
    if (payloadSection) {
      payloadSection.appendChild(emptyState);
    }
  }

  emptyState.innerHTML = `
    <div class="flex flex-col items-center">
      <div class="text-5xl mb-3 opacity-50">📦</div>
      <p class="text-sm font-medium mb-1">${title}</p>
      <p class="text-xs text-base-content/50">${hint}</p>
    </div>
  `;
  emptyState.classList.remove("hidden");
};

/**
 * Hide empty state message
 */
const hideEmptyState = (): void => {
  const emptyState = document.getElementById("empty-state-overlay");
  if (emptyState) {
    emptyState.classList.add("hidden");
  }
};

/**
 * Show error state with retry button
 */
const showErrorState = (message: string): void => {
  let errorOverlay = document.getElementById("error-overlay");
  if (!errorOverlay) {
    errorOverlay = document.createElement("div");
    errorOverlay.id = "error-overlay";
    errorOverlay.className =
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[300px] text-center";

    const payloadSection = document.querySelector(
      ".payload-list-section, section:first-of-type"
    );
    if (payloadSection) {
      payloadSection.appendChild(errorOverlay);
    }
  }

  errorOverlay.innerHTML = `
    <div class="alert alert-error flex-col gap-2">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm font-medium">Error</span>
      </div>
      <p class="text-xs break-words">${message}</p>
      <button id="retry-btn" class="btn btn-sm btn-outline">Retry</button>
    </div>
  `;
  errorOverlay.classList.remove("hidden");

  // Attach retry handler
  const retryBtn = document.getElementById("retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      hideErrorState();
      requestPageState(tabId);
    });
  }
};

/**
 * Hide error state
 */
const hideErrorState = (): void => {
  const errorOverlay = document.getElementById("error-overlay");
  if (errorOverlay) {
    errorOverlay.classList.add("hidden");
  }
};

/**
 * Setup keyboard navigation
 */
const setupKeyboardNavigation = (): void => {
  document.addEventListener("keydown", (event: KeyboardEvent) => {
    // Only handle navigation if payloadList exists and we have entries
    if (!payloadList || filteredEntries.length === 0) return;

    // Don't intercept if user is in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.tagName === "TEXTAREA"
    ) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (selectedEntryIndex < filteredEntries.length - 1) {
          handleEntrySelect(selectedEntryIndex + 1);
          scrollToSelectedEntry();
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (selectedEntryIndex > 0) {
          handleEntrySelect(selectedEntryIndex - 1);
          scrollToSelectedEntry();
        } else if (selectedEntryIndex === -1 && filteredEntries.length > 0) {
          handleEntrySelect(0);
          scrollToSelectedEntry();
        }
        break;

      case "Home":
        event.preventDefault();
        if (filteredEntries.length > 0) {
          handleEntrySelect(0);
          scrollToSelectedEntry();
        }
        break;

      case "End":
        event.preventDefault();
        if (filteredEntries.length > 0) {
          handleEntrySelect(filteredEntries.length - 1);
          scrollToSelectedEntry();
        }
        break;

      case "Enter":
        // Could be used to expand/collapse in detail panel
        break;
    }
  });
};

/**
 * Scroll to ensure selected entry is visible
 */
const scrollToSelectedEntry = (): void => {
  const selectedRow = document.querySelector(".payload-row.bg-primary\\/20");
  if (selectedRow) {
    selectedRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

/**
 * Initialize UI components
 */
const initializeComponents = (): void => {
  // Initialize FilterBar
  const filterBarContainer = document.getElementById("filter-bar");
  if (filterBarContainer) {
    filterBar = new FilterBar(filterBarContainer, handleFilterChange);
    filterBar.setFilter(currentFilter);
  }

  // Initialize PayloadList
  const payloadListContainer = document.getElementById("payload-list");
  if (payloadListContainer) {
    payloadList = new PayloadList(payloadListContainer, handleEntrySelect);
    payloadList.setEntries(filteredEntries);
  }

  // Initialize DetailPanel
  const detailPanelContainer = document.getElementById("detail-panel");
  if (detailPanelContainer) {
    detailPanel = new DetailPanel(detailPanelContainer);
  }
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Export for potential extension
export { handleFilterChange, handleEntrySelect, handlePageStateUpdate };
