# Z.ai / 智谱 鉴权密钥获取说明

Z.ai / 智谱（GLM）的 **Coding Plan 订阅** 用量。MyToken 通过官方接口
`GET https://api.z.ai/api/coding/paas/v3/dashboard/billing/coding_plan/usage`
读取你的 **5 小时 / 本周** 窗口（已用百分比 + 重置时间），鉴权用单个 **API Key**（Bearer）。

## 1. 获取 API Key

1. 打开 <https://www.z.ai>（国际站）或智谱开放平台 <https://open.bigmodel.cn>
   并注册 / 登录。
2. 购买 / 激活 **GLM Coding Plan** 订阅计划。
3. 进入 **API Key / API 密钥** 页面。
4. 点击「创建 API Key」，生成形如 `sk-xxxx` 的密钥。
5. 复制并妥善保管（创建后一般仅完整显示一次）。

> ⚠️ API Key 等价于你的账户 / 订阅权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会以进度条展示 5 小时 / 本周窗口的用量。

## 说明

- 官方旧版 v4 端点已废弃（返回 404），MyToken 已走 **v3** 端点。
- 返回 401 / 403 表示 **API Key 无效或无 Coding Plan 订阅**；404 表示端点已变更。
- 该模块仅展示订阅用量，不含余额 / 花费统计。
