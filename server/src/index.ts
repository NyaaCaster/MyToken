/**
 * server/src/index.ts
 *
 * MyToken 后端轻量代理层（P2）
 *  - Express4 + TypeScript，Node18+（使用全局 fetch，无需额外 http 包）。
 *  - 唯一业务路由：GET /api/providers/:id/query —— 按供应商 id 分派到上游，
 *    注入必要头（QinyAPI New-Api-User、OpenCode-Go 浏览器 UA），转发 Bearer。
 *  - 安全：目标 URL 由 providers.ts 硬编码，且 host 必须命中供应商域名白名单；
 *    任何请求绝不把密钥写入日志。
 *  - 错误归一：上游 401/403/404/5xx 与网络错误统一转为 JSON { ok, code, message }。
 *  - CORS：dev 阶段放开 localhost（生产由 nginx /api 同源处理）。
 *
 * 运行（需在本机有网时 npm i 后）：
 *   npm run dev:server   —— tsx watch 热重载
 *   npm run build:server —— tsc -p server 编译到 server/dist
 *   npm run start:server —— node server/dist/index.js
 */

import express from "express";
import type { Request, Response } from "express";
import { providers } from "./providers.js";
import type { Ctx, Provider } from "./providers.js";

const DEFAULT_PORT = 8788;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
/** 监听地址：默认 127.0.0.1（仅本机，防 LAN 无鉴权中继）；Docker 容器内由 compose 设 HOST=0.0.0.0。 */
const HOST = process.env.HOST || "127.0.0.1";
const FETCH_TIMEOUT_MS = 15000;
const ACCEPT_JSON = { Accept: "application/json" } as const;

/** 允许跨源调用本代理的前端开发源（Vite dev 默认端口）。生产由 nginx 同源，不需 CORS。 */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

/** 这些入站查询参数不会被透传给上游（它们是代理自身的控制/鉴权参数）。 */
const RESERVED_QUERY = new Set([
  "apiKey",
  "key",
  "token",
  "op",
  "userId",
  "New-Api-User",
  "Authorization",
]);

/** 把 req.query 规整成 string 字典（忽略数组/嵌套对象，保留原 key）。 */
function asStrings(q: Request["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) {
      const s = v.find((x): x is string => typeof x === "string");
      if (s !== undefined) out[k] = s;
    }
  }
  return out;
}

/** 取前端鉴权密钥：优先 Authorization 头（Bearer 剥离前缀），其次 apiKey/key 查询参数。 */
function getAuthKey(req: Request): string | null {
  const ah = req.headers.authorization;
  if (ah) {
    const m = /^Bearer\s+(.+)$/i.exec(ah);
    return m ? m[1].trim() : ah.trim();
  }
  const q = req.query;
  const k =
    typeof q.apiKey === "string" ? q.apiKey : typeof q.key === "string" ? q.key : null;
  return k;
}

/** 把 forwardQuery 的剩余查询参数拼回 URL。 */
function buildForwardQuery(q: Request["query"]): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (RESERVED_QUERY.has(k)) continue;
    if (typeof v === "string") sp.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => { if (typeof x === "string") sp.append(k, x); });
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * 统一上游 GET。返回解析后的 JSON 与原 HTTP 状态码。
 * 网络错误/超时抛 UpstreamError；HTTP 非 2xx 不抛，由调用方按状态码归一。
 */
async function fetchUpstream(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...headers, ...ACCEPT_JSON },
      signal: ctrl.signal,
    });
    const text = await resp.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text ? { raw: text } : null;
    }
    return { status: resp.status, json };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new UpstreamError(aborted ? "请求上游超时" : "无法连接上游服务");
  } finally {
    clearTimeout(timer);
  }
}

/** 上游 HTTP 状态码 -> 前端可读中文提示。 */
function upstreamMessage(messages: Provider["messages"], status: number): string {
  const custom = messages?.[status];
  if (custom) return custom;
  if (status === 401) return "鉴权失败：密钥无效或已过期";
  if (status === 403) return "没有权限 / 无生效订阅";
  if (status === 404) return "上游接口不存在或已变更";
  if (status >= 500) return "上游服务暂时不可用";
  return `上游返回异常状态 ${status}`;
}

/** 归一错误响应。 */
function sendError(res: Response, code: number, message: string): void {
  const status = code >= 400 && code <= 599 ? code : 502;
  res.status(status).json({ ok: false, code, message });
}

async function handleQuery(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const provider = providers[id];
  if (!provider) {
    sendError(res, 404, `未知供应商: ${id}`);
    return;
  }

  const ctx: Ctx = {
    authKey: getAuthKey(req),
    q: asStrings(req.query),
    header: (n) => req.headers[n] as string | undefined,
  };

  // 分派：拿到上游端点，或直接归一错误（缺参数 / 占位未实现）
  const resolved = provider.resolve(ctx);
  if (!resolved.ok) {
    sendError(res, resolved.code, resolved.message);
    return;
  }
  const { url: rawUrl, headers, forwardQuery } = resolved.endpoint;

  // 域名白名单校验：目标 host 必须命中供应商 hosts，兜底禁止任意 URL。
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    sendError(res, 500, "上游地址非法");
    return;
  }
  if (!provider.hosts.includes(url.host)) {
    sendError(res, 403, `拒绝请求非白名单域名: ${url.host}`);
    return;
  }

  const finalUrl = forwardQuery
    ? url.origin + url.pathname + buildForwardQuery(req.query)
    : rawUrl;

  // 只打印供应商/目标域/状态，绝不打印密钥或完整 URL（路径不涉密但保持克制）。
  const logTag = `[proxy] ${provider.id} -> ${url.host}${url.pathname}`;

  try {
    const { status, json } = await fetchUpstream(finalUrl, headers);
    console.log(`${logTag} ${status}`);
    if (status >= 200 && status < 300) {
      res.status(status).json({ ok: true, data: json });
    } else {
      sendError(res, status, upstreamMessage(provider.messages, status));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "代理转发失败";
    console.error(`${logTag} ERR: ${msg}`);
    sendError(res, 502, msg);
  }
}

const app = express();
app.disable("x-powered-by");

// CORS：仅放行白名单内的开发源；跨源不来自这些源则不放行（生产同源由 nginx 处理）。
// ⚠️ 不透传/反射任意 Origin，避免本代理在 LAN 上被当无鉴权中继。
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, New-Api-User");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mytoken-proxy", port: PORT });
});

app.get("/api/providers/:id/query", handleQuery);

const server = app.listen(PORT, HOST, () => {
  console.log(`[MyToken] proxy listening on http://${HOST}:${PORT}`);
});

// 优雅退出
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
