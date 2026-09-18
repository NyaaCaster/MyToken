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
    // 【模型列表】官方 2026-09-10 发布 DeepSeek-V4.1 Flash，并更改 API 模型名：
    //   - flash 系列统一为新名 `deepseek-flash`（DeepSeek-V4.1-Flash，552B MoE、原生多模态）；
    //     旧名 `deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 对应的模型已下线，
    //     仅为兼容暂时路由到 V4.1 Flash，按 Flash 单价计费 ⇒ 三者在计费上同一档，
    //     故本表只保留 `deepseek-flash` 一行（不再单列旧名，避免展示已下线模型）。
    //   - `deepseek-v4-pro`（DeepSeek-V4-Pro-0813）继续提供、计费方式不变：官方更新日志
    //     2026-09-10 条目「决定在 2026-09-14 之后继续提供 V4 Pro 的 API 调用服务」；
    //     news260910 原文「9-14 12:00 后路由到 V4.1 Flash」的下线口径已被更新日志覆盖（作废）。
    //   来源：官方新闻 https://api-docs.deepseek.com/zh-cn/news/news260910、
    //     官方更新日志 https://api-docs.deepseek.com/zh-cn/updates（均为一手官方页面，2026-09-18 复核）。
    // 【价格】18 个数值自 2026-09-10 12:00 调价后未再变动（2026-09-18 复核官方定价页逐项一致）：
    //   flash 空闲 0.02/1/4、高峰 0.04/2/8（高峰 = 空闲 ×2）；pro 空闲 0.15/4.5/13.5、高峰 0.3/9/27。
    //   调价依据公告逐字转载（含平台公告截图）：
    //   https://www.dzwww.com/news/yw/202609/t20260909_18097412.htm 、
    //   https://m.ithome.com/html/1000692.htm （官方 API 用户通知邮件截图）。
    //   官方定价页 https://api-docs.deepseek.com/zh-cn/quick_start/pricing 已同步该价，并与本表逐项一致。
    // 时段（依据官方定价页脚注）：高峰 = 北京时间周一至周五 9:00-12:00、14:00-18:00，
    //   其余（含周末全天）为空闲；周末执行低谷价的规则见 2026-08-23 官方公告，渲染端已按此实现。
    // 与 public/docs/deepseek.md 的「价格峰谷」表同步维护（官方调价时两处一起改）。
    peak: {
      windows: [
        { start: 9, end: 12 },
        { start: 14, end: 18 },
      ],
      tz: "北京时间",
      currency: "CNY",
      models: {
        // 官方现行模型名（DeepSeek-V4.1-Flash）。旧名 deepseek-v4-flash /
        // deepseek-v4-flash-vision-exp 已下线并路由到本模型，同价，故不单列。
        "deepseek-flash": {
          offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
          peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
        },
        // DeepSeek-V4-Pro-0813：官方已确认 2026-09-14 之后继续提供、计费方式不变。
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
