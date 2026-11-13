# dsh-tongji-aigc

把**同济 AIGC 专区**（<https://agi.tongji.edu.cn>）的图片 / 视频 / 3D / 音乐生成能力，反向代理进 [DeepSeek Harness](https://deepseek.com)（DSH）。登录走**同济大学统一身份认证（SSO）跳转**，登录后用卡片自带的脚本把浏览器里的令牌自动回传保存，宿主侧注册全套工具，产物落盘返回绝对路径。

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
2. 在 **登录** 面板点 **统一身份认证登录**，浏览器打开同济大学 IAM 完成认证；登录后浏览器跳回站内，**地址栏不会显示 token**；
3. 在 **浏览器登录态** 面板点 **复制取令牌脚本**，切到同济 AIGC 页面按 `F12` → Console 粘贴运行，脚本自动把令牌回传插件；
4. 回到卡片点 **检测登录态**，显示「已读取到登录态，令牌已保存」后，即可在对话里调用 `tongji_aigc_generate` 等工具。

详细用法见 [`docs/USAGE.md`](docs/USAGE.md)。

## 设计要点

- **反向代理，不落地上游代码**：插件只是把同济 AIGC 的 REST 接口包装成 DSH 工具，不复制、不托管上游模型。
- **统一身份认证（SSO）跳转登录 + 浏览器脚本自动回传**：站点默认登录走同济大学统一身份认证，插件调 `/auth/sso/discover` 取 IAM 授权地址、用浏览器打开，登录后令牌写在浏览器 `sessionStorage`、地址栏不显示 `token=`。卡片「浏览器登录态」面板提供取令牌脚本，用户在同济 AIGC 页面 Console 运行即可用 `no-cors` 请求把令牌回传插件落盘，无需手动复制。令牌只存本机，状态接口只回掩码、永不回传明文。
- **异步任务轮询**：复用「创建任务 → 轮询状态 → 回收产物」的通用反向代理范式，长任务（视频 / 3D / 音乐）自动等待到终态并把产物下载到会话工作目录。
- **配置分层**：插件配置 > `~/.dsh/.dsh-tongji-aigc/config.json` > 环境变量 > 内置默认值，令牌与配置分离。

## 目录

```
dsh-tongji-aigc/
├── lib/
│   ├── index.js          # 宿主入口：工具注册 + webServer 端点
│   ├── config.js         # 配置分层解析
│   ├── token.js          # 令牌读写 / 掩码 / JWT 解析
│   ├── log.js
│   ├── aigc/
│   │   ├── client.js     # 同济 AIGC REST 客户端
│   │   ├── generate.js   # 生成主链路（工具与卡片端点共用）
│   │   ├── runner.js     # 任务轮询 + 产物落盘
│   │   └── tools.js      # 6 个 DSH 工具定义
│   └── client/index.js   # 设置卡片（SSO 登录 + 令牌管理 + 快速生图）
├── locale/               # zh / en 文案（meta + 卡片）
├── docs/USAGE.md
├── cordis.patch.yml
├── icon.svg
└── package.json
```

## 许可

MIT
