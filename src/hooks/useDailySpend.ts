/**
 * src/hooks/useDailySpend.ts
 *
 * 「今日消耗（估算）」的 React 桥接（P8）：
 *   - 通过 `useSyncExternalStore` 订阅 localStorage 采样日志（跨组件 / 跨标签页一致）；
 *   - `spend` 为派生值（当日最早采样 → 当前的余额净减少，剔除充值）；
 *   - `reset` 清空当日样本（异常时手动重置基线，调用方随后应触发一次刷新写新基线）。
 *
 * 采样写入不在这里，而在 `useBalances.refresh` 的成功分支（唯一的查询收敛点）。
 * 口径与算法见 `src/lib/dailySpend.ts` 与 `.docs/设计-P8-今日消耗估算.md`。
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  dailySpendOf,
  getLogSnapshot,
  resetToday as clearTodaySamples,
  subscribeLog,
} from "../lib/dailySpend";
import type { DailySpend } from "../types/provider";

export interface UseDailySpendResult {
  /** 今日消耗（估算）；无当日样本时为 null（此时不展示该行）。 */
  spend: DailySpend | null;
  /** 重置今日基线（清空当日样本）。 */
  reset: () => void;
}

/**
 * @param providerId 供应商 id；传 null 表示不关心（返回 spend=null 且 reset 为空操作）。
 */
export function useDailySpend(providerId: string | null): UseDailySpendResult {
  const log = useSyncExternalStore(subscribeLog, getLogSnapshot);

  const spend = useMemo(
    () => (providerId ? dailySpendOf(log, providerId) : null),
    [log, providerId],
  );

  const reset = useCallback(() => {
    if (providerId) clearTodaySamples(providerId);
  }, [providerId]);

  return { spend, reset };
}
