import { useEffect, useRef } from "react";

type VisibleRefreshOptions = {
  immediate?: boolean;
  refreshOnFocus?: boolean;
};

/** Runs background refreshes only while visible, then catches up on return. */
export function useVisibleRefresh(
  refresh: () => void | Promise<void>,
  intervalMs: number | null,
  options: VisibleRefreshOptions = {},
) {
  const { immediate = true, refreshOnFocus = true } = options;
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    if (immediate) void refreshRef.current();
    const timer = intervalMs == null ? null : window.setInterval(run, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (refreshOnFocus) window.addEventListener("focus", run);
    return () => {
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (refreshOnFocus) window.removeEventListener("focus", run);
    };
  }, [immediate, intervalMs, refreshOnFocus]);
}
