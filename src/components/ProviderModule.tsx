/**
 * src/components/ProviderModule.tsx
 *
 * P4 引入、P6 完善交互：把 ProviderCard 外壳 + 密钥输入 + 鉴权说明浮窗 + 查询归一
 * 粘成一个「开启需先鉴权、关闭即收起」的供应商模块。
 *
 * 交互模型：
 * - 开关 OFF：模块收起（仅 ProviderCard 的「标题 + 开关」，见 ProviderCard children 空）。
 * - 点开关 ON：展开编辑器 → 若密钥已填则自动发起鉴权（经 parent.onEnable，
 *   内部走 /api/providers/:id/query）；成功才真正置 enabled 并展开数据；
 *   失败则开关回弹、停留在编辑态并显示红色中文错误。
 * - 密钥未填：停在编辑态提示「请填写密钥后点击认证」。
 * - 每个 secret 字段：隐藏输入 + 眼睛切换 + 复制 + ?（打开鉴权说明 md 浮窗）。
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, RefreshCw, ShieldCheck } from "lucide-react";
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
  /** 尝试启用：内部先鉴权，成功才真正启用；resolve 是否成功 */
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

/** 单个供应商模块（P6 交互版）。 */
export function ProviderModule({
  def,
  config,
  state,
  onFieldChange,
  onEnable,
  onDisable,
  onRefresh,
}: ProviderModuleProps) {
  const [editing, setEditing] = useState(false); // 编辑器展开（未启用时也可展开填密钥）
  const [pending, setPending] = useState(false); // 鉴权进行中
  const [docOpen, setDocOpen] = useState(false);

  const expanded = config.enabled || editing;
  const secretEmpty = def.fields
    .filter((f) => f.secret)
    .some((f) => !(config.credentials[f.key] ?? "").trim());

  // 开关切换：开启需先鉴权；关闭即收起
  const handleSwitch = async (next: boolean) => {
    if (pending) return;
    if (!next) {
      setPending(false);
      setEditing(false);
      onDisable();
      return;
    }
    setEditing(true); // 展开编辑器
    if (secretEmpty) return; // 密钥未填：不鉴权，提示用户填写
    setPending(true);
    await onEnable();
    setPending(false);
    // 成功 -> parent 已 setEnabled(true)（真开启+展开数据）；失败 -> 开关回弹，停编辑态显示错误
  };

  // 编辑态「认证并启用」按钮
  const handleEnable = async () => {
    if (pending) return;
    setPending(true);
    await onEnable();
    setPending(false);
  };

  return (
    <section>
      <ProviderCard
        name={def.name}
        titleUrl={def.titleUrl}
        enabled={config.enabled}
        pending={pending}
        onToggle={handleSwitch}
      />

      {/* 展开体：密钥输入 + （启用后）数据；关闭即收起 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="provider-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-2 overflow-hidden"
          >
            <div className="rounded-2xl border border-gray-200/50 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
              {/* 密钥 / 鉴权字段输入 */}
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

              {/* 操作行：未启用 -> 认证并启用；已启用 -> 刷新 */}
              <div className="mt-3 flex items-center gap-2">
                {config.enabled ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={pending || state.loading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                    刷新
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={pending || secretEmpty}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {pending ? "认证中…" : "认证并启用"}
                  </button>
                )}
                {!config.enabled && secretEmpty && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    请填写密钥后点击认证
                  </span>
                )}
                {config.enabled && (
                  <span className="text-xs text-gray-400">已启用 · 可手动刷新</span>
                )}
              </div>

              {/* 错误 / 结果 */}
              <div className="mt-3">
                {state.error && (
                  <p className="flex items-center gap-1.5 text-sm text-red-500">
                    <span aria-hidden>⚠</span> {state.error}
                  </p>
                )}
                {state.loading && !state.error && (
                  <p className="text-sm text-gray-400">查询中…</p>
                )}
                {!state.loading && !state.error && state.data && (
                  <ResultView data={state.data} />
                )}
                {state.lastUpdated && (
                  <p className="mt-2 text-xs text-gray-400">
                    更新于{" "}
                    {new Date(state.lastUpdated).toLocaleTimeString("zh-CN")}
                  </p>
                )}
              </div>
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
