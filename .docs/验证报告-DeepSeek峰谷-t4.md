# 验证报告：DeepSeek 峰谷价格数据与新价文案（t4 / verifier）

- 验证者：verifier（独立验证：自读代码、自抓官网、自跑构建；未改业务代码）
- 验证时间：2026-09-10 13:03–13:08（+08:00）
- 验证对象（本报告只认证这一组修订，hash 取 13:07:23 时刻）：

| 文件 | sha256 |
|---|---|
| `src/providers/registry.ts` | `EE15EBA8A4769BBB073A54037796C7EAEEB61421D80342E06A20ECB93AA2F456` |
| `src/components/PeakValleyView.tsx` | `03FC29DFD380D6DD78D0F85BFA87D24A59344C0FD50776B02C0481903DCB2C98` |
| `src/types/provider.ts` | `58774BCFECBE77EAF64C663B524A5214A6E6FF2800D9791B658F705AC30B62EF` |
| `public/docs/deepseek.md` | `61ED3D14F014E0ABAAE82AEB977033979F583F44C2C192304EE3448D5BA18C1D` |
| `README.md` | `17D9415C876E855059D457BBDC6CA220057EDCF601341BCB92A196F7CC0B85FF` |

**总结论：verification FAILED（1 项 blocker + 1 项流程 medium）**。其中 pro 数值、峰时段/时区/币种/单位、
周末政策、模型集合、构建、旧值残留全部 passed；failed 只指向 **flash 系列 12 个数字缺少一手官方证据、
且与官方定价页当场冲突**。

## 0. 过程告警（medium）：验证期内实现文件持续变动

验证窗口 13:03–13:08 内 `src/providers/registry.ts` 至少出现 5 个不同 hash（`33D928F8` → `1D472F87` →
`62E03E08` → `EE15EBA8`），`src/types/provider.ts`、`public/docs/deepseek.md` 同样在窗口内被改写。
变化均在注释/文案层，**18 个价格数字逐值未变**（已逐版 grep 核对），但这意味着：
(a) 13:04:0x 与 13:05:44 两次成功构建都不是最终修订；(b) 本报告认证的修订是 `EE15EBA8`（构建已在
13:07:0x 于该修订上重跑，见 §5）；(c) **此后任何一次编辑都会使本报告失效**，需冻结修订后重跑一次
「hash + 数值 grep + `npm run build`」复验。

## 1. 代码实际值（逐模型逐字段）

`src/providers/registry.ts`（`deepseek.peak`，行号为 `EE15EBA8` 版）：

| 模型 | 字段 | offPeak | peak | 行号 |
|---|---|---|---|---|
| `deepseek-v4-flash` | cacheHit / cacheMiss / output | 0.02 / 1 / 4 | 0.04 / 2 / 8 | :52-53 |
| `deepseek-v4-flash-vision-exp` | cacheHit / cacheMiss / output | 0.02 / 1 / 4 | 0.04 / 2 / 8 | :58-59 |
| `deepseek-v4-pro` | cacheHit / cacheMiss / output | 0.15 / 4.5 / 13.5 | 0.3 / 9.0 / 27.0 | :62-63 |

其它：`windows: [{9,12},{14,18}]`（:44-47）、`tz: "北京时间"`（:48）、`currency: "CNY"`（:49）。
消费端：`src/components/PeakValleyView.tsx:43-51`、`:120-133`（`Object.keys(peak.models)` 逐行渲染；`:126`
正则去 `deepseek-`/`v4-` 前缀 → `flash` / `flash-vision-exp` / `pro`）；类型 `src/types/provider.ts:41-63`。
价格只有这一份数据源：全仓 `cacheHit|cacheMiss` 命中仅 `registry.ts` + 类型 + 渲染读取三处，无第二副本；
`server/src/providers.ts`、`src/providers/query.ts` 只管余额。

## 2. 独立抓取的官方（一级）证据

| # | URL | 抓取时刻 | 关键片段（逐字） |
|---|---|---|---|
| A1 | <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> | 13:04 | 「价格… 空闲时段 0.05元 / 0.15元 / 0.05元；高峰时段 0.10元 / 0.30元 / 0.10元；…（缓存未命中）空闲 1.5元 / 4.5元 / 1.5元；高峰 3.0元 / 9.0元 / 3.0元；输出 空闲 4.5元 / 13.5元 / 4.5元；高峰 9.0元 / 27.0元 / 9.0元」列序 = flash / pro / vision-exp |
| A2 | A1 + cache-buster `?v=20260910-1306` | 13:06 | 与 A1 **完全相同**（已排除 CDN 缓存旧页面的可能） |
| A3 | <https://api-docs.deepseek.com/quick_start/pricing/>（英文页） | 13:05 | flash `$0.007 / $0.014`、`$0.22 / $0.44`、`$0.66 / $1.32`；pro `$0.022 / $0.044`、`$0.66 / $1.32`、`$1.98 / $3.96`；脚注「Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday (all other hours are off-peak)」 |
| A4 | <https://api-docs.deepseek.com/zh-cn/updates> | 13:05 | 最新条目 2026-08-21，**无** 2026-09-09/10 调价条目 |
| A5 | <https://api-docs.deepseek.com/sitemap.xml> | 13:05 | 新闻止于 `news260821`，无 `news2609xx` |
| A6 | <https://api-docs.deepseek.com/zh-cn/news/news260821> | 13:05 | 「计费价格与 V4-Flash 模型一致」（vision-exp 同价的官方表述） |

A1 脚注(1)逐字：「空闲时段价格为高峰时段价格的一半。高峰时段为北京时间周一至周五 9:00 - 12:00、
14:00 - 18:00（其余为空闲时段）。」

A1 与 A3 交叉验算（旧人民币价 × 0.1467 ≈ 美元价）：0.05→0.007、1.5→0.22、4.5→0.66、0.15→0.022、
13.5→1.98 全部吻合 ⇒ **中英文定价页在 13:04–13:06 仍共同反映调价前的 flash 价**，即公告所称
「北京时间 2026-09-10 12:00 生效」之后 64–66 分钟，官方定价页尚未同步。

一手公告不可得（已尽力，四路全试）：
- <https://platform.deepseek.com/announcements> → 仅 SPA 空壳（页面文本只有「DeepSeek」）。
- <https://platform.deepseek.com/api/v0/announcements> → HTTP 404 `{"detail":"Not Found"}`。
- <https://api-docs.deepseek.com/zh-cn/news/news260910> → 不存在（回落文档首页）。
- A4/A5 无 9 月调价条目。

二级（媒体逐字转载，非官方域名）证据——我亲自打开并核对了 4 篇：
- 大众网/界面新闻 <https://www.dzwww.com/news/yw/202609/t20260909_18097412.htm>（09-09 08:41）：
  「DeepSeek 开放平台公告，将于北京时间 2026 年 9 月 10 日 12:00 起，调整 flash 系列定价：空闲时段输入
  缓存命中单价 0.02 元、输入缓存未命中单价 1 元，输出单价 4 元；高峰时段价格为空闲时段价格的 2 倍。
  高峰时段是指北京时间周一至周五 9:00-12:00、14:00-18:00（其余为空闲时段）。」页面附平台公告截图
  （`appimg.dzwww.com/share/2026/09/09/39ce83324246da3_750.PNG`）。
- IT之家 09-09 06:39 <https://m.ithome.com/html/999953.htm>：给出 0.05→0.02、0.10→0.04（-60%）、
  1.5→1、3.0→2（-33.33%）、4.5→4、9.0→8（-11.11%）对照表，并明确「Flash 系列目前包含
  deepseek-v4-flash 和 deepseek-v4-flash-vision-exp 两款模型」。
- IT之家 09-10 12:10 <https://m.ithome.com/html/1000692.htm>（**今日**）：「DeepSeek 官方今日向 API 用户
  发送通知邮件，宣布… V4.1 Flash 模型并执行新的 Flash 定价… 空闲 0.02/1/4，高峰为空闲 2 倍，12:00 生效」
  「计划推迟至北京时间 2026 年 9 月 14 日 12:00 下线 V4 Pro 服务，届时 V4 Pro 将路由到 V4.1 Flash 并按
  V4.1 Flash 计费」。
- 21财经 09-09 08:08 <https://m.21jingji.com/timeline/9cd6f9ad250001bd65a9bc808acbfbea.html>：同文同数。
- 检索另见界面/新浪财经/华尔街见闻快讯/钛媒体/观察者网/TechWeb/站长之家/网易/腾讯/东方财富/搜狐等 10+ 家
  同文不同稿源，其「调整前」列与本仓旧值、与 A1 逐值一致（内部自洽）。

## 3. 逐项比对与判定

| 验收点 | 结论 | 依据 |
|---|---|---|
| flash / vision-exp 共 12 个数（0.02/1/4、0.04/2/8） | **FAILED（blocker）** | 唯一载体是开放平台公告的**媒体逐字转载**（B 级）；一手公告页需登录、公开接口 404、A4/A5 无条目 ⇒ 无法从官方来源复核。且 A1/A2/A3 在生效时点后 64–66 分钟仍逐值显示旧价（0.05/1.5/4.5、0.10/3.0/9.0），与仓库值**当场冲突**。差异性质＝「官方定价页未同步/无法确认」，理由充分且已在 `registry.ts:35-38`、`public/docs/deepseek.md:47-48` 如实披露，但按验证者职责不得据此认证数值正确 |
| pro 6 个数 | passed | 与 A1 逐值一致（0.15/0.30、4.5/9.0、13.5/27.0）；公告亦未涉 pro |
| vision-exp 是否应在列、是否与 flash 同价 | passed（结构） | A1 该列存在且与 flash 逐值同价；A6 官方「计费价格与 V4-Flash 模型一致」 |
| 峰时段 / 时区 | passed | A1 脚注 ≡ `registry.ts:44-47`（北京时间周一至周五 9-12、14-18）；A3 UTC 口径 01:00-04:00 / 06:00-10:00 换算后一致；`tz` 仅描述性，渲染端 `PeakValleyView.tsx:28-41` 固定 `Asia/Shanghai`，两者一致 |
| 币种 / 单位 | passed | A1「下表所列模型价格以『百万 tokens』为单位」+ 人民币元 ≡ `currency: "CNY"`（:49）；UI 单位文案 `PeakValleyView.tsx:50-51,59` |
| 周末政策 | passed | A1「周一至周五…其余为空闲时段」⇒ 周末全天空闲 ≡ `PeakValleyView.tsx:44-47,75,104`；文案 `:95`「峰（工作日）」`:100`「其余为空闲」`:104`「周六/周日全天空闲」无矛盾 |
| 模型集合无遗漏 | passed | A1 仅 3 款模型列，registry 3 款齐全，无第四款在售模型（V4.1 Flash 沿用 `deepseek-v4-flash` 模型名，A1 未新增列） |
| 旧值 / 旧时段文案残留 | passed | 全跟踪文件 grep 无旧价格数据、无旧时段文案（详见 §4） |
| 构建 | passed | `npm run build` exit 0（在最终修订上重跑，详见 §5） |

## 4. 一致性与残留 grep（tracked 文件）

- `git grep -n -E "0\.05|0\.10|13\.5|27\.0|0\.15"` 命中仅：`src/index.css`（阴影/内边距数值）、
  `src/providers/registry.ts:62-63`（pro 合法值）、`registry.ts:38`（注释中引用**官方页当前价**，非遗留）、
  `public/docs/deepseek.md:40`（pro）、`src/components/PeakValleyView.tsx:23`（小数格式化示例
  「3 → ¥3、1.5 → ¥1.5、0.05 → ¥0.05」）。
- 旧时段文案（`9:00|14:00|18:00|工作日`）全部为当前正确口径（`registry.ts:39`、`PeakValleyView.tsx:90,95`、
  `public/docs/deepseek.md:32`）。
- 无第二份价格副本；`server/`、`query.ts` 不涉价格。

观察项（低风险，非阻断）：
1. `PeakValleyView.tsx:23` 的格式化示例借用了 flash 旧价 0.05/1.5，会被「旧值残留」类 grep 命中，建议换成
   与当前数据无关的量（如 0.02 → ¥0.02）。
2. `registry.ts:48` 的 `tz: "北京时间"` 仍是**死字段**（无读取方，渲染端硬编码 `Asia/Shanghai`）；类型注释
   已如实说明（`types/provider.ts:52-56`），但字段对逻辑无约束力。
3. **主界面（`PeakValleyView.tsx:56-60`）没有「价格来自公告、定价页尚未同步」的用户可见提示**；该说明目前
   只在弹窗文档 `public/docs/deepseek.md:47-48` 与代码注释里。用户对照官方定价页会看到矛盾。

## 5. 构建证据

```
13:07:0x  H1=EE15EBA8A4769BBB073A54037796C7EAEEB61421D80342E06A20ECB93AA2F456
> mytoken@0.1.0 build / tsc -b && vite build
✓ 2258 modules transformed.   ✓ built in 4.60s
dist/assets/index-spqqO4mh.js  525.20 kB
EXITCODE=0        H2=EE15EBA8…（构建期间 hash 未变）
```
（另在 13:04:0x、13:05:44 的两个中间修订上各跑一次，同样 exit 0；`chunk > 500 kB` 为既有告警，与本次改动无关。）

## 6. 建议的最小修复（由 captain 二选一）

- **方案 A（推荐，保留公告新价 + 消除误导）**：数值不动，在 `PeakValleyView.tsx:56-60` 的价格区加一句用户可见
  说明（例如「flash 系列为 2026-09-09 开放平台公告价 / 09-10 12:00 生效；官方定价页尚未同步」），与
  `public/docs/deepseek.md:47-48` 口径一致。改完只需 `npm run build` 复验。
- **方案 B（保守，回退到一级来源）**：把 `registry.ts:52-53,58-59` 回退为 0.05/1.5/4.5 与 0.10/3.0/9.0
  （= 当前官方定价页值），注释/文档保留公告说明与 09-14 pro 复核项。
  ⚠️ 注意：方案 B 会让界面显示**公告生效前的旧价**，与今日 IT之家所载「官方 API 用户通知邮件：V4.1 Flash
  12:00 起执行新定价」相悖，仅在 captain 判定「未同步的一级来源优先」时采用。
- 两个方案都建议顺带处理 §4 观察项 1，并**冻结修订后重跑一次验证**（§0(b)(c)）。

---

# 追加验证（t7 repair r2 之后，按 captain 复核口径重跑）

- 追加验证时刻（本机 `Get-Date`，+08:00）：**13:08:39 – 13:09:05**（构建窗口 13:08:56–13:09:05）
- 本追加节**取代** §0/§1 的修订 pin（t7 后文件再次变更）；认证修订如下：

| 文件 | sha256 |
|---|---|
| `src/providers/registry.ts` | `5A25E94A9D8DD7BB104B267127834D89B2CA2F61EE6123A2D90EC5F120316746` |
| `src/components/PeakValleyView.tsx` | `03FC29DFD380D6DD78D0F85BFA87D24A59344C0FD50776B02C0481903DCB2C98` |
| `src/types/provider.ts` | `56CC15F6BD6210C741A77904B6D0820D29A0E09C4642AB40A6DCEE226AEFBC79` |
| `public/docs/deepseek.md` | `76B03AA19C57147EF301E2F4F96E53E089F0B81074ADA7BF7ADA19366969571B` |
| `README.md` | `17D9415C876E855059D457BBDC6CA220057EDCF601341BCB92A196F7CC0B85FF` |

## A. 逐项比对（代码值 vs 公告口径）

| 模型 | 代码值（文件:行号） | 公告口径 | 判定 |
|---|---|---|---|
| `deepseek-v4-flash` | offPeak 0.02/1/4、peak 0.04/2/8（`registry.ts:53-54`） | 空闲 0.02/1/4、高峰 2×（=0.04/2/8） | **passed** |
| `deepseek-v4-flash-vision-exp` | offPeak 0.02/1/4、peak 0.04/2/8（`registry.ts:59-60`） | 属 flash 系列同标准（媒体明示两款同价；官方页两列同值 + news260821「计费价格与 V4-Flash 一致」） | **passed** |
| `deepseek-v4-pro` | offPeak 0.15/4.5/13.5、peak 0.3/9.0/27.0（`registry.ts:63-64`） | 公告未涉 pro，维持原值 | **passed** |

## B. 我自己的抓取时刻与页面片段（不引用他人时间戳）

| 抓取时刻（本机 Get-Date） | URL | 片段 |
|---|---|---|
| 13:04、13:06（cache-buster）、13:09（`?verify=t4-rerun`，构建窗口同批） | <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> | 三次均为「空闲时段 0.05元 / 0.15元 / 0.05元；高峰 0.10元 / 0.30元 / 0.10元；未命中 空闲 1.5元 / 4.5元 / 1.5元、高峰 3.0元 / 9.0元 / 3.0元；输出 空闲 4.5元 / 13.5元 / 4.5元、高峰 9.0元 / 27.0元 / 9.0元」＋脚注(1)「空闲时段价格为高峰时段价格的一半。高峰时段为北京时间周一至周五 9:00 - 12:00、14:00 - 18:00（其余为空闲时段）」 |
| 13:07 | <https://www.dzwww.com/news/yw/202609/t20260909_18097412.htm>（大众网转界面新闻，署名「来源：界面新闻」，页附平台公告截图 `appimg.dzwww.com/share/2026/09/09/39ce83324246da3_750.PNG`） | 「9月9日，DeepSeek 开放平台公告，将于北京时间 2026 年 9 月 10 日 12:00 起，调整 flash 系列定价：空闲时段输入缓存命中单价 0.02 元、输入缓存未命中单价 1 元，输出单价 4 元；高峰时段价格为空闲时段价格的 2 倍。高峰时段是指北京时间周一至周五 9:00-12:00、14:00-18:00（其余为空闲时段）。」 |
| 13:05 / 13:07 | <https://m.ithome.com/html/999953.htm>（09-09 06:39）/ <https://m.ithome.com/html/1000692.htm>（09-10 12:10） | 前者含 0.05→0.02(-60%)、1.5→1(-33.33%)、4.5→4(-11.11%) 对照表并写明「Flash 系列包含 deepseek-v4-flash 与 deepseek-v4-flash-vision-exp 两款」；后者「官方今日向 API 用户发送通知邮件…新的 Flash 定价 12:00 生效：空闲 0.02/1/4、高峰 2 倍」「推迟至 9 月 14 日 12:00 下线 V4 Pro，届时路由到 V4.1 Flash 并按 V4.1 Flash 计费」 |
| 13:05 | <https://m.21jingji.com/timeline/9cd6f9ad250001bd65a9bc808acbfbea.html>（09-09 08:08） | 同文同数（21 快讯） |

一手公告仍不可得（13:04–13:09 复测）：`platform.deepseek.com/announcements` = SPA 空壳；`/api/v0/announcements` = HTTP 404；`api-docs.deepseek.com/zh-cn/updates` 最新条目 2026-08-21；`sitemap.xml` 新闻止于 `news260821`。

## C. 硬约束检查（不得把新价来源写成「官网定价页」）

`grep -n "定价页|公告|证据等级|官网"`（*.ts/*.tsx/*.md）结果：**无任何把 flash 新价归因于定价页的表述**；相反：
- `registry.ts:31-36` 明确「新价依据：开放平台调价公告（2026-09-09 发布，2026-09-10 12:00 生效）…证据等级：官方一手公告页需登录…一级可核查载体为逐字转载 + 官方公告/通知邮件截图」；
- `registry.ts:37-38` 明确「官方定价页…仍显示旧价…**即 flash 新价不是来自定价页**」；
- `registry.ts:39` 只把**时段**归因于定价页脚注；`public/docs/deepseek.md:49` 只把**时段、币种与 pro 价**归因于中文定价页；
- `public/docs/deepseek.md:50-51` 有独立「冲突说明」段。
**四要素齐备**：数据（`:30-32`）、生效时点（`:31`）、来源（`:33-34`，两条可点链接）、证据等级（`:35-36`）；另 `:43` 增加与文档表同步维护提醒。

## D. 越界检查（git diff 范围）

- `git status --porcelain` 仅 5 个文件（README.md、public/docs/deepseek.md、src/components/PeakValleyView.tsx、src/providers/registry.ts、src/types/provider.ts）+ 本报告；**无 server/**、无 dist/**（dist 被忽略且未纳入 diff）。
- `git diff -U0 src/providers/registry.ts` 的 +/- 行只有：注释块、flash 两档 6 个数、新增 vision-exp 两条价；**`windows` / `tz` / `currency` 行未出现在变更集中**（未改）。
- `git diff -U0 src/components/PeakValleyView.tsx` 的 +/- 行只有：文件头注释 2 行、`unit` 常量、标题处单位 `<span>`；**`beijingNow()`、`isPeakHour()`、周末判定 `:44-47`、时段判定 `:75`、模型名 `replace` 正则 `:126` 均未改动**（正则加固确实未做，符合排除范围）。
- `src/types/provider.ts` 仅两处 doc 注释（币种说明、tz 说明字段）；`README.md` 仅 1 行。

## E. 构建

```
13:08:56 → 13:09:05（+08:00）
> mytoken@0.1.0 build / tsc -b && vite build
✓ 2258 modules transformed.  ✓ built in 4.51s   EXITCODE=0
构建前后 registry.ts sha256 均为 5A25E94A…（未被并发编辑）
```
（chunk > 500 kB 为既有告警，与本改动无关。）

## F. 本轮判定与任务状态说明

在本轮 captain 口径（「官方定价页仍显示旧价」不作为失败理由；验代码=公告口径、证据链、归因硬约束、未声明项）下，§A–§E **全部 passed**。
但必须记录一个任务状态事实：**t4 已被我上一轮以 failed 终结，终态不可改写**，因此本轮结论无法写入 t4 的正式 verdict。若要形成正式的门禁记录，需由 captain 新建一个依赖 t7（repair r2）的验证任务（或按流程重新派发），我可以按同一套命令在冻结修订上重跑（约 1 分钟：hash + 数值 grep + `npm run build` + 官方页复抓）。

## G. 时间戳勘误（按 captain 要求记录，且本报告不引用他人时间戳作为证据时刻）

- 他人产出（t2 证据文件、以及 captain 转述的「12:52–13:25 / 13:40」）中出现的抓取时刻**不可采信**：我在本机 13:02–13:09 期间连续观测时，这些「未来时间戳」所指的既有产物/files 已经存在；本机 `Get-Date` 在 13:03:58–13:09:05 之间的读数与之矛盾。
- 本报告 §B、§E 的全部时刻均为我自己的 `Get-Date` 读数；其中「官方定价页 13:05 复核」与 `registry.ts:37` 注释中的「13:05」恰好一致（同一时钟口径），可作交叉印证。
- 实质结论不受时间戳影响：定价页三次复抓内容一致，公告转载四篇内容一致。

## H. 仍然保留的低风险观察项（非阻断，供 reviewer / integration 参考）

1. `src/components/PeakValleyView.tsx:23` 的格式化示例借用 flash 旧价（`1.5 → ¥1.5、0.05 → ¥0.05`），会被「旧值残留」类 grep 命中；建议改为与新价无关或一致的示例。
2. 主界面 `PeakValleyView.tsx:56-60` 仍无「flash 为公告价、定价页尚未同步」的用户可见提示；该说明只在弹窗文档 `public/docs/deepseek.md:44-51` 与代码注释中（是否补提示由 captain 决定）。
3. `registry.ts:49` 的 `tz: "北京时间"` 仍是描述性字段（渲染端固定 `Asia/Shanghai`），类型注释已如实说明。

---

# 归属判定（按 captain 更正口径重做，13:09:47–13:10 本机时间）

判定修订（此刻 hash；注意：这已比 t8 冻结基线 `5A25E94A`/`76B03AA1` 更新，engineer 的 t9 修复正在写入）：
`registry.ts` `569ADDD6…`、`deepseek.md` `FFBDDCA4…`、`PeakValleyView.tsx` `03FC29DF…`、`provider.ts` `56CC15F6…`、`README.md` `17D9415C…`。
数值未因这次编辑变动：flash `:55-56`、vision-exp `:61-62`、pro `:65-66`。

**未使用** impl-scout 建议的机械反向 grep；改为逐条读原文判断归属。

| 检查项 | 判定 | 原文证据（逐字） |
|---|---|---|
| 1. flash 新价必须归属「开放平台 2026-09-09 公告 / 09-10 12:00 生效」，不得归为定价页 | **passed** | `registry.ts:31-32`「新价依据：DeepSeek 开放平台调价公告（2026-09-09 发布，北京时间 2026-09-10 12:00 生效）—— flash 系列 空闲 0.02/1/4、高峰 0.04/2/8」；`:39` 反向明示「**即 flash 新价不是来自定价页**」；`deepseek.md:44-48`「flash 系列新价依据 DeepSeek 开放平台 2026-09-09 调价公告…可核查载体为公告的逐字转载」；`deepseek.md:49` 把定价页的归属**严格限定**为「峰谷时段、币种与 pro 价」 |
| 2. 是否如实写明「官方定价页当时为旧价/尚未同步」 | **passed（加分项已具备）** | `registry.ts:37-38`「官方定价页…于 2026-09-10 13:04–13:06 两次本机复核仍为调价前价格（0.05/1.5/4.5、0.10/3.0/9.0，页面滞后）」；`deepseek.md:50-51`「**冲突说明**：…仍为调价前价格 0.05/1.5/4.5（未同步本次调价）；本表按 2026-09-09 公告执行，待定价页同步后复核」；另 `deepseek.md:55` 给出冲突处置规则「以官方公告与官方定价页为准；两者不一致时以较新者为准并复核本表」 |
| 3. 四要素（数据 / 生效时点 / 来源 / 证据等级）齐备 | **passed** | 数据＝`registry.ts:30,32`（人民币价、单位、flash 两档值）；生效时点＝`:31`（2026-09-10 12:00）；来源＝`:33-34`（dzwww 逐字转载含公告截图、ITHome 载官方 API 用户通知邮件）；证据等级＝`:35-36`（一手公告页需登录、一级可核查载体说明）。文档侧同构：`deepseek.md:42`（数值源同步提醒）、`:44-48`（来源）、`:50-51`（冲突说明）、`:52-54`（待复核/TODO 09-14） |

正向断言（captain 指定）：
`Select-String -Path src/providers/registry.ts,public/docs/deepseek.md -Pattern "开放平台"` → 命中 3 处：
`registry.ts:31`「新价依据：DeepSeek 开放平台调价公告…」、`deepseek.md:44`「flash 系列新价依据 DeepSeek 开放平台 2026-09-09 调价公告…」、`deepseek.md:3`（余额接口，无关）。

**对 captain 引用措辞的勘误**：captain 引用的行「`// 来源 1（峰时段/币种/pro 价）：中文定价页` + `…（2026-09-10 13:02 复核）`」**在当前修订中已不存在**（`Select-String "来源 1" ` 命中数 = 0）；该行属于 13:03 之前的旧版注释。现文（`registry.ts:31-39`）不再使用「来源 1/来源 2」编号，且已把归属写得比旧版更明确（含 `:39` 的否认句）。结论不受影响：**不存在把 flash 新价归为定价页提供的表述**。

**修订冻结提示**：t8 的 pass 与我 §A–§E 的认证都指向 `5A25E94A`/`76B03AA1`；此后 registry.ts 与 deepseek.md 又被写入（现 `569ADDD6`/`FFBDDCA4`）。按 t9（方案 A 修复）的契约，最终必须在**修复后冻结的修订**上重跑 t10 复验（hash + 数值 grep + `npm run build` + 我自己的官方页复抓），本节的归属判定亦以该冻结修订为准再确认一次。

---

# 行号重核 + 逐条验收判定（最新修订，本机 13:10:29–13:10:43）

修订 pin（比上一节又新一版，engineer 仍在写入）：`registry.ts` `CF4F62B5…`、`public/docs/deepseek.md` `F89BCA11…`、
`PeakValleyView.tsx` `03FC29DF…`、`src/types/provider.ts` `56CC15F6…`、`README.md` `17D9415C…`。
`npm run build` 于 13:10:35–13:10:43 运行，**EXITCODE=0**，构建前后两个文件 hash 均未变（未被并发编辑打断）。

## 当前行号（取代本报告早前各节的旧行号）

- 价格数据：`deepseek-v4-flash` `registry.ts:55-56`、`deepseek-v4-flash-vision-exp` `:61-62`、`deepseek-v4-pro` `:65-66`
- 注释四要素：数据/单位/币种 `:30,32`、生效时点 `:31`、来源两条链接 `:33-34`、证据等级 `:35-36`；冲突/否认句 `:37-39`；时段 `:40-41`；pro 待复核 + TODO `:42-44`；与文档同步提醒 `:45`
- UI：单位文案 `PeakValleyView.tsx:50-51,59`（**至今仍无「公告价/定价页未同步」的用户可见披露** —— 那是 t9/方案 A 的交付内容，尚未落地）
- 文档：峰谷表 `deepseek.md:36-40`、数值源提醒 `:42`、来源 `:44-49`、冲突说明 `:50-51`、待复核/TODO `:52-54`、冲突处置规则 `:55`

## 逐条验收判定（按 captain 更正后的口径）

| # | 验收标准 | 判定 | 证据（当前行号／命令输出） |
|---|---|---|---|
| 1 | 数值逐项与**公告口径**一致（flash 0.02/1/4、0.04/2/8；vision-exp 同标准；pro 不变） | **passed** | `registry.ts:55-56`（flash）、`:61-62`（vision-exp）、`:65-66`（pro 0.15/4.5/13.5、0.3/9.0/27.0）；`git grep -n "cacheHit: |cacheMiss: "` 六个字段值如上述；vision-exp 属 flash 系列有官方结构证据（定价页两列同值 + news260821「计费价格与 V4-Flash 一致」） |
| 2 | 归属判定：flash 新价不得被归为定价页提供（人工判定，不用机械反向 grep） | **passed** | `registry.ts:31-32`「新价依据：DeepSeek 开放平台调价公告（2026-09-09 发布，北京时间 2026-09-10 12:00 生效）—— flash 系列 空闲 0.02/1/4、高峰 0.04/2/8」；`:39`「即 flash 新价**不是**来自定价页」；`deepseek.md:44-48` 同口径，`:49` 把定价页归属限定为「峰谷时段、币种与 pro 价」。全仓无「把 flash 新价归为定价页/声称定价页已更新」的表述 |
| 3 | 是否如实写明「官方定价页当时仍为调价前价格（未同步）」 | **passed（加分项已具备）** | `registry.ts:37-39`「官方定价页…于 2026-09-10 13:04–13:06 两次独立复核仍为调价前价格（0.05/1.5/4.5、0.10/3.0/9.0，页面滞后）」；`deepseek.md:50-51` 独立「冲突说明」段；`:55`「两者不一致时以较新者为准并复核本表」 |
| 4 | 四要素（数据 / 生效时点 / 来源 / 证据等级）齐备 | **passed** | 见上「注释四要素」行；文档侧同构（`:42/:44-49/:50-51/:52-54`） |
| 5 | 未越界（无 server/**、dist/**；windows/tz/currency 与周末逻辑未改；UI 只补单位文案） | **passed** | `git status --porcelain` 仅 5 个文件 + 本报告；`git diff -U0 registry.ts PeakValleyView.tsx` 的 +/- 行只有注释块、flash 六值与新增 vision-exp、UI 头注释 2 行 + `unit` 常量 + 单位 `<span>`；`windows/tz/currency`、`beijingNow/isPeakHour`、周末判定、`:126` 正则均未进变更集 |
| 6 | 构建可用 | **passed** | 13:10:35–13:10:43 `npm run build` → `tsc -b && vite build` 成功，EXITCODE=0（chunk>500kB 为既有告警） |
| 7 | 修订哈希稳定性（冻结前提） | **failed（未达成，属流程项）** | 13:03–13:10 期间 registry.ts 出现 ≥7 个不同 hash（`33D928F8→1D472F87→62E03E08→EE15EBA8→5A25E94A→569ADDD6→CF4F62B5`），deepseek.md 亦 4 次改写；本轮判定仅对应上表 pin，一旦再写入即失效 ⇒ 需 t9 完成后冻结并由 t10 复验 |

**结论**：与实现相关的内容判定（1–6）**全部 passed**；唯一未达成的是第 7 项「修订冻结」，属流程前提，由 t9→t10 收口。
