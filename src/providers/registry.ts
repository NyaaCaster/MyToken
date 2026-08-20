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
    // 价格峰谷：直接采用 DeepSeek 官网中文定价页的人民币价 + 官方北京峰时段
    // （官网明确：高峰时段为北京时间 9:00-12:00、14:00-18:00；价格单位 元/百万tokens）
    peak: {
      windows: [
        { start: 9, end: 12 },
        { start: 14, end: 18 },
      ],
      tz: "北京时间",
      currency: "CNY",
      models: {
        "deepseek-v4-flash": {
          offPeak: { cacheHit: 0.05, cacheMiss: 1.5, output: 4.5 },
          peak: { cacheHit: 0.1, cacheMiss: 3.0, output: 9.0 },
        },
        "deepseek-v4-pro": {
          offPeak: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 },
          peak: { cacheHit: 0.3, cacheMiss: 9.0, output: 27.0 },
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
