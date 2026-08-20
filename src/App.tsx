import { useCallback } from "react";
import { useTheme } from "./hooks/useTheme";
import { Header } from "./components/Header";
import { ProviderModule } from "./components/ProviderModule";
import { useProvidersConfig } from "./hooks/useProvidersConfig";
import { useBalances } from "./hooks/useBalances";
import { providers } from "./providers/registry";

export default function App() {
  const { mode, cycle } = useTheme();
  const { getConfig, setField, setEnabled } = useProvidersConfig();
  const { getState, refresh } = useBalances();

  // 尝试启用：先鉴权（refresh），成功才真正置 enabled —— 对应「开关鉴权联动」。
  const enableProvider = useCallback(
    async (id: string) => {
      const creds = getConfig(id).credentials ?? {};
      const data = await refresh(id, creds);
      if (data) setEnabled(id, true);
      return data !== null;
    },
    [getConfig, refresh, setEnabled],
  );

  const disableProvider = useCallback(
    (id: string) => setEnabled(id, false),
    [setEnabled],
  );

  const refreshProvider = useCallback(
    (id: string) => {
      const creds = getConfig(id).credentials ?? {};
      void refresh(id, creds);
    },
    [getConfig, refresh],
  );

  return (
    <div className="relative min-h-screen bg-canvas text-gray-900 dark:bg-[#0A0A0A] dark:text-gray-100">
      {/* 柔和辉光背景装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-blue-500/5 blur-[120px] dark:bg-blue-500/10" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-500/10" />
      </div>

      <Header themeMode={mode} onCycleTheme={cycle} />

      <main className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">MyToken — 多模型 API 额度聚合面板</h1>

        {/* 供应商模块纵向瀑布容器（注册表渲染四家核心供应商） */}
        <div className="flex flex-col gap-4">
          {providers.map((def) => {
            const config = getConfig(def.id);
            const state = getState(def.id);
            return (
              <ProviderModule
                key={def.id}
                def={def}
                config={config}
                state={state}
                onFieldChange={(key, value) => setField(def.id, key, value)}
                onEnable={() => enableProvider(def.id)}
                onDisable={() => disableProvider(def.id)}
                onRefresh={() => refreshProvider(def.id)}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}
