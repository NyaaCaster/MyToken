import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../hooks/useTheme";

interface ThemeToggleProps {
  mode: ThemeMode;
  onCycle: () => void;
}

const CONFIG: Record<
  ThemeMode,
  { icon: typeof Sun; title: string; next: string }
> = {
  light: { icon: Sun, title: "主题：浅色", next: "点击切换为暗色" },
  dark: { icon: Moon, title: "主题：暗色", next: "点击切换为跟随系统" },
  system: { icon: Monitor, title: "主题：跟随系统", next: "点击切换为浅色" },
};

/** 三态循环主题切换按钮：浅色 → 暗色 → 跟随系统(+system)。 */
export function ThemeToggle({ mode, onCycle }: ThemeToggleProps) {
  const { icon: Icon, title, next } = CONFIG[mode];
  const tip = `${title} · ${next}`;
  return (
    <button
      type="button"
      onClick={onCycle}
      title={tip}
      aria-label={tip}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/5 bg-white/60 text-slate-500 shadow-subtle backdrop-blur-xl transition hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-[#111]/60 dark:text-slate-400 dark:hover:text-blue-400"
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
