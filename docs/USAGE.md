# dsh-tongji-aigc 使用说明

把**同济 AIGC 专区**（<https://agi.tongji.edu.cn>）的图片 / 视频 / 3D / 音乐生成能力，以反向代理的方式接进 DSH：在「设置 → 插件」里用**同济大学统一身份认证（SSO）**登录，登录后用卡片自带的脚本把浏览器里的令牌自动回传，之后在对话里调用工具，产物自动落盘并返回绝对路径。

## 一、安装

插件本体在 `C:\Users\15940\Documents\dsh-plugins\dsh-tongji-aigc`，安装进桌面 profile：

```bash
dsh plugin --profile desktop add "C:/Users/15940/Documents/dsh-plugins/dsh-tongji-aigc"
```

> 装完**需要重启 DSH 桌面端**才能加载本插件（插件代码改动同理，改完重启才生效）。

## 二、登录（统一身份认证 SSO 跳转）

站点默认登录走**同济大学统一身份认证（SSO）**，本地账号密码表单仅管理员可用，普通用户账号体系不同。登录成功后，站点把访问令牌（`access_token`，一个 JWT）写进浏览器 `sessionStorage`，并直接跳回站内——**地址栏不会显示 `token=`**，需要从浏览器里手动取一次。

1. 打开 **设置 → 插件 → 同济 AIGC**；
2. 点 **统一身份认证登录**。插件调站点 `/auth/sso/discover` 拿到 IAM 授权地址，并用系统浏览器打开；
3. 在 `iam.tongji.edu.cn` 完成统一身份认证。登录完成后浏览器跳回 `agi.tongji.edu.cn` 站内（如 `/models/hub`），此时令牌已写在浏览器里；
4. 切到那个**同济 AIGC 页面**，按 `F12` 打开开发者工具，在 **Console** 里执行 `sessionStorage.getItem('access_token')`，复制返回的那串；
5. 回到卡片，把它粘进 **令牌** 框，点 **保存令牌**，卡片显示「已保存，登录有效」即完成。

- 令牌**只存在本机**，**不会**回传明文（状态接口只回掩码，如 `********xzlg`）。
- 令牌过期会在卡片上显示「已过期」，重新登录后再粘一次即可。
- 点 **清除令牌** 可一键退出登录，不影响任何配置。

## 三、对话里的工具

| 工具 | 作用 | 关键参数 |
| --- | --- | --- |
| `tongji_aigc_generate` | 生成（主链路） | `mode`（t2i / i2i / t2v / i2v / t23d / i23d / t2a）、`prompt`、`reference_image`、`template_code`、`params`、`count`、`output_path`、`estimate_only` |
| `tongji_aigc_templates` | 列出可用模板/工作流 | `type`（image / video / 3d / music，可选） |
| `tongji_aigc_task` | 查询单个任务并下载产物 | `task_id`、`download`、`output_path` |
| `tongji_aigc_tasks` | 任务历史分页列表 | `page`、`page_size`、`status` |
| `tongji_aigc_quote` | 生成前报价（积分/费用） | `template_code`、`params`、`count` |
| `tongji_aigc_health` | 健康检查 + 登录态 | 无参数 |

`mode` 取值：

- `t2i` 文生图、`i2i` 图生图
- `t2v` 文生视频、`i2v` 图生视频
- `t23d` 文生 3D、`i23d` 图生 3D
- `t2a` 文生音乐

生成示例（文生图）：

```
用 tongji_aigc_generate 生成一张图：mode=t2i，prompt="赛博朋克风格的外滩夜景，霓虹灯光，雨后地面反射"，count=1
```

图生视频（需要一张参考图，传本地绝对路径或 URL）：

```
用 tongji_aigc_generate 做图生视频：mode=i2v，prompt="镜头缓慢推近"，reference_image="D:/xxx/ref.png"
```

产物默认落到**当前会话工作目录**下的 `tongji-aigc-<时间戳>/`，文件名 `<taskId>-NN_<名称>`，工具返回里带每个产物的绝对路径。

## 四、配置

优先级（高的赢）：**插件配置（profile 的 cordis.patch.yml）> 配置文件 > 环境变量 > 内置默认值**。

配置文件：`~/.dsh/.dsh-tongji-aigc/config.json`（可手工编辑，改完重启生效）：

```json
{
  "baseUrl": "https://agi.tongji.edu.cn/api/v1",
  "requestTimeoutMs": 300000,
  "pollIntervalMs": 2000,
  "pollTimeoutMs": 600000,
  "outputDir": "",
  "maxCount": 4
}
```

| 键 | 含义 | 默认 |
| --- | --- | --- |
| `baseUrl` | 上游 API 基址 | `https://agi.tongji.edu.cn/api/v1` |
| `requestTimeoutMs` | 单次 HTTP 请求超时 | 300000 |
| `pollIntervalMs` | 任务轮询间隔 | 2000 |
| `pollTimeoutMs` | 任务轮询总超时 | 600000 |
| `outputDir` | 默认产物目录（留空用会话工作目录） | `""` |
| `maxCount` | 单次生成数量上限 | 4 |

环境变量：`TONGJI_AIGC_BASE_URL` / `TONGJI_AIGC_POLL_INTERVAL_MS` / `TONGJI_AIGC_POLL_TIMEOUT_MS` / `TONGJI_AIGC_REQUEST_TIMEOUT_MS` / `TONGJI_AIGC_OUTPUT_DIR` / `TONGJI_AIGC_MAX_COUNT`。

> 令牌**不进配置文件**，由卡片写在 `~/.dsh/.tongji-aigc/token.json`，两者互不影响。

## 五、常见问题

- **提示未登录 / 登录态已失效**：去设置卡片重新点「统一身份认证登录」，完成认证后在「浏览器登录态」面板复制脚本、在同济 AIGC 页面 Console 运行，再点「检测登录态」。
- **登录后不知道填什么 / 提示密码错误**：本站默认登录走**统一身份认证**，不是本地管理员账号密码。请用 SSO 登录按钮跳转；登录成功后**地址栏不会显示 token**，要用卡片的「复制取令牌脚本」在同济 AIGC 页面 Console 运行来自动回传令牌。本地账号密码表单是管理员专用，普通账号填进去必然提示密码错误。
- **没看到 callback / 地址栏没有 token**：正常。站点在登录后把令牌写进浏览器并直接跳回站内，地址栏不留 `token=`。用「浏览器登录态」面板的脚本自动回传，或手动在 Console 执行 `sessionStorage.getItem('access_token')` 复制。
- **保存令牌报 invalid_token**：令牌不对或已过期，重新登录后再粘。
- **生成卡住 / 超时**：视频、3D、音乐耗时较长，可在配置里调大 `pollTimeoutMs`。
- **需要改上游地址**：改 `baseUrl`（生产默认同域 `https://agi.tongji.edu.cn/api/v1`）。
