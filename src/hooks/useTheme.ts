import { useCallback, useEffect, useState } from "react";

/** 主题模式：浅色 / 暗色 / 跟随系统 */
export type ThemeMode = "light" | "dark" | "system";

/** localStorage 持久化键 */
const STORAGE_KEY = "mytoken-theme";

/** 三态循环顺序：浅色 → 暗色 → 跟随系统 → 浅色 */
const CYCLE_ORDER: ThemeMode[] = ["light", "dark", "system"];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(stored) ? stored : "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * 主题管理 hook（三态循环 + localStorage 持久化 + 跟随系统监听）。
 * - 返回当前选择模式 mode 与解析后的实际主题 resolved（"light" | "dark"）。
 * - 通过给 <html> 挂/去 `.dark` class 切换暗色（与 index.css 的 @custom-variant dark 配合）。
 * - `cycle()` 做 浅色 → 暗色 → 跟随系统 循环，并写入 localStorage。
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    readInitialMode() === "system"
      ? systemPrefersDark()
        ? "dark"
        : "light"
      : (readInitialMode() as "light" | "dark"),
  );

  // 把解析后的实际主题映射到根元素 .dark class
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  // mode 变化：非 system 直接取 mode；system 则监听 prefers-color-scheme 变化
  useEffect(() => {
    if (mode !== "system") {
      setResolved(mode);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => setResolved(mq.matches ? "dark" : "light");
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((prev) => {
      const idx = CYCLE_ORDER.indexOf(prev);
      const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { mode, resolved, cycle } as const;
}
