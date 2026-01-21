/**
 * Next.js Developer Tools - Persistent State Manager
 *
 * Service Worker 종료 시에도 상태를 유지하기 위한 chrome.storage.session 기반 상태 관리
 */

import type { TabState, PageState } from "@/shared/types";

// =============================================================================
// Types
// =============================================================================

/**
 * 세션 스토리지 키 접두사
 */
const STORAGE_PREFIX = "ndt_";

/**
 * 마지막 저장 시간 키
 */
const LAST_SAVED_KEY = "ndt_lastSaved";

/**
 * 탭 키 생성
 */
const getTabKey = (tabId: number): string => `${STORAGE_PREFIX}tab_${tabId}`;

// =============================================================================
// PersistentStateManager Class
// =============================================================================

/**
 * 영구 상태 관리자
 * chrome.storage.session을 사용하여 Service Worker 종료 시에도 상태 유지
 */
export class PersistentStateManager {
  /** 메모리 캐시 (빠른 접근용) */
  private cache = new Map<number, TabState>();

  /** 저장 중인지 여부 (중복 저장 방지) */
  private isSaving = false;

  /** 대기 중인 저장 작업 */
  private pendingSaves = new Set<number>();

  /** 마지막 저장 시간 */
  private lastSaveTime = 0;

  /**
   * 초기화 - 세션 스토리지에서 상태 복원
   */
  async initialize(): Promise<void> {
    try {
      const storage = await chrome.storage.session.get(null);
      const entries = Object.entries(storage);
      const tabPrefix = `${STORAGE_PREFIX}tab_`;

      for (const [key, value] of entries) {
        if (key.startsWith(tabPrefix)) {
          const tabId = parseInt(key.replace(tabPrefix, ""), 10);
          if (!isNaN(tabId) && this.isValidTabState(value)) {
            this.cache.set(tabId, value);
          }
        }
      }

      console.log(
        `[PersistentState] Restored ${this.cache.size} tab states from session storage`
      );
    } catch (error) {
      console.error("[PersistentState] Failed to restore state:", error);
    }
  }

  /**
   * TabState 유효성 검사
   */
  private isValidTabState(value: unknown): value is TabState {
    return (
      typeof value === "object" &&
      value !== null &&
      "tabId" in value &&
      typeof (value as TabState).tabId === "number"
    );
  }

  /**
   * 탭 상태 조회
   */
  async getTabState(tabId: number): Promise<TabState | null> {
    // 캐시에서 먼저 조회
    const cached = this.cache.get(tabId);
    if (cached) return cached;

    // 캐시에 없으면 스토리지에서 조회
    try {
      const key = getTabKey(tabId);
      const result = await chrome.storage.session.get(key);
      const state = result[key] as TabState | undefined;

      if (state && this.isValidTabState(state)) {
        this.cache.set(tabId, state);
        return state;
      }
    } catch (error) {
      console.error(
        `[PersistentState] Failed to get tab ${tabId} state:`,
        error
      );
    }

    return null;
  }

  /**
   * 탭 상태 저장
   */
  async setTabState(tabId: number, state: TabState): Promise<void> {
    // 캐시 업데이트
    this.cache.set(tabId, state);

    // 저장 예약
    this.pendingSaves.add(tabId);
    await this.flushPendingSaves();
  }

  /**
   * 대기 중인 저장 작업 실행
   */
  private async flushPendingSaves(): Promise<void> {
    if (this.isSaving || this.pendingSaves.size === 0) return;

    this.isSaving = true;

    try {
      const updates: Record<string, unknown> = {};

      for (const tabId of this.pendingSaves) {
        const state = this.cache.get(tabId);
        if (state) {
          updates[getTabKey(tabId)] = state;
        }
      }

      updates[LAST_SAVED_KEY] = Date.now();

      await chrome.storage.session.set(updates);
      this.lastSaveTime = Date.now();
      this.pendingSaves.clear();
    } catch (error) {
      console.error("[PersistentState] Failed to save states:", error);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 탭 상태 삭제
   */
  async deleteTabState(tabId: number): Promise<void> {
    this.cache.delete(tabId);
    this.pendingSaves.delete(tabId);

    try {
      const key = getTabKey(tabId);
      await chrome.storage.session.remove(key);
    } catch (error) {
      console.error(
        `[PersistentState] Failed to delete tab ${tabId} state:`,
        error
      );
    }
  }

  /**
   * 페이지 상태 업데이트
   */
  async updatePageState(tabId: number, pageState: PageState): Promise<void> {
    const existing = this.cache.get(tabId);
    const updated: TabState = existing
      ? {
          ...existing,
          pageState,
          lastActivity: Date.now(),
        }
      : {
          tabId,
          pageState,
          devtoolsConnected: false,
          lastActivity: Date.now(),
        };

    await this.setTabState(tabId, updated);
  }

  /**
   * DevTools 연결 상태 업데이트
   */
  async setDevToolsConnected(tabId: number, connected: boolean): Promise<void> {
    const existing = this.cache.get(tabId);
    if (existing) {
      await this.setTabState(tabId, {
        ...existing,
        devtoolsConnected: connected,
        lastActivity: Date.now(),
      });
    }
  }

  /**
   * 모든 탭 상태 조회
   */
  getAllTabStates(): Map<number, TabState> {
    return new Map(this.cache);
  }

  /**
   * 닫힌 탭 정리
   */
  async cleanupClosedTabs(): Promise<number> {
    let cleanedCount = 0;

    try {
      const tabs = await chrome.tabs.query({});
      const openTabIds = new Set(tabs.map((t) => t.id).filter(Boolean));

      for (const tabId of this.cache.keys()) {
        if (!openTabIds.has(tabId)) {
          await this.deleteTabState(tabId);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error("[PersistentState] Failed to cleanup closed tabs:", error);
    }

    return cleanedCount;
  }

  /**
   * Service Worker 종료 전 즉시 저장
   */
  async saveBeforeSuspend(): Promise<void> {
    // 모든 캐시된 상태를 저장
    for (const tabId of this.cache.keys()) {
      this.pendingSaves.add(tabId);
    }

    await this.flushPendingSaves();
    console.log("[PersistentState] State saved before suspend");
  }

  /**
   * 전체 상태 초기화 (테스트용)
   */
  async clearAll(): Promise<void> {
    this.cache.clear();
    this.pendingSaves.clear();

    try {
      const storage = await chrome.storage.session.get(null);
      const keysToRemove = Object.keys(storage).filter((key) =>
        key.startsWith(STORAGE_PREFIX)
      );
      if (keysToRemove.length > 0) {
        await chrome.storage.session.remove(keysToRemove);
      }
    } catch (error) {
      console.error("[PersistentState] Failed to clear all:", error);
    }
  }

  /**
   * 상태 요약 (디버깅용)
   */
  getStatus(): { cachedTabs: number; lastSaveTime: number } {
    return {
      cachedTabs: this.cache.size,
      lastSaveTime: this.lastSaveTime,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/** PersistentStateManager 싱글톤 인스턴스 */
let persistentStateInstance: PersistentStateManager | null = null;

/**
 * PersistentStateManager 인스턴스 획득
 */
export const getPersistentStateManager = (): PersistentStateManager => {
  if (!persistentStateInstance) {
    persistentStateInstance = new PersistentStateManager();
  }
  return persistentStateInstance;
};
