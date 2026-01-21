/**
 * Next.js Developer Tools - Observer Utilities
 *
 * MutationObserver 최적화를 위한 유틸리티
 * - createDebouncedObserver: 디바운싱이 적용된 MutationObserver
 * - ObserverManager: Observer 중앙 관리 및 정리
 */

import { PERFORMANCE } from "./constants";

// =============================================================================
// Types
// =============================================================================

/**
 * 디바운스 Observer 옵션
 */
export interface DebouncedObserverOptions {
  /** 디바운스 지연 시간 (ms) */
  debounceMs?: number;

  /** requestIdleCallback 사용 여부 (가능한 경우) */
  useIdleCallback?: boolean;

  /** 콜백 실행 시 mutations 필터링 함수 */
  filter?: (mutation: MutationRecord) => boolean;
}

/**
 * Observer 등록 정보
 */
interface ObserverEntry {
  observer: MutationObserver;
  target: Node;
  cleanup?: () => void;
}

// =============================================================================
// Debounced MutationObserver
// =============================================================================

/**
 * 디바운싱이 적용된 MutationObserver 생성
 *
 * 연속된 DOM 변경을 배치 처리하여 콜백 호출 빈도를 제한합니다.
 * requestIdleCallback을 사용하여 브라우저 유휴 시간에 처리합니다.
 *
 * @param callback - mutation 처리 콜백
 * @param options - 디바운스 옵션
 * @returns MutationObserver 인스턴스
 *
 * @example
 * const observer = createDebouncedObserver(
 *   (mutations) => {
 *     console.log('Batched mutations:', mutations.length);
 *   },
 *   { debounceMs: 100 }
 * );
 *
 * observer.observe(document.body, { childList: true, subtree: true });
 *
 * // 정리
 * observer.disconnect();
 */
export function createDebouncedObserver(
  callback: (mutations: MutationRecord[]) => void,
  options: DebouncedObserverOptions = {}
): MutationObserver {
  const {
    debounceMs = PERFORMANCE.MUTATION_DEBOUNCE_MS,
    useIdleCallback = true,
    filter,
  } = options;

  let pendingMutations: MutationRecord[] = [];
  let scheduled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let idleCallbackId: number | null = null;

  const flush = (): void => {
    scheduled = false;
    timeoutId = null;
    idleCallbackId = null;

    if (pendingMutations.length === 0) return;

    // 필터 적용
    const mutations = filter
      ? pendingMutations.filter(filter)
      : pendingMutations;

    pendingMutations = [];

    if (mutations.length > 0) {
      callback(mutations);
    }
  };

  const scheduleFlush = (): void => {
    if (scheduled) return;
    scheduled = true;

    // requestIdleCallback 사용 (지원되는 경우)
    if (useIdleCallback && "requestIdleCallback" in window) {
      idleCallbackId = requestIdleCallback(flush, { timeout: debounceMs * 2 });
    } else {
      // 폴백: setTimeout
      timeoutId = setTimeout(flush, debounceMs);
    }
  };

  const observer = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    scheduleFlush();
  });

  // disconnect 시 타이머 정리를 위한 래핑
  const originalDisconnect = observer.disconnect.bind(observer);
  observer.disconnect = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (idleCallbackId !== null && "cancelIdleCallback" in window) {
      cancelIdleCallback(idleCallbackId);
      idleCallbackId = null;
    }
    pendingMutations = [];
    scheduled = false;
    originalDisconnect();
  };

  return observer;
}

// =============================================================================
// Observer Manager
// =============================================================================

/**
 * Observer 중앙 관리 클래스
 *
 * 여러 MutationObserver를 ID로 관리하고 일괄 정리할 수 있습니다.
 *
 * @example
 * const manager = new ObserverManager();
 *
 * // Observer 생성 및 등록
 * manager.create(
 *   'content-observer',
 *   (mutations) => handleMutations(mutations),
 *   document.body,
 *   { childList: true }
 * );
 *
 * // 특정 Observer 제거
 * manager.destroy('content-observer');
 *
 * // 모든 Observer 제거
 * manager.destroyAll();
 */
export class ObserverManager {
  private observers = new Map<string, ObserverEntry>();

  /**
   * 새 Observer 생성 및 등록
   *
   * @param id - Observer 식별자
   * @param callback - mutation 처리 콜백
   * @param target - 관찰할 DOM 노드
   * @param config - MutationObserver 설정
   * @param options - 디바운스 옵션
   */
  create(
    id: string,
    callback: (mutations: MutationRecord[]) => void,
    target: Node,
    config: MutationObserverInit,
    options?: DebouncedObserverOptions
  ): void {
    // 기존 observer가 있으면 먼저 제거
    this.destroy(id);

    const observer = createDebouncedObserver(callback, options);
    observer.observe(target, config);

    this.observers.set(id, {
      observer,
      target,
    });
  }

  /**
   * 특정 Observer 제거
   *
   * @param id - Observer 식별자
   * @returns 제거 성공 여부
   */
  destroy(id: string): boolean {
    const entry = this.observers.get(id);
    if (!entry) return false;

    entry.observer.disconnect();
    entry.cleanup?.();
    this.observers.delete(id);

    return true;
  }

  /**
   * 모든 Observer 제거
   */
  destroyAll(): void {
    for (const [id] of this.observers) {
      this.destroy(id);
    }
  }

  /**
   * Observer 존재 여부 확인
   *
   * @param id - Observer 식별자
   */
  has(id: string): boolean {
    return this.observers.has(id);
  }

  /**
   * 등록된 Observer 수
   */
  get size(): number {
    return this.observers.size;
  }
}

// =============================================================================
// Cleanup Helper
// =============================================================================

/**
 * 페이지 언로드 시 Observer 자동 정리 설정
 *
 * @param manager - ObserverManager 인스턴스
 * @returns 정리 함수
 *
 * @example
 * const manager = new ObserverManager();
 * const cleanup = setupAutoCleanup(manager);
 *
 * // 필요시 수동 정리
 * cleanup();
 */
export function setupAutoCleanup(manager: ObserverManager): () => void {
  const handleUnload = (): void => {
    manager.destroyAll();
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);

  return () => {
    window.removeEventListener("beforeunload", handleUnload);
    window.removeEventListener("pagehide", handleUnload);
    manager.destroyAll();
  };
}
