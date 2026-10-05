/** Preserve Next's replaceable push callback while observing every segment. */
export function installNextFHook(target: object, onSegment: (segment: unknown) => void): void {
  const instrumented = new WeakSet<unknown[]>();
  const report = (segment: unknown): void => {
    try {
      onSegment(segment);
    } catch {
      /* Observers must never interrupt hydration. */
    }
  };
  const instrument = (value: unknown): void => {
    if (!Array.isArray(value) || instrumented.has(value)) return;
    try {
      let inner: unknown = value.push;
      const wrapper = function (this: unknown, ...items: unknown[]): unknown {
        for (const item of items) report(item);
        // Calling a non-function keeps the page's original assignment semantics.
        return Reflect.apply(inner as (...args: unknown[]) => unknown, this, items);
      };
      Object.defineProperty(value, 'push', {
        configurable: true,
        get: () => wrapper,
        set: (next: unknown) => {
          inner = next;
        },
      });
      instrumented.add(value);
      for (const segment of value) report(segment);
    } catch {
      /* Frozen arrays or page-owned descriptors are left untouched. */
    }
  };
  try {
    let current: unknown = Reflect.get(target, '__next_f');
    Object.defineProperty(target, '__next_f', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (value: unknown) => {
        current = value;
        instrument(value);
      },
    });
    instrument(current);
  } catch {
    /* A non-configurable page property cannot be intercepted. */
  }
}
