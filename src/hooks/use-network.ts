import { useEffect, useState } from "react";
import { Network } from "../core/network";
import type { NetworkData } from "../types";

type NetworkState =
  { status: "loading" } | { status: "ready"; network: Network } | { status: "error"; message: string };

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/network.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<NetworkData>;
      })
      .then((data) => setState({ status: "ready", network: new Network(data) }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, []);

  return state;
}
