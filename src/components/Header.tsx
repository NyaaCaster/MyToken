import { Wallet } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemeMode } from "../hooks/useTheme";

const REPO_URL = "https://github.com/NyaaCaster/MyToken";

interface HeaderProps {
  themeMode: ThemeMode;
  onCycleTheme: () => void;
}

/** 顶栏：左侧 icon + MyToken（点击跳仓库，新开标签），右侧图标功能区（主题切换最右）。 */
export function Header({ themeMode, onCycleTheme }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/70 backdrop-blur-xl dark:border-white/5 dark:bg-[#0A0A0A]/70">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="MyToken 仓库"
          className="group flex items-center gap-2.5"
        >
          {/* 蓝紫渐变 Logo 方块 */}
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-glow">
            <Wallet className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-gray-900 transition group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
            MyToken
          </span>
        </a>

        {/* 右侧图标按钮区：后续功能从右向左增加，主题切换在最右 */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle mode={themeMode} onCycle={onCycleTheme} />
        </div>
      </div>
    </header>
  );
}
