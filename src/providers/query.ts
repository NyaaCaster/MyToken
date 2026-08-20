/**
 * src/providers/query.ts
 *
 * 供应商查询/归一实现：P4 四家核心（QinyAPI/DeepSeek/OpenCode Go/硅基流动）
 * + P5 五家 Coding Plan（Anthropic/Z.ai/MiniMax/Kimi/OpenRouter）。
 *
 * 查询统一经 P2 代理层：fetch `/api/providers/<id>/query`（同源，dev 由 Vite 转发到
 * Express、prod 由 nginx 转发）。鉴权密钥以 `Authorization: Bearer` 头携带，只发往
 * P2 白名单内的官方域名；QinyAPI 额外以 userId + op 查询参数分派余额/消费日志。
 *
 * 成功 -> 返回归一化的 ProviderResult(ok:true)；
 * 失败/鉴权错误 -> 抛 ProviderError，message 为可直接展示的简体中文文案。
 */
import type {
  ProviderBalance,
  ProviderCredentials,
  ProviderDef,
  ProviderResult,
  ProviderWindow,
} from "../types/provider";

/** new-api quota → 1 展示单位（USD）换算基数：quota_per_unit = 500000。 */
const QUOTA_PER_UNIT = 500000;

/** 消费日志分页累加的最大页数（防失控请求，个人工具足够）。 */
const LOG_MAX_PAGES = 20;

/** 查询失败/鉴权错误：message 为可直接展示的中文文案（lifespan）。 */
export class ProviderError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

/** 请求 P2 代理层，返回上游原始 JSON（已解包 {ok,data}）。非 2xx / ok=false 抛 ProviderError。 */
async function proxyFetch(
  id: string,
  opts: { auth?: string; params?: Record<string, string | number>; signal?: AbortSignal },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.auth) headers.Authorization = `Bearer ${opts.auth}`;

  const resp = await fetch(`/api/providers/${encodeURIComponent(id)}/query${suffix}`, {
    method: "GET",
    headers,
    signal: opts.signal,
  });

  let ok = false;
  let data: unknown = null;
  let code: number | null = null;
  let message: string | null = null;
  try {
    const parsed = (await resp.json()) as {
      ok?: unknown;
      data?: unknown;
      code?: unknown;
      message?: unknown;
    } | null;
    if (parsed && typeof parsed === "object") {
      ok = parsed.ok === true;
      data = parsed.data ?? null;
      if (typeof parsed.code === "number") code = parsed.code;
      if (typeof parsed.message === "string") message = parsed.message;
    }
  } catch {
    /* 非 JSON 响应 */
  }

  if (!resp.ok || !ok) {
    const c = code ?? resp.status;
    const m =
      message ||
      (resp.ok ? "查询失败：上游返回异常" : `查询失败（HTTP ${resp.status}）`);
    throw new ProviderError(m, c);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/** 宽容取数值：字符串解析为浮点，其余按 Number 转换，非有限数归 0。 */
function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 今日 0 点 ~ 现在的 Unix 秒（本地时区，匹配 new-api 时间口径）。 */
function todayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { start: Math.floor(start.getTime() / 1000), end: Math.floor(now.getTime() / 1000) };
}

/** 宽容取数值，缺省/非法返回 null（用于区分「缺失」与「0」）。 */
function rawNum(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 取对象的 object 子字段；非对象返回 undefined。 */
function objectField(data: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = data[key];
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

/**
 * 把 unix 秒（数字或数字字符串）/ ISO 字符串归一为 ISO 字符串；无法解析返回 undefined。
 * 用于各家 resets_at / resetsAt / period_end 的重置时间展示。
 */
function fmtResets(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return new Date(v * 1000).toISOString();
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 1e8) return new Date(n * 1000).toISOString();
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return v;
  }
  return undefined;
}

/** 从常见字段名（utilization|percent + resets_at|resetsAt）读取一个用量窗口；缺失返回 undefined。 */
function readWindow(
  row: Record<string, unknown> | undefined,
  label: string,
): ProviderWindow | undefined {
  if (!row) return undefined;
  const percent = toNum(row.utilization) || toNum(row.percent);
  const resetsAt = fmtResets(row.resets_at ?? row.resetsAt);
  return { label, percent, ...(resetsAt ? { resetsAt } : {}) };
}

/** 依据重置时间距现在的跨度，粗判窗口标签（≤48h 视为 5 小时档，否则按周档）。 */
function labelForPeriod(resetsAt: string, now: number): "5小时" | "本周" {
  const t = new Date(resetsAt).getTime();
  if (Number.isNaN(t)) return "本周";
  const hours = (t - now) / 3600000;
  return hours <= 48 ? "5小时" : "本周";
}

/* -------------------------------------------------------------------------- */
/* QinyAPI（new-api）：配额余额 + 今日/累计花费                                  */
/* -------------------------------------------------------------------------- */
async function queryQinyapi(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const token = (creds.token ?? "").trim();
  const userId = (creds.userId ?? "").trim();
  if (!token) throw new ProviderError("缺少 QinyAPI 访问令牌");
  if (!userId) throw new ProviderError("缺少 QinyAPI 用户 ID");

  const auth = token;
  const base = { userId };

  // 余额：GET /api/user/self（?op 缺省 self）
  const self = await proxyFetch("qinyapi", { auth, params: base, signal });
  const quota = toNum((self.data as Record<string, unknown> | undefined)?.quota);
  const usedQuota = toNum((self.data as Record<string, unknown> | undefined)?.used_quota);

  const balance: ProviderBalance = {
    amount: quota / QUOTA_PER_UNIT,
    currency: "USD",
    label: "可用余额",
  };
  const stats: { total: number; today?: number } = { total: usedQuota / QUOTA_PER_UNIT };

  // 今日花费（best-effort）：GET /api/log/self?type=2&start/end_timestamp 分页累加 quota。
  try {
    const range = todayRange();
    let page = 1;
    let collected = 0;
    let total = Infinity;
    let spent = 0;
    while (page <= LOG_MAX_PAGES && collected < total) {
      const log = await proxyFetch("qinyapi", {
        auth,
        params: {
          userId,
          op: "log",
          type: 2,
          start_timestamp: range.start,
          end_timestamp: range.end,
          p: page,
          page_size: 100,
        },
        signal,
      });
      total = toNum((log.data as Record<string, unknown> | undefined)?.total);
      const items = ((log.data as Record<string, unknown> | undefined)?.items ?? []) as unknown[];
      if (items.length === 0) break;
      for (const it of items) {
        spent += toNum((it as Record<string, unknown> | null)?.quota);
      }
      collected += items.length;
      page += 1;
    }
    stats.today = spent / QUOTA_PER_UNIT;
  } catch {
    // 今日花费统计失败不影响余额展示
  }

  return { ok: true, balance, stats, raw: self };
}

/* -------------------------------------------------------------------------- */
/* DeepSeek 官方：仅余额（balance_infos 多币种，CNY 优先 + 正余额挑选）           */
/* -------------------------------------------------------------------------- */
interface BalanceInfo {
  currency: string;
  total_balance: number;
}

/** 复用「CNY 优先 + 正余额」挑选逻辑（见 .ref 供应商调研 §1.1）。 */
function pickBalanceInfo(infos: BalanceInfo[]): BalanceInfo | undefined {
  return (
    infos.find((i) => i.currency === "CNY" && i.total_balance > 0) ??
    infos.find((i) => i.total_balance > 0) ??
    infos.find((i) => i.currency === "CNY") ??
    infos[0]
  );
}

async function queryDeepseek(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 DeepSeek API Key");

  const data = await proxyFetch("deepseek", { auth: apiKey, signal });
  const infos: BalanceInfo[] = Array.isArray(data.balance_infos)
    ? data.balance_infos.map((it) => {
        const row = (it ?? {}) as Record<string, unknown>;
        return { currency: String(row.currency ?? ""), total_balance: toNum(row.total_balance) };
      })
    : [];
  const picked = pickBalanceInfo(infos);
  if (!picked) throw new ProviderError("DeepSeek 返回数据中无余额信息");

  const balance: ProviderBalance = {
    amount: picked.total_balance,
    currency: picked.currency || "CNY",
    label: "余额",
  };
  return { ok: true, balance, raw: data };
}

/* -------------------------------------------------------------------------- */
/* OpenCode Go：订阅用量（rolling 5h / weekly 本周 / monthly 本月）              */
/* -------------------------------------------------------------------------- */
async function queryOpencodeGo(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 OpenCode Go API Key");

  const data = await proxyFetch("opencode-go", { auth: apiKey, signal });
  const usage = (data.usage ?? {}) as Record<string, unknown>;

  const build = (key: string, label: string): ProviderWindow | undefined => {
    const w = usage[key];
    if (!w || typeof w !== "object") return undefined;
    const row = w as Record<string, unknown>;
    return {
      label,
      percent: toNum(row.percent),
      ...(typeof row.resetsAt === "string" ? { resetsAt: row.resetsAt } : {}),
    };
  };

  const windows = [
    build("rolling", "5小时"),
    build("weekly", "本周"),
    build("monthly", "本月"),
  ].filter((w): w is ProviderWindow => w !== undefined);

  if (windows.length === 0) throw new ProviderError("OpenCode Go 未返回可用窗口数据");
  return { ok: true, windows, raw: data };
}

/* -------------------------------------------------------------------------- */
/* 硅基流动：余额（data.activeBalance 可用 / totalBalance 总，单位元）           */
/* -------------------------------------------------------------------------- */
async function querySiliconflow(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少硅基流动 API Key");

  const data = await proxyFetch("siliconflow", { auth: apiKey, signal });
  const info = ((data.data as Record<string, unknown> | undefined) ?? data) as Record<string, unknown>;
  const active = toNum(info.activeBalance);
  const currency =
    typeof info.currency === "string" && info.currency ? info.currency : "CNY";

  const balance: ProviderBalance = {
    amount: active,
    currency,
    label: "可用余额",
  };
  return { ok: true, balance, raw: data };
}

/* -------------------------------------------------------------------------- */
/* 5 家 Coding Plan（P5）：Anthropic / Z.ai / MiniMax / Kimi / OpenRouter       */
/* -------------------------------------------------------------------------- */

/** Anthropic：five_hour / seven_day 订阅窗口（utilization 已用% + resets_at unix 秒）。 */
async function queryAnthropic(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 Anthropic OAuth 令牌 / API Key");

  const data = await proxyFetch("anthropic", { auth: apiKey, signal });
  const windows = [
    readWindow(objectField(data, "five_hour"), "5小时"),
    readWindow(objectField(data, "seven_day"), "本周"),
  ].filter((w): w is ProviderWindow => w !== undefined);

  if (windows.length === 0) throw new ProviderError("Anthropic 未返回可用订阅窗口");
  return { ok: true, windows, raw: data };
}

/** Z.ai / 智谱：兼容 plans[]（status/total_units/used_units/period_end）与扁平 five_hour/weekly 两种形态。 */
async function queryZai(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 Z.ai API Key");

  const data = await proxyFetch("zai", { auth: apiKey, signal });
  const windows: ProviderWindow[] = [];

  const plans = Array.isArray(data.plans) ? data.plans : [];
  if (plans.length > 0) {
    const now = Date.now();
    for (const p of plans as unknown[]) {
      const row = (p ?? {}) as Record<string, unknown>;
      if (toNum(row.status) === 3) continue; // 不限量跳过
      const total = toNum(row.total_units);
      const used = toNum(row.used_units);
      if (total <= 0) continue;
      const percent = Math.min(100, Math.max(0, (used / total) * 100));
      const resetsAt = fmtResets(row.period_end);
      const label = resetsAt ? labelForPeriod(resetsAt, now) : "窗口";
      windows.push({ label, percent, ...(resetsAt ? { resetsAt } : {}) });
    }
  }

  // 扁平形态兜底
  if (windows.length === 0) {
    windows.push(
      ...[
        readWindow(objectField(data, "five_hour"), "5小时"),
        readWindow(
          objectField(data, "weekly") ?? objectField(data, "week") ?? objectField(data, "seven_day"),
          "本周",
        ),
      ].filter((w): w is ProviderWindow => w !== undefined),
    );
  }

  if (windows.length === 0) throw new ProviderError("Z.ai 未返回可用用量数据");
  return { ok: true, windows, raw: data };
}

/** MiniMax Token Plan：model_remains[] 取 general 行，剩% → 已用%（100-remaining）；status=3 不限量。 */
async function queryMinimax(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 MiniMax API Key");

  const data = await proxyFetch("minimax", { auth: apiKey, signal });
  const rows = (Array.isArray(data.model_remains) ? data.model_remains : []) as unknown[];
  const row = (rows.find((r) => {
    const name = String(((r ?? {}) as Record<string, unknown>).model_name ?? "").toLowerCase();
    return name.startsWith("general");
  }) ??
    rows.find((r) => /minimax-m/i.test(String(((r ?? {}) as Record<string, unknown>).model_name ?? ""))) ??
    rows[0]) as Record<string, unknown> | undefined;

  if (!row) throw new ProviderError("MiniMax 未返回可用用量数据");

  const status = toNum(row.current_interval_status);
  if (status === 3) {
    return { ok: true, windows: [{ label: "不限量", percent: 0 }], raw: data };
  }

  const windows: ProviderWindow[] = [];
  const intervalRemain = rawNum(row.current_interval_remaining_percent);
  const weeklyRemain = rawNum(row.current_weekly_remaining_percent);
  const remainToUsed = (r: number | null) =>
    r === null ? null : Math.min(100, Math.max(0, 100 - r));
  const intervalUsed = remainToUsed(intervalRemain);
  const weeklyUsed = remainToUsed(weeklyRemain);
  if (intervalUsed !== null) windows.push({ label: "5小时", percent: intervalUsed });
  if (weeklyUsed !== null) windows.push({ label: "本周", percent: weeklyUsed });

  if (windows.length === 0) throw new ProviderError("MiniMax 未返回可用用量数据");
  return { ok: true, windows, raw: data };
}

/** Kimi / Moonshot：available_balance（分，<100 视为已是元）→ 余额文本 CNY。 */
async function queryKimi(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 Kimi API Key");

  const data = await proxyFetch("kimi", { auth: apiKey, signal });
  const d = objectField(data, "data") ?? data;

  let v = rawNum(d.available_balance);
  if (v === null) v = rawNum(d.balance);
  if (v === null) v = rawNum(d.cash_balance);
  if (v === null) v = 0;
  const amount = v < 100 ? v : v / 100; // 分 → 元

  const balance: ProviderBalance = { amount, currency: "CNY", label: "可用余额" };
  return { ok: true, balance, raw: data };
}

/** OpenRouter：data.total_credits/total_usage（美元）→ 已用% + 剩余。 */
async function queryOpenrouter(
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const apiKey = (creds.apiKey ?? "").trim();
  if (!apiKey) throw new ProviderError("缺少 OpenRouter API Key");

  const data = await proxyFetch("openrouter", { auth: apiKey, signal });
  const d = objectField(data, "data") ?? data;
  const total = toNum(d.total_credits);
  const used = toNum(d.total_usage);
  if (total <= 0) throw new ProviderError("OpenRouter 未返回可用 credits 数据");

  const resetsAt = fmtResets(d.resets_at ?? d.resetsAt);
  const windows: ProviderWindow[] = [
    {
      label: "Credits",
      percent: Math.min(100, Math.max(0, (used / total) * 100)),
      ...(resetsAt ? { resetsAt } : {}),
    },
  ];
  return { ok: true, windows, raw: data };
}

/* -------------------------------------------------------------------------- */
/* 统一入口                                                                      */
/* -------------------------------------------------------------------------- */
export function queryProvider(
  def: ProviderDef,
  creds: ProviderCredentials,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  switch (def.id) {
    case "qinyapi":
      return queryQinyapi(creds, signal);
    case "deepseek":
      return queryDeepseek(creds, signal);
    case "opencode-go":
      return queryOpencodeGo(creds, signal);
    case "siliconflow":
      return querySiliconflow(creds, signal);
    case "anthropic":
      return queryAnthropic(creds, signal);
    case "zai":
      return queryZai(creds, signal);
    case "minimax":
      return queryMinimax(creds, signal);
    case "kimi":
      return queryKimi(creds, signal);
    case "openrouter":
      return queryOpenrouter(creds, signal);
    default:
      return Promise.reject(new ProviderError(`未知供应商适配器：${def.id}`));
  }
}
