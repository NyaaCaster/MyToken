# MyToken

多 API 供应商个人额度 / 余额 / 订阅用量聚合查询面板。

> 把分散在多家模型 API 平台的余额、Coding Plan 订阅额度汇聚到一个竖版瀑布式页面，一目了然。

## 功能

- 供应商模块纵向排列：`QinyAPI → DeepSeek(余额) → OpenCode Go → 硅基流动 → Coding Plan(Anthropic / Z.ai / MiniMax / Kimi / OpenRouter)`，可持续追加。
- 每模块仅两个操作：**鉴权密钥输入**（隐藏显示）+ **启用开关**（开启时即时鉴权，成功才展开）。
- 各模块标题可跳官网（QinyAPI / OpenCode Go / 硅基流动），密钥输入栏带 **? 说明浮窗**（渲染各家鉴权密钥获取 md 文档）。
- 右上角主题切换：浅色 / 暗色 / 跟随系统（默认跟随系统）。

## 架构

```
浏览器 (React SPA)
   │ /api/* 同源调用（Vite dev 代理 / nginx 反代）
   ▼
Express 轻量代理层（server，8788）
   │  注入必需头（New-Api-User / 浏览器 UA），域名白名单，不落日志
   ▼
各供应商官方接口
```

- 前端：React 19 + TypeScript(strict) + Vite 6 + Tailwind 4 + lucide-react + motion + react-markdown
- 后端：Express 4 + Node18+ 全局 fetch
- 部署：Docker（nginx + node 双服务），构建推送私有仓库，macmini 部署

## 开发

```bash
npm install            # 需可联网环境
npm run dev            # 终端 1：Vite dev server (5173, 已代理 /api → 8788)
npm run dev:server     # 终端 2：Express 代理层 (8788, HOST/PORT 可配)
```

或 Docker 本地编排：

```bash
docker compose up -d --build   # Web: http://127.0.0.1:8098
```

详见 `README.dev.md`。

## 目录

```
MyToken/
├── meta.json           # 项目元数据 SSOT
├── src/                # 前端（types / providers / components / hooks）
├── server/             # Express 代理层（域名白名单 + 错误归一）
├── public/docs/        # 各供应商鉴权密钥获取说明 md（浮窗渲染）
├── .docs/              # 设计审计 / SSOT / 代码审核 / 阶段交接
├── .ref/               # 调研材料（git 忽略，不入库）
├── Dockerfile / docker-compose*.yml / rebuild.py / restart.py
└── index.html          # data-blessing
```

## 许可

AGPL-3.0

---

*Nyaa be with you.*
