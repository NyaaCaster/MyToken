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
    // 今日消耗（P8）：官方无统计接口 → 每次成功查询记录一条余额采样，按
    // 「当日最早采样 → 当前」的余额净减少估算（充值用 topped_up_balance 剔除）。
    // 口径与误差来源见 .docs/设计-P8-今日消耗估算.md 与 public/docs/deepseek.md。
    dailySpend: true,
    // 价格峰谷：人民币价（元/百万 tokens，CNY），空闲价 = 高峰价的一半（高峰 = 2 × 空闲）。
    // 新价依据：DeepSeek 开放平台调价公告（2026-09-09 发布，北京时间 2026-09-10 12:00 生效）——
    //   flash 系列 空闲 0.02/1/4、高峰 0.04/2/8。
    //   公告逐字转载（含平台公告截图）：https://www.dzwww.com/news/yw/202609/t20260909_18097412.htm
    //   官方通知邮件（V4.1 Flash 新定价 + pro 下线路由）：https://m.ithome.com/html/1000692.htm
    //   证据等级：官方一手公告页 platform.deepseek.com/announcements 需登录（未登录仅返回 SPA 空壳），
    //   故一级可核查载体为上述逐字转载 + 官方公告/通知邮件截图。
    //   官方定价页 https://api-docs.deepseek.com/zh-cn/quick_start/pricing 截至 2026-09-10 13:04–13:06
    //   两次独立复核仍为调价前价格（0.05/1.5/4.5、0.10/3.0/9.0，页面滞后）
    //   ——即 flash 新价**不是**来自定价页。
    // 时段（未变，依据官方定价页脚注）：高峰 = 北京时间周一至周五 9:00-12:00、14:00-18:00，
    //   其余（含周末全天）为空闲。
    // deepseek-v4-pro：公告未调价，维持原值；自北京时间 2026-09-14 12:00 起 pro 将下线并路由到
    //   V4.1 Flash、按 V4.1 Flash 计费。
    // TODO(2026-09-14): 复核 deepseek-v4-pro 行口径（届时请求路由到 V4.1 Flash 并按 Flash 价计费）
    // 与 public/docs/deepseek.md 的「价格峰谷」表同步维护（官方调价时两处一起改）。
    peak: {
      windows: [
        { start: 9, end: 12 },
        { start: 14, end: 18 },
      ],
      tz: "北京时间",
      currency: "CNY",
      models: {
        "deepseek-v4-flash": {
          offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
          peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
        },
        // deepseek-v4-flash-vision-exp：属 flash 系列（公告口径），与 deepseek-v4-flash 同标准同价。
        // 结构证据（在售且与 flash 同价）来自官方定价页与 news260821；新价那一侧同属公告口径。
        "deepseek-v4-flash-vision-exp": {
          offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
          peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
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
