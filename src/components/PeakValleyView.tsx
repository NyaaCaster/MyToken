/**
 * src/components/PeakValleyView.tsx
 *
 * 价格峰谷展示（参考费用统计插件的「经典分段与胶囊芯片」峰谷）：
 *  - 24 小时「胶囊分段条」：峰时段高亮蓝、空闲时段灰，当前小时带高亮环。
 *  - 峰时段窗口文字说明（UTC）+ 当前处于峰/空闲。
 *  - 各模型「空闲 / 峰」两档价（$ / 1M tokens：缓存命中 / 未命中 / 输出）。
 * 数据静态来自 registry 的 provider.peak（DeepSeek 官方定价）。
 */
import { Fragment } from "react";
import type { ProviderPeak } from "../types/provider";

function isPeakHour(hour: number, windows: ProviderPeak["windows"]): boolean {
  return windows.some((w) => {
    const { start, end } = w;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end; // 跨午夜窗口（本配置不会出现，兼容）
  });
}

function fmtPx(n: number): string {
  return `$${n.toLocaleString("zh-CN", { maximumFractionDigits: 4 })}`;
}

export function PeakValleyView({ peak }: { peak: ProviderPeak }) {
  const nowHour = new Date().getUTCHours();
  const inPeak = isPeakHour(nowHour, peak.windows);
  const modelIds = Object.keys(peak.models);

  return (
    <div className="space-y-3">
      {/* 标题 + 当前相位 */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          价格峰谷（{peak.tz || "UTC"} 时区）
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

      {/* 峰时段说明 */}
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

      {/* 各模型 空闲/峰 两档价（$ / 1M tokens） */}
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <th className="px-2 py-1.5 font-medium">模型</th>
              <th className="px-2 py-1.5 font-medium">档位</th>
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
                <Fragment key={id}>
                  <tr className="border-t border-gray-100 dark:border-white/5">
                    <td className="px-2 py-1.5 font-medium" rowSpan={2}>
                      {id}
                    </td>
                    <td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400">
                      空闲
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.offPeak.cacheHit)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.offPeak.cacheMiss)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.offPeak.output)}</td>
                  </tr>
                  <tr className="border-t border-gray-100 dark:border-white/5">
                    <td className="px-2 py-1.5 text-blue-600 dark:text-blue-400">峰</td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.peak.cacheHit)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.peak.cacheMiss)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtPx(m.peak.output)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
