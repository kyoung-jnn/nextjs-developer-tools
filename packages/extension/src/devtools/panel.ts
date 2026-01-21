/**
 * DevTools Panel entry point
 * Manages panel state and UI rendering
 */

import "@/globals.css";
import { MessageTypes } from "@/shared/messages";
import type { PageState, FilterState } from "@/shared/types";
import { applyFilterAndSort } from "@/shared/parser";
import { FilterBar } from "./components/FilterBar";
import { PayloadList } from "./components/PayloadList";
import { DetailPanel } from "./components/DetailPanel";
import {
  getPanelStore,
  setFilter,
  setSelectedEntryIndex,
  setEntries,
  setFilteredEntries,
  setLoading,
  updatePanelState,
  setFilterBar,
  setPayloadList,
  setDetailPanel,
  setPort,
  getComponents,
} from "./panel-state";

/**
 * Initialize the panel
 */
const initialize = (): void => {
  console.log("[Next.js DevTools] Panel initialized");

  // Get current tab ID
  const tabId = chrome.devtools.inspectedWindow.tabId;

  // Initialize loading state
  setLoading(true);

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
  const newPort = chrome.runtime.connect({ name: `devtools-${tabId}` });
  setPort(newPort);

  newPort.onMessage.addListener((message) => {
    if (message.type === MessageTypes.PAGE_STATE_UPDATED) {
      handlePageStateUpdate(message.payload as PageState);
    }
  });

  newPort.onDisconnect.addListener(() => {
    console.log("[Next.js DevTools] Disconnected from background");
    setPort(null);

    // Try to reconnect after a delay
    setTimeout(() => {
      const { port } = getComponents();
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
  updatePanelState({ isLoading: true, errorMessage: null });
  showLoadingState();

  chrome.runtime.sendMessage(
    { type: MessageTypes.GET_PAGE_STATE, tabId },
    (response) => {
      setLoading(false);
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

  const { payloadList } = getComponents();

  // Check if this is a Next.js page
  if (!state.isNextJs) {
    showEmptyState(
      "Not a Next.js page",
      "Navigate to a Next.js application to see SSR data"
    );
    setEntries([]);
    setFilteredEntries([]);
    if (payloadList) {
      payloadList.setEntries([]);
    }
    updateStatusBar(state);
    return;
  }

  // Get payloads from state
  const newEntries = state.payloads ?? [];
  setEntries(newEntries);

  // Show empty state if no entries
  if (newEntries.length === 0) {
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
  setFilter(filter);
  applyFiltersAndSort();
};

/**
 * Handle entry selection from PayloadList
 */
const handleEntrySelect = (index: number): void => {
  setSelectedEntryIndex(index);

  const panelState = getPanelStore().getState();
  const entry = panelState.filteredEntries[index] || null;
  const { detailPanel, payloadList } = getComponents();

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
  const panelState = getPanelStore().getState();
  const { payloadList, detailPanel } = getComponents();

  // Apply filter and sort
  const newFilteredEntries = applyFilterAndSort(
    panelState.entries,
    panelState.currentFilter
  );
  setFilteredEntries(newFilteredEntries);

  // Update PayloadList
  if (payloadList) {
    payloadList.setEntries(newFilteredEntries);
  }

  // Clear selection if filtered out
  if (panelState.selectedEntryIndex >= newFilteredEntries.length) {
    setSelectedEntryIndex(-1);
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

  const panelState = getPanelStore().getState();
  const routerType =
    state.detection.routerType === "app" ? "App Router" : "Page Router";
  const entryCount = panelState.entries.length;
  const filteredCount = panelState.filteredEntries.length;

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
  updatePanelState({ errorMessage: message, isLoading: false });

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
 * Show loading state overlay with skeleton UI
 */
const showLoadingState = (): void => {
  let overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.className = "fixed inset-0 flex flex-col bg-devtools-primary z-50";
    overlay.innerHTML = `
      <!-- Skeleton header -->
      <div class="bg-devtools-secondary border-b border-devtools-subtle px-2 py-2">
        <div class="flex items-center gap-3">
          <div class="skeleton-devtools h-6 w-24 rounded"></div>
          <div class="skeleton-devtools h-6 flex-1 rounded"></div>
          <div class="skeleton-devtools h-6 w-20 rounded"></div>
        </div>
      </div>

      <!-- Skeleton content -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left pane skeleton -->
        <div class="flex-1 border-r border-devtools-subtle p-2 space-y-2">
          <div class="skeleton-devtools h-8 w-full rounded"></div>
          <div class="skeleton-devtools h-8 w-full rounded"></div>
          <div class="skeleton-devtools h-8 w-3/4 rounded"></div>
          <div class="skeleton-devtools h-8 w-5/6 rounded"></div>
          <div class="skeleton-devtools h-8 w-2/3 rounded"></div>
        </div>

        <!-- Right pane skeleton -->
        <div class="flex-1 p-2 space-y-2">
          <div class="flex gap-2 border-b border-devtools-subtle pb-2">
            <div class="skeleton-devtools h-6 w-16 rounded"></div>
            <div class="skeleton-devtools h-6 w-16 rounded"></div>
            <div class="skeleton-devtools h-6 w-16 rounded"></div>
          </div>
          <div class="skeleton-devtools h-4 w-full rounded"></div>
          <div class="skeleton-devtools h-4 w-5/6 rounded"></div>
          <div class="skeleton-devtools h-4 w-4/5 rounded"></div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div class="absolute inset-0 flex items-center justify-center bg-devtools-primary/80">
        <div class="flex flex-col items-center gap-3">
          <span class="loading loading-spinner loading-lg text-devtools-accent-blue"></span>
          <p class="text-sm text-devtools-muted">Detecting Next.js...</p>
        </div>
      </div>
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

  // SVG icon for empty state
  const icon = title.includes("Not a Next.js")
    ? `<svg class="w-12 h-12 text-devtools-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
      </svg>`
    : title.includes("Waiting")
      ? `<svg class="w-12 h-12 text-devtools-text-muted animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>`
      : `<svg class="w-12 h-12 text-devtools-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>`;

  emptyState.innerHTML = `
    <div class="flex flex-col items-center gap-3 p-6 rounded-lg bg-devtools-secondary/50">
      ${icon}
      <div class="space-y-1">
        <p class="text-sm font-medium text-devtools-text-secondary">${title}</p>
        <p class="text-xs text-devtools-text-muted">${hint}</p>
      </div>
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
 * Regions for keyboard navigation focus management
 */
const FOCUSABLE_REGIONS = [
  "#filter-bar",
  "#payload-list",
  "#detail-panel",
] as const;

/**
 * Setup keyboard navigation
 */
const setupKeyboardNavigation = (): void => {
  // Track current focused region index
  let currentRegionIndex = 1; // Start with payload list

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    const { payloadList } = getComponents();
    const panelState = getPanelStore().getState();
    const { filteredEntries, selectedEntryIndex } = panelState;

    const target = event.target as HTMLElement;
    const isInInput =
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.tagName === "TEXTAREA";

    // Handle F6 for region navigation (standard DevTools shortcut)
    if (event.key === "F6") {
      event.preventDefault();
      currentRegionIndex = event.shiftKey
        ? (currentRegionIndex - 1 + FOCUSABLE_REGIONS.length) %
          FOCUSABLE_REGIONS.length
        : (currentRegionIndex + 1) % FOCUSABLE_REGIONS.length;

      const region = document.querySelector(
        FOCUSABLE_REGIONS[currentRegionIndex]
      );
      if (region) {
        // Focus the first focusable element in the region
        const focusable = region.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          (region as HTMLElement).focus();
        }
        // Announce region change for screen readers
        announceToScreenReader(
          `Moved to ${region.getAttribute("aria-label") || "region"}`
        );
      }
      return;
    }

    // Don't intercept list navigation if user is in an input field
    if (isInInput) {
      return;
    }

    // Only handle list navigation if payloadList exists and we have entries
    if (!payloadList || filteredEntries.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
      case "j": // Vim-style navigation
        event.preventDefault();
        if (selectedEntryIndex < filteredEntries.length - 1) {
          handleEntrySelect(selectedEntryIndex + 1);
          scrollToSelectedEntry();
        }
        break;

      case "ArrowUp":
      case "k": // Vim-style navigation
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
      case " ": // Space key for selection
        // Could be used to expand/collapse in detail panel
        break;

      case "/": {
        // Quick search shortcut
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          '#filter-bar input[type="text"]'
        );
        if (searchInput) {
          searchInput.focus();
        }
        break;
      }
    }
  });
};

/**
 * Announce message to screen readers via live region
 */
const announceToScreenReader = (message: string): void => {
  let announcer = document.getElementById("sr-announcer");
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "sr-announcer";
    announcer.setAttribute("role", "status");
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    announcer.className = "sr-only";
    announcer.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0";
    document.body.appendChild(announcer);
  }
  // Clear and set to trigger announcement
  announcer.textContent = "";
  setTimeout(() => {
    announcer!.textContent = message;
  }, 50);
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
  const panelState = getPanelStore().getState();

  // Initialize FilterBar
  const filterBarContainer = document.getElementById("filter-bar");
  if (filterBarContainer) {
    const newFilterBar = new FilterBar(filterBarContainer, handleFilterChange);
    newFilterBar.setFilter(panelState.currentFilter);
    setFilterBar(newFilterBar);
  }

  // Initialize PayloadList
  const payloadListContainer = document.getElementById("payload-list");
  if (payloadListContainer) {
    const newPayloadList = new PayloadList(
      payloadListContainer,
      handleEntrySelect
    );
    newPayloadList.setEntries(panelState.filteredEntries);
    setPayloadList(newPayloadList);
  }

  // Initialize DetailPanel
  const detailPanelContainer = document.getElementById("detail-panel");
  if (detailPanelContainer) {
    const newDetailPanel = new DetailPanel(detailPanelContainer);
    setDetailPanel(newDetailPanel);
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
