# dsh-tongji-aigc

把**同济 AIGC 专区**（<https://agi.tongji.edu.cn>）的图片 / 视频 / 3D / 音乐生成能力，反向代理进 [DeepSeek Harness](https://deepseek.com)（DSH）。登录走**同济大学统一身份认证（IAM）**，在卡片里填**工号 + 密码**即可（无需任何复制粘贴；多数账号不弹验证码，仅当 IAM 要求时才需填验证码），宿主侧注册全套工具，产物落盘返回绝对路径。

> 登录形态只有一种：**账号密码直登**。插件用纯 HTTP 打通整条 IAM 链路——`discover → 登录页 → 前置校验 → RSA 加密提交（XHR）→ GET AuthnEngine → 授权码 → agi 换令牌`，令牌从 agi callback 的 **302 跳转 URL `token=`** 取得（不碰浏览器 sessionStorage），全程零粘贴。多数账号不弹验证码，直接工号 + 密码登录；仅当 IAM 要求时才现取一张验证码让你填。

## 能力

| 工具 | 作用 |
| --- | --- |
| `tongji_aigc_generate` | 生成：文生图 / 图生图 / 文生视频 / 图生视频 / 文生 3D / 图生 3D / 文生音乐 |
| `tongji_aigc_templates` | 列出可用模板 / 工作流 |
| `tongji_aigc_task` | 查询单个任务状态并下载产物 |
| `tongji_aigc_tasks` | 任务历史分页列表 |
| `tongji_aigc_quote` | 生成前报价（积分 / 费用） |
| `tongji_aigc_health` | 健康检查 + 登录态 |

## 快速开始

```bash
# 1. 安装进桌面 profile（装完需重启 DSH）
dsh plugin --profile desktop add "C:/Users/15940/Documents/dsh-plugins/dsh-tongji-aigc"
```

1. 重启 DSH，打开 **设置 → 插件 → 同济 AIGC**；
2. 卡片显示**账号密码登录**面板：输入同济**工号 / 学号**、**密码**，点登录即全自动完成（多数账号不弹验证码；若 IAM 要求，面板会自动展开**验证码图**让你填，图看不清点「换一张」）；面板下方另有**「浏览器登录」**按钮，用于工号 + 密码无法直登的情况；
3. 点 **登录**：插件用纯 HTTP 提交 IAM（密码 RSA 加密）、跟随授权链拿到 code，再向 agi callback 跟随 302 跳转从 URL `token=` 取得 `access_token`、校验、落盘。成功后卡片自动显示「登录有效」与姓名 / 学院 / 身份，**全程无需复制或粘贴任何令牌**。

> 工号 / 密码有误时卡片就地提示；若 IAM 要求验证码，面板自动展开验证码框并自动换一张。该账号若被 IAM 触发二次认证（人脸 / 短信等增强认证），纯 HTTP 无法完成，请点面板上的**「浏览器登录」**：插件会用本机 Edge / Chrome 弹一个独立窗口打开同济登录页，你在里面照常完成登录（含人脸 / 短信），令牌由插件自动抓取落盘。令牌只存本机 `~/.dsh-tongji-aigc/token.json`，状态接口只回掩码。详见 [`docs/USAGE.md`](docs/USAGE.md)。

详细用法见 [`docs/USAGE.md`](docs/USAGE.md)。

## 设计要点

- **反向代理，不落地上游代码**：插件只是把同济 AIGC 的 REST 接口包装成 DSH 工具，不复制、不托管上游模型。
- **账号密码直登 + 状态优先 UI**：卡片按「状态优先」的极简设置卡设计——主角只有一个（确认「我登录了没有、是谁」）。没登录时显示工号 / 密码表单，填完点登录即全自动完成（多数账号不弹验证码；仅当 IAM 要求时面板才自动展开验证码框）。宿主用纯 HTTP 跑完整条 IAM 链路（`lib/aigc/iam-login.js`：自实现 cookie jar + 手动跟 302 + RSA 加密密码），最后向 agi `/auth/sso/callback` 换令牌、令牌取自 **JSON 响应体**（不依赖浏览器 sessionStorage），校验落盘。登录会话跨请求存在磁盘（DSH 每请求新进程也能续上），验证码按需现取；令牌只存本机、状态接口只回掩码、永不回传明文。
- **浏览器自动化登录**：工号 + 密码无法直登（或账号密码登录被 IAM 触发人脸 / 短信等增强认证）时，点**「统一身份认证登录」**——用本机 Edge / Chrome 开独立临时窗口打开同济登录页，用户在真浏览器里完成登录（`lib/browser-login.js`：自启浏览器 + CDP **`Fetch` 域主动拦截** `*token=*` 请求——命中即暂停、从 `request.url` 取令牌、再放行不阻断登录；另有 `/json/list` 轮询兜底），令牌校验落盘，凭据只在真浏览器输入、插件不碰。
- **异步任务轮询**：复用「创建任务 → 轮询状态 → 回收产物」的通用反向代理范式，长任务（视频 / 3D / 音乐）自动等待到终态并把产物下载到会话工作目录。
- **配置分层**：插件配置 > `~/.dsh/.dsh-tongji-aigc/config.json` > 环境变量 > 内置默认值，令牌与配置分离（令牌在 `~/.dsh-tongji-aigc/token.json`）。
- **主题自适应**：卡片样式只用宿主真实的 `--dsw-*` token，主按钮随深浅主题反转，已在 light / dark 两套主题下做过截图验收。

## 目录

```
dsh-tongji-aigc/
├── lib/
│   ├── index.js          # 宿主入口：工具注册 + webServer 端点（含 login-start / auto-login）
│   ├── config.js         # 配置分层解析
│   ├── token.js          # 令牌读写 / 掩码 / JWT 解析
│   ├── auto-login.js     # （保留）临时扩展 + 隔离一次性浏览器窗登录（现役为账号密码直登）
│   ├── log.js
│   ├── aigc/
│   │   ├── client.js     # 同济 AIGC REST 客户端
│   │   ├── generate.js   # 生成主链路（工具与卡片端点共用）
│   │   ├── runner.js     # 任务轮询 + 产物落盘
│   │   └── tools.js      # 6 个 DSH 工具定义
│   └── client/index.js   # 设置卡片（状态优先 UI + 全自动登录）
├── locale/               # zh / en 文案（meta + 卡片）
├── docs/USAGE.md
├── cordis.patch.yml
├── icon.svg
└── package.json
```

## 许可

MIT
