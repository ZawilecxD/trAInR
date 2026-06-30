import { createContext, useCallback, useContext, useEffect, useRef } from "react";

export type SetLogFlushFn = () => Promise<boolean>;

export interface SetLogFlushRegistry {
  register: (key: string, flush: SetLogFlushFn) => void;
  unregister: (key: string) => void;
}

// Optional by design: when no provider is mounted the context is null and
// useRegisterSetLogFlush is a no-op, so useDebouncedSetLogSave keeps working
// standalone (debounce-only) exactly as before.
export const SetLogFlushContext = createContext<SetLogFlushRegistry | null>(null);

export interface SetLogFlushController extends SetLogFlushRegistry {
  flushAll: () => Promise<boolean>;
}

export function useSetLogFlushRegistry(): SetLogFlushController {
  const flushesRef = useRef(new Map<string, SetLogFlushFn>());

  const register = useCallback((key: string, flush: SetLogFlushFn) => {
    flushesRef.current.set(key, flush);
  }, []);

  const unregister = useCallback((key: string) => {
    flushesRef.current.delete(key);
  }, []);

  const flushAll = useCallback(async () => {
    const flushes = Array.from(flushesRef.current.values());
    const results = await Promise.all(flushes.map((flush) => flush()));
    return results.every(Boolean);
  }, []);

  return { register, unregister, flushAll };
}

export function useRegisterSetLogFlush(key: string, flushFn: SetLogFlushFn): void {
  const registry = useContext(SetLogFlushContext);
  const flushRef = useRef(flushFn);

  useEffect(() => {
    flushRef.current = flushFn;
  }, [flushFn]);

  useEffect(() => {
    if (!registry) return;

    const stableFlush: SetLogFlushFn = () => flushRef.current();
    registry.register(key, stableFlush);

    return () => {
      registry.unregister(key);
    };
  }, [registry, key]);
}
