# OpenCode Go 鉴权密钥获取说明

OpenCode Go（`https://opencode.ai/go`）是一个长上下文编码订阅。MyToken 通过官方用量
接口 `GET https://opencode.ai/zen/go/v1/usage` 读取你的 **5 小时 / 本周 / 本月**
订阅用量（已用百分比 + 重置时间），鉴权用单个 **API Key**。

## 1. 获取 API Key

1. 打开 <https://opencode.ai/go> 。
2. 登录并购买 / 激活 **Go 订阅**计划（需一个编码登录账号，如 GitHub / Claude）。
3. 在账户 / 订阅页面中找到你的 **API Key**（OpenCode Go Key，形如 `sk-xxxx`）。
4. 复制并妥善保管。

> 若你本机装过 `opencode` CLI 并已登录，其登录态也会被自动识别兜底；
> 在 MyToken 直接粘贴上面的 Key 最省事。
> ⚠️ Key 只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会以进度条展示三个窗口的用量。

## 说明

- 无有效订阅或 Key 无效时返回 401 / 403，MyToken 会提示「没有生效的订阅或 Key 无效」。
- 该接口需要浏览器 UA 才能通过前置的 Cloudflare 校验——MyToken 的代理层
  **已替你注入**浏览器 UA，你无需额外操作。
