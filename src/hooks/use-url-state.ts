import { useCallback, useEffect, useState } from "react";
import { decodeState, encodeState } from "../core/url-state";
import type { AppState } from "../types";

export function useUrlState(): [AppState, (update: (previous: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => decodeState(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setState(decodeState(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const encoded = encodeState(state);
    const nextHash = encoded ? `#${encoded}` : "";
    if (window.location.hash === nextHash) return;
    const url = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", url);
  }, [state]);

  const update = useCallback((updater: (previous: AppState) => AppState) => setState(updater), []);

  return [state, update];
}
