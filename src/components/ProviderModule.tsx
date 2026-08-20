/**
 * src/components/ProviderModule.tsx
 *
 * P4 引入、P6 交互、本次重构：把每个供应商模块拆成三个区块：
 *   1. 供应商标题栏（ProviderCard）：左侧标题（可选外链）+ 「刷新/设置」图标按钮
 *      （仅启用时显示）+ 启用开关。
 *   2. 设置区块：访问令牌输入、用户 ID 输入（仅该供应商需要时显示）+ 认证按钮。
 *      - 未启用验证通过前：开启开关时显示。
 *      - 验证通过启用后：区块隐藏，改由标题栏「设置」图标按钮再次呼出。
 *   3. 额度数据区块：显示余额/窗口/统计；仅在启用且非「设置」态时显示。
 *
 * 自动刷新：打开页面/定时刷新由 App 统一调度（见 App.tsx 的 refreshAll + 间隔）。
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { ProviderCard } from "./ProviderCard";
import { SecretInput } from "./SecretInput";
import { ProviderDocModal } from "./ProviderDocModal";
import type { ProviderDef, ProviderResult } from "../types/provider";
import type { ProviderBalanceState } from "../hooks/useBalances";
import type { ProviderConfig } from "../hooks/useProvidersConfig";

export interface ProviderModuleProps {
  def: ProviderDef;
  config: ProviderConfig;
  state: ProviderBalanceState;
  onFieldChange: (key: string, value: string) => void;
  /** 尝试启用/重新认证：内部先鉴权，成功才置 enabled；resolve 是否成功 */
  onEnable: () => Promise<boolean>;
  /** 停用（关闭开关） */
  onDisable: () => void;
  /** 手动刷新（已启用时） */
  onRefresh: () => void;
}

function formatAmount(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function formatResets(value: string): string {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `重置 ${date.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return value;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
      <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

/** 归一结果渲染：余额 / 统计 / 订阅窗口。 */
function ResultView({ data }: { data: ProviderResult }) {
  return (
    <div className="space-y-3 text-sm">
      {data.balance && (
        <p className="flex items-baseline gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {data.balance.label}
          </span>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatAmount(data.balance.amount)}
            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
              {data.balance.currency}
            </span>
          </span>
        </p>
      )}

      {data.stats &&
        (data.stats.today !== undefined || data.stats.total !== undefined) && (
          <div className="grid grid-cols-2 gap-2">
            {data.stats.today !== undefined && (
              <Stat label="今日" value={`${formatAmount(data.stats.today)} USD`} />
            )}
            {data.stats.total !== undefined && (
              <Stat label="累计" value={`${formatAmount(data.stats.total)} USD`} />
            )}
          </div>
        )}

      {data.windows && (
        <div className="space-y-2">
          {data.windows.map((w) => (
            <div key={w.label}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{w.label}</span>
                <span>
                  {w.percent.toFixed(1)}% 已用
                  {w.resetsAt ? ` · ${formatResets(w.resetsAt)}` : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                  style={{ width: `${Math.min(100, Math.max(0, w.percent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 单个供应商模块（三区块：标题栏 / 设置 / 额度数据）。 */
export function ProviderModule({
  def,
  config,
  state,
  onFieldChange,
  onEnable,
  onDisable,
  onRefresh,
}: ProviderModuleProps) {
  const enabled = config.enabled;

  // 未启用时：开关 ON 展开设置块（editing）；已启用后：点「设置」图标再呼出设置块。
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  // 设置区块：未启用时由 editing 控制；已启用后由 settingsOpen 控制。
  const showSettings = enabled ? settingsOpen : editing;
  // 额度数据区块：仅启用且非设置态。
  const showData = enabled && !showSettings;

  const secretEmpty = def.fields
    .filter((f) => f.secret)
    .some((f) => !(config.credentials[f.key] ?? "").trim());

  // 开关切换：开启需先鉴权；关闭即收起。
  const handleSwitch = async (next: boolean) => {
    if (pending) return;
    if (!next) {
      setPending(false);
      setEditing(false);
      setSettingsOpen(false);
      onDisable();
      return;
    }
    setEditing(true); // 展开设置块
    if (secretEmpty) return; // 密钥未填：不鉴权，提示填写
    setPending(true);
    const ok = await onEnable();
    setPending(false);
    if (ok) {
      setEditing(false);
      setSettingsOpen(false);
    }
  };

  // 认证/保存（未启用=认证并启用；已启用（设置态）=保存并重新认证）。
  const handleEnable = async () => {
    if (pending) return;
    setPending(true);
    const ok = await onEnable();
    setPending(false);
    if (ok && !enabled) setEditing(false);
  };

  // 标题栏操作按钮（refresh + settings），仅启用时显示；order：[刷新][设置]。
  const actions = enabled ? (
    <>
      <button
        type="button"
        title="刷新额度"
        aria-label="刷新"
        onClick={onRefresh}
        disabled={pending || state.loading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-blue-500/10 hover:text-blue-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-blue-400"
      >
        <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden />
      </button>
      <button
        type="button"
        title="设置密钥"
        aria-label="设置"
        onClick={() => setSettingsOpen((v) => !v)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-blue-500/10 dark:hover:text-blue-400 ${
          showSettings
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>
    </>
  ) : null;

  return (
    <section>
      <ProviderCard
        name={def.name}
        titleUrl={def.titleUrl}
        enabled={enabled}
        pending={pending}
        onToggle={handleSwitch}
        actions={actions}
      />

      {/* 区块 2：设置（密钥输入 + 认证） */}
      <AnimatePresence initial={false}>
        {showSettings && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-2 overflow-hidden"
          >
            <div className="rounded-2xl border border-gray-200/50 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
              <div className="space-y-3">
                {def.fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {f.label}
                      {f.secret && (
                        <button
                          type="button"
                          title="查看密钥获取说明"
                          aria-label={`查看${f.label}获取说明`}
                          onClick={() => setDocOpen(true)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </span>
                    {f.secret ? (
                      <SecretInput
                        id={`${def.id}-${f.key}`}
                        value={config.credentials[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(v) => onFieldChange(f.key, v)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={config.credentials[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => onFieldChange(f.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#111] dark:text-gray-100"
                      />
                    )}
                  </label>
                ))}
              </div>

              {/* 认证错误（在设置块内也显示，便于重认证失败时看到） */}
              {state.error && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
                  <span aria-hidden>⚠</span> {state.error}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={pending || secretEmpty}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  {pending ? "认证中…" : enabled ? "保存并重新认证" : "认证并启用"}
                </button>
                {enabled && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-500/10 dark:text-gray-400"
                  >
                    完成
                  </button>
                )}
                {!enabled && secretEmpty && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    请填写密钥后点击认证
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 区块 3：额度数据 */}
      <AnimatePresence initial={false}>
        {showData && (
          <motion.div
            key="data"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-2 overflow-hidden"
          >
            <div className="rounded-2xl border border-gray-200/50 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
              {state.error ? (
                <p className="flex items-center gap-1.5 text-sm text-red-500">
                  <span aria-hidden>⚠</span> {state.error}
                </p>
              ) : state.loading ? (
                <p className="text-sm text-gray-400">查询中…</p>
              ) : state.data ? (
                <ResultView data={state.data} />
              ) : (
                <p className="text-sm text-gray-400">暂无数据 · 点击刷新获取</p>
              )}
              {state.lastUpdated && (
                <p className="mt-2 text-xs text-gray-400">
                  更新于 {new Date(state.lastUpdated).toLocaleTimeString("zh-CN")}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 鉴权说明浮窗 */}
      <ProviderDocModal
        isOpen={docOpen}
        onClose={() => setDocOpen(false)}
        docPath={def.docPath}
        providerName={def.name}
      />
    </section>
  );
}
