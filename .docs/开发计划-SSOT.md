# MyToken 开发计划 — SSOT（Single Source of Truth）

> **项目**：MyToken — 多 API 供应商个人额度/余额聚合查询面板
> **仓库**：https://github.com/NyaaCaster/MyToken.git
> **本文件是开发阶段的唯一事实来源**；每 P 完成后更新状态符号并写阶段交接文档。
> 状态符号：⬜ 未开始 / 🟡 进行中 / ✅ 已完成

---

## 一、目标与范围边界

**目标**：一个竖版瀑布式页面，汇总展示用户在各 API 供应商平台的余额/额度/订阅用量，支持每家「鉴权密钥 + 启用开关 + 鉴权说明浮窗」。

**V1 范围（已与用户拍板）**：
| 模块 | 展示内容 | 说明 |
|------|---------|------|
| QinyAPI | 余额（USD）、今日/累计花费 | 双头令牌鉴权 |
| DeepSeek 官方 | **仅余额** | 无官方统计 API，token/费用统计 V1 不做 |
| OpenCode-Go | 订阅用量（5h/周/月 + 重置时间） | 需浏览器 UA 过 Cloudflare |
| 硅基流动 | 余额（元） | 无花费明细 API |
| Coding Plan | Anthropic / Z.ai / MiniMax / Kimi / OpenRouter | SCNet 无 API 端点，V1 不纳入 |

**不在范围**：不做 LLM 流量代理、不做充值、不做账本记账统计、不做 SCNet。

## 二、已确认架构与约束

- **架构**：前端 React SPA + 轻量 Node/Express 代理层（同源 `/api/*` 调用；规避 CORS、注入 UA、Key 白名单保护）。
- **命名**：保持 `MyToken`（`.`docs` 记录为 Nyaa 前缀命名规则例外）。
- **密钥存储**：前端 localStorage（隐藏显示）；代理不持久化、不落日志。
- **部署**：Docker 多阶段 → macmini（rebuild.py 构建推送私有仓库 + restart.py 部署）。
- **代码签名**：`"Nyaa be with you."` 三处（`src/version.ts` SSOT + `index.html data-blessing` + `src/main.tsx console.log`）。
- **美术**：NyaaChat 基调 —— Tailwind v4，暗色基 `#0A0A0A/#111111` + 毛玻璃浮层 + 蓝主色/紫次色 + 蓝紫渐变 Logo + 柔和辉光 + 蓝色滚动条；深浅双主题（`.dark` class）；字体 Inter/Space Grotesk/JetBrains Mono。
- **md 渲染**：`react-markdown` + `prose`；鉴权说明 md 放 `public/docs/<provider>.md`，浮窗 `fetch` 懒加载 + 链接新开标签。
- **状态管理**：无 Redux/Zustand；顶层 `useState` + 自定义 hooks（`useProviders`/`useBalances`）+ localStorage。
- **技术栈**：React19 + TS(strict) + Vite6 + Tailwind4 + lucide-react + motion + Express4 + npm。
- **提交规范**：`<type>: <subject>`；`git add <file>` 逐个；禁 `add -A`/force push/`--amend`/`--no-verify`；走 `$GITHUB_PAT`。
- **行尾**：LF + `.gitattributes`。
- **禁提交**：`.env*`、`node_modules/`、`dist/`、`*.log`、`.ref/`、密钥、`.claude/settings.local.json`。

## 三、安全红线

1. **密钥只发往硬编码的官方域名白名单**（QinyAPI / api.deepseek.com / opencode.ai / api.siliconflow.cn / 各 Coding Plan 官方域），代理不转发到任意源。
2. **代理不得把密钥写入日志**；前端不做任何密钥上报/分享。
3. `.env*` 不入 git（`.env.example` 除外）；`.ref/` 不入 git；`.docs/` 入 git。
4. `.docs/` 内不出现该参考插件的字面名称（以「参考插件」代称）。

---

## 四、版本与阶段划分

### V1 — MyToken 额度聚合面板 MVP

| P | 内容 | 状态 | 依赖 |
|---|------|------|------|
| P1 | 项目工程化基础（NyaaFrame 模板初始化 + git 首次提交推送） | ⬜ | — |
| P2 | 后端轻量代理层（Express，供应商查询转发 + CORS/UA/Key 白名单） | ⬜ | P1 |
| P3 | 前端骨架与主题（左上 Logo+名称跳仓库、右上图标区、主题浅/暗/跟随系统、毛玻璃美术基调、瀑布布局容器） | ⬜ | P1 |
| P4 | 供应商适配器层 + 四家核心模块（QinyAPI / DeepSeek / OpenCode-Go / 硅基流动） | ⬜ | P2,P3 |
| P5 | Coding Plan 模块（Anthropic / Z.ai / MiniMax / Kimi / OpenRouter，各自独立开关） | ⬜ | P4 |
| P6 | 前端交互完善（密钥隐藏显示、? 浮窗渲染 md 说明、开关鉴权联动、模块收起/展开） | ⬜ | P3 |
| P7 | 端到端验证 + Docker + macmini 部署 + README/SSOT 收尾 | ⬜ | P4,P5,P6 |

---

## 五、各 P 详细说明

### P1 — 项目工程化基础
- 依据 NyaaFrame 模板初始化：`meta.json`、`package.json`(ESM+React19+TS+Vite6+Tailwind4+lucide+motion+Express)、`tsconfig.json`(strict, ES2022, bundler)、`vite.config.ts`、`postcss.config.js`、`index.html`(data-blessing)、`src/main.tsx`、`src/version.ts`(APP_NAME/APP_VERSION/BLESSING)、`src/index.css`、`public/`、`README.md`、`LICENSE`(AGPL-3.0)。
- `.gitignore`（已就绪）、`.gitattributes`(LF)。
- `git init` + 首个 `init:` 提交 + PAT 推送。
- 验证：`npm ci && npm run build` 通过；`console.log(BLESSING)` 生效。

### P2 — 后端轻量代理层
- 独立 Node/Express 服务（`server/`，Express4，TS）。
- 路由 `/api/providers/:id/query`：按供应商分派到上游，注入必要头（QinyAPI `New-Api-User`、OpenCode-Go 浏览器 UA）、转发 Bearer、基于**域名白名单**放行。
- 错误归一（401/403/404/5xx → 标准 JSON {ok, code, message}）；不写 Key 日志。
- 本地 dev：Vite 代理 `/api` → Express；生产：nginx `/api/*` → Express。
- 验证：每个供应商用 mock 响应做单测/冒烟，鉴权失败返回归一错误。

### P3 — 前端骨架与主题
- 顶栏：左侧 icon+「MyToken」→ 跳 `https://github.com/NyaaCaster/MyToken`；右侧图标区（主题切换浅/暗/跟随系统，默认跟随系统）。
- 主题系统：`.dark` class + `prefers-color-scheme` 跟随 + localStorage 记忆；三态循环图标。
- 美术落地：毛玻璃浮层、蓝紫渐变 Logo、柔和辉光背景、蓝色滚动条、字体、卡片圆角阴影。
- 瀑布布局容器：供应商模块纵向排列，供 P4/P5 填充。
- 验证：三态主题切换正确、跳转正常、布局响应式。

### P4 — 供应商适配器层 + 四家核心模块
- 统一 `Provider` 抽象与 JSON 模块注册表（id/name/titleUrl/kind/fields/docPath）。
- 四家适配器（查询经 `/api/providers/:id/query`）：
  - QinyAPI：`/api/user/self` 余额 + `/api/log/self?type=2` 今日/累计（双头令牌）。
  - DeepSeek：`/user/balance`，`balance_infos` 按 CNY 优先+正余额挑选。
  - OpenCode-Go：`/zen/go/v1/usage` → rolling/weekly/monthly `{percent,resetsAt}`。
  - 硅基流动：`/v1/user/info` → `activeBalance/totalBalance`（元）。
- 每模块：密钥输入（隐藏）+ 启用开关 + 标题 URL。
- 验证：用真实/模拟 Key 走各自适配器拿到正确归一结果。

### P5 — Coding Plan 模块
- 新增 5 个适配器（各自独立开关/凭据）：Anthropic(5h/7d)→Z.ai(v3,404 容错)→MiniMax(剩%)→Kimi(余额分)→OpenRouter(credits)。
- 端点白名单；404 提示端点变更；401/403 提示无订阅/Key 无效。
- 验证：各厂商窗口/余额正确归一展示。

### P6 — 前端交互完善
- 密钥隐藏显示（password 型 input + 眼睛切换 + 复制按钮）。
- **? 浮窗**：`BaseModal` 复用壳 + `fetch(public/docs/<provider>.md)` 懒加载 + `react-markdown` + `prose` + 链接 `target=_blank`；每供应商一份 md。
- **开关鉴权联动**：开启时先调查询 → 鉴权失败开关回弹并提示中文错误；成功后展开模块。
- 模块收起/展开（默认收起，减少渲染压力）。
- 验证：交互全流程（输 Key→开开关→鉴权成功展开 / 失败回弹；浮窗正确渲染 md）。

### P7 — 端到端验证 + 部署收尾
- 端到端：真实 Key 对拍各家字段。
- Docker 多阶段（node:20-alpine 构建 → nginx:alpine 运行 + `/api/*` 转发 Express）；`docker-compose.publish.yml`。
- `rebuild.py`（Python，构建→推送私有仓库）+ 说明 `restart.py`（macmini 拉取→重启）。
- README 生成、SSOT 全部 ✅、`.docs/阶段交接` 补齐。
- 验证：macmini 上线后页面可用、全模块查询正常。

---

## 六、代码签名（三处嵌入，强制）
1. `src/version.ts`：`export const BLESSING = "Nyaa be with you." as const;`（SSOT 来源）
2. `index.html`：`<html lang="zh-CN" data-blessing="Nyaa be with you.">`
3. `src/main.tsx`：`console.log(BLESSING);`

## 七、命名约定
- 组件 PascalCase、hooks camelCase(use 前缀)、库/工具 camelCase、脚本 kebab-case。
- 功能模块英文代号走「诗意化+极客风」风格（如适配层代号可用 `Arcana`/`OracleScry` 等，具体在 P4 定，避免直白技术腔）。

## 八、环境变量约定（`.env`，不入 git；`.env.example` 含占位）
- `PRIVATE_DOCKER_REGISTRY_HOST`（私有仓库地址，部署用）
- 供应商密钥**不**通过 `.env` 注入前端（由用户在页面输入、存 localStorage）。

## 九、跨对话续接
新会话按顺序读取：`CLAUDE.md` → `.docs/开发计划-SSOT.md` → 最新 `.docs/阶段交接-*.md` → memory → 按交接「续接提示词」以 plan 模式继续。
