# Anthropic 鉴权密钥获取说明

Anthropic（Claude）的 **Coding Plan 订阅**（Claude Pro / Max 等）提供用量窗口。
MyToken 通过官方用量接口 `GET https://api.anthropic.com/api/oauth/usage` 读取你的
**5 小时 / 本周** 两个窗口（已用百分比 + 重置时间），鉴权用 **OAuth 访问令牌**（Bearer）。

## 1. 获取 OAuth 令牌

1. 需要一个**有效的 Claude Coding Plan 订阅**（Pro / Max 等，至少未过期）。
2. OAuth 令牌通常来自 **Claude Code 的登录态**：
   - 若你本机已安装并登录过 Claude Code CLI，其登录凭证
     （`~/.claude/.credentials.json` 中的 `claudeAiOauth.accessToken`）会被本工具
     **自动识别兜底**，无需手动填写。
   - 也可通过环境变量 `ANTHROPIC_OAUTH_TOKEN` 或 `CLAUDE_CODE_OAUTH_TOKEN`
     提供这类令牌。
3. 使用网页端 + 有订阅权限的会话走 OAuth 授权流程也能拿到令牌，但相对繁琐，
   优先推荐上面的 CLI 登录态方式。

> ⚠️ 该令牌等价于你的订阅权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| OAuth 令牌 / API Key | `sk-ant-…`（OAuth token） | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会以进度条展示 5 小时 / 本周两个窗口。
若你使用 CLI 登录态，可留空本输入直接启用（由本工具自动读取）。

## 说明

- 返回 401 / 403 表示**没有生效的订阅或令牌无效**；404 表示官方用量端点已变更。
- 该模块仅展示订阅用量，不含余额 / 花费统计。
