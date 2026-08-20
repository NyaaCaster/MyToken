/**
 * src/hooks/useProvidersConfig.ts
 *
 * 每家供应商的配置持久化（P4）：字段输入值与启用开关。
 * 读写 localStorage：
 *   - mytoken-provider-values：{ providerId: { fieldKey: value } }
 *   - mytoken-provider-enabled：{ providerId: boolean }
 */
import { useCallback, useEffect, useState } from "react";
import { providers } from "../providers/registry";
import type { ProviderCredentials } from "../types/provider";

const VALUES_KEY = "mytoken-provider-values";
const ENABLED_KEY = "mytoken-provider-enabled";

/** 单个供应商的配置快照。 */
export interface ProviderConfig {
  credentials: ProviderCredentials;
  enabled: boolean;
}

/** 从 localStorage 读取全部配置（损坏/缺失时回退默认，永不抛出）。 */
function readConfigs(): Record<string, ProviderConfig> {
  const base: Record<string, ProviderConfig> = {};
  for (const p of providers) base[p.id] = { credentials: {}, enabled: false };

  if (typeof window === "undefined") return base;

  try {
    const v = JSON.parse(
      window.localStorage.getItem(VALUES_KEY) ?? "{}",
    ) as Record<string, Record<string, string>>;
    for (const p of providers) {
      const sv = v?.[p.id];
      if (sv && typeof sv === "object") {
        base[p.id] = { ...base[p.id], credentials: { ...sv } };
      }
    }
  } catch {
    /* 忽略损坏的存储 */
  }

  try {
    const e = JSON.parse(window.localStorage.getItem(ENABLED_KEY) ?? "{}") as Record<
      string,
      boolean
    >;
    for (const p of providers) {
      if (typeof e?.[p.id] === "boolean") {
        base[p.id] = { ...base[p.id], enabled: e[p.id] };
      }
    }
  } catch {
    /* 忽略 */
  }

  return base;
}

/** 管理各 provider 的 credentials + enabled，变更自动持久化到 localStorage。 */
export function useProvidersConfig() {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>(readConfigs);

  // 持久化：任一配置变化即整体重写两个存储键。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const values: Record<string, ProviderCredentials> = {};
    const enabled: Record<string, boolean> = {};
    for (const p of providers) {
      const c = configs[p.id];
      values[p.id] = { ...(c?.credentials ?? {}) };
      enabled[p.id] = !!c?.enabled;
    }
    try {
      window.localStorage.setItem(VALUES_KEY, JSON.stringify(values));
    } catch {
      /* 存储受限时忽略 */
    }
    try {
      window.localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
    } catch {
      /* 忽略 */
    }
  }, [configs]);

  const setField = useCallback((id: string, key: string, value: string) => {
    setConfigs((prev) => {
      const cur = prev[id] ?? { credentials: {}, enabled: false };
      return { ...prev, [id]: { ...cur, credentials: { ...cur.credentials, [key]: value } } };
    });
  }, []);

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setConfigs((prev) => {
      const cur = prev[id] ?? { credentials: {} };
      return { ...prev, [id]: { ...cur, enabled } };
    });
  }, []);

  const getConfig = useCallback(
    (id: string): ProviderConfig => configs[id] ?? { credentials: {}, enabled: false },
    [configs],
  );

  return { configs, getConfig, setField, setEnabled } as const;
}
