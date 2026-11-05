import { useCallback, useEffect, useEffectEvent, useState } from "react";

export interface LoadState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

interface Snapshot<T> {
  key: string;
  version: number;
  data: T | null;
  error: unknown;
}

/**
 * Загрузка данных по ключу.
 * Смена ключа (другой id) сразу сбрасывает данные; reload() перезагружает,
 * оставляя прежние данные на экране до прихода новых, а при ошибке — вместе
 * с ошибкой. Ответы на устаревший ключ отбрасываются.
 */
export function useLoad<T>(key: string, load: () => Promise<T>): LoadState<T> {
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const runLoad = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await runLoad();
        if (!cancelled) setSnapshot({ key, version, data, error: null });
      } catch (error: unknown) {
        // При неудачном reload() того же ключа оставляем прежние данные на экране
        if (!cancelled)
          setSnapshot((prev) => ({
            key,
            version,
            data: prev?.key === key ? prev.data : null,
            error,
          }));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const sameKey = snapshot?.key === key;
  return {
    data: sameKey ? snapshot.data : null,
    error: sameKey ? snapshot.error : null,
    loading: !sameKey || snapshot.version !== version,
    reload,
  };
}
