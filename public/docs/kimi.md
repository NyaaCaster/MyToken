# Kimi / Moonshot 鉴权密钥获取说明

Kimi（Moonshot）是**按量付费（PAYG）** 账户。MyToken 通过官方接口
`GET https://api.moonshot.cn/v1/users/me/balance` 读取你的**账户余额**（人民币元），
鉴权用单个 **API Key**（Bearer，`sk-*`）。

## 1. 获取 API Key

1. 打开 Moonshot 开放平台 <https://platform.moonshot.cn> 并注册 / 登录。
2. 进入 **账户设置 → API Key 管理 / API Keys** 页面。
3. 点击「创建 API Key」，生成形如 `sk-xxxx` 的密钥。
4. 复制并妥善保管（创建后一般仅完整显示一次）。

> ⚠️ API Key 等价于你的账户权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会显示你的余额（以元展示）。

## 说明

- 该接口返回的余额单位是**分**，MyToken 会自动换算为**元**展示。
- Kimi 是 PAYG 余额（无订阅窗口），故本模块仅显示**余额**金额、不做百分比条。
- 返回 401 表示 **API Key 无效**；404 表示端点已变更。
