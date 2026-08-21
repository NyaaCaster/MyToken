/**
 * src/components/PeakValleyView.tsx
 *
 * 价格峰谷展示（参考费用统计插件的「经典分段与胶囊芯片」峰谷）：
 *  - 24 小时「胶囊分段条」：峰时段高亮蓝、空闲时段灰，当前小时带高亮环。
 *  - 峰/谷窗口与价格**直接取自官方**（registry 的 provider.peak：官方人民币价 + 北京峰时段），
 *    不做汇率换算/时区硬计算；当前时刻小时用真实时区（Asia/Shanghai）取得。
 *  - 各模型「空闲 / 峰」两档价（币种由 peak.currency 决定：CNY→¥）。
 * 数据静态来自 registry 的 provider.peak（DeepSeek 官方定价）。
 */
import type { ProviderPeak } from "../types/provider";

function isPeakHour(hour: number, windows: ProviderPeak["windows"]): boolean {
  return windows.some((w) => {
    const { start, end } = w;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end; // 跨午夜窗口（本配置不会出现，兼容）
  });
}

function fmtPx(n: number, currency?: string): string {
  const sym = currency === "CNY" ? "¥" : "$";
  // 固定 1 位小数（即使为 0 也显示 .0）
  return `${sym}${n.toLocaleString("zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

/** 当前小时（按峰谷窗口所在时区：北京时间），用真实时区 API 取得，不做硬计算。 */
function nowHourInBeijing(): number {
  const val = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(val) % 24;
}

export function PeakValleyView({ peak }: { peak: ProviderPeak }) {
  // 官方窗口（北京时间 9-12 / 14-18）直接使用，不换算。
  const nowHour = nowHourInBeijing();
  const inPeak = isPeakHour(nowHour, peak.windows);
  const modelIds = Object.keys(peak.models);
  const currency = peak.currency ?? "USD";

  return (
    <div className="space-y-3">
      {/* 标题 + 当前相位 */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          价格峰谷（{peak.tz || "官方"} · {currency === "CNY" ? "元/百万 tokens" : "$/百万 tokens"}）
        </span>
        <span
          className={
            inPeak
              ? "font-medium text-blue-600 dark:text-blue-400"
              : "font-medium text-emerald-600 dark:text-emerald-400"
          }
        >
          {inPeak ? "当前：峰时段" : "当前：空闲时段"}
        </span>
      </div>

      {/* 24 小时胶囊分段条 */}
      <div className="flex gap-[3px]">
        {Array.from({ length: 24 }, (_, h) => {
          const isPeak = isPeakHour(h, peak.windows);
          return (
            <div
              key={h}
              title={`${String(h).padStart(2, "0")}:00 ${isPeak ? "峰" : "空闲"}`}
              className={`h-4 min-w-0 flex-1 rounded-md transition ${
                isPeak
                  ? "bg-blue-500"
                  : "bg-gray-200 dark:bg-white/10"
              } ${h === nowHour ? "ring-2 ring-blue-700 dark:ring-blue-400" : ""}`}
            />
          );
        })}
      </div>

      {/* 峰时段说明（官方时区） */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {peak.windows.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            峰 {String(w.start).padStart(2, "0")}:00–{String(w.end).padStart(2, "0")}:00
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-white/20" />
          其余为空闲
        </span>
      </div>

      {/* 各模型 两档价，每模型一行；三列各显「空闲 | 峰」，按当前相位着色 */}
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <th className="px-2 py-1.5 font-medium">模型</th>
              <th className="px-2 py-1.5 text-right font-medium">缓存命中</th>
              <th className="px-2 py-1.5 text-right font-medium">未命中</th>
              <th className="px-2 py-1.5 text-right font-medium">输出</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-200">
            {modelIds.map((id) => {
              const m = peak.models[id];
              if (!m) return null;
              return (
                <tr key={id} className="border-t border-gray-100 dark:border-white/5">
                  <td className="px-2 py-1.5 font-medium">{id.replace(/^deepseek-/, "")}</td>
                  <TierCell off={m.offPeak.cacheHit} pk={m.peak.cacheHit} inPeak={inPeak} currency={currency} />
                  <TierCell off={m.offPeak.cacheMiss} pk={m.peak.cacheMiss} inPeak={inPeak} currency={currency} />
                  <TierCell off={m.offPeak.output} pk={m.peak.output} inPeak={inPeak} currency={currency} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 单个价格单元格：显「空闲 | 峰」两价；按当前相位着色（突出当前时段价）。 */
function TierCell({
  off,
  pk,
  inPeak,
  currency,
}: {
  off: number;
  pk: number;
  inPeak: boolean;
  currency?: string;
}) {
  // 当前空闲：空闲价绿(显眼)、峰价灰；当前峰：峰价蓝(显眼)、空闲价灰
  const offCls = inPeak
    ? "text-gray-400 dark:text-gray-500"
    : "font-semibold text-emerald-600 dark:text-emerald-400";
  const pkCls = inPeak
    ? "font-semibold text-blue-600 dark:text-blue-400"
    : "text-gray-400 dark:text-gray-500";
  return (
    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
      <span className={offCls}>{fmtPx(off, currency)}</span>
      <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
      <span className={pkCls}>{fmtPx(pk, currency)}</span>
    </td>
  );
}
