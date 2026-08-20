/**
 * src/components/ProviderCard.tsx
 *
 * P3 引入、P6 完善：供应商模块的「标题 + 启停开关」外壳（presentational）。
 * - 形态固定：左侧标题（可选外链，ExternalLink 新开标签）+ 右侧启停开关。
 * - `pending` 表示正在鉴权（开关禁用并显示加载态，鉴权成功才真正翻转）。
 * - `children` 由父级（ProviderModule）根据展开态注入密钥输入与数据区；
 *   无 children 且未展开时，卡片即「只显示标题+开关」（模块收起）。
 */
import type { ReactNode } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

export interface ProviderCardProps {
  /** 供应商展示名，如 "QinyAPI" */
  name: string;
  /** 标题可跳转 url（可选，如 QinyAPI/OpenCode Go/硅基流动） */
  titleUrl?: string;
  /** 启停开关状态（鉴权成功后才为 true） */
  enabled: boolean;
  /** 鉴权进行中：禁用开关并显示加载态 */
  pending?: boolean;
  /** 切换回调（父级决定是否先鉴权） */
  onToggle: (enabled: boolean) => void;
  /** 展开态内容（密钥输入 / 数据区） */
  children?: ReactNode;
}

export function ProviderCard({
  name,
  titleUrl,
  enabled,
  pending = false,
  onToggle,
  children,
}: ProviderCardProps) {
  const titleContent = titleUrl ? (
    <a
      href={titleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-900 transition hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
    >
      <span className="truncate">{name}</span>
      <ExternalLink
        className="h-3.5 w-3.5 flex-none text-gray-300 transition group-hover:text-blue-500 dark:text-gray-600"
        aria-hidden
      />
    </a>
  ) : (
    <span className="truncate font-medium text-gray-900 dark:text-gray-100">
      {name}
    </span>
  );

  return (
    <div className="rounded-2xl border border-gray-200/50 bg-white/80 p-4 shadow-elevation-1 backdrop-blur-xl transition hover:shadow-elevation-2 dark:border-white/10 dark:bg-[#1A1A1A]/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">{titleContent}</div>

        {/* 启停开关（鉴权中显示加载态并禁用） */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "停用" : "启用"} ${name}`}
          disabled={pending}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-70 ${
            enabled
              ? "bg-gradient-to-r from-blue-600 to-indigo-500"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          {pending ? (
            <Loader2 className="ml-[14px] h-4 w-4 animate-spin text-white" aria-hidden />
          ) : (
            <span
              className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-[22px]" : "translate-x-[3px]"
              }`}
            />
          )}
        </button>
      </div>

      {children}
    </div>
  );
}
