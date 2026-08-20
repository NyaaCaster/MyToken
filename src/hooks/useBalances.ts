/**
 * src/hooks/useBalances.ts
 *
 * 各供应商查询状态管理（P4）：data / loading / error / lastUpdated。
 * refresh(id, creds) 触发查询并归一到 ProviderResult；成功 resolve 该结果，
 * 失败时把 ProviderError 的中文 message 写进 error 并 resolve null（P6 供
 * 「开关鉴权联动」判断本次鉴权是否成功）。
 */
import { useCallback, useState } from "react";
import { getProvider } from "../providers/registry";
import { queryProvider } from "../providers/query";
import type { ProviderCredentials, ProviderResult } from "../types/provider";

/** 单个供应商的查询状态。 */
export interface ProviderBalanceState {
  loading: boolean;
  error: string | null;
  data: ProviderResult | null;
  lastUpdated: number | null;
}

function initial(): ProviderBalanceState {
  return { loading: false, error: null, data: null, lastUpdated: null };
}

/** 管理各 provider 的查询状态与刷新。 */
export function useBalances() {
  const [states, setStates] = useState<Record<string, ProviderBalanceState>>({});

  const refresh = useCallback(async (id: string, creds: ProviderCredentials) => {
    const def = getProvider(id);
    if (!def) return null;

    setStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? initial()), loading: true, error: null },
    }));

    try {
      const data = await queryProvider(def, creds);
      setStates((prev) => ({
        ...prev,
        [id]: { loading: false, error: null, data, lastUpdated: Date.now() },
      }));
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "查询失败";
      setStates((prev) => ({
        ...prev,
        [id]: { loading: false, error: message, data: null, lastUpdated: Date.now() },
      }));
      return null;
    }
  }, []);

  const clear = useCallback((id: string) => {
    setStates((prev) => ({ ...prev, [id]: initial() }));
  }, []);

  const getState = useCallback(
    (id: string): ProviderBalanceState => states[id] ?? initial(),
    [states],
  );

  return { states, getState, refresh, clear } as const;
}
