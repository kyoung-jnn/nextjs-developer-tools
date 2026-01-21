/**
 * Next.js Developer Tools - Store
 *
 * 경량 Observable Store 패턴 구현
 * React/Vue 없이 예측 가능한 상태 관리 제공
 */

// =============================================================================
// Types
// =============================================================================

/**
 * 상태 변경 리스너 함수 타입
 */
export type Listener<T> = (state: T, prevState: T) => void;

/**
 * Store 인터페이스
 * T는 객체 타입이면 됨 (Record<string, unknown> 제약 제거)
 */
export interface Store<T extends object> {
  /** 현재 상태 조회 (불변 스냅샷) */
  getState(): Readonly<T>;

  /** 상태 업데이트 (부분 객체 또는 업데이터 함수) */
  setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void;

  /** 상태 변경 구독 (구독 취소 함수 반환) */
  subscribe(listener: Listener<T>): () => void;

  /** 특정 키만 선택적으로 구독 */
  subscribeToKey<K extends keyof T>(
    key: K,
    listener: (value: T[K], prevValue: T[K]) => void
  ): () => void;

  /** 상태 초기화 */
  reset(): void;
}

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Observable Store 생성
 *
 * @param initialState - 초기 상태 객체
 * @returns Store 인스턴스
 *
 * @example
 * interface AppState {
 *   count: number;
 *   items: string[];
 * }
 *
 * const store = createStore<AppState>({
 *   count: 0,
 *   items: []
 * });
 *
 * // 상태 조회
 * store.getState(); // { count: 0, items: [] }
 *
 * // 상태 업데이트 (부분 객체)
 * store.setState({ count: 1 });
 *
 * // 상태 업데이트 (업데이터 함수)
 * store.setState(prev => ({ count: prev.count + 1 }));
 *
 * // 구독
 * const unsubscribe = store.subscribe((state, prevState) => {
 *   console.log('State changed:', state);
 * });
 *
 * // 구독 취소
 * unsubscribe();
 */
export function createStore<T extends object>(initialState: T): Store<T> {
  // 현재 상태 (깊은 복사로 불변성 보장)
  let state: T = structuredClone(initialState);

  // 리스너 집합
  const listeners = new Set<Listener<T>>();

  // 키별 리스너 맵
  const keyListeners = new Map<
    keyof T,
    Set<(value: unknown, prevValue: unknown) => void>
  >();

  return {
    getState(): Readonly<T> {
      return state;
    },

    setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void {
      const prevState = state;

      // 업데이터 함수 또는 부분 객체 처리
      const nextPartial =
        typeof partial === "function" ? partial(prevState) : partial;

      // 변경 사항이 없으면 조기 반환
      const hasChanges = Object.keys(nextPartial).some(
        (key) =>
          nextPartial[key as keyof T] !== prevState[key as keyof typeof partial]
      );

      if (!hasChanges) {
        return;
      }

      // 새 상태 생성 (불변성 유지)
      state = { ...prevState, ...nextPartial };

      // 전체 리스너 알림
      listeners.forEach((listener) => {
        try {
          listener(state, prevState);
        } catch (error) {
          console.error("[Store] Listener error:", error);
        }
      });

      // 키별 리스너 알림
      for (const key of Object.keys(nextPartial) as Array<keyof T>) {
        const keyListener = keyListeners.get(key);
        if (keyListener && prevState[key] !== state[key]) {
          keyListener.forEach((listener) => {
            try {
              listener(state[key], prevState[key]);
            } catch (error) {
              console.error(
                `[Store] Key listener error for '${String(key)}':`,
                error
              );
            }
          });
        }
      }
    },

    subscribe(listener: Listener<T>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    subscribeToKey<K extends keyof T>(
      key: K,
      listener: (value: T[K], prevValue: T[K]) => void
    ): () => void {
      if (!keyListeners.has(key)) {
        keyListeners.set(key, new Set());
      }

      const typedListener = listener as (
        value: unknown,
        prevValue: unknown
      ) => void;
      keyListeners.get(key)!.add(typedListener);

      return () => {
        const listeners = keyListeners.get(key);
        if (listeners) {
          listeners.delete(typedListener);
          if (listeners.size === 0) {
            keyListeners.delete(key);
          }
        }
      };
    },

    reset(): void {
      const prevState = state;
      state = structuredClone(initialState);

      // 모든 리스너에게 알림
      listeners.forEach((listener) => {
        try {
          listener(state, prevState);
        } catch (error) {
          console.error("[Store] Listener error on reset:", error);
        }
      });
    },
  };
}

// =============================================================================
// Derived State
// =============================================================================

/**
 * 파생 상태 생성 (셀렉터)
 *
 * @param store - 원본 Store
 * @param selector - 파생 상태 계산 함수
 * @returns 파생 상태를 구독하는 함수
 *
 * @example
 * const store = createStore({ items: [1, 2, 3] });
 *
 * createDerivedState(store, state => state.items.length)(count => {
 *   console.log('Item count:', count);
 * });
 */
export function createDerivedState<T extends object, D>(
  store: Store<T>,
  selector: (state: T) => D
): (listener: (derived: D) => void) => () => void {
  return (listener) => {
    let prevDerived = selector(store.getState());

    return store.subscribe((state) => {
      const nextDerived = selector(state);
      if (!Object.is(prevDerived, nextDerived)) {
        prevDerived = nextDerived;
        listener(nextDerived);
      }
    });
  };
}
