/**
 * Next.js Developer Tools - Tab State Management
 * chrome.storage.local을 사용한 탭별 상태 관리
 */

import type { TabState, PageState } from "@/shared/types";
import { createDefaultTabState } from "@/shared/types";

const TAB_STATE_PREFIX = "tab_";

// =============================================================================
// In-Memory Cache (Service Worker 수명 동안 유지)
// =============================================================================

/** 탭별 상태 캐시 */
const stateCache = new Map<number, TabState>();

// =============================================================================
// Tab State CRUD
// =============================================================================

/**
 * 탭 상태 조회
 */
export const getTabState = async (tabId: number): Promise<TabState | null> => {
  // 캐시 확인
  if (stateCache.has(tabId)) {
    return stateCache.get(tabId)!;
  }

  // storage에서 로드
  const key = `${TAB_STATE_PREFIX}${tabId}`;
  const result = await chrome.storage.local.get(key);
  const state = result[key] as TabState | undefined;

  if (state) {
    stateCache.set(tabId, state);
    return state;
  }

  return null;
};

/**
 * 탭 상태 저장
 */
export const setTabState = async (
  tabId: number,
  state: TabState
): Promise<void> => {
  const key = `${TAB_STATE_PREFIX}${tabId}`;

  // 캐시 업데이트
  stateCache.set(tabId, state);

  // storage에 저장
  await chrome.storage.local.set({ [key]: state });
};

/**
 * 탭 상태 생성 또는 조회
 */
export const getOrCreateTabState = async (tabId: number): Promise<TabState> => {
  let state = await getTabState(tabId);

  if (!state) {
    state = createDefaultTabState(tabId);
    await setTabState(tabId, state);
  }

  return state;
};

/**
 * 탭 상태 업데이트
 */
export const updateTabState = async (
  tabId: number,
  updates: Partial<TabState>
): Promise<TabState> => {
  const state = await getOrCreateTabState(tabId);

  const newState: TabState = {
    ...state,
    ...updates,
    lastActivity: Date.now(),
  };

  await setTabState(tabId, newState);
  return newState;
};

/**
 * 탭 상태 삭제
 */
export const deleteTabState = async (tabId: number): Promise<void> => {
  const key = `${TAB_STATE_PREFIX}${tabId}`;

  // 캐시에서 제거
  stateCache.delete(tabId);

  // storage에서 제거
  await chrome.storage.local.remove(key);
};

// =============================================================================
// Page State Operations
// =============================================================================

/**
 * 페이지 상태 조회
 */
export const getPageState = async (
  tabId: number
): Promise<PageState | null> => {
  const tabState = await getTabState(tabId);
  return tabState?.pageState ?? null;
};

/**
 * 페이지 상태 업데이트
 */
export const updatePageState = async (
  tabId: number,
  pageState: PageState
): Promise<TabState> => {
  return updateTabState(tabId, {
    pageState,
  });
};

// =============================================================================
// DevTools Connection Management
// =============================================================================

/**
 * DevTools 연결 상태 업데이트
 */
export const setDevToolsConnected = async (
  tabId: number,
  connected: boolean
): Promise<void> => {
  await updateTabState(tabId, {
    devtoolsConnected: connected,
  });
};

// =============================================================================
// Cleanup
// =============================================================================

/**
 * 닫힌 탭의 상태 정리
 */
export const cleanupClosedTabs = async (): Promise<number> => {
  const result = await chrome.storage.local.get(null);
  const tabs = await chrome.tabs.query({});
  const activeTabIds = new Set(tabs.map((tab) => tab.id).filter(Boolean));

  const keysToRemove: string[] = [];

  for (const key of Object.keys(result)) {
    if (key.startsWith(TAB_STATE_PREFIX)) {
      const tabId = parseInt(key.replace(TAB_STATE_PREFIX, ""), 10);
      if (!isNaN(tabId) && !activeTabIds.has(tabId)) {
        keysToRemove.push(key);
        stateCache.delete(tabId);
      }
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  return keysToRemove.length;
};

/**
 * 모든 탭 상태 정리
 */
export const clearAllTabStates = async (): Promise<void> => {
  const result = await chrome.storage.local.get(null);
  const keysToRemove: string[] = [];

  for (const key of Object.keys(result)) {
    if (key.startsWith(TAB_STATE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  stateCache.clear();
};

/**
 * 모든 탭 상태 조회
 */
export const getAllTabStates = async (): Promise<Map<number, TabState>> => {
  const result = await chrome.storage.local.get(null);
  const states = new Map<number, TabState>();

  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith(TAB_STATE_PREFIX)) {
      const tabId = parseInt(key.replace(TAB_STATE_PREFIX, ""), 10);
      if (!isNaN(tabId) && value) {
        states.set(tabId, value as TabState);
      }
    }
  }

  return states;
};
