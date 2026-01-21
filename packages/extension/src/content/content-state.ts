/**
 * Next.js Developer Tools - Content Script State
 *
 * Content script의 모듈 레벨 상태를 Observable Store로 관리
 */

import { createStore, type Store } from "@/shared/store";
import type { DetectionResult } from "@/shared/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Content Script 상태 인터페이스
 */
export interface ContentState {
  /** 현재 페이지에서 감지 완료 여부 */
  hasDetected: boolean;

  /** 현재 URL (SPA 네비게이션 감지용) */
  currentUrl: string;

  /** 마지막 감지 결과 */
  lastDetection: DetectionResult | null;

  /** URL 변경 감시 Observer 등록 여부 */
  isObserverActive: boolean;

  /** 주기적 체크 횟수 */
  checkCount: number;
}

// =============================================================================
// Initial State
// =============================================================================

/**
 * Content Script 초기 상태
 */
const createInitialState = (): ContentState => ({
  hasDetected: false,
  currentUrl: typeof window !== "undefined" ? window.location.href : "",
  lastDetection: null,
  isObserverActive: false,
  checkCount: 0,
});

// =============================================================================
// Store Instance
// =============================================================================

/**
 * Content Script Store 싱글톤 인스턴스
 */
let contentStore: Store<ContentState> | null = null;

/**
 * Content Store 인스턴스 획득 (지연 초기화)
 */
export const getContentStore = (): Store<ContentState> => {
  if (!contentStore) {
    contentStore = createStore<ContentState>(createInitialState());
  }
  return contentStore;
};

// =============================================================================
// State Actions
// =============================================================================

/**
 * 감지 완료 상태 설정
 */
export const setDetected = (detected: boolean): void => {
  getContentStore().setState({ hasDetected: detected });
};

/**
 * 마지막 감지 결과 설정
 */
export const setLastDetection = (result: DetectionResult | null): void => {
  getContentStore().setState({ lastDetection: result });
};

/**
 * 현재 URL 업데이트
 */
export const updateCurrentUrl = (url: string): void => {
  getContentStore().setState({ currentUrl: url });
};

/**
 * Observer 활성 상태 설정
 */
export const setObserverActive = (active: boolean): void => {
  getContentStore().setState({ isObserverActive: active });
};

/**
 * 체크 카운트 증가
 */
export const incrementCheckCount = (): number => {
  const store = getContentStore();
  const current = store.getState().checkCount;
  store.setState({ checkCount: current + 1 });
  return current + 1;
};

/**
 * URL 변경 감지 시 상태 리셋
 */
export const resetForNavigation = (newUrl: string): void => {
  getContentStore().setState({
    hasDetected: false,
    currentUrl: newUrl,
    lastDetection: null,
    checkCount: 0,
  });
};

/**
 * 전체 상태 리셋 (테스트용)
 */
export const resetContentState = (): void => {
  getContentStore().reset();
};
