/**
 * Chrome Extension messaging contracts
 * Based on contracts/messaging.md specification
 */

import type { RouterType, PageState, PayloadEntry } from "./types";

// Message type constants
export const MessageTypes = {
  // Content Script → Background Script
  ROUTER_DETECTED: "ROUTER_DETECTED",
  PAYLOAD_EXTRACTED: "PAYLOAD_EXTRACTED",

  // Background Script → Content Script
  REQUEST_DETECTION: "REQUEST_DETECTION",

  // DevTools Panel ↔ Background Script
  GET_PAGE_STATE: "GET_PAGE_STATE",
  PAGE_STATE: "PAGE_STATE",
  PAGE_STATE_UPDATED: "PAGE_STATE_UPDATED",

  // Error response
  ERROR: "ERROR",
} as const;

export type MessageType = (typeof MessageTypes)[keyof typeof MessageTypes];

// Error codes
export const ErrorCodes = {
  TAB_NOT_FOUND: "TAB_NOT_FOUND",
  PARSE_ERROR: "PARSE_ERROR",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Content Script → Background Script: Router detected
 */
export interface RouterDetectedMessage {
  type: typeof MessageTypes.ROUTER_DETECTED;
  payload: {
    routerType: RouterType;
    confidence: number;
    indicators: string[];
  };
}

/**
 * Content Script → Background Script: Payload extracted
 */
export interface PayloadExtractedMessage {
  type: typeof MessageTypes.PAYLOAD_EXTRACTED;
  payload: {
    entries: PayloadEntry[];
    extractedAt: number;
  };
}

/**
 * Background Script → Content Script: Request detection
 */
export interface RequestDetectionMessage {
  type: typeof MessageTypes.REQUEST_DETECTION;
}

/**
 * DevTools Panel → Background Script: Get page state request
 */
export interface GetPageStateRequest {
  type: typeof MessageTypes.GET_PAGE_STATE;
  tabId: number;
}

/**
 * Background Script → DevTools Panel: Page state response
 */
export interface PageStateResponse {
  type: typeof MessageTypes.PAGE_STATE;
  payload: PageState;
}

/**
 * Background Script → DevTools Panel: Page state updated (push)
 */
export interface PageStateUpdatedMessage {
  type: typeof MessageTypes.PAGE_STATE_UPDATED;
  payload: PageState;
}

/**
 * Error response for any failed request
 */
export interface ErrorResponse {
  type: typeof MessageTypes.ERROR;
  error: {
    code: ErrorCode;
    message: string;
  };
}

// Union type for all messages
export type ExtensionMessage =
  | RouterDetectedMessage
  | PayloadExtractedMessage
  | RequestDetectionMessage
  | GetPageStateRequest
  | PageStateResponse
  | PageStateUpdatedMessage
  | ErrorResponse;

/**
 * Type guard for RouterDetectedMessage
 */
export const isRouterDetectedMessage = (
  message: unknown
): message is RouterDetectedMessage => {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as ExtensionMessage).type === MessageTypes.ROUTER_DETECTED
  );
};

/**
 * Type guard for PayloadExtractedMessage
 */
export const isPayloadExtractedMessage = (
  message: unknown
): message is PayloadExtractedMessage => {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as ExtensionMessage).type === MessageTypes.PAYLOAD_EXTRACTED
  );
};

/**
 * Type guard for RequestDetectionMessage
 */
export const isRequestDetectionMessage = (
  message: unknown
): message is RequestDetectionMessage => {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as ExtensionMessage).type === MessageTypes.REQUEST_DETECTION
  );
};

/**
 * Type guard for GetPageStateRequest
 */
export const isGetPageStateRequest = (
  message: unknown
): message is GetPageStateRequest => {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as ExtensionMessage).type === MessageTypes.GET_PAGE_STATE
  );
};

/**
 * Create a RouterDetectedMessage
 */
export const createRouterDetectedMessage = (
  payload: RouterDetectedMessage["payload"]
): RouterDetectedMessage => ({
  type: MessageTypes.ROUTER_DETECTED,
  payload,
});

/**
 * Create a PayloadExtractedMessage
 */
export const createPayloadExtractedMessage = (
  entries: PayloadEntry[]
): PayloadExtractedMessage => ({
  type: MessageTypes.PAYLOAD_EXTRACTED,
  payload: {
    entries,
    extractedAt: Date.now(),
  },
});

/**
 * Create a GetPageStateRequest
 */
export const createGetPageStateRequest = (
  tabId: number
): GetPageStateRequest => ({
  type: MessageTypes.GET_PAGE_STATE,
  tabId,
});

/**
 * Create a RequestDetectionMessage
 */
export const createRequestDetectionMessage = (): RequestDetectionMessage => ({
  type: MessageTypes.REQUEST_DETECTION,
});

/**
 * Create a PageStateResponse
 */
export const createPageStateResponse = (
  payload: PageState | null
): PageStateResponse => ({
  type: MessageTypes.PAGE_STATE,
  payload: payload!,
});

/**
 * Create a PageStateUpdatedMessage
 */
export const createPageStateUpdatedMessage = (
  payload: PageState
): PageStateUpdatedMessage => ({
  type: MessageTypes.PAGE_STATE_UPDATED,
  payload,
});

/**
 * Create an ErrorResponse
 */
export const createErrorResponse = (
  code: ErrorCode,
  message: string
): ErrorResponse => ({
  type: MessageTypes.ERROR,
  error: {
    code,
    message,
  },
});
