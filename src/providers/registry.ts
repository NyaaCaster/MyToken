/**
 * src/providers/registry.ts
 *
 * 供应商注册表（P4 四家核心 + P5 五家 Coding Plan）。
 * 只描述「是什么 / 长什么样」，不包含查询逻辑（查询/归一在 query.ts）。
 */
import type { ProviderDef } from "../types/provider";

/** 供应商注册表（QinyAPI / DeepSeek / OpenCode Go / 硅基流动 / 5 家 Coding Plan）。 */
export const providers: ProviderDef[] = [
  {
    id: "qinyapi",
    name: "QinyAPI",
    titleUrl: "https://love.qinyan.icu/register?aff=btB0",
    kind: "balance",
    fields: [
      { key: "token", label: "访问令牌", secret: true, placeholder: "sk-…" },
      { key: "userId", label: "用户 ID", placeholder: "令牌所属用户 id" },
    ],
    docPath: "docs/qinyapi.md",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "balance",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-…" },
    ],
    docPath: "docs/deepseek.md",
    // 价格峰谷（来源 DeepSeek 官方定价；峰时段 01:00-04:00 / 06:00-10:00 UTC）
    peak: {
      windows: [
        { start: 1, end: 4 },
        { start: 6, end: 10 },
      ],
      tz: "UTC",
      models: {
        "deepseek-v4-flash": {
          offPeak: { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 },
          peak: { cacheHit: 0.014, cacheMiss: 0.44, output: 1.32 },
        },
        "deepseek-v4-pro": {
          offPeak: { cacheHit: 0.022, cacheMiss: 0.66, output: 1.98 },
          peak: { cacheHit: 0.044, cacheMiss: 1.32, output: 3.96 },
        },
      },
    },
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    titleUrl: "https://opencode.ai/go?ref=TZCVZ4X21V",
    kind: "usage-window",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-…" },
    ],
    docPath: "docs/opencode-go.md",
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    titleUrl: "https://cloud.siliconflow.cn/i/KJ0qgMuR",
    kind: "balance",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-…" },
    ],
    docPath: "docs/siliconflow.md",
  },

  /* ------------------------- P5 各家 Coding Plan ------------------------- */
  {
    id: "anthropic",
    name: "Anthropic",
    titleUrl: "https://claude.ai/",
    kind: "usage-window",
    fields: [
      { key: "apiKey", label: "OAuth 令牌 / API Key", secret: true, placeholder: "…" },
    ],
    docPath: "docs/anthropic.md",
  },
  {
    id: "zai",
    name: "Z.ai / 智谱",
    titleUrl: "https://www.z.ai/",
    kind: "usage-window",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "…" },
    ],
    docPath: "docs/zai.md",
  },
  {
    id: "minimax",
    name: "MiniMax Token Plan",
    titleUrl: "https://www.minimaxi.com/",
    kind: "usage-window",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-…" },
    ],
    docPath: "docs/minimax.md",
  },
  {
    id: "kimi",
    name: "Kimi / Moonshot",
    titleUrl: "https://platform.moonshot.cn/",
    kind: "balance",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-…" },
    ],
    docPath: "docs/kimi.md",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    titleUrl: "https://openrouter.ai/",
    kind: "usage-window",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "sk-or-…" },
    ],
    docPath: "docs/openrouter.md",
  },
];

/** 按 id 查注册表（未命中返回 undefined）。 */
export function getProvider(id: string): ProviderDef | undefined {
  return providers.find((p) => p.id === id);
}
