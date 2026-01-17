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
export function detectPageRouter(): DetectionResult | null {
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
}

// =============================================================================
// App Router Detection
// =============================================================================

/**
 * RSC 청크 패턴 검증
 * 형식: /^\d+:["IHL{[\$"]/ (인덱스:데이터)
 */
const RSC_CHUNK_PATTERNS = [
  /^\d+:/, // 기본 패턴: "0:..."
  /^\d+:\["/, // 배열 시작: "0:["..."
  /^\d+:\{/, // 객체 시작: "0:{..."
  /^\d+:"[^"]*"/, // 문자열: "0:"...""
];

/**
 * __next_f 배열에서 RSC 청크 검증
 */
function verifyRSCChunks(nextF: unknown[]): boolean {
  if (nextF.length === 0) return false;

  // 최소 하나의 유효한 RSC 청크가 있는지 확인
  for (const item of nextF) {
    if (Array.isArray(item) && item[0] === 1 && typeof item[1] === "string") {
      const chunk = item[1];
      // RSC 청크 패턴 매칭
      if (RSC_CHUNK_PATTERNS.some((pattern) => pattern.test(chunk))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * App Router 감지 - self.__next_f 배열 확인
 * @returns DetectionResult if App Router, null otherwise
 */
export function detectAppRouter(): DetectionResult | null {
  // self.__next_f 또는 window.__next_f 확인
  const globalWithNext = globalThis as typeof globalThis & {
    __next_f?: unknown[];
  };

  const nextF = globalWithNext.__next_f;

  if (!Array.isArray(nextF)) {
    return null;
  }

  const indicators: string[] = ["self.__next_f found"];
  let confidence = 100;

  // RSC 청크 검증
  if (verifyRSCChunks(nextF)) {
    indicators.push(`RSC chunks verified (${nextF.length} items)`);
  } else {
    // 배열은 존재하지만 RSC 청크 패턴이 없음
    confidence = 80;
    indicators.push("RSC chunk pattern not matched");
  }

  // 추가 App Router 지표 확인
  const scrollBoundary = document.querySelector(
    "[data-nextjs-scroll-focus-boundary]"
  );
  if (scrollBoundary) {
    indicators.push("scroll-focus-boundary found");
  }

  return {
    routerType: "app",
    confidence,
    detectedAt: Date.now(),
    indicators,
  };
}

// =============================================================================
// Pre-check
// =============================================================================

/**
 * Next.js 페이지일 가능성 사전 체크
 * 전체 감지 전 빠른 필터링용
 */
export function mightBeNextJs(): boolean {
  // 공통 Next.js 지표 확인
  const indicators = [
    "#__NEXT_DATA__", // Page Router
    "#__next", // Next.js 루트 요소
    "[data-nextjs-scroll-focus-boundary]", // App Router
  ];

  return indicators.some(
    (selector) => document.querySelector(selector) !== null
  );
}

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
export function detectRouter(): DetectionResult {
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
}

/**
 * 재시도 로직이 포함된 라우터 감지
 * SPA나 지연 로딩 페이지용
 * @param maxAttempts 최대 시도 횟수 (기본: 3)
 * @param delayMs 재시도 간 대기 시간 (기본: 500ms)
 */
export async function detectRouterWithRetry(
  maxAttempts = 3,
  delayMs = 500
): Promise<DetectionResult> {
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
}
