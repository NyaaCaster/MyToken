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
  // 最多 2 位小数，无小数则不显示（3 → ¥3、1.5 → ¥1.5、0.05 → ¥0.05）
  return `${sym}${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/** 当前北京时间「星期 + 小时」（真实时区 API，不做硬计算；周末官方全天谷价）。 */
function beijingNow(): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const w = parts.find((p) => p.type === "weekday")?.value ?? "";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { weekday: map[w] ?? 0, hour: h };
}

export function PeakValleyView({ peak }: { peak: ProviderPeak }) {
  // 官方窗口（北京时间 9-12 / 14-18）直接使用，不换算；周末（周六/周日）全天空闲
  const { weekday, hour } = beijingNow();
  const isWeekend = weekday === 0 || weekday === 6;
  const inPeak = !isWeekend && isPeakHour(hour, peak.windows);
  const modelIds = Object.keys(peak.models);
  const currency = peak.currency ?? "USD";

  return (
    <div className="space-y-3">
      {/* 标题 + 当前相位 */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          价格峰谷
        </span>
        <span
          className={
            inPeak
              ? "font-medium text-blue-600 dark:text-blue-400"
              : "font-medium text-emerald-600 dark:text-emerald-400"
          }
        >
          {inPeak ? "峰时段" : "空闲时段"}
        </span>
      </div>

      {/* 24 小时胶囊分段条（周末全天空闲） */}
      <div className="flex gap-[3px]">
        {Array.from({ length: 24 }, (_, h) => {
          const isPeak = !isWeekend && isPeakHour(h, peak.windows);
          return (
            <div
              key={h}
              title={`${String(h).padStart(2, "0")}:00 ${isPeak ? "峰" : "空闲"}`}
              className={`h-4 min-w-0 flex-1 rounded-md transition ${
                isPeak
                  ? "bg-blue-500"
                  : "bg-gray-200 dark:bg-white/10"
              } ${h === hour ? "ring-2 ring-blue-700 dark:ring-blue-400" : ""}`}
            />
          );
        })}
      </div>

      {/* 峰时段说明（北京时间 · 工作日；周末全天空闲） */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {peak.windows.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            峰（工作日）{String(w.start).padStart(2, "0")}:00–{String(w.end).padStart(2, "0")}:00
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-white/20" />
          其余为空闲
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          周六/周日全天空闲
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
                  <td className="px-2 py-1.5 font-medium">
                    {id.replace(/^deepseek-/, "").replace(/^v4-/, "")}
                  </td>
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
