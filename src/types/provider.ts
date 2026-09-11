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
  /**
   * 是否启用「今日消耗（估算）」采样（P8，可选）：
   * 仅余额型且无官方统计接口的供应商（当前 = DeepSeek）打开。
   * 开启后每次成功查询都会记录一条余额采样（localStorage），用于按差值估算今日消耗。
   */
  dailySpend?: boolean;
}

/** 一档价格（币种见 ProviderPeak.currency；DeepSeek 为元/百万 tokens）。 */
export interface ProviderPriceTier {
  cacheHit: number;
  cacheMiss: number;
  output: number;
}

/** 峰谷窗口（小时数，半开区间 [start,end)）；tz 当前仅为说明字段，渲染端固定按 Asia/Shanghai 取值，切换时区供应商需先改渲染端。 */
export interface ProviderPeakWindow {
  start: number;
  end: number;
}

/** 价格峰谷：峰时段窗口 + 各模型的空闲/峰两档价。 */
export interface ProviderPeak {
  windows: ProviderPeakWindow[];
  /** 峰谷窗口所在时区说明（如 "北京时间"/"UTC"）。 */
  tz: string;
  /** 价格币种（如 "CNY" 人民币 / "USD" 美元），展示前缀用。 */
  currency?: string;
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
  /** 赠送余额（可选，DeepSeek `granted_balance`；用于识别赠送余额过期等异常）。 */
  granted?: number;
  /** 充值余额（可选，DeepSeek `topped_up_balance`；用于把充值从「余额净减少」里剔除）。 */
  toppedUp?: number;
}

/** 「今日消耗（估算）」结果（P8，见 src/lib/dailySpend.ts 与 .docs/设计-P8-今日消耗估算.md）。 */
export interface DailySpend {
  /** 估算消耗金额（>= 0；分精度）。 */
  spend: number;
  /** 币种（跟随余额）。 */
  currency: string;
  /** 基线（当日最早一次采样）时刻，Unix 毫秒。 */
  since: number;
  /** 参与计算的样本数。 */
  samples: number;
  /** 疑似异常：短间隔内余额大额减少（可能是赠送余额过期或平台调整）。 */
  suspect: boolean;
  /** 触发异常的金额合计（仅 suspect 时给出）。 */
  suspectAmount?: number;
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
  /** 按模型拆分（金额，降序），由日志类供应商（如 QinyAPI）按模型名累计。 */
  byModel?: Array<{ model: string; amount: number }>;
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
