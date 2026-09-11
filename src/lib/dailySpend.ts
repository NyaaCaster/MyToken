/**
 * src/lib/dailySpend.ts
 *
 * DeepSeek「今日消耗（估算）」的采样存储 + 计算（P8）。
 *
 * 口径（详见 `.docs/设计-P8-今日消耗估算.md`）：
 *   **今日消耗 = 从「今天第一次采样时刻」到「当前」的余额净减少，并剔除充值。**
 * 之所以是估算：DeepSeek 无官方统计 API，本项目也不做 LLM 流量代理，只能按本机采样的
 * 余额差值推算 —— 首次采样之前、页面关闭期间发生的消耗不可观测（系统性偏低）。
 *
 * 本文件分两层：
 *   - 纯函数（`computeFromSamples` / `pruneSamples` / `bjtDayKey` …）：不依赖浏览器，可离线仿真；
 *   - 存储层（`recordSample` / `getLogSnapshot` / `subscribeLog` / `resetToday`）：
 *     localStorage + 内存缓存 + 订阅（含跨标签页 storage 事件）。
 */
import type { DailySpend } from "../types/provider";

/** localStorage 存储键（结构：{ [providerId]: BalanceSample[] }）。 */
const LOG_KEY = "mytoken-balance-log";

/** 单日样本上限：5 分钟自动刷新 ≈ 288 条/日，留余量；超限保留首条（基线）+ 最新若干条。 */
export const MAX_SAMPLES_PER_DAY = 400;
/** 只保留最近 N 天，避免 localStorage 无界增长。 */
export const KEEP_DAYS = 7;
/** 疑似异常阈值（金额）：短间隔内单笔余额变动达到该值 → 更可能是赠送余额过期/平台调整。 */
export const SUSPECT_DELTA = 5;
/** 异常判据的「短间隔」上限（分钟）：超过该间隔的大额变动视为页面关闭期间的正常消耗，不误报。 */
export const SUSPECT_GAP_MIN = 15;

/** 一次余额采样点。 */
export interface BalanceSample {
  /** 采样时刻（Unix 毫秒）。 */
  t: number;
  /** 归属日（Asia/Shanghai，`YYYY-MM-DD`）：写入时确定，读取端不再按时区重算。 */
  day: string;
  /** 总余额（上游 `total_balance`，两位小数）。 */
  total: number;
  /** 赠送余额（上游 `granted_balance`；上游未给为 null）。 */
  granted: number | null;
  /** 充值余额（上游 `topped_up_balance`；用于把充值从余额净减少里剔除，未给为 null）。 */
  toppedUp: number | null;
  /** 币种（如 CNY / USD）。 */
  currency: string;
}

/** 采样日志：按供应商 id 分组。 */
export interface BalanceLog {
  [providerId: string]: BalanceSample[];
}

/** 写入采样所需的输入（从归一后的 `ProviderBalance` 取）。 */
export interface SampleInput {
  total: number;
  currency: string;
  granted?: number | null;
  toppedUp?: number | null;
}

/* -------------------------------------------------------------------------- */
/* 纯工具                                                                       */
/* -------------------------------------------------------------------------- */

/** 保留两位小数（余额本身即「分」精度，消除浮点减法噪声）。 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? round2(n) : null;
}

/** 北京时间的当日键（`YYYY-MM-DD`，Asia/Shanghai）。 */
export function bjtDayKey(t: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(t));
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 北京时间的 `HH:MM`（展示「自 HH:MM 起」）。 */
export function bjtHm(t: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(t));
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** 日期键加减天数（按 UTC 解析 `YYYY-MM-DD`，与本地时区无关）。 */
export function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + deltaDays * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** 逐条校验采样（损坏/旧版本条目丢弃，避免一条脏数据毁掉整天）。 */
function isSample(v: unknown): v is BalanceSample {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    Number.isFinite(s.t) &&
    typeof s.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.day) &&
    Number.isFinite(s.total) &&
    typeof s.currency === "string" &&
    (s.granted === null || Number.isFinite(s.granted)) &&
    (s.toppedUp === null || Number.isFinite(s.toppedUp))
  );
}

/** 裁剪：丢弃 KEEP_DAYS 之前的日子；当日超限时保留首条（基线）+ 最新若干条。 */
export function pruneSamples(list: BalanceSample[], day: string): BalanceSample[] {
  const minDay = shiftDay(day, -(KEEP_DAYS - 1));
  const kept = list.filter((s) => s.day >= minDay);
  const today = kept.filter((s) => s.day === day);
  if (today.length <= MAX_SAMPLES_PER_DAY) return kept;
  const keep = new Set<BalanceSample>([
    today[0],
    ...today.slice(today.length - (MAX_SAMPLES_PER_DAY - 1)),
  ]);
  return kept.filter((s) => s.day !== day || keep.has(s));
}

/* -------------------------------------------------------------------------- */
/* 计算（纯函数）                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 由样本序列算某日「今日消耗（估算）」。
 *
 * 逐相邻样本对累加（而非只取首末差值，两者在无充值/无异常时等价，但逐对可逐笔剔除充值）：
 *   delta = prev.total − cur.total          // >0 余额减少，<0 余额增加（充值）
 *   topUp = max(0, cur.toppedUp − prev.toppedUp)
 *   part  = delta + topUp                    // 抠掉充值后的净消耗
 *   spend += max(0, part)                    // 杂项增加不计入，避免出现负数
 *
 * 币种漂移：只取与最后一条样本同币种的尾部连续子序列（多币种账户混算无意义）。
 * 异常检测：相邻样本间隔 ≤ SUSPECT_GAP_MIN 分钟且余额减少 ≥ SUSPECT_DELTA → 疑似异常
 *           （赠送余额过期 / 平台调整；正常短时消耗很难达到该额度）。
 */
export function computeFromSamples(samples: BalanceSample[], day: string): DailySpend | null {
  const daySamples = samples.filter((s) => s.day === day);
  if (daySamples.length === 0) return null;

  const currency = daySamples[daySamples.length - 1].currency;
  let start = daySamples.length - 1;
  while (start > 0 && daySamples[start - 1].currency === currency) start -= 1;
  const seq = daySamples.slice(start);

  let spend = 0;
  let suspect = false;
  let suspectAmount = 0;

  for (let i = 1; i < seq.length; i += 1) {
    const prev = seq[i - 1];
    const cur = seq[i];
    const delta = round2(prev.total - cur.total);
    const chargedTopUp =
      prev.toppedUp !== null && cur.toppedUp !== null
        ? Math.max(0, round2(cur.toppedUp - prev.toppedUp))
        : 0;
    const part = round2(delta + chargedTopUp);
    if (part > 0) spend = round2(spend + part);

    const gapMin = (cur.t - prev.t) / 60_000;
    if (delta >= SUSPECT_DELTA && gapMin <= SUSPECT_GAP_MIN) {
      suspect = true;
      suspectAmount = round2(suspectAmount + delta);
    }
  }

  return {
    spend,
    currency,
    since: seq[0].t,
    samples: seq.length,
    suspect,
    ...(suspect ? { suspectAmount } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* 存储层（localStorage + 内存缓存 + 订阅）                                       */
/* -------------------------------------------------------------------------- */

const EMPTY_LOG: BalanceLog = {};
/** 内存缓存（`useSyncExternalStore` 需要 getSnapshot 返回稳定引用，变更时整体替换）。 */
let cache: BalanceLog | null = null;
const listeners = new Set<() => void>();

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function emit(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* 单个订阅者异常不影响其余 */
    }
  }
}

function parseLog(): BalanceLog {
  if (!hasStorage()) return EMPTY_LOG;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LOG_KEY) ?? "{}",
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_LOG;
    const out: BalanceLog = {};
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const rows = list.filter(isSample).sort((a, b) => a.t - b.t);
      if (rows.length > 0) out[id] = rows;
    }
    return out;
  } catch {
    return EMPTY_LOG;
  }
}

/** 读取采样日志快照（带内存缓存，引用稳定）。 */
export function getLogSnapshot(): BalanceLog {
  if (cache === null) cache = parseLog();
  return cache;
}

function writeLog(next: BalanceLog): void {
  cache = next;
  if (hasStorage()) {
    try {
      window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch {
      /* 存储受限/超限时仅内存内生效，不抛出 */
    }
  }
  emit();
}

/** 订阅采样日志变更（返回取消订阅函数）。 */
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 跨标签页同步：另一个标签页写入后本页缓存失效并通知订阅者。
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === LOG_KEY) {
      cache = null;
      emit();
    }
  });
}

/**
 * 记录一次采样（按 `day` 去重：与当日最后一条完全同值时不写入，避免无信息量的膨胀）。
 * 返回是否真的新增。
 */
export function recordSample(
  providerId: string,
  input: SampleInput,
  now: number = Date.now(),
): boolean {
  const day = bjtDayKey(now);
  const sample: BalanceSample = {
    t: now,
    day,
    total: round2(input.total),
    granted: numOrNull(input.granted),
    toppedUp: numOrNull(input.toppedUp),
    currency: input.currency || "CNY",
  };

  const prevLog = getLogSnapshot();
  const list = prevLog[providerId] ?? [];
  const last = list.filter((s) => s.day === day).pop();
  if (
    last &&
    last.total === sample.total &&
    last.granted === sample.granted &&
    last.toppedUp === sample.toppedUp &&
    last.currency === sample.currency
  ) {
    return false;
  }

  writeLog({ ...prevLog, [providerId]: pruneSamples([...list, sample], day) });
  return true;
}

/** 清空某供应商「今日」样本（异常时手动重置基线）；返回是否有样本被清掉。 */
export function resetToday(providerId: string, now: number = Date.now()): boolean {
  const day = bjtDayKey(now);
  const prevLog = getLogSnapshot();
  const list = prevLog[providerId];
  if (!list || !list.some((s) => s.day === day)) return false;
  writeLog({ ...prevLog, [providerId]: list.filter((s) => s.day !== day) });
  return true;
}

/** 读取某供应商今日消耗（估算）；无当日样本返回 null。 */
export function dailySpendOf(
  log: BalanceLog,
  providerId: string,
  now: number = Date.now(),
): DailySpend | null {
  const list = log[providerId];
  if (!list || list.length === 0) return null;
  return computeFromSamples(list, bjtDayKey(now));
}
