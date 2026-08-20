/**
 * src/components/BaseModal.tsx（P6）
 *
 * 复用弹窗壳（参考 NyaaChat BaseModal 模式）：
 * - ESC 关闭、点击遮罩关闭、毛玻璃底、body 滚动锁、内容区独立滚动、最大宽度可配。
 * 子弹窗只传 isOpen/onClose/title/maxWidth + body。
 */
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** 内容宽度，如 "max-w-lg" / "max-w-2xl" */
  maxWidth?: string;
  children: ReactNode;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  maxWidth = "max-w-lg",
  children,
}: BaseModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // 锁 body 滚动
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 + 毛玻璃 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* 浮层主体 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[85vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-gray-200/50 bg-white/95 shadow-elevation-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#111]/95`}
      >
        <div className="flex flex-none items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-white/5">
          <h2 className="font-display text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
