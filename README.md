# dsh-tongji-aigc

把**同济 AIGC 专区**（<https://agi.tongji.edu.cn>）的图片 / 视频 / 3D / 音乐生成能力，反向代理进 [DeepSeek Harness](https://deepseek.com)（DSH）。登录走**同济大学统一身份认证（SSO）跳转**，点一次按钮后由插件**自动同步浏览器登录态**（无需任何复制粘贴），宿主侧注册全套工具，产物落盘返回绝对路径。

> 登录形态只有一种：**统一身份认证（SSO）一键登录**。卡片没有账号密码输入框——同济 AIGC 的普通用户走学校 SSO，账号密码表单是管理员专用、填了必然报错。

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
2. 点 **统一身份认证登录**，插件在本机找一个已装的 **Edge / Chrome**，开一个**独立临时配置目录**的隔离窗口、加载一个**临时生成的扩展**，再在那个窗口里打开同济大学 IAM 完成认证；登录后页面跳回站内，令牌写进该窗口的 `sessionStorage`、**地址栏不会显示 token**；
3. **回到卡片，什么都不用做**：临时扩展的 content script 轮询 `sessionStorage.access_token`，读到后通过顶层导航 `location.replace(本机 DSH /api/tongji-aigc/relay?token=...)` 回传（顶层导航不受 mixed-content 拦截，可绕过 HTTPS→HTTP 限制）、校验、落盘，卡片每 2 秒自动轮询，一旦登录成功自动显示「登录有效」与姓名 / 学院 / 身份。卡片里没有任何输入框，也不需要复制或粘贴任何令牌。关闭该隔离窗口 / 超时后，临时扩展与临时配置目录会被删除（关窗即卸载）。

> 登录窗口由插件全程拥有（独立 `--user-data-dir`，不碰你平时的浏览器配置，不要求开发者模式），临时扩展用完即删。仅当本机缺 Edge / Chrome 时，卡片才自动降级提供「复制取令牌脚本」。详见 [`docs/USAGE.md`](docs/USAGE.md)。

详细用法见 [`docs/USAGE.md`](docs/USAGE.md)。

## 设计要点

- **反向代理，不落地上游代码**：插件只是把同济 AIGC 的 REST 接口包装成 DSH 工具，不复制、不托管上游模型。
- **一键零粘贴 SSO 登录 + 状态优先 UI**：卡片按「状态优先」的极简设置卡设计——主角只有一个（确认「我登录了没有、是谁」），没登录时一个按钮完成登录。点按钮 → 宿主找本机 Edge / Chrome 开隔离窗口 + 临时扩展并打开 SSO 页 → 用户在该窗口认证 → 临时扩展读同一窗口 `sessionStorage` 的令牌并通过顶层导航回传 → 校验落盘。登录窗口必须由插件自己拥有（宿主无法跨进程 / 跨源读用户浏览器存储），界面上不出现任何令牌输入框、全程零粘贴。令牌只存本机，状态接口只回掩码、永不回传明文。
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
│   ├── auto-login.js     # 临时扩展 + 隔离一次性浏览器窗登录
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
