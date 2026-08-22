/**
 * src/components/ProviderModule.tsx
 *
 * 每个供应商 = 一张完整的圆角卡片（单一视觉对象），内部分三块：
 *   1. 标题栏（卡片头部）：左侧标题（可选外链）+ 右侧成组 [刷新][设置][启用开关]。
 *      - 「刷新/设置」图标按钮仅启用时显示，紧挨在启用开关左侧（右对齐成组）。
 *   2. 设置子区块（内嵌）：访问令牌输入、用户 ID 输入（该供应商需要时）+ 认证按钮；
 *      - 未启用验证通过前：开启开关时显示。
 *      - 验证通过启用后：隐藏，改由标题栏「设置」图标再次呼出。
 *   3. 额度数据子区块（内嵌）：余额/窗口/统计；仅启用且非设置态时显示。
 *
 * 设计：卡片壳（rounded-2xl）由本组件统一提供；标题栏与内容子区块用内嵌
 * （border-t 分隔 + 次级底色 rounded-xl）形成「基座的标题栏 vs 子区块」层级，
 * 避免平级割裂。自动刷新（打开/定时）由 App 统一调度。
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Info, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { ProviderCard } from "./ProviderCard";
import { SecretInput } from "./SecretInput";
import { ProviderDocModal } from "./ProviderDocModal";
import { PeakValleyView } from "./PeakValleyView";
import type { ProviderDef, ProviderResult, ProviderStats } from "../types/provider";
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

/* ---------------- 展示工具 ---------------- */

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
    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-white/5">
      <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

/** 归一结果渲染：余额 / 统计 / 订阅窗口。 */
function ResultView({
  data,
  storageKey,
}: {
  data: ProviderResult;
  storageKey: string;
}) {
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

      {/* 今日/累计 下方的「按模型统计」折叠项（仅今日，状态存 localStorage） */}
      {data.stats && <ByModelStat items={data.stats.byModel} storageKey={storageKey} />}

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

/** 按模型统计折叠项：今日各模型消费金额（降序）+ 横向柱状图（最大=100%）。 */
function ByModelStat({
  items,
  storageKey,
}: {
  items: ProviderStats["byModel"];
  storageKey: string;
}) {
  const [open, setOpen] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        window.localStorage.getItem(`mytoken-bymodel-${storageKey}`) === "1"
      );
    } catch {
      return false;
    }
  });
  if (!items || items.length === 0) return null;

  const toggle = () => {
    const n = !open;
    setOpen(n);
    try {
      window.localStorage.setItem(`mytoken-bymodel-${storageKey}`, n ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const max = items[0]?.amount ?? 0;

  return (
    <div className="border-t border-gray-100 pt-3 dark:border-white/5">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        按模型统计（{items.length}）
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {items.map((it) => (
            <div key={it.model}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">
                  {it.model}
                </span>
                <span className="font-medium tabular-nums">
                  {formatAmount(it.amount)} USD
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                  style={{
                    width: `${max > 0 ? Math.max(2, (it.amount / max) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 供应商模块 ---------------- */

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

  const [editing, setEditing] = useState(false); // 未启用时：开关 ON 展开设置子区块
  const [settingsOpen, setSettingsOpen] = useState(false); // 已启用后：点「设置」图标再呼出
  const [pending, setPending] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const showSettings = enabled ? settingsOpen : editing;
  const showData = enabled && !showSettings;

  const secretEmpty = def.fields
    .filter((f) => f.secret)
    .some((f) => !(config.credentials[f.key] ?? "").trim());

  const handleSwitch = async (next: boolean) => {
    if (pending) return;
    if (!next) {
      setPending(false);
      setEditing(false);
      setSettingsOpen(false);
      onDisable();
      return;
    }
    setEditing(true);
    if (secretEmpty) return;
    setPending(true);
    const ok = await onEnable();
    setPending(false);
    if (ok) {
      setEditing(false);
      setSettingsOpen(false);
    }
  };

  const handleEnable = async () => {
    if (pending) return;
    setPending(true);
    const ok = await onEnable();
    setPending(false);
    if (ok && !enabled) setEditing(false);
  };

  // 标题栏右侧成组按钮 [刷新][设置]，仅启用时显示，紧挨开关左侧。
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
        title={showSettings ? "收起设置" : "设置密钥"}
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
    <section className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 shadow-elevation-1 backdrop-blur-xl transition hover:shadow-elevation-2 dark:border-white/10 dark:bg-[#1A1A1A]/80">
      {/* 区块 1：标题栏（卡片头部） */}
      <ProviderCard
        name={def.name}
        titleUrl={def.titleUrl}
        enabled={enabled}
        pending={pending}
        onToggle={handleSwitch}
        actions={actions}
      />

      {/* 区块 2：设置子区块（内嵌） */}
      <AnimatePresence initial={false}>
        {showSettings && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-white/5">
              <div className="rounded-xl bg-gray-50/70 p-4 dark:bg-white/[0.04]">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 区块 3：额度数据子区块（内嵌） */}
      <AnimatePresence initial={false}>
        {showData && (
          <motion.div
            key="data"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-white/5">
              <div className="rounded-xl bg-gray-50/70 p-4 dark:bg-white/[0.04]">
                {state.data ? (
                  <>
                    <ResultView data={state.data} storageKey={def.id} />
                    {state.error && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                        <span aria-hidden>⚠</span> 刷新失败：{state.error}（保留上次数据）
                      </p>
                    )}
                  </>
                ) : state.error ? (
                  <p className="flex items-center gap-1.5 text-sm text-red-500">
                    <span aria-hidden>⚠</span> {state.error}
                  </p>
                ) : state.loading ? (
                  <p className="text-sm text-gray-400">查询中…</p>
                ) : (
                  <p className="text-sm text-gray-400">暂无数据 · 点击刷新获取</p>
                )}
                {/* 价格峰谷（DeepSeek 等支持峰谷计价的供应商） */}
                {def.peak && (
                  <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/5">
                    <PeakValleyView peak={def.peak} />
                  </div>
                )}
                {state.lastUpdated && (
                  <p className="mt-2 text-xs text-gray-400">
                    更新于 {new Date(state.lastUpdated).toLocaleTimeString("zh-CN")}
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
