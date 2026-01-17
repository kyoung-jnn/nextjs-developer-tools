/**
 * Next.js Developer Tools - Content Script
 * 모든 페이지에서 실행되어 Next.js 감지 및 페이로드 추출
 */

import { detectRouterWithRetry, mightBeNextJs } from "./detector";
import type { DetectionResult, PayloadEntry } from "@/shared/types";
import {
  createRouterDetectedMessage,
  createPayloadExtractedMessage,
  isRequestDetectionMessage,
} from "@/shared/messages";

// =============================================================================
// State
// =============================================================================

/** 현재 페이지에서 감지 완료 여부 */
let hasDetected = false;

/** 현재 URL (SPA 네비게이션 감지용) */
let currentUrl = window.location.href;

/** 마지막 감지 결과 */
let _lastDetection: DetectionResult | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Content Script 초기화
 */
function initialize(): void {
  console.log("[Next.js DevTools] Content script loaded");

  // Background Script로부터 메시지 수신
  chrome.runtime.onMessage.addListener(handleMessage);

  // 초기 감지 실행
  runDetection();

  // SPA 네비게이션 감시
  observeUrlChanges();
}

// =============================================================================
// Message Handling
// =============================================================================

/**
 * Background Script로부터 메시지 처리
 */
function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  if (isRequestDetectionMessage(message)) {
    // 감지 재요청 시 재실행
    hasDetected = false;
    runDetection();
    sendResponse({ success: true });
  }

  return false;
}

// =============================================================================
// Detection
// =============================================================================

/**
 * 라우터 감지 실행 및 결과를 Background Script로 전송
 */
async function runDetection(): Promise<void> {
  // 중복 감지 방지
  if (hasDetected) {
    return;
  }

  // 빠른 사전 체크
  if (!mightBeNextJs()) {
    sendDetectionResult({
      routerType: "none",
      confidence: 100,
      detectedAt: Date.now(),
      indicators: ["Quick pre-check: Not Next.js"],
    });
    hasDetected = true;
    return;
  }

  try {
    // 재시도 로직이 포함된 감지 실행
    const result = await detectRouterWithRetry(3, 300);
    _lastDetection = result;

    sendDetectionResult(result);
    hasDetected = true;

    console.log(
      `[Next.js DevTools] Detected: ${result.routerType} (confidence: ${result.confidence}%)`,
      result.indicators
    );

    // Next.js가 감지되면 페이로드도 추출
    if (result.routerType !== "none") {
      await extractAndSendPayload(result.routerType);
    }
  } catch (error) {
    console.error("[Next.js DevTools] Detection failed:", error);
    sendDetectionResult({
      routerType: "none",
      confidence: 0,
      detectedAt: Date.now(),
      indicators: [
        `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      ],
    });
  }
}

/**
 * 감지 결과를 Background Script로 전송
 */
function sendDetectionResult(result: DetectionResult): void {
  const message = createRouterDetectedMessage({
    routerType: result.routerType,
    confidence: result.confidence,
    indicators: result.indicators,
  });

  chrome.runtime.sendMessage(message).catch((error) => {
    // Extension 컨텍스트가 무효화되었을 수 있음
    console.warn("[Next.js DevTools] Failed to send message:", error);
  });
}

// =============================================================================
// Payload Extraction (간소화된 버전 - US2에서 확장)
// =============================================================================

/**
 * SSR 페이로드 추출 및 Background Script로 전송
 */
async function extractAndSendPayload(
  routerType: "app" | "page"
): Promise<void> {
  try {
    const entries: PayloadEntry[] = [];

    if (routerType === "page") {
      // Page Router: __NEXT_DATA__ 추출
      const nextDataScript = document.querySelector("#__NEXT_DATA__");
      if (nextDataScript?.textContent) {
        const rawData = nextDataScript.textContent;
        entries.push({
          id: crypto.randomUUID(),
          name: "Page Props",
          type: "pageProps",
          size: new Blob([rawData]).size,
          timestamp: Date.now(),
          data: safeParseJSON(rawData),
          raw: rawData,
        });
      }
    } else if (routerType === "app") {
      // App Router: __next_f 추출
      const globalWithNext = globalThis as typeof globalThis & {
        __next_f?: Array<[number, string]>;
      };

      if (Array.isArray(globalWithNext.__next_f)) {
        for (const item of globalWithNext.__next_f) {
          if (
            Array.isArray(item) &&
            item[0] === 1 &&
            typeof item[1] === "string"
          ) {
            entries.push({
              id: crypto.randomUUID(),
              name: "RSC Chunk",
              type: "rsc",
              size: new Blob([item[1]]).size,
              timestamp: Date.now(),
              data: item[1],
              raw: item[1],
            });
          }
        }
      }
    }

    if (entries.length > 0) {
      const message = createPayloadExtractedMessage(entries);

      chrome.runtime.sendMessage(message).catch((error) => {
        console.warn("[Next.js DevTools] Failed to send payload:", error);
      });

      console.log(
        `[Next.js DevTools] Payload extracted: ${entries.length} entries`
      );
    }
  } catch (error) {
    console.error("[Next.js DevTools] Payload extraction failed:", error);
  }
}

/**
 * 안전한 JSON 파싱
 */
function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// =============================================================================
// SPA Navigation Detection
// =============================================================================

/**
 * SPA 네비게이션을 위한 URL 변경 감시
 */
function observeUrlChanges(): void {
  // MutationObserver로 DOM 변경 감지
  const observer = new MutationObserver(() => {
    checkUrlChange();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // popstate 이벤트 (브라우저 뒤로/앞으로)
  window.addEventListener("popstate", () => {
    checkUrlChange();
  });

  // pushState/replaceState 인터셉트
  interceptHistoryMethods();

  // 초기 로드 후 주기적 체크 (폴백)
  let checkCount = 0;
  const maxChecks = 10;
  const checkInterval = setInterval(() => {
    checkCount++;
    checkUrlChange();

    if (checkCount >= maxChecks) {
      clearInterval(checkInterval);
    }
  }, 500);
}

/**
 * URL 변경 확인 및 재감지 트리거
 */
function checkUrlChange(): void {
  if (window.location.href !== currentUrl) {
    console.log(
      "[Next.js DevTools] URL changed:",
      currentUrl,
      "->",
      window.location.href
    );
    currentUrl = window.location.href;
    hasDetected = false;

    // 페이지가 안정화될 때까지 약간 대기
    setTimeout(() => {
      runDetection();
    }, 100);
  }
}

/**
 * history.pushState 및 history.replaceState 인터셉트
 */
function interceptHistoryMethods(): void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof originalPushState>) {
    const result = originalPushState(...args);
    window.dispatchEvent(new CustomEvent("nextjs-devtools-navigation"));
    return result;
  };

  history.replaceState = function (
    ...args: Parameters<typeof originalReplaceState>
  ) {
    const result = originalReplaceState(...args);
    window.dispatchEvent(new CustomEvent("nextjs-devtools-navigation"));
    return result;
  };

  window.addEventListener("nextjs-devtools-navigation", () => {
    checkUrlChange();
  });
}

// =============================================================================
// Entry Point
// =============================================================================

// DOM 준비 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
