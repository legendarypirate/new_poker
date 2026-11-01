"use client";

import { useCallback, useEffect, useState } from "react";

export function useAdminQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  refreshMs = 0
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const next = await fetcher();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    setLoading(true);
    void reload();
    if (!refreshMs) return;
    const id = window.setInterval(() => void reload(), refreshMs);
    return () => window.clearInterval(id);
  }, [reload, refreshMs]);

  return { data, error, loading, reload, setData };
}
