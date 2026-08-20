# MiniMax Token Plan 鉴权密钥获取说明

MiniMax 的 **Token Plan 订阅** 用量。MyToken 通过官方接口
`GET https://www.minimaxi.com/v1/token_plan/remains` 读取你的 **5 小时 / 本周**
两档剩余用量（转成已用百分比展示），鉴权用单个 **API Key**（Bearer，`sk-*` / `sk-cp-*`）。

## 1. 获取 API Key

1. 打开 MiniMax 开放平台 <https://www.minimaxi.com>（或 <https://www.minimax.io>）
   并注册 / 登录。
2. 购买 / 激活 **Token Plan** 订阅计划。
3. 进入 **API 密钥 / API Keys** 页面。
4. 点击「创建 API Key」，生成形如 `sk-xxxx` 的密钥（Token Plan 相关 Key 多为 `sk-cp-` 开头）。
5. 复制并妥善保管。

> ⚠️ API Key 等价于你的账户 / 订阅权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` 或 `sk-cp-xxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会展示 5 小时 / 本周两档的用量；
若你的计划**不限量**，MyToken 会显示「不限量」标识。

## 说明

- 返回 401 / 403 表示 **API Key 无效或无 Token Plan 订阅**；404 表示端点已变更。
- 该模块仅展示订阅用量，不含余额 / 花费统计。
