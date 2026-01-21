/**
 * Next.js Developer Tools - DevTools Panel State
 *
 * DevTools Panel의 모듈 레벨 상태를 Observable Store로 관리
 */

import { createStore, createDerivedState, type Store } from "@/shared/store";
import type { FilterState, PayloadEntry } from "@/shared/types";
import { DEFAULT_FILTER_STATE } from "@/shared/types";
import { FilterBar } from "./components/FilterBar";
import { PayloadList } from "./components/PayloadList";
import { DetailPanel } from "./components/DetailPanel";

// =============================================================================
// Types
// =============================================================================

/**
 * DevTools Panel 상태 인터페이스
 */
export interface PanelState {
  /** 현재 필터 설정 */
  currentFilter: FilterState;

  /** 선택된 항목 인덱스 (-1 = 선택 없음) */
  selectedEntryIndex: number;

  /** 전체 페이로드 엔트리 목록 */
  entries: PayloadEntry[];

  /** 필터링된 페이로드 엔트리 목록 */
  filteredEntries: PayloadEntry[];

  /** 로딩 상태 */
  isLoading: boolean;

  /** 에러 메시지 (null = 에러 없음) */
  errorMessage: string | null;
}

/**
 * UI 컴포넌트 참조 인터페이스
 */
export interface PanelComponents {
  filterBar: FilterBar | null;
  payloadList: PayloadList | null;
  detailPanel: DetailPanel | null;
  port: chrome.runtime.Port | null;
}

// =============================================================================
// Initial State
// =============================================================================

/**
 * Panel 초기 상태 생성
 */
const createInitialPanelState = (): PanelState => ({
  currentFilter: { ...DEFAULT_FILTER_STATE },
  selectedEntryIndex: -1,
  entries: [],
  filteredEntries: [],
  isLoading: true,
  errorMessage: null,
});

/**
 * 컴포넌트 초기 상태
 */
const createInitialComponents = (): PanelComponents => ({
  filterBar: null,
  payloadList: null,
  detailPanel: null,
  port: null,
});

// =============================================================================
// Store Instances
// =============================================================================

/**
 * Panel Store 싱글톤 인스턴스
 */
let panelStore: Store<PanelState> | null = null;

/**
 * Components Store 싱글톤 인스턴스
 * (컴포넌트 인스턴스는 상태 변경 알림 불필요하므로 별도 관리)
 */
let componentsStore: Store<PanelComponents> | null = null;

/**
 * Panel Store 인스턴스 획득 (지연 초기화)
 */
export const getPanelStore = (): Store<PanelState> => {
  if (!panelStore) {
    panelStore = createStore<PanelState>(createInitialPanelState());
  }
  return panelStore;
};

/**
 * Components Store 인스턴스 획득 (지연 초기화)
 */
export const getComponentsStore = (): Store<PanelComponents> => {
  if (!componentsStore) {
    componentsStore = createStore<PanelComponents>(createInitialComponents());
  }
  return componentsStore;
};

// =============================================================================
// State Selectors (Derived State)
// =============================================================================

/**
 * 선택된 엔트리 조회
 */
export const getSelectedEntry = (): PayloadEntry | null => {
  const state = getPanelStore().getState();
  const { selectedEntryIndex, filteredEntries } = state;
  return filteredEntries[selectedEntryIndex] ?? null;
};

/**
 * 선택된 엔트리 변경 구독
 */
export const subscribeToSelectedEntry = (
  listener: (entry: PayloadEntry | null) => void
): (() => void) => {
  return createDerivedState(
    getPanelStore(),
    (state) => state.filteredEntries[state.selectedEntryIndex] ?? null
  )(listener);
};

// =============================================================================
// State Actions
// =============================================================================

/**
 * 필터 설정 업데이트
 */
export const setFilter = (filter: FilterState): void => {
  getPanelStore().setState({ currentFilter: filter });
};

/**
 * 선택된 엔트리 인덱스 설정
 */
export const setSelectedEntryIndex = (index: number): void => {
  getPanelStore().setState({ selectedEntryIndex: index });
};

/**
 * 엔트리 목록 설정
 */
export const setEntries = (entries: PayloadEntry[]): void => {
  getPanelStore().setState({ entries });
};

/**
 * 필터링된 엔트리 목록 설정
 */
export const setFilteredEntries = (filteredEntries: PayloadEntry[]): void => {
  getPanelStore().setState({ filteredEntries });
};

/**
 * 로딩 상태 설정
 */
export const setLoading = (isLoading: boolean): void => {
  getPanelStore().setState({ isLoading });
};

/**
 * 에러 메시지 설정
 */
export const setErrorMessage = (errorMessage: string | null): void => {
  getPanelStore().setState({ errorMessage });
};

/**
 * 여러 상태를 한 번에 업데이트
 */
export const updatePanelState = (partial: Partial<PanelState>): void => {
  getPanelStore().setState(partial);
};

// =============================================================================
// Component Actions
// =============================================================================

/**
 * FilterBar 컴포넌트 설정
 */
export const setFilterBar = (filterBar: FilterBar | null): void => {
  getComponentsStore().setState({ filterBar });
};

/**
 * PayloadList 컴포넌트 설정
 */
export const setPayloadList = (payloadList: PayloadList | null): void => {
  getComponentsStore().setState({ payloadList });
};

/**
 * DetailPanel 컴포넌트 설정
 */
export const setDetailPanel = (detailPanel: DetailPanel | null): void => {
  getComponentsStore().setState({ detailPanel });
};

/**
 * Port 연결 설정
 */
export const setPort = (port: chrome.runtime.Port | null): void => {
  getComponentsStore().setState({ port });
};

/**
 * 컴포넌트 조회
 */
export const getComponents = (): Readonly<PanelComponents> => {
  return getComponentsStore().getState();
};

// =============================================================================
// Reset
// =============================================================================

/**
 * 전체 Panel 상태 리셋
 */
export const resetPanelState = (): void => {
  getPanelStore().reset();
};

/**
 * 컴포넌트 참조 리셋
 */
export const resetComponents = (): void => {
  getComponentsStore().reset();
};
