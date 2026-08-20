/**
 * src/components/SecretInput.tsx（P6）
 *
 * 密钥输入框：type=password 隐藏显示 + 眼睛切换可见 + 复制按钮。
 * 受控组件（value/onChange 交给父级持久化到 localStorage）。
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

export interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 关联 label 的 id（可选） */
  id?: string;
}

export function SecretInput({ value, onChange, placeholder, id }: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type={revealed ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-16 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-[#111] dark:text-gray-100"
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        <button
          type="button"
          title={revealed ? "隐藏密钥" : "显示密钥"}
          aria-label={revealed ? "隐藏密钥" : "显示密钥"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setRevealed((v) => !v)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:text-blue-600 dark:hover:text-blue-400"
        >
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
        <button
          type="button"
          title="复制密钥"
          aria-label="复制密钥"
          onClick={copy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:text-blue-600 dark:hover:text-blue-400"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
