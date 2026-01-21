/**
 * Next.js Developer Tools - Content Script
 * 모든 페이지에서 실행되어 Next.js 감지 및 페이로드 추출
 */

import { detectRouterWithRetry, mightBeNextJs } from "./detector";
import {
  getContentStore,
  setDetected,
  setLastDetection,
  updateCurrentUrl,
  setObserverActive,
  incrementCheckCount,
  resetForNavigation,
} from "./content-state";
import type { DetectionResult, PayloadEntry } from "@/shared/types";
import {
  createRouterDetectedMessage,
  createPayloadExtractedMessage,
  isRequestDetectionMessage,
} from "@/shared/messages";
import { safeJsonParse } from "@/shared/utils";
import { createDebouncedObserver } from "@/shared/observer";
import { PERFORMANCE } from "@/shared/constants";

// =============================================================================
// Non-State References (Observer/Timer는 상태가 아닌 리소스 참조)
// =============================================================================

/** URL 변경 감시 Observer (리소스 참조) */
let urlObserver: MutationObserver | null = null;

/** 주기적 체크 인터벌 ID (리소스 참조) */
let checkIntervalId: ReturnType<typeof setInterval> | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Content Script 초기화
 */
const initialize = (): void => {
  console.log("[Next.js DevTools] Content script loaded");

  // 초기 URL 설정
  updateCurrentUrl(window.location.href);

  // Background Script로부터 메시지 수신
  chrome.runtime.onMessage.addListener(handleMessage);

  // 초기 감지 실행
  runDetection();

  // SPA 네비게이션 감시
  observeUrlChanges();

  // 페이지 언로드 시 정리
  setupCleanup();
};

/**
 * 페이지 언로드 시 리소스 정리
 */
const setupCleanup = (): void => {
  const cleanup = (): void => {
    // Observer 정리
    if (urlObserver) {
      urlObserver.disconnect();
      urlObserver = null;
      setObserverActive(false);
    }

    // 인터벌 정리
    if (checkIntervalId !== null) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }

    console.log("[Next.js DevTools] Cleanup completed");
  };

  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("pagehide", cleanup);
};

// =============================================================================
// Message Handling
// =============================================================================

/**
 * Background Script로부터 메시지 처리
 */
const handleMessage = (
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean => {
  if (isRequestDetectionMessage(message)) {
    // 감지 재요청 시 재실행
    setDetected(false);
    runDetection();
    sendResponse({ success: true });
  }

  return false;
};

// =============================================================================
// Detection
// =============================================================================

/**
 * 라우터 감지 실행 및 결과를 Background Script로 전송
 */
const runDetection = async (): Promise<void> => {
  const state = getContentStore().getState();

  // 중복 감지 방지
  if (state.hasDetected) {
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
    setDetected(true);
    return;
  }

  try {
    // 재시도 로직이 포함된 감지 실행
    const result = await detectRouterWithRetry(3, 300);
    setLastDetection(result);

    sendDetectionResult(result);
    setDetected(true);

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
};

/**
 * 감지 결과를 Background Script로 전송
 */
const sendDetectionResult = (result: DetectionResult): void => {
  const message = createRouterDetectedMessage({
    routerType: result.routerType,
    confidence: result.confidence,
    indicators: result.indicators,
  });

  chrome.runtime.sendMessage(message).catch((error) => {
    // Extension 컨텍스트가 무효화되었을 수 있음
    console.warn("[Next.js DevTools] Failed to send message:", error);
  });
};

// =============================================================================
// Payload Extraction (간소화된 버전 - US2에서 확장)
// =============================================================================

/**
 * SSR 페이로드 추출 및 Background Script로 전송
 */
const extractAndSendPayload = async (
  routerType: "app" | "page"
): Promise<void> => {
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
          data: safeJsonParse(rawData),
          raw: rawData,
        });
      }
    } else if (routerType === "app") {
      // App Router: script 태그에서 RSC 청크 추출
      const rscChunks = extractRSCChunksFromDOM();
      for (const chunk of rscChunks) {
        entries.push({
          id: crypto.randomUUID(),
          name: "RSC Chunk",
          type: "rsc",
          size: new Blob([chunk]).size,
          timestamp: Date.now(),
          data: chunk,
          raw: chunk,
        });
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
};

/**
 * DOM의 script 태그에서 RSC 청크 추출
 */
const extractRSCChunksFromDOM = (): string[] => {
  const chunks: string[] = [];
  const scripts = document.querySelectorAll("script");

  // RSC 청크 패턴: self.__next_f.push([1,"..."]) 형태
  const pushPattern =
    /self\.__next_f\.push\(\s*\[\s*1\s*,\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\]\s*\)/g;

  for (const script of scripts) {
    const content = script.textContent || "";
    if (content.includes("__next_f.push")) {
      let match;
      while ((match = pushPattern.exec(content)) !== null) {
        // 이스케이프된 문자열 디코딩
        const decoded = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
        chunks.push(decoded);
      }
    }
  }

  return chunks;
};

// =============================================================================
// SPA Navigation Detection
// =============================================================================

/**
 * SPA 네비게이션을 위한 URL 변경 감시
 */
const observeUrlChanges = (): void => {
  // 디바운싱이 적용된 MutationObserver로 DOM 변경 감지
  // 100ms 디바운스로 CPU 사용률 감소
  urlObserver = createDebouncedObserver(
    () => {
      checkUrlChange();
    },
    {
      debounceMs: PERFORMANCE.MUTATION_DEBOUNCE_MS,
      useIdleCallback: true,
    }
  );

  // head 요소만 관찰하여 subtree 범위 최소화
  // Next.js SPA 네비게이션은 주로 head의 title/meta 변경으로 감지 가능
  const targetNode = document.head || document.documentElement;
  urlObserver.observe(targetNode, {
    childList: true,
    subtree: false, // subtree 최소화로 성능 향상
    characterData: true,
  });

  setObserverActive(true);

  // popstate 이벤트 (브라우저 뒤로/앞으로)
  window.addEventListener("popstate", () => {
    checkUrlChange();
  });

  // pushState/replaceState 인터셉트
  interceptHistoryMethods();

  // 초기 로드 후 주기적 체크 (폴백) - 10회까지만
  const maxChecks = 10;
  checkIntervalId = setInterval(() => {
    const count = incrementCheckCount();
    checkUrlChange();

    if (count >= maxChecks && checkIntervalId !== null) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
  }, 500);
};

/**
 * URL 변경 확인 및 재감지 트리거
 */
const checkUrlChange = (): void => {
  const state = getContentStore().getState();

  if (window.location.href !== state.currentUrl) {
    console.log(
      "[Next.js DevTools] URL changed:",
      state.currentUrl,
      "->",
      window.location.href
    );

    // 네비게이션에 따른 상태 리셋
    resetForNavigation(window.location.href);

    // 페이지가 안정화될 때까지 약간 대기
    setTimeout(() => {
      runDetection();
    }, 100);
  }
};

/**
 * history.pushState 및 history.replaceState 인터셉트
 */
const interceptHistoryMethods = (): void => {
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
};

// =============================================================================
// Entry Point
// =============================================================================

// DOM 준비 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
