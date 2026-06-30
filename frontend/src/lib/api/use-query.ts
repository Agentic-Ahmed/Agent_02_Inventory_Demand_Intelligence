"use client";

import * as React from "react";

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refetch: () => void;
}

/**
 * Minimal async-data hook (no react-query in the dep set). Re-runs whenever a
 * value in `deps` changes — pass the session's tenant/role so data refetches on
 * a switch. Guards against setting state after unmount or out-of-order responses.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: React.DependencyList): QueryState<T> {
  const [data, setData] = React.useState<T>();
  const [error, setError] = React.useState<Error>();
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  // Keep the latest fn without making it a dependency (callers pass inline fns).
  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    fnRef
      .current()
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refetch };
}
