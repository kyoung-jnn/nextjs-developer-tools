/**
 * Next.js Developer Tools - Shared Utilities
 *
 * 공용 유틸리티 함수 모음
 * - escapeHtml: XSS 방지를 위한 HTML 이스케이프
 * - safeJsonParse: 에러 처리가 포함된 안전한 JSON 파싱
 * - debounce: 함수 디바운싱
 */

// =============================================================================
// HTML Escape
// =============================================================================

/** HTML 이스케이프 매핑 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

/**
 * HTML 특수 문자를 이스케이프하여 XSS 공격 방지
 *
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열 (innerHTML에 안전)
 *
 * @example
 * escapeHtml('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

// =============================================================================
// JSON Parsing
// =============================================================================

/**
 * 안전한 JSON 파싱 (에러 시 null 반환)
 *
 * @param str - 파싱할 JSON 문자열
 * @returns 파싱된 객체 또는 실패 시 null
 *
 * @example
 * safeJsonParse('{"key": "value"}') // Returns: { key: "value" }
 * safeJsonParse('invalid json')     // Returns: null
 */
export function safeJsonParse<T = unknown>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

// =============================================================================
// Debounce
// =============================================================================

/**
 * 디바운스 함수 인터페이스
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  /** 대기 중인 실행 취소 */
  cancel(): void;
  /** 대기 중인 실행을 즉시 실행 */
  flush(): void;
}

/**
 * 함수를 디바운스하여 연속 호출 시 마지막 호출만 실행
 *
 * @param fn - 디바운스할 함수
 * @param ms - 대기 시간 (밀리초)
 * @returns 디바운스된 함수 (cancel, flush 메서드 포함)
 *
 * @example
 * const debouncedSearch = debounce(search, 300);
 * debouncedSearch('query1');
 * debouncedSearch('query2'); // 300ms 후 'query2'로 한 번만 실행
 * debouncedSearch.cancel();  // 대기 중인 실행 취소
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs !== null) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, ms);
  }) as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs !== null) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  return debounced;
}
