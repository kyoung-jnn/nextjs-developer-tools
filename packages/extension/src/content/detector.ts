/**
 * Next.js Developer Tools - Router Detector
 * App Router / Page Router 감지 로직
 */

import type { DetectionResult } from "@/shared/types";

// =============================================================================
// Page Router Detection
// =============================================================================

/**
 * Page Router 감지 - #__NEXT_DATA__ 스크립트 태그 확인
 * @returns DetectionResult if Page Router, null otherwise
 */
export const detectPageRouter = (): DetectionResult | null => {
  const nextDataElement = document.querySelector("#__NEXT_DATA__");

  if (!nextDataElement) {
    return null;
  }

  const indicators: string[] = ["#__NEXT_DATA__ found"];
  let confidence = 100;

  try {
    const content = nextDataElement.textContent;
    if (content) {
      const data = JSON.parse(content);

      // buildId 확인으로 신뢰도 검증
      if (data.buildId) {
        indicators.push(`buildId: ${data.buildId}`);
      }

      // page 필드 확인
      if (data.page) {
        indicators.push(`page: ${data.page}`);
      }
    }
  } catch {
    // JSON 파싱 실패, 하지만 요소는 존재
    confidence = 80;
    indicators.push("JSON parse failed");
  }

  return {
    routerType: "page",
    confidence,
    detectedAt: Date.now(),
    indicators,
  };
};

// =============================================================================
// App Router Detection
// =============================================================================

/**
 * App Router 감지 - script 태그에서 __next_f.push 패턴 확인
 * Content script는 격리된 환경이므로 DOM을 통해 감지
 * @returns DetectionResult if App Router, null otherwise
 */
export const detectAppRouter = (): DetectionResult | null => {
  const indicators: string[] = [];
  let confidence = 0;

  // 1. script 태그에서 self.__next_f.push 패턴 확인
  const scripts = document.querySelectorAll("script");
  let rscScriptCount = 0;

  for (const script of scripts) {
    const content = script.textContent || "";
    if (
      content.includes("self.__next_f.push") ||
      content.includes("__next_f.push")
    ) {
      rscScriptCount++;
    }
  }

  if (rscScriptCount > 0) {
    indicators.push(`__next_f.push scripts found (${rscScriptCount})`);
    confidence = 100;
  }

  // 2. App Router 전용 DOM 요소 확인
  const scrollBoundary = document.querySelector(
    "[data-nextjs-scroll-focus-boundary]"
  );
  if (scrollBoundary) {
    indicators.push("scroll-focus-boundary found");
    confidence = Math.max(confidence, 90);
  }

  // 3. Next.js App Router의 특징적인 요소 확인
  const nextRoot = document.getElementById("__next");
  if (nextRoot && !document.getElementById("__NEXT_DATA__")) {
    indicators.push("#__next found without #__NEXT_DATA__");
    confidence = Math.max(confidence, 80);
  }

  // 4. RSC 관련 meta 태그 확인
  const rscMeta = document.querySelector('meta[name="next-size-adjust"]');
  if (rscMeta) {
    indicators.push("next-size-adjust meta found");
    confidence = Math.max(confidence, 85);
  }

  if (confidence === 0) {
    return null;
  }

  return {
    routerType: "app",
    confidence,
    detectedAt: Date.now(),
    indicators,
  };
};

// =============================================================================
// Pre-check
// =============================================================================

/**
 * Next.js 페이지일 가능성 사전 체크
 * 전체 감지 전 빠른 필터링용
 */
export const mightBeNextJs = (): boolean => {
  // 공통 Next.js 지표 확인
  const indicators = [
    "#__NEXT_DATA__", // Page Router
    "#__next", // Next.js 루트 요소
    "[data-nextjs-scroll-focus-boundary]", // App Router
  ];

  return indicators.some(
    (selector) => document.querySelector(selector) !== null
  );
};

// =============================================================================
// Main Detection
// =============================================================================

/**
 * 통합 라우터 감지
 * 우선순위:
 * 1. __NEXT_DATA__ 확인 → Page Router
 * 2. self.__next_f 확인 → App Router
 * 3. 둘 다 없음 → Not Next.js
 */
export const detectRouter = (): DetectionResult => {
  // 1. Page Router 확인 (우선순위 높음)
  const pageRouterResult = detectPageRouter();
  if (pageRouterResult) {
    return pageRouterResult;
  }

  // 2. App Router 확인
  const appRouterResult = detectAppRouter();
  if (appRouterResult) {
    return appRouterResult;
  }

  // 3. Next.js가 아님
  return {
    routerType: "none",
    confidence: 100,
    detectedAt: Date.now(),
    indicators: ["No Next.js indicators found"],
  };
};

/**
 * 재시도 로직이 포함된 라우터 감지
 * SPA나 지연 로딩 페이지용
 * @param maxAttempts 최대 시도 횟수 (기본: 3)
 * @param delayMs 재시도 간 대기 시간 (기본: 500ms)
 */
export const detectRouterWithRetry = async (
  maxAttempts = 3,
  delayMs = 500
): Promise<DetectionResult> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = detectRouter();

    // 감지 성공 시 반환
    if (result.routerType !== "none") {
      return result;
    }

    // 마지막 시도가 아니면 대기 후 재시도
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // 모든 시도 실패
  return {
    routerType: "none",
    confidence: 100,
    detectedAt: Date.now(),
    indicators: [`Detection failed after ${maxAttempts} attempts`],
  };
};
