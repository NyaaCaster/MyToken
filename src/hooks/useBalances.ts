/**
 * src/hooks/useBalances.ts
 *
 * 各供应商查询状态管理（P4）：data / loading / error / lastUpdated。
 * refresh(id, creds) 触发查询并归一到 ProviderResult；成功 resolve 该结果，
 * 失败时把 ProviderError 的中文 message 写进 error 并 resolve null（P6 供
 * 「开关鉴权联动」判断本次鉴权是否成功）。
 *
 * P8：成功查询后，若该供应商开了 `def.dailySpend`（当前仅 DeepSeek），顺带记录一条
 * 余额采样（供「今日消耗（估算）」按差值推算）。此处是查询的唯一收敛点，
 * 自动刷新 / 手动刷新 / 启用认证都走它，采样点因此天然一致。
 */
import { useCallback, useRef, useState } from "react";
import { getProvider } from "../providers/registry";
import { queryProvider } from "../providers/query";
import { recordSample } from "../lib/dailySpend";
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
  // ref 镜像最新 states：getState 保持引用稳定，避免 App 的 refreshAll/useEffect
  // 因 states 每次变化而重建 → 每次任一模块刷新完成都触发一轮全量刷新（刷新风暴，
  // 让已完成的模块再次 loading、转圈时间被人为拉长）。
  const statesRef = useRef<Record<string, ProviderBalanceState>>({});
  statesRef.current = states;

  const refresh = useCallback(async (id: string, creds: ProviderCredentials) => {
    const def = getProvider(id);
    if (!def) return null;

    setStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? initial()), loading: true, error: null },
    }));

    try {
      const data = await queryProvider(def, creds);
      // P8：先落采样再更新状态（同一批次渲染即可读到最新采样，避免「今日」慢一拍）
      if (def.dailySpend && data.balance) {
        recordSample(def.id, {
          total: data.balance.amount,
          currency: data.balance.currency,
          granted: data.balance.granted ?? null,
          toppedUp: data.balance.toppedUp ?? null,
        });
      }
      setStates((prev) => ({
        ...prev,
        [id]: { loading: false, error: null, data, lastUpdated: Date.now() },
      }));
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "查询失败";
      // 刷新失败保留上次成功数据（不清空），避免偶发超时直接吞掉展示
      setStates((prev) => ({
        ...prev,
        [id]: {
          loading: false,
          error: message,
          data: prev[id]?.data ?? null,
          lastUpdated: prev[id]?.lastUpdated ?? null,
        },
      }));
      return null;
    }
  }, []);

  const clear = useCallback((id: string) => {
    setStates((prev) => ({ ...prev, [id]: initial() }));
  }, []);

  const getState = useCallback(
    (id: string): ProviderBalanceState => statesRef.current[id] ?? initial(),
    [],
  );

  return { states, getState, refresh, clear } as const;
}
