# 硅基流动（SiliconFlow）鉴权密钥获取说明

硅基流动（`https://cloud.siliconflow.cn`）的余额查询接口
`GET https://api.siliconflow.cn/v1/user/info` 用一个 **API Key**（Bearer）即可查
本人账户的**可用/总余额**（单位：元），无需额外权限。

## 1. 获取 API Key

1. 打开 [https://cloud.siliconflow.cn](https://cloud.siliconflow.cn/i/KJ0qgMuR) 并注册 / 登录。
   ⚠️ **需绑定手机号**才能创建 API Key。
2. 登录后进入「控制台 / 工作台」。
3. 进入 **API 密钥**页面（账户中心 → API 密钥 / API Keys）。
4. 点击「创建 API 密钥（New API key）」，生成形如 `sk-xxxx` 的密钥。
5. 复制并妥善保管（创建后通常只完整显示一次）。

> 新用户注册通常赠送 **2000 万 tokens**（约 ¥14）免费额度，可先用于测试。
> ⚠️ API Key 等价于账户权限，只保存在本机，**不要**提交到 git 或分享。

## 2. 在 MyToken 中填写

| 输入项 | 示例 | 说明 |
|--------|------|------|
| API Key | `sk-xxxxxxxx` | 必填，见第 1 步 |

填好后点击「认证并启用」即可。鉴权通过会显示你的**可用余额**（元）。

## 说明

- 硅基流动**没有**公开的「花费 / 账单明细」接口，故本模块只展示余额；
  如需消费统计，可在其控制台「用量/账单」页查看。
- 返回 401（invalid api key）表示 Key 无效或已删除，请回控制台重新创建。
