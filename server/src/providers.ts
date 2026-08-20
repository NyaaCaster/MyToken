/**
 * server/src/providers.ts
 *
 * 供应商分派与域名白名单。
 * 安全核心：每个供应商的请求目标 URL 一律在本文件内【硬编码】，并且仅当目标
 * host 命中该供应商白名单（hosts）时才放行 —— 密钥只可能被发往官方域名，
 * 代理绝不把密钥转发到任意 URL。
 *
 * 密钥本身不在此出现：它由前端在请求里携带（Authorization 头或 apiKey 参数），
 * 由 index.ts 读入请求上下文 Ctx.authKey，再按需注入上游请求头。
 */

/**
 * 浏览器 UA。opencode.ai 前置 Cloudflare，若不携带浏览器 UA 会以 error 1010 拦截。
 */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** 请求上下文：从入站请求提炼出的、与供应商无关的输入。 */
export interface Ctx {
  /** 前端提供的鉴权密钥（取自 Authorization 头或 apiKey 参数），可为 null。 */
  authKey: string | null;
  /** 已规整为字符串的查询参数（保留原始 key）。 */
  q: Record<string, string>;
  /** 读取请求头（键名视为小写）。 */
  header: (name: string) => string | undefined;
}

/** 单个上游端点：一个原子 GET 请求的目标。 */
export interface Endpoint {
  url: string;
  headers: Record<string, string>;
  /** 为 true 时，把入站请求剩余查询参数原样透传给上游（分页 / 时间区间过滤等）。 */
  forwardQuery?: boolean;
}

export type ResolveResult =
  | { ok: true; endpoint: Endpoint }
  | { ok: false; code: number; message: string };

export interface Provider {
  id: string;
  name: string;
  /** 官方域名白名单（host，不含协议与路径）。 */
  hosts: string[];
  /** 是否使用 Bearer 鉴权（仅信息性标注，供文档/前端参考）。 */
  useBearer: boolean;
  /** 根据上下文解析本次请求对应的上游端点。 */
  resolve: (ctx: Ctx) => ResolveResult;
  /** 供应商定制错误文案：HTTP 状态码 -> 中文提示（可选）。 */
  messages?: Partial<Record<number, string>>;
}

/** 缺密钥时的统一错误。 */
const noKey = (providerName: string): ResolveResult =>
  ({ ok: false, code: 401, message: `缺少 ${providerName} 的 API Key（请填写密钥）` });

/** 从 query（大小写不敏感）或 header 里取一个参数。 */
function getParam(ctx: Ctx, name: string): string | undefined {
  const exact = ctx.q[name];
  if (exact !== undefined) return exact;
  const lower = name.toLowerCase();
  for (const k of Object.keys(ctx.q)) {
    if (k.toLowerCase() === lower) return ctx.q[k];
  }
  return ctx.header(lower);
}

/* -------------------------------------------------------------------------- */
/* 四家 P4 核心供应商                                                          */
/* -------------------------------------------------------------------------- */

const qinyapi: Provider = {
  id: "qinyapi",
  name: "QinyAPI",
  hosts: ["love.qinyan.icu"],
  useBearer: true,
  /**
   * qinyapi（new-api）需要两个头：Authorization: Bearer <令牌> + New-Api-User: <用户id>。
   * 通过 ?op=self（默认，余额）与 ?op=log（消费日志，透传 start/end_timestamp 等）分派。
   */
  resolve: (ctx) => {
    const userId = getParam(ctx, "New-Api-User") ?? getParam(ctx, "userId");
    if (!ctx.authKey && !userId) {
      return { ok: false, code: 401, message: "缺少令牌与用户 id（QinyAPI 需 Authorization + New-Api-User 两件套）" };
    }
    if (!ctx.authKey) return { ok: false, code: 401, message: "缺少 QinyAPI 令牌（Authorization）" };
    if (!userId) return { ok: false, code: 401, message: "缺少 New-Api-User 用户 id" };
    const headers = { Authorization: `Bearer ${ctx.authKey}`, "New-Api-User": String(userId) };
    const op = ctx.q["op"] ?? "self";
    if (op === "self") {
      return { ok: true, endpoint: { url: "https://love.qinyan.icu/api/user/self", headers } };
    }
    if (op === "log") {
      // ?type=2 与 start/end_timestamp / p / page_size 等由 forwardQuery 原样透传
      return { ok: true, endpoint: { url: "https://love.qinyan.icu/api/log/self", headers, forwardQuery: true } };
    }
    return { ok: false, code: 400, message: `未知的 qinyapi 操作: ${op}` };
  },
  messages: { 401: "令牌无效或 New-Api-User 与令牌不匹配", 403: "无权限查看该账户" },
};

const deepseek: Provider = {
  id: "deepseek",
  name: "DeepSeek",
  hosts: ["api.deepseek.com"],
  useBearer: true,
  resolve: (ctx) => {
    if (!ctx.authKey) return noKey("DeepSeek");
    return {
      ok: true,
      endpoint: { url: "https://api.deepseek.com/user/balance", headers: { Authorization: `Bearer ${ctx.authKey}` } },
    };
  },
  messages: { 401: "DeepSeek API Key 无效" },
};

const opencodeGo: Provider = {
  id: "opencode-go",
  name: "OpenCode Go",
  hosts: ["opencode.ai"],
  useBearer: true,
  resolve: (ctx) => {
    if (!ctx.authKey) return noKey("OpenCode Go");
    return {
      ok: true,
      endpoint: {
        url: "https://opencode.ai/zen/go/v1/usage",
        // 必须带浏览器 UA，否则被 opencode.ai 前置的 Cloudflare 以 error 1010 拦截
        headers: { Authorization: `Bearer ${ctx.authKey}`, "User-Agent": BROWSER_UA },
      },
    };
  },
  messages: { 401: "没有生效的订阅或 Key 无效", 403: "没有生效的订阅或 Key 无效" },
};

const siliconflow: Provider = {
  id: "siliconflow",
  name: "硅基流动",
  hosts: ["api.siliconflow.cn"],
  useBearer: true,
  resolve: (ctx) => {
    if (!ctx.authKey) return noKey("硅基流动");
    return {
      ok: true,
      endpoint: { url: "https://api.siliconflow.cn/v1/user/info", headers: { Authorization: `Bearer ${ctx.authKey}` } },
    };
  },
  messages: { 401: "硅基流动 API Key 无效或已失效" },
};

/* -------------------------------------------------------------------------- */
/* 各家 Coding Plan（P5）—— 统一 Bearer，URL 硬编码 + hosts 白名单              */
/* -------------------------------------------------------------------------- */

/** 构造一个带 Bearer 鉴权的单端点 GET 目标。 */
function bearerEndpoint(url: string, authKey: string): ResolveResult {
  return { ok: true, endpoint: { url, headers: { Authorization: `Bearer ${authKey}` } } };
}

/** 通用：有 Key 即放行到固定端点。 */
function simpleResolve(endpointUrl: string, providerName: string) {
  return (ctx: Ctx): ResolveResult => {
    if (!ctx.authKey) return noKey(providerName);
    return bearerEndpoint(endpointUrl, ctx.authKey);
  };
}

/**
 * anthropic：GET /api/oauth/usage
 * 响应含 five_hour / seven_day 窗口（各自 utilization 已用% + resets_at unix 秒），
 * 以及 seven_day_sonnet / extra_usage 等。前端归一化时取 five_hour/seven_day 即可。
 */
const anthropic: Provider = {
  id: "anthropic",
  name: "Anthropic",
  hosts: ["api.anthropic.com"],
  useBearer: true,
  resolve: simpleResolve("https://api.anthropic.com/api/oauth/usage", "Anthropic"),
  messages: {
    401: "没有有效的 Claude 订阅或 OAuth 令牌无效",
    403: "没有权限查看该订阅",
    404: "Anthropic 用量端点已变更",
  },
};

/**
 * zai：GET /api/coding/paas/v3/.../coding_plan/usage
 * 注意 2026-08 起 v4 返回 404，须用 v3；响应为 plans[] 或扁平 five_hour/weekly 两种形态，
 * 前端归一化时两者都要兼容。
 */
const zai: Provider = {
  id: "zai",
  name: "Z.ai / 智谱",
  hosts: ["api.z.ai", "open.bigmodel.cn"],
  useBearer: true,
  resolve: simpleResolve(
    "https://api.z.ai/api/coding/paas/v3/dashboard/billing/coding_plan/usage",
    "Z.ai / 智谱",
  ),
  messages: {
    401: "Z.ai API Key 无效或无 Coding Plan 订阅",
    403: "无 Coding Plan 订阅权限",
    404: "Coding Plan 端点已变更（v4 已废弃，当前走 v3）",
  },
};

/**
 * minimax：GET /v1/token_plan/remains
 * 响应 model_remains[]（剩% 优先，取 general 或 MiniMax-M* 行抽 5h / 7d 两档；
 * status=3 表示不限量跳过）。备用域名 www.minimax.io 与 www.minimaxi.com 同在白名单。
 */
const minimax: Provider = {
  id: "minimax",
  name: "MiniMax Token Plan",
  hosts: ["www.minimaxi.com", "www.minimax.io"],
  useBearer: true,
  resolve: simpleResolve("https://www.minimaxi.com/v1/token_plan/remains", "MiniMax"),
  messages: {
    401: "MiniMax API Key 无效或无 Token Plan 订阅",
    403: "无 Token Plan 权限",
    404: "Token Plan 端点已变更",
  },
};

/**
 * kimi：GET /v1/users/me/balance
 * 响应 available_balance 的单位是「分」，<100 视为已是元；无窗口，前端按文本余额展示。
 */
const kimi: Provider = {
  id: "kimi",
  name: "Kimi / Moonshot",
  hosts: ["api.moonshot.cn"],
  useBearer: true,
  resolve: simpleResolve("https://api.moonshot.cn/v1/users/me/balance", "Kimi / Moonshot"),
  messages: {
    401: "Kimi API Key 无效",
    403: "没有余额查询权限",
    404: "余额端点已变更",
  },
};

/**
 * openrouter：GET /api/v1/credits
 * 响应 data.total_credits / total_usage（美元）；已用% = total_usage / total_credits，
 * resetsAt 可空（预付 credits 无固定重置窗口）。
 */
const openrouter: Provider = {
  id: "openrouter",
  name: "OpenRouter",
  hosts: ["openrouter.ai"],
  useBearer: true,
  resolve: simpleResolve("https://openrouter.ai/api/v1/credits", "OpenRouter"),
  messages: {
    401: "OpenRouter API Key 无效",
    403: "没有 credits 查询权限",
    404: "Credits 端点已变更",
  },
};

/* -------------------------------------------------------------------------- */
/* 注册表                                                                      */
/* -------------------------------------------------------------------------- */

export const providers: Record<string, Provider> = {
  qinyapi,
  deepseek,
  "opencode-go": opencodeGo,
  siliconflow,
  anthropic,
  zai,
  minimax,
  kimi,
  openrouter,
};
