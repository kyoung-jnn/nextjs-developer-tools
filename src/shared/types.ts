/**
 * Next.js Developer Tools - Shared Types
 * Based on data-model.md specification
 */

// =============================================================================
// Core Types
// =============================================================================

/** 라우터 종류를 나타내는 타입 */
export type RouterType = "app" | "page" | "none";

/** 페이지 상태 */
export type PageStatus = "idle" | "loading" | "ready" | "error";

/** 페이로드 유형 */
export type PayloadType = "pageProps" | "rsc" | "metadata" | "buildInfo";

/** 렌더링 타입 */
export type RenderingType = "SSR" | "SSG" | "ISR" | "RSC" | "Client";

/** 필터 타입 */
export type FilterType = "all" | "props" | "rsc";

/** 정렬 필드 */
export type SortField = "name" | "size" | "timestamp";

/** 정렬 순서 */
export type SortOrder = "asc" | "desc";

// =============================================================================
// Detection Types
// =============================================================================

/**
 * 라우터 감지 결과
 */
export interface DetectionResult {
  /** 감지된 라우터 타입 */
  routerType: RouterType;
  /** 감지 신뢰도 (0-100) */
  confidence: number;
  /** 감지 시간 (Unix timestamp ms) */
  detectedAt: number;
  /** 감지에 사용된 지표 목록 */
  indicators: string[];
}

// =============================================================================
// Payload Types
// =============================================================================

/**
 * SSR 페이로드 항목
 */
export interface PayloadEntry {
  /** 고유 식별자 (UUID) */
  id: string;
  /** 표시 이름 (경로 또는 컴포넌트명) */
  name: string;
  /** 페이로드 유형 */
  type: PayloadType;
  /** 바이트 단위 크기 */
  size: number;
  /** 추출 시간 (Unix timestamp ms) */
  timestamp: number;
  /** 실제 페이로드 데이터 */
  data: unknown;
  /** 원본 문자열 */
  raw: string;
}

// =============================================================================
// State Types
// =============================================================================

/**
 * 현재 페이지의 전체 상태
 */
export interface PageState {
  /** 현재 페이지 URL */
  url: string;
  /** 감지된 라우터 타입 */
  routerType: RouterType;
  /** Next.js 여부 */
  isNextJs: boolean;
  /** 추출된 페이로드 목록 */
  payloads: PayloadEntry[];
  /** 감지 결과 상세 */
  detection: DetectionResult;
  /** 마지막 업데이트 시간 */
  lastUpdated: number;
}

/**
 * 탭별 상태 (Background Script 관리)
 */
export interface TabState {
  /** 탭 ID */
  tabId: number;
  /** 페이지 상태 */
  pageState: PageState | null;
  /** DevTools 연결 여부 */
  devtoolsConnected: boolean;
  /** 마지막 활동 시간 */
  lastActivity: number;
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * 필터 바 상태
 */
export interface FilterState {
  /** 검색어 */
  searchQuery: string;
  /** 선택된 타입 필터 */
  typeFilter: PayloadType[];
  /** 정렬 기준 */
  sortBy: SortField;
  /** 정렬 순서 */
  sortOrder: SortOrder;
}

/**
 * 선택 상태
 */
export interface SelectionState {
  /** 선택된 페이로드 ID */
  selectedPayloadId: string | null;
  /** 활성 탭 */
  activeTab: "headers" | "payload" | "preview";
}

/**
 * DevTools 패널 전체 상태
 */
export interface PanelState {
  /** 연결 상태 */
  isConnected: boolean;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 페이지 상태 */
  pageState: PageState | null;
  /** 필터 상태 */
  filter: FilterState;
  /** 선택 상태 */
  selection: SelectionState;
  /** 에러 메시지 */
  error: string | null;
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * chrome.storage.local 스키마
 */
export interface StorageSchema {
  /** 탭별 캐시된 상태 */
  [key: `tab_${number}`]: TabState;
  /** 사용자 설정 */
  settings?: {
    /** 자동 감지 활성화 */
    autoDetect: boolean;
    /** 최대 페이로드 크기 (MB) */
    maxPayloadSize: number;
    /** 테마 */
    theme: "auto" | "light" | "dark";
  };
}

// =============================================================================
// Default Values
// =============================================================================

/** 기본 필터 상태 */
export const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery: "",
  typeFilter: [],
  sortBy: "timestamp",
  sortOrder: "desc",
};

/** 기본 선택 상태 */
export const DEFAULT_SELECTION_STATE: SelectionState = {
  selectedPayloadId: null,
  activeTab: "preview",
};

/** 기본 패널 상태 */
export const DEFAULT_PANEL_STATE: PanelState = {
  isConnected: false,
  isLoading: true,
  pageState: null,
  filter: DEFAULT_FILTER_STATE,
  selection: DEFAULT_SELECTION_STATE,
  error: null,
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * 기본 DetectionResult 생성
 */
export function createDefaultDetection(): DetectionResult {
  return {
    routerType: "none",
    confidence: 0,
    detectedAt: Date.now(),
    indicators: [],
  };
}

/**
 * 기본 PageState 생성
 */
export function createDefaultPageState(url: string): PageState {
  return {
    url,
    routerType: "none",
    isNextJs: false,
    payloads: [],
    detection: createDefaultDetection(),
    lastUpdated: Date.now(),
  };
}

/**
 * 기본 TabState 생성
 */
export function createDefaultTabState(tabId: number): TabState {
  return {
    tabId,
    pageState: null,
    devtoolsConnected: false,
    lastActivity: Date.now(),
  };
}

/**
 * UUID v4 생성
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
