/**
 * src/types/provider.ts
 *
 * 供应商适配层核心类型（P4）。
 * 与 P2 代理层（server/src/providers.ts 的 Provider.id 白名单）保持 id 一致：
 *   qinyapi / deepseek / opencode-go / siliconflow。
 */

/** 鉴权输入字段元数据。secret=true 表示输入需隐藏显示（实际 type=password 逻辑在 P6 落地）。 */
export interface AuthField {
  /** 字段键：作为 ProviderCredentials 的 key 使用。 */
  key: string;
  /** 展示标签，如 "访问令牌" / "API Key"。 */
  label: string;
  /** true 表示隐藏显示（密钥类）。 */
  secret?: boolean;
  /** 输入框占位提示。 */
  placeholder?: string;
}

/** 供应商展示形态：余额 / 配额 / 订阅窗口。 */
export type ProviderKind = "balance" | "quota" | "usage-window" | "both";

/** 统一供应商注册描述（对应设计审计 4.2 的 ProviderDef）。 */
export interface ProviderDef {
  /** 唯一 id，与 P2 代理层 /api/providers/:id/query 的 id 一一对应。 */
  id: string;
  /** 展示名。 */
  name: string;
  /** 标题可跳转 url（可选，如 QinyAPI / OpenCode Go / 硅基流动）。 */
  titleUrl?: string;
  /** 展示形态。 */
  kind: ProviderKind;
  /** 鉴权输入字段（secret 字段隐藏显示）。 */
  fields: AuthField[];
  /** 鉴权说明 md（public/docs/<id>.md，P6 浮窗懒加载）。 */
  docPath: string;
  /** 价格峰谷配置（可选，仅支持峰谷计价的供应商提供，如 DeepSeek）。 */
  peak?: ProviderPeak;
}

/** 一档价格（美元 / 1M tokens，DeepSeek 官方结构）。 */
export interface ProviderPriceTier {
  cacheHit: number;
  cacheMiss: number;
  output: number;
}

/** 峰谷窗口（UTC 小时，半开区间 [start, end)）。 */
export interface ProviderPeakWindow {
  start: number;
  end: number;
}

/** 价格峰谷：峰时段窗口 + 各模型的空闲/峰两档价。 */
export interface ProviderPeak {
  windows: ProviderPeakWindow[];
  /** 时区说明，如 "UTC"。 */
  tz: string;
  models: Record<string, { offPeak: ProviderPriceTier; peak: ProviderPriceTier }>;
}

/** 归一化的余额展示。 */
export interface ProviderBalance {
  /** 展示金额（已按各家单位换算：QinyAPI 已 ÷quota_per_unit、硅基流动即元、DeepSeek 即 total_balance）。 */
  amount: number;
  /** 币种，如 "USD" / "CNY"。 */
  currency: string;
  /** 展示标签，如 "可用余额" / "余额"。 */
  label: string;
}

/** 归一化的订阅用量窗口。 */
export interface ProviderWindow {
  /** 窗口标签，如 "5小时" / "本周" / "本月"。 */
  label: string;
  /** 已用百分比（0–100）。 */
  percent: number;
  /** 重置时间（ISO 字符串或原始描述）。 */
  resetsAt?: string;
}

/** 归一化的统计（金额或配额口径由各家适配器决定）。 */
export interface ProviderStats {
  /** 今日量。 */
  today?: number;
  /** 本月量。 */
  month?: number;
  /** 累计量。 */
  total?: number;
}

/**
 * 归一查询结果（成功态）。失败与鉴权错误由 queryProvider 抛 ProviderError，
 * 其中的 message 为可直接展示的简体中文文案（lifespan）。
 */
export interface ProviderResult {
  ok: true;
  balance?: ProviderBalance;
  windows?: ProviderWindow[];
  stats?: ProviderStats;
  /** 各家上游原始响应（调试/展示兜底用）。 */
  raw: unknown;
}

/** 每家供应商的鉴权凭据：AuthField.key -> 用户输入值。 */
export type ProviderCredentials = Record<string, string>;
