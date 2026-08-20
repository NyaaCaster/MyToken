# MyToken

多 API 供应商个人额度 / 余额 / 订阅用量聚合查询面板。

> 把分散在多家模型 API 平台的余额、Coding Plan 订阅额度汇聚到一个竖版瀑布式页面，一目了然。

---

## 目录

- [功能](#功能)
- [支持的供应商](#支持的供应商)
- [访问与使用](#访问与使用)
- [架构](#架构)
- [技术栈](#技术栈)
- [本地开发](#本地开发)
- [部署（Docker → macmini，HTTPS）](#部署docker--macminihttps)
- [目录结构](#目录结构)
- [安全性](#安全性)
- [许可](#许可)

---

## 功能

- 供应商模块**纵向瀑布排列**，每家独立成一张完整圆角卡片，卡内分「标题栏 / 设置 / 额度数据」三区块。
- 每模块仅两个用户操作：**鉴权密钥输入**（隐藏显示，带 ? 获取说明浮窗）+ **启用开关**（开启时即时鉴权，成功才展开）。
- 标题栏右侧成组按钮：**刷新**（手动刷新额度）、**设置**（重开密钥设置区块），紧挨在启用开关左侧。
- **自动刷新**：打开页面即刷新所有已启用供应商，此后每 5 分钟自动刷新一次。
- 右上角主题切换：浅色 / 暗色 / 跟随系统（默认跟随系统）。
- 浏览器标签页显示项目 favicon。

## 支持的供应商

| 供应商 | 展示内容 | 鉴权 |
|--------|---------|------|
| **QinyAPI** | 余额（USD）、今日/累计花费 | 访问令牌 + 用户 ID |
| **DeepSeek** | 余额 + 价格峰谷（24h 分段胶囊） | API Key |
| **OpenCode Go** | 订阅用量（5h / 周 / 月 + 重置时间） | API Key |
| **硅基流动** | 可用 / 总余额（元） | API Key |
| **Anthropic** | Coding Plan 用量窗口 | OAuth 令牌 / API Key |
| **Z.ai / 智谱** | Coding Plan 用量 | API Key |
| **MiniMax** | Token Plan 用量 | API Key |
| **Kimi / Moonshot** | PAYG 余额 | API Key |
| **OpenRouter** | 预付 Credits | API Key |

> ℹ️ 各家「能查什么」以官方 API 能力为限：DeepSeek 无「今日消耗」统计 API（仅余额 + 定价峰谷）；硅基流动无「代金券」API（仅余额）。详见 `.docs/设计审计.md` 与 `.ref/` 调研。

---

## 访问与使用

### 线上（macmini 已部署，HTTPS）

| 入口 | 地址 |
|------|------|
| **Web（HTTPS）** | `https://192.168.31.141:5200` |
| HTTP→HTTPS 跳转 | `http://192.168.31.141:5209`（自动 301 到上面的 HTTPS） |
| Express 代理（可选直连） | `https://192.168.31.141:5201/api/health` |

> 用域名 `h.hony-wen.com` / `h.nyaa.host`（若已解析 + 端口转发）则证书无告警；局域网 IP 访问会有 LE 证书域名不匹配提示，属正常（证书为域名签发）。

### 使用步骤

1. 打开 Web 页面（上方 HTTPS 地址）。
2. 点击目标供应商模块的**启用开关** → 展开「设置」子区块。
3. 填入该供应商的**鉴权密钥**（各家的获取方式点输入框旁的 **?** 浮窗查看）。
4. 点**「认证并启用」**；鉴权通过即展开该供应商的额度数据，开关保持开启。
5. 之后点标题栏 **刷新** 图标可手动刷新；页面也会自动刷新（打开时 + 每 5 分钟）。
6. 若要改密钥：点标题栏 **设置** 图标 → 重新编辑 → **保存并重新认证**。
7. 右上角切换浅色 / 暗色 / 跟随系统。

---

## 架构

```
浏览器 (React SPA)
   │  /api/* 同源调用（nginx 反代，HTTPS）
   ▼
nginx (web 容器，443 ssl + HTTP 301)
   │  /api/ → server:8788（容器内网 http）
   ▼
Express 轻量代理层（server 容器，8788）
   │  注入必需头（New-Api-User / 浏览器 UA）、域名白名单、不落日志
   ▼
各供应商官方接口
```

- 前端：React 19 + TypeScript(strict) + Vite 6 + Tailwind 4 + lucide-react + motion + react-markdown
- 后端：Express 4 + Node18+ 全局 fetch
- 部署：Docker 双服务（nginx web + node server），私有仓库分发，macmini 托管
- **HTTPS**：复用 macmini LE SAN 证书（`h.hony-wen.com` + `h.nyaa.host`），容器 `:ro` 挂载，续期由宿主机 acme.sh 统一驱动并热加载（零停机）

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript（strict） |
| 构建 | Vite 6（`@vitejs/plugin-react`） |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`）+ `@tailwindcss/typography` |
| 图标 / 动画 | lucide-react / motion |
| 文档渲染 | react-markdown + remark-gfm |
| 后端代理 | Express 4 |
| 部署 | Docker Compose、Python 脚本（`rebuild.py` / `restart.py`） |

---

## 本地开发

```bash
npm install                        # 需联网；本机网络受限时：npm install --registry=https://registry.npmmirror.com
npm run dev                        # 终端 1：Vite dev server（5173，已代理 /api → 8788）
npm run dev:server                 # 终端 2：Express 代理层（127.0.0.1:8788）
npm run build                      # 前端类型检查 + 打包
npm run build:server               # 后端编译
npm run preview                    # 预览构建产物
```

> 本地 dev 无需 HTTPS/证书（Vite 代理 /api 到本机 Express）。生产走 Docker + nginx 才需要证书卷。

---

## 部署（Docker → macmini，HTTPS）

遵循工作空间标准流程，镜像走私有仓库，地址经 `.env` 的 `PRIVATE_DOCKER_REGISTRY_HOST` 注入（不硬编码）。

### 1. 本机构建 + 推送（Windows 研发机）

```bash
# 创建 .env（gitignored），Windows 构建推回环仓库：
#   PRIVATE_DOCKER_REGISTRY_HOST=localhost:5000
cp .env.example .env
python rebuild.py                 # build web/server × latest+sha → push 私有仓库 → 清理
```

### 2. macmini 部署

```bash
# macmini 侧 .env（拉取用局域网仓库 + HTTPS 端口 + 证书目录）：
#   PRIVATE_DOCKER_REGISTRY_HOST=192.168.31.142:5000
#   WEB_PORT=5200  SERVER_PORT=5201  HTTP_REDIRECT_PORT=5209  CERT_DIR=./certs
# 部署目录 /root/DockerContainer/MyToken/ 需含：.env、docker-compose.publish.yml、restart.py、certs/
ssh macmini 'cd /root/DockerContainer/MyToken && python3 restart.py'
```

### 端口约定

| 端口 | 服务 | 说明 |
|------|------|------|
| **5200** | web（HTTPS 443） | Web 主入口，容器内 nginx `443 ssl` |
| **5201** | server（8788） | Express 代理（容器内 8788） |
| **5209** | web（HTTP 80） | HTTP→HTTPS 301 跳转入口 |

### HTTPS 证书（自动续期）

- 复用 macmini 宿主机 acme.sh/LE SAN 证书（`/etc/letsencrypt/h.hony-wen.com/`）。
- 部署目录 `certs/` 内 `fullchain.pem`(644) + `privkey.pem`(600)，经 `:ro` 卷挂载进 web 容器 `/etc/nginx/ssl`。
- 续期由宿主机合并 reload hook（`reload_certs.py`）自动同步到 MyToken `certs/` 并热加载容器 —— **零重建、零停机**。

---

## 目录结构

```
MyToken/
├── meta.json                 # 项目元数据 SSOT
├── src/
│   ├── types/                # Provider 类型定义（含峰谷）
│   ├── providers/            # 供应商注册表 + 查询适配器
│   ├── components/           # UI（Header/ProviderModule/PeakValley/Modal…）
│   └── hooks/                # useTheme / useBalances / useProvidersConfig
├── server/                   # Express 代理层（域名白名单 + 错误归一）
│   └── src/{index,providers}.ts
├── public/
│   ├── docs/                 # 各供应商鉴权密钥获取说明 md（浮窗渲染）
│   └── favicon.svg
├── .docs/                    # 设计审计 / SSOT / 代码审核 / 阶段交接（入 git）
├── .ref/                     # 调研材料（git 忽略）
├── Dockerfile / nginx.conf / docker-compose*.yml
├── rebuild.py / restart.py   # 构建推送 / 拉取部署（Python）
└── index.html                # data-blessing（favicon、入口）
```

---

## 安全性

- 密钥仅存浏览器 `localStorage`、输入隐藏显示；**不持久化/不上传/不落日志**。
- 代理层只向**官方域名白名单**转发（URL 硬编码 + host 二次校验），密钥绝不发往任意源。
- `nginx.conf` HTTP 只做 301 跳转；HSTS、安全头已开启。
- `.env*`、`.ref/`、密钥不入 git；证书私钥仅宿主机（0600）+ 容器只读挂载。

---

## 许可

AGPL-3.0

---

*Nyaa be with you.*
