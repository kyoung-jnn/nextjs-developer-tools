/**
 * Background Script (Service Worker) entry point
 * Handles message routing, state management, and badge updates
 */

import {
  MessageTypes,
  isRouterDetectedMessage,
  isPayloadExtractedMessage,
  isGetPageStateRequest,
  createErrorResponse,
  createRequestDetectionMessage,
  ErrorCodes,
  type PageStateResponse,
  type PageStateUpdatedMessage,
  type RouterDetectedMessage,
  type PayloadExtractedMessage,
} from "@/shared/messages";
import {
  getTabState,
  getOrCreateTabState,
  deleteTabState,
  updatePageState,
  setDevToolsConnected,
  cleanupClosedTabs,
} from "./state";
import { updateBadge, clearBadge } from "./badge";
import { type PageState, type DetectionResult } from "@/shared/types";

// Store connected DevTools ports for broadcasting updates
const connectedPorts = new Map<number, chrome.runtime.Port>();

/**
 * Initialize the background script
 */
const initialize = (): void => {
  console.log("[Next.js DevTools] Background script initialized");

  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(handleMessage);

  // Listen for connections from DevTools panels
  chrome.runtime.onConnect.addListener(handleConnection);

  // Listen for tab activation changes
  chrome.tabs.onActivated.addListener(handleTabActivated);

  // Listen for tab URL changes
  chrome.tabs.onUpdated.addListener(handleTabUpdated);

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(handleTabRemoved);

  // Run initial cleanup
  runPeriodicCleanup().catch(console.error);

  // Set up periodic cleanup (every 5 minutes)
  setInterval(
    () => {
      runPeriodicCleanup().catch(console.error);
    },
    5 * 60 * 1000
  );
};

/**
 * Handle incoming messages from content scripts
 */
const handleMessage = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean => {
  const tabId = sender.tab?.id;

  // Handle GET_PAGE_STATE request (from DevTools - doesn't require sender tab)
  if (isGetPageStateRequest(message)) {
    handleGetPageState(message.tabId, sendResponse);
    return true; // Async response
  }

  // For other messages, require a valid tab ID from sender
  if (!tabId) {
    sendResponse(
      createErrorResponse(ErrorCodes.TAB_NOT_FOUND, "No tab ID in sender")
    );
    return false;
  }

  // Handle ROUTER_DETECTED message
  if (isRouterDetectedMessage(message)) {
    handleRouterDetected(tabId, message.payload);
    sendResponse({ success: true });
    return false;
  }

  // Handle PAYLOAD_EXTRACTED message
  if (isPayloadExtractedMessage(message)) {
    handlePayloadExtracted(tabId, message.payload);
    sendResponse({ success: true });
    return false;
  }

  return false;
};

/**
 * Handle router detection result from content script
 */
const handleRouterDetected = async (
  tabId: number,
  payload: RouterDetectedMessage["payload"]
): Promise<void> => {
  const { routerType, confidence, indicators } = payload;

  // Get current tab state
  const tabState = await getOrCreateTabState(tabId);

  // Get current tab URL
  let url = tabState.pageState?.url ?? "";
  try {
    const tab = await chrome.tabs.get(tabId);
    url = tab.url ?? url;
  } catch {
    // Tab might be closed, use existing URL
  }

  // Create detection result
  const detection: DetectionResult = {
    routerType,
    confidence,
    detectedAt: Date.now(),
    indicators: indicators ?? [],
  };

  // Create updated page state
  const pageState: PageState = {
    url,
    routerType,
    isNextJs: routerType !== "none",
    detection,
    payloads: tabState.pageState?.payloads ?? [],
    lastUpdated: Date.now(),
  };

  // Update tab state with new page state
  await updatePageState(tabId, pageState);

  // Update badge
  await updateBadge(tabId, routerType);

  // Broadcast to connected DevTools
  broadcastPageStateUpdate(tabId, pageState);

  console.log(
    `[Next.js DevTools] Router detected for tab ${tabId}: ${routerType}`
  );
};

/**
 * Handle payload extraction result from content script
 */
const handlePayloadExtracted = async (
  tabId: number,
  payload: PayloadExtractedMessage["payload"]
): Promise<void> => {
  const { entries } = payload;

  if (!entries || entries.length === 0) {
    console.warn("[Next.js DevTools] No payload entries received");
    return;
  }

  // Get current tab state
  const tabState = await getOrCreateTabState(tabId);
  const currentPageState = tabState.pageState;

  if (!currentPageState) {
    console.warn("[Next.js DevTools] No page state found for tab", tabId);
    return;
  }

  // Merge new entries with existing payloads (avoid duplicates by ID)
  const existingIds = new Set(currentPageState.payloads.map((p) => p.id));
  const newEntries = entries.filter((e) => !existingIds.has(e.id));

  // Create updated page state with new payloads
  const updatedPageState: PageState = {
    ...currentPageState,
    payloads: [...currentPageState.payloads, ...newEntries],
    lastUpdated: Date.now(),
  };

  // Update tab state
  await updatePageState(tabId, updatedPageState);

  // Broadcast to connected DevTools
  broadcastPageStateUpdate(tabId, updatedPageState);

  console.log(
    `[Next.js DevTools] Payloads extracted for tab ${tabId}: ${newEntries.length} new entries`
  );
};

/**
 * Handle GET_PAGE_STATE request from DevTools
 */
const handleGetPageState = async (
  tabId: number,
  sendResponse: (response: unknown) => void
): Promise<void> => {
  const tabState = await getTabState(tabId);
  const pageState = tabState?.pageState;

  if (pageState) {
    const response: PageStateResponse = {
      type: MessageTypes.PAGE_STATE,
      payload: pageState,
    };
    sendResponse(response);
  } else {
    sendResponse(
      createErrorResponse(ErrorCodes.TAB_NOT_FOUND, `No state for tab ${tabId}`)
    );
  }
};

/**
 * Handle DevTools panel connection
 */
const handleConnection = (port: chrome.runtime.Port): void => {
  if (port.name.startsWith("devtools-")) {
    const tabId = parseInt(port.name.replace("devtools-", ""), 10);

    if (!isNaN(tabId)) {
      connectedPorts.set(tabId, port);
      console.log(`[Next.js DevTools] DevTools connected for tab ${tabId}`);

      // Mark DevTools as connected in tab state
      setDevToolsConnected(tabId, true).catch(console.error);

      port.onDisconnect.addListener(() => {
        connectedPorts.delete(tabId);
        setDevToolsConnected(tabId, false).catch(console.error);
        console.log(
          `[Next.js DevTools] DevTools disconnected for tab ${tabId}`
        );
      });

      // Send current state immediately
      getTabState(tabId).then((tabState) => {
        const pageState = tabState?.pageState;
        if (pageState) {
          const message: PageStateUpdatedMessage = {
            type: MessageTypes.PAGE_STATE_UPDATED,
            payload: pageState,
          };
          port.postMessage(message);
        }
      });
    }
  }
};

/**
 * Broadcast page state update to connected DevTools
 */
const broadcastPageStateUpdate = (tabId: number, state: PageState): void => {
  const port = connectedPorts.get(tabId);
  if (port) {
    const message: PageStateUpdatedMessage = {
      type: MessageTypes.PAGE_STATE_UPDATED,
      payload: state,
    };
    port.postMessage(message);
  }
};

/**
 * Handle tab activation - request detection on the active tab
 */
const handleTabActivated = async (
  activeInfo: chrome.tabs.TabActiveInfo
): Promise<void> => {
  const { tabId } = activeInfo;

  // Check if we have state for this tab
  const tabState = await getTabState(tabId);
  const pageState = tabState?.pageState;

  if (pageState?.detection) {
    // Update badge for existing state
    await updateBadge(tabId, pageState.detection.routerType);
  } else {
    // Clear badge and request detection
    await clearBadge(tabId);
    requestDetection(tabId);
  }
};

/**
 * Handle tab URL update - request re-detection
 */
const handleTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo
): Promise<void> => {
  // Only trigger on complete load with URL change
  if (changeInfo.status === "complete" && changeInfo.url) {
    requestDetection(tabId);
  }
};

/**
 * Handle tab removal - clean up state
 */
const handleTabRemoved = async (tabId: number): Promise<void> => {
  // Remove state for closed tab
  await deleteTabState(tabId);
  connectedPorts.delete(tabId);
  console.log(`[Next.js DevTools] Tab ${tabId} removed, state cleaned up`);
};

/**
 * Send detection request to content script
 */
const requestDetection = (tabId: number): void => {
  const message = createRequestDetectionMessage();
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Content script may not be loaded yet, ignore error
  });
};

/**
 * Periodic cleanup of closed tabs
 */
const runPeriodicCleanup = async (): Promise<void> => {
  const cleanedCount = await cleanupClosedTabs();
  if (cleanedCount > 0) {
    console.log(
      `[Next.js DevTools] Cleaned up ${cleanedCount} closed tab states`
    );
  }
};

// Initialize on service worker startup
initialize();
