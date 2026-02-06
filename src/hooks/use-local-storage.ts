import { useState, useCallback, useEffect, useRef } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function useLocalStorage<T>(key: string, fallback: T): [T, SetValue<T>] {
  const [value, setValueRaw] = useState<T>(() => readStorage(key, fallback));
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    const stored = readStorage(key, fallback);
    setValueRaw(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue: SetValue<T> = useCallback((next) => {
    setValueRaw((prev) => {
      const resolved = next instanceof Function ? next(prev) : next;
      writeStorage(keyRef.current, resolved);
      return resolved;
    });
  }, []);

  return [value, setValue];
}
