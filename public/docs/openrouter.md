# OpenRouter 鉴权密钥获取说明

OpenRouter 是**预付 credits（余额）** 平台。MyToken 通过官方接口
`GET https://openrouter.ai/api/v1/credits` 读取你的 **credits 总额与已用额**，
展示已用百分比，鉴权用单个 **API Key**（Bearer，`sk-or-*`）。

## 1. 获取 API Key

1. 打开 <https://openrouter.ai> 并注册 / 登录。
2. 进入 **Keys** 页面。
3. 点击「Create Key」创建密钥，形如 `sk-or-xxxx`。
4. 复制并妥善保管（创建后仅完整显示一次）。
5. 如需补充余额，可在 **Credits** 页面充值。

> ⚠️ API Key 等价于你的账户权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-or-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会显示 credits 的已用进度（美元）。

## 说明

- OpenRouter 是**预付** credits，没有固定的订阅重置窗口，故只展示**已用百分比**，
  而不显示重置时间。
- 返回 401 表示 **API Key 无效**；403 表示没有 credits 查询权限；404 表示端点已变更。
