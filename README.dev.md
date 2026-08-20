# MyToken 开发与部署手册

## 架构

- **前端**：React 19 + Vite → `npm run build` 产出 `dist/`（nginx 托管，SPA）。
- **后端**：Express 代理（`server/`）→ `npm run build:server` 产出 `server/dist/`，端口 `8788`（可用 `PORT` 覆盖）。
- 前端以同源 `/api/providers/:id/query` 调用；开发经 Vite 代理、生产经 nginx `/api` 反代到 `server:8788`。

## 一、纯本地开发（不依赖 Docker）

需要可联网环境先安装依赖（本机研发环境离线时跳过安装）。

```bash
npm install            # 生成 node_modules + package-lock.json（Docker 构建依赖 lockfile）
```

双终端分别启动前端与后端：

```bash
# 终端 1：前端 vite dev（含 /api -> 127.0.0.1:8788 代理）
npm run dev

# 终端 2：后端 Express 代理（tsx watch 热重载）
npm run dev:server
```

打开 `http://127.0.0.1:5173`（vite 默认端口）。

常用脚本：

```bash
npm run build           # 类型检查 + 前端打包（dist/）
npm run build:server    # 后端编译（server/dist/）
npm run start:server    # 运行编译后的后端（server/dist/index.js）
npm run typecheck:server# 后端类型检查（不产出）
```

冒烟：`curl http://127.0.0.1:8788/api/health` 应返回 `{"ok":true,...}`。

## 二、Docker 本地编排

```bash
docker compose up -d --build
# 打开 http://127.0.0.1:8098 （端口可用 .env 的 WEB_PORT 覆盖）
# Express 直连冒烟 http://127.0.0.1:8788/api/health
```

## 三、构建推送 + 部署（工作空间标准流程）

### 环境准备

1. 复制 `.env.example` 为 `.env`，填 `PRIVATE_DOCKER_REGISTRY_HOST`（Windows 构建用本机回环地址+端口）。
2. 确保已 `npm install` 生成 `package-lock.json`（Dockerfile 用 `npm ci`）。
3. 本机需能访问私有仓库（NyaaDockerHUB，`insecure-registries` 已配）。

### Windows 研发机：构建并推送

```bash
python3 rebuild.py      # build web/server × latest+sha → push → 注册表清理 → 本地清理
```

### macmini：部署

```bash
# 部署目录准备（含 real .env + docker-compose.publish.yml 重命名为 docker-compose.yml + restart.py）
python3 restart.py      # pull → down → up -d → prune → ps
```

> 仓库地址只从 `.env` 注入、绝不硬编码进 Git 跟踪文件；`rebuild.py`/`restart.py` 输出均已掩码。

## 四、安全红线

- 镜像引用一律 `${PRIVATE_DOCKER_REGISTRY_HOST:?err}/...`，不在 compose/Dockerfile/脚本中写死仓库地址。
- nginx 只把 `/api` 反代到 `server:8788` 容器，不暴露外部任意地址。
- 供应商密钥由用户在页面输入、存 localStorage，代理不落日志、不持久化。

*Nyaa be with you.*
