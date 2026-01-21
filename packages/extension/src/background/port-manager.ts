/**
 * Next.js Developer Tools - Port Manager
 *
 * DevTools 패널과의 포트 연결을 관리하고 ping/pong 메커니즘으로 연결 유지
 */

import { MessageTypes, type PageStateUpdatedMessage } from "@/shared/messages";
import type { PageState } from "@/shared/types";
import { setDevToolsConnected } from "./state";

// =============================================================================
// Types
// =============================================================================

/**
 * 포트 연결 정보
 */
interface PortConnection {
  /** Chrome 포트 객체 */
  port: chrome.runtime.Port;
  /** 탭 ID */
  tabId: number;
  /** 마지막 pong 수신 시간 */
  lastPong: number;
  /** ping 인터벌 ID */
  pingIntervalId: ReturnType<typeof setInterval> | null;
}

/**
 * Ping/Pong 메시지 타입
 */
interface PingMessage {
  type: "PING";
  timestamp: number;
}

interface PongMessage {
  type: "PONG";
  timestamp: number;
}

type PortMessage = PingMessage | PongMessage;

// =============================================================================
// Constants
// =============================================================================

/** Ping 전송 간격 (ms) */
const PING_INTERVAL_MS = 25000; // 25초

/** Pong 타임아웃 (ms) - 이 시간 내 pong이 없으면 연결 해제 */
const PONG_TIMEOUT_MS = 30000; // 30초

// =============================================================================
// PortManager Class
// =============================================================================

/**
 * DevTools 포트 연결 관리자
 */
export class PortManager {
  /** 탭별 포트 연결 Map */
  private connections = new Map<number, PortConnection>();

  /** 연결 해제 콜백 */
  private onDisconnectCallback?: (tabId: number) => void;

  /**
   * 연결 해제 콜백 설정
   */
  setOnDisconnect(callback: (tabId: number) => void): void {
    this.onDisconnectCallback = callback;
  }

  /**
   * 새 포트 연결 처리
   */
  async handleConnect(port: chrome.runtime.Port): Promise<number | null> {
    // devtools-{tabId} 형식 검증
    if (!port.name.startsWith("devtools-")) {
      return null;
    }

    const tabId = parseInt(port.name.replace("devtools-", ""), 10);
    if (isNaN(tabId)) {
      return null;
    }

    // 기존 연결이 있으면 정리
    this.disconnect(tabId);

    // 새 연결 생성
    const connection: PortConnection = {
      port,
      tabId,
      lastPong: Date.now(),
      pingIntervalId: null,
    };

    this.connections.set(tabId, connection);

    // 포트 메시지 리스너 설정
    port.onMessage.addListener((message: unknown) => {
      this.handleMessage(tabId, message);
    });

    // 포트 연결 해제 리스너 설정
    port.onDisconnect.addListener(() => {
      this.handleDisconnect(tabId);
    });

    // DevTools 연결 상태 업데이트
    await setDevToolsConnected(tabId, true);

    // Ping 인터벌 시작
    this.startPingInterval(tabId);

    console.log(`[PortManager] Connected: tab ${tabId}`);

    return tabId;
  }

  /**
   * 포트 메시지 처리
   */
  private handleMessage(tabId: number, message: unknown): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    // PONG 메시지 처리
    if (this.isPongMessage(message)) {
      connection.lastPong = Date.now();
    }
  }

  /**
   * PONG 메시지 타입 가드
   */
  private isPongMessage(message: unknown): message is PongMessage {
    return (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      (message as PortMessage).type === "PONG"
    );
  }

  /**
   * 연결 해제 처리
   */
  private handleDisconnect(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    // Ping 인터벌 정리
    if (connection.pingIntervalId) {
      clearInterval(connection.pingIntervalId);
    }

    this.connections.delete(tabId);

    // DevTools 연결 상태 업데이트
    setDevToolsConnected(tabId, false).catch(console.error);

    // 콜백 호출
    this.onDisconnectCallback?.(tabId);

    console.log(`[PortManager] Disconnected: tab ${tabId}`);
  }

  /**
   * 특정 탭 연결 해제
   */
  disconnect(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    // Ping 인터벌 정리
    if (connection.pingIntervalId) {
      clearInterval(connection.pingIntervalId);
    }

    // 포트 연결 해제
    try {
      connection.port.disconnect();
    } catch {
      // 이미 연결 해제됨
    }

    this.connections.delete(tabId);
  }

  /**
   * Ping 인터벌 시작
   */
  private startPingInterval(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    connection.pingIntervalId = setInterval(() => {
      this.sendPing(tabId);
      this.checkPongTimeout(tabId);
    }, PING_INTERVAL_MS);
  }

  /**
   * Ping 메시지 전송
   */
  private sendPing(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const pingMessage: PingMessage = {
      type: "PING",
      timestamp: Date.now(),
    };

    try {
      connection.port.postMessage(pingMessage);
    } catch {
      // 포트가 이미 닫힘
      this.handleDisconnect(tabId);
    }
  }

  /**
   * Pong 타임아웃 확인
   */
  private checkPongTimeout(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const elapsed = Date.now() - connection.lastPong;
    if (elapsed > PONG_TIMEOUT_MS) {
      console.warn(
        `[PortManager] Pong timeout for tab ${tabId}, disconnecting`
      );
      this.disconnect(tabId);
      this.onDisconnectCallback?.(tabId);
    }
  }

  /**
   * 특정 탭에 메시지 전송
   */
  sendMessage(tabId: number, message: unknown): boolean {
    const connection = this.connections.get(tabId);
    if (!connection) return false;

    try {
      connection.port.postMessage(message);
      return true;
    } catch {
      this.handleDisconnect(tabId);
      return false;
    }
  }

  /**
   * 페이지 상태 업데이트 브로드캐스트
   */
  broadcastPageState(tabId: number, state: PageState): void {
    const message: PageStateUpdatedMessage = {
      type: MessageTypes.PAGE_STATE_UPDATED,
      payload: state,
    };
    this.sendMessage(tabId, message);
  }

  /**
   * 연결 여부 확인
   */
  isConnected(tabId: number): boolean {
    return this.connections.has(tabId);
  }

  /**
   * 연결된 탭 ID 목록 조회
   */
  getConnectedTabs(): number[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 포트 객체 직접 조회 (하위 호환성)
   */
  getPort(tabId: number): chrome.runtime.Port | null {
    return this.connections.get(tabId)?.port ?? null;
  }

  /**
   * 모든 연결 정리
   */
  disconnectAll(): void {
    for (const tabId of this.connections.keys()) {
      this.disconnect(tabId);
    }
  }

  /**
   * 연결 상태 요약 (디버깅용)
   */
  getStatus(): { tabId: number; lastPong: number }[] {
    return Array.from(this.connections.entries()).map(([tabId, conn]) => ({
      tabId,
      lastPong: conn.lastPong,
    }));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/** PortManager 싱글톤 인스턴스 */
let portManagerInstance: PortManager | null = null;

/**
 * PortManager 인스턴스 획득
 */
export const getPortManager = (): PortManager => {
  if (!portManagerInstance) {
    portManagerInstance = new PortManager();
  }
  return portManagerInstance;
};
