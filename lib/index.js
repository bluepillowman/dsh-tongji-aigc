/**
 * dsh-tongji-aigc 宿主侧入口。
 *
 * 职责：
 *   1. 解析配置，构造 AigcClient（令牌从 token.json 现取）；
 *   2. 注册全套 DSH 工具（生图/生视频/3D/音乐、模板、任务、报价、健康）；
 *   3. 注册同源 HTTP 端点，供客户端设置卡片做「登录校验、令牌读写、健康检查、快速生成」。
 *
 * 不声明任何必需服务（`inject = []`）：一律用 scoped `ctx.inject` 等 webServer/tools
 * 就绪，避免服务没就绪时整个插件被推迟装载（Cordis 的 inject 语义是「缺了就不装载」）。
 */
import { resolveConfig } from './config.js'
import { AigcClient } from './aigc/client.js'
import { createTools } from './aigc/tools.js'
import { readToken, clearToken, tokenStatus, writeToken, isTokenExpired } from './token.js'
import { logInfo, logWarn } from './log.js'
import { ensureLoginEnv, startLogin, readLoginToken, cleanupLogin, AutoLoginError, NEED_BROWSER_LOGIN } from './auto-login.js'

export const name = 'dsh-tongji-aigc'
export const inject = []

/** 插件的 live 状态，供工具/端点读最新配置与令牌。 */
const live = { config: resolveConfig(), client: null }

/** 构造（或复用）客户端。令牌每次现取，改令牌/换登录无需重启。 */
function getClient() {
  if (live.client) return live.client
  live.client = new AigcClient({
    baseUrl: live.config.baseUrl,
    requestTimeoutMs: live.config.requestTimeoutMs,
    getToken: readToken,
  })
  return live.client
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function writeJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(payload)
}

/** 统一处理端点里的异常，绝不让一个坏请求把宿主搞挂。 */
function handleError(response, error) {
  const message = error?.hint ? `${error.message}（${error.hint}）` : String(error?.message || error)
  logWarn(`端点出错：${message}`)
  writeJson(response, 500, { error: message })
}

/**
 * 用 /auth/me 校验令牌。成功返回用户信息，失败抛错。
 */
async function validateToken(token) {
  const client = new AigcClient({
    baseUrl: live.config.baseUrl,
    requestTimeoutMs: live.config.requestTimeoutMs,
    getToken: () => token,
  })
  return client.me()
}

export async function apply(ctx, pluginConfig) {
  live.config = resolveConfig(pluginConfig)
  live.client = null
  logInfo(`已装载：baseUrl=${live.config.baseUrl}，poll=${live.config.pollIntervalMs}ms，timeout=${live.config.pollTimeoutMs}ms`)

  // 1) 工具
  ctx.inject(['tools'], (toolCtx) => {
    if (!toolCtx?.tools?.register) {
      logWarn('宿主没有提供 tools.register，本插件工具未注册')
      return
    }
    const disposers = []
    for (const tool of createTools(live.config, getClient)) {
      disposers.push(toolCtx.tools.register(tool))
    }
    return () => {
      for (const dispose of disposers.splice(0)) {
        try {
          if (typeof dispose === 'function') dispose()
        } catch (error) {
          logWarn(`摘除工具失败：${String(error)}`)
        }
      }
    }
  })

  // 2) 同源 HTTP 端点（供客户端卡片使用）
  ctx.inject(['webServer'], (webCtx) => {
    if (!webCtx?.webServer?.register) {
      logWarn('宿主没有提供 webServer.register，本插件卡片端点未注册')
      return
    }
    const disposers = []
    const register = (path, handler) => disposers.push(webCtx.webServer.register({ kind: 'exact', path, handler }))

    /** 状态：令牌是否配置、掩码、是否过期，以及站点/登录校验结果。 */
    register('/api/tongji-aigc/status', async (request, response) => {
      try {
        const status = tokenStatus()
        const body = {
          baseUrl: live.config.baseUrl,
          configured: status.configured,
          hint: status.hint,
          expired: status.expired,
          expiresAt: status.expiresAt,
        }
        if (status.configured) {
          try {
            body.user = await validateToken(readToken())
          } catch (error) {
            body.error = String(error?.message || error)
          }
        }
        writeJson(response, 200, body)
      } catch (error) {
        handleError(response, error)
      }
    })

/** 保存令牌：先校验，通过才落盘；校验失败回 401。 */
    register('/api/tongji-aigc/token', async (request, response) => {
      try {
        if (request.method === 'GET') {
          writeJson(response, 200, tokenStatus())
          return
        }
        if (request.method === 'DELETE') {
          clearToken()
          live.client = null
          writeJson(response, 200, { configured: false })
          return
        }
        if (request.method !== 'POST' && request.method !== 'PUT') {
          writeJson(response, 405, { error: 'method_not_allowed' })
          return
        }
        const body = JSON.parse((await readBody(request)).toString('utf8') || '{}')
        const token = String(body.token ?? '').trim()
        if (token === '') {
          writeJson(response, 400, { error: 'empty_token' })
          return
        }
        try {
          await validateToken(token)
        } catch (error) {
          writeJson(response, 401, { error: 'invalid_token', detail: String(error?.message || error) })
          return
        }
        writeToken(token)
        live.client = null
        writeJson(response, 200, { configured: true, hint: tokenStatus().hint, expired: isTokenExpired(token) })
      } catch (error) {
        handleError(response, error)
      }
    })

    /**
     * 临时扩展回传令牌的落地端点（GET，顶层导航方式）：
     *   - 临时扩展从 HTTPS 的 agi.tongji.edu.cn 页用 `location.replace(origin + '/api/tongji-aigc/relay?token=...')`
     *     跳过来（顶层导航不受混合内容拦截，可绕过 HTTPS→HTTP 限制）。
     *   - 读取 query 中的 token，校验通过则落盘，并返回一段「登录成功，可关闭窗口」的提示页；
     *     校验失败也返回提示页（不要 401 成空页面，让用户知道发生了什么）。
     */
    register('/api/tongji-aigc/relay', async (request, response) => {
      try {
        const url = new URL(request.url, 'http://localhost')
        const token = String(url.searchParams.get('token') || '').trim()
        const okPage = (title, msg) =>
          `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${title}</title>` +
          `<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#f3f4f6;color:#111;display:flex;height:100vh;align-items:center;justify-content:center;margin:0}` +
          `.c{max-width:360px;padding:32px 28px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12)}` +
          `h1{font-size:20px;margin:0 0 12px}h2{font-size:15px;font-weight:500;color:#374151;margin:0}p{font-size:13px;color:#6b7280;margin:14px 0 0}</style></head>` +
          `<body><div class="c"><h1>${title}</h1><h2>${msg}</h2><p>你可以直接关闭这个登录窗口了。</p></div></body></html>`
        if (token === '') {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          response.end(okPage('回传失败', '未收到令牌（token 为空）'))
          return
        }
        try {
          await validateToken(token)
        } catch (error) {
          response.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' })
          response.end(okPage('令牌无效', '回传的令牌未通过校验，请重试登录'))
          return
        }
        writeToken(token)
        live.client = null
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(okPage('登录成功', '同济 AIGC 已连接，令牌已安全保存到本机'))
      } catch (error) {
        handleError(response, error)
      }
    })

    /**
     * 统一身份认证（SSO）跳转：插件调站点 /auth/sso/discover 取 IAM 授权地址。
     * 仅作为 login-start 的内部依赖 / 兼容保留；卡片应改用 login-start。
     */
    register('/api/tongji-aigc/sso-url', async (request, response) => {
      try {
        const data = await getClient().ssoDiscover('tongji')
        const url = String(data?.redirect_url || data?.url || '').trim()
        if (url === '') {
          writeJson(response, 502, { error: 'sso_discover_failed', detail: '站点未返回 SSO 授权地址' })
          return
        }
        writeJson(response, 200, { url })
      } catch (error) {
        handleError(response, error)
      }
    })

    /**
     * 开始登录（零粘贴的起点）：宿主开一个隔离的一次性浏览器窗并加载临时扩展。
     *   - 先确认本机有可用浏览器（Edge / Chrome），没有就快速降级；
     *   - 取 IAM 授权地址；
     *   - 把临时扩展写到系统临时目录，扩展在 agi 站内轮询 sessionStorage.access_token，
     *     读到后通过顶层导航 `location.replace(origin + '/api/tongji-aigc/relay?token=...')` 回传
     *     （顶层导航不受混合内容拦截，可绕过 HTTPS→HTTP 限制）；
     *   - 用独立 --user-data-dir 开隔离窗口加载该扩展，打开 SSO 授权页；记住 {pid,...}。
     * 用户只需在弹出的隔离窗口里完成同济统一身份认证，令牌会由临时扩展自动回传并落盘，
     * 全程不用复制粘贴；窗口关闭 / 超时后临时扩展与配置目录被删除（关窗即卸载）。
     *
     * 请求体可带 { origin }：回传端点基于此源拼出，缺省则用当前请求的源。
     *
     * 返回：
     *   200 {started:true}             —— 隔离登录窗口已打开，卡片开始轮询
     *   503 {pending:false, reason}    —— 环境缺失（无可用浏览器）
     */
    register('/api/tongji-aigc/login-start', async (request, response) => {
      try {
        // 先确认本机有可用浏览器，缺了就快速降级，不必白打一次上游。
        const exe = await ensureLoginEnv()
        const data = await getClient().ssoDiscover('tongji')
        const authUrl = String(data?.redirect_url || data?.url || '').trim()
        if (authUrl === '') {
          writeJson(response, 502, { error: 'sso_discover_failed', detail: '站点未返回 SSO 授权地址' })
          return
        }
        let origin = ''
        try {
          const body = JSON.parse((await readBody(request)).toString('utf8') || '{}')
          origin = String(body.origin || '').trim()
        } catch { /* 没有 body 就用请求源 */ }
        if (origin === '') {
          const host = request.headers?.host || 'localhost'
          origin = `http://${host}`
        }
        const relayUrl = `${origin}/api/tongji-aigc/relay`
        await startLogin(authUrl, relayUrl)
        writeJson(response, 200, { started: true })
      } catch (error) {
        if (error instanceof AutoLoginError) {
          writeJson(response, 503, { pending: false, reason: error.code, detail: error.message })
          return
        }
        handleError(response, error)
      }
    })

    /**
     * 自动同步登录态：临时扩展已把 agi 站内的 sessionStorage.access_token 通过
     * 顶层导航回传并落盘。本端点读回令牌、校验通过后返回 configured，卡片轮询它，
     * 认证一完成就自动变为「已登录」，全程无需复制粘贴令牌。
     *
     * 返回：
     *   200 {configured:true, hint, expired} —— 已同步成功
     *   202 {pending:true, reason, detail}   —— 还没登录好，卡片继续轮询
     *   503 {pending:false, reason, detail}  —— 环境缺失，停止轮询并提示
     */
    register('/api/tongji-aigc/auto-login', async (request, response) => {
      try {
        const token = await readLoginToken()
        try {
          await validateToken(token)
        } catch (error) {
          writeJson(response, 202, { pending: true, reason: 'invalid_token', detail: String(error?.message || error) })
          return
        }
        writeToken(token)
        live.client = null
        writeJson(response, 200, { configured: true, hint: tokenStatus().hint, expired: isTokenExpired(token) })
      } catch (error) {
        if (error instanceof AutoLoginError) {
          const pending = NEED_BROWSER_LOGIN.has(error.code)
          writeJson(response, pending ? 202 : 503, {
            pending,
            reason: error.code,
            detail: error.message,
          })
          return
        }
        handleError(response, error)
      }
    })

    /** 模板列表（卡片可选展示，方便选 template_code）。 */
    register('/api/tongji-aigc/templates', async (request, response) => {
      try {
        const type = new URL(request.url ?? '/', 'http://localhost').searchParams.get('type') || undefined
        const templates = await getClient().templates(type)
        writeJson(response, 200, { total: templates.length, templates })
      } catch (error) {
        handleError(response, error)
      }
    })

    /**
     * 卡片快速生成。复用与工具同一条链路：创建任务 → 轮询 → 落盘。
     * 产物写到配置的 outputDir 或会话工作目录；返回绝对路径与产物 URL。
     */
    register('/api/tongji-aigc/generate', async (request, response) => {
      try {
        if (request.method !== 'POST') {
          writeJson(response, 405, { error: 'method_not_allowed' })
          return
        }
        const body = JSON.parse((await readBody(request)).toString('utf8') || '{}')
        const client = getClient()
        if (!readToken()) {
          writeJson(response, 401, { error: 'not_logged_in' })
          return
        }
        const mode = String(body.mode || '').trim()
        const prompt = String(body.prompt || '').trim()
        if (!mode || !prompt) {
          writeJson(response, 400, { error: 'missing_mode_or_prompt' })
          return
        }
        const result = await generateByMode(client, mode, prompt, {
          templateCode: body.template_code,
          params: body.params || {},
          referenceImage: body.reference_image,
          count: body.count,
        })
        writeJson(response, 200, result)
      } catch (error) {
        handleError(response, error)
      }
    })

    return () => {
      for (const dispose of disposers.splice(0)) {
        try {
          if (typeof dispose === 'function') dispose()
        } catch (error) {
          logWarn(`摘除 HTTP 路由失败：${String(error)}`)
        }
      }
    }
  })

  logInfo('dsh-tongji-aigc 装载完成：工具与卡片端点已就绪')
}

/** 复用 runner 的最小生成链路（给卡片快速生成用，避免把工具 executor 逻辑重复一遍）。 */
async function generateByMode(client, mode, prompt, options) {
  const { createTaskDependencies } = await import('./aigc/generate.js')
  const deps = createTaskDependencies(live.config)
  return deps.run({ client, mode, prompt, ...options })
}
