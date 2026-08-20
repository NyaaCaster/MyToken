# DeepSeek 鉴权密钥获取说明

DeepSeek 官方开放平台提供一个**纯余额查询接口**
`GET https://api.deepseek.com/user/balance`，鉴权用单个 **API Key**（Bearer）。

## 1. 获取 API Key

1. 打开 <https://platform.deepseek.com> 并注册 / 登录。
2. 进入 **API Keys / API 密钥**页面。
3. 点击「创建 API Key（Create new API key）」，生成形如 `sk-xxxxxxxx` 的密钥。
4. **立即复制并保存**（创建后仅完整显示这一次）。
5. 若需要，可在同页为 Key 取名 / 设置配额 / 一键删除（删除后旧 Key 立即失效）。

> ⚠️ API Key 等价于你的账户权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。MyToken 会读取该 Key 对应账户的余额
（`balance_infos`，多币种下按 CNY 优先 + 正余额挑选）。

## 说明

- DeepSeek 官方**没有**「今日消耗 / token 用量 / 按模型费用」这类可用 API Key
  调用的统计接口，故 MyToken 的 DeepSeek 模块**只展示余额**。
- 若返回 401，说明 Key 无效 / 已删除，请回平台重新生成。
