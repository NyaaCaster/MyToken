/**
 * src/components/ProviderDocModal.tsx（P6）
 *
 * 鉴权密钥获取说明浮窗：复用 BaseModal 壳 + fetch(public/docs/<id>.md) 懒加载 +
 * react-markdown + prose 渲染（参考 NyaaChat ComfyWorkflowInfoModal 模式）。
 * - docPath 缺省按站点根解析（"/docs/<id>.md"）。
 * - 链接 target=_blank，不离开应用。
 * - 三个状态：content===null(加载中) / 内容 / error(失败)。
 */
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BaseModal } from "./BaseModal";

export interface ProviderDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 供应商说明 md 路径（registry 的 docPath，如 "docs/qinyapi.md"） */
  docPath: string;
  /** 供应商展示名（用于标题） */
  providerName: string;
}

export function ProviderDocModal({
  isOpen,
  onClose,
  docPath,
  providerName,
}: ProviderDocModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const resolvedPath = docPath.startsWith("/") ? docPath : `/${docPath}`;

  // 重试：清空错误并重新拉取（触发下方 useEffect）
  const reload = () => {
    setError(false);
    setContent(null);
  };

  useEffect(() => {
    if (!isOpen || content !== null || error) return;
    let cancelled = false;
    fetch(resolvedPath)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedPath, content, error]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${providerName} · 获取密钥说明`}
      maxWidth="max-w-2xl"
    >
      {error ? (
        <div className="flex flex-col items-start gap-2 text-sm text-red-500">
          <p>
            加载说明失败（{docPath} 缺失或网络异常）。
          </p>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
          >
            重试
          </button>
        </div>
      ) : content === null ? (
        <p className="text-sm text-gray-400">加载中…</p>
      ) : (
        <div className="provider-doc prose prose-sm md:prose-base max-w-none dark:prose-invert prose-a:text-blue-600 prose-headings:tracking-tight dark:prose-a:text-blue-400">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </Markdown>
        </div>
      )}
    </BaseModal>
  );
}
