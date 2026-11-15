/**
 * dsh-tongji-aigc 客户端设置卡片。
 *
 * 出现在「设置 → 插件」。设计取向（状态优先的极简设置卡）：
 *   一张卡里只让一件事最重要——「你现在是谁」。身份用大字号做主角，登录/退出
 *   是唯一主动作；靠留白与字重分层，不靠逐层描边把信息框起来。
 *
 * 登录流程（自动，无输入框、无粘贴）：
 *   1. 点「统一身份认证登录」→ 宿主 /login-start 在本机找一个 Edge / Chrome，
 *      开一个独立临时配置目录的隔离窗口并加载一个临时生成的扩展，再打开 SSO 授权页
 *      （不是用户平时的浏览器，独立 --user-data-dir，不碰用户配置）；
 *   2. 用户就在那个隔离窗口完成同济统一身份认证；站点把令牌写进该窗口
 *      sessionStorage（地址栏不留 token）；
 *   3. 临时扩展的 content script 轮询 sessionStorage.access_token，读到后通过顶层导航
 *      location.replace(本机 DSH /api/tongji-aigc/relay?token=...) 回传（顶层导航不受
 *      mixed-content 拦截，可绕过 HTTPS→HTTP 限制）、校验、落盘；
 *   4. 卡片后台轮询 /api/tongji-aigc/status，一旦 configured 变 true 自动切到「已登录」并显示身份；
 *      登录窗口关闭 / 超时后临时扩展与配置目录被删除（关窗即卸载）。
 *   5. 仅当本机确实没有可用 Edge / Chrome 时，才降级为「复制取令牌脚本」（no-cors 回传）。
 *
 * 为什么是「临时扩展 + 隔离窗口」：宿主无法跨进程 / 跨源读用户浏览器的 sessionStorage；
 * 必须有一段代码跑在用户登录的那个浏览器会话里读令牌再回传。临时扩展只在本次登录写入
 * 并加载、用完即删，不要求开发者模式、不在用户常用浏览器里留下任何痕迹。
 *
 * 约定（照 dsh-api-rules 卡片）：
 *   - 纯 React DOM + 组件级 <style>，React 在 factory 顶层取一次；
 *   - 文案用扁平点号 key，`t(key)` 调用，中英两份字典同写；
 *   - 样式只用宿主真实存在的 --dsw-* token，且带兜底色，主按钮随深浅主题反转；
 *   - 字号分层：20px 标题/身份，14px 正文与按钮，13px 辅助，绝不靠 11px 撑版面。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-tongji-aigc',
  factory(require) {
    const name = 'dsh-tongji-aigc-client'
    const inject = ['slots', 'locale']
    const ReactTop = require('react')

    const zh = {
      'card.title': '同济 AIGC',
      'card.desc': '登录后即可在对话里直接调用同济 AIGC 专区的生图、生视频、3D 与音乐能力。',
      'card.signIn': '统一身份认证登录',
      'card.signInBusy': '正在打开登录窗口…',
      'card.ssoFailed': '无法打开登录窗口，请确认本机装有 Edge 或 Chrome 后重试。',
      'card.waitingTitle': '等待登录完成',
      'card.waitingHint': '请在刚弹出的登录窗口里完成同济统一身份认证。登录成功后这里会自动变为已登录，无需复制或粘贴任何令牌；关闭该窗口即结束本次登录。',
      'card.waitingTimeout': '还没检测到登录。可以再点一次登录，或改用下方的备用方式。',
      'card.signOut': '退出登录',
      'card.signOutBusy': '正在退出…',
      'card.signedInAs': '当前登录',
      'card.stateOk': '登录有效',
      'card.stateExpired': '登录已过期',
      'card.tokenState': '令牌',
      'card.validUntil': '有效至',
      'card.autoOk': '登录态已自动同步。',
      'card.signedOutOk': '已退出登录。',
      'card.fallbackTitle': '自动登录暂不可用',
      'card.fallbackHint': '未检测到可用的 Edge / Chrome。可用备用方式：复制一段脚本，切到已登录的同济 AIGC 页面，按 F12 在 Console 里粘贴运行，令牌会自动回传。',
      'card.copyScript': '复制取令牌脚本',
      'card.copied': '脚本已复制。请切到同济 AIGC 页面，按 F12 → Console 粘贴并回车；完成后这里会自动更新。',
      'card.copyFailed': '复制失败，请手动选中下方脚本复制。',
      'card.scriptLabel': '备用脚本',
      'card.notLoggedIn': '尚未登录',
      'card.offline': '暂时无法读取登录状态',
      'card.retry': '重试',
      'card.accountTitle': '统一身份认证',
      'card.accountHint': '点击下方按钮打开同济统一身份认证页面，按提示完成登录（如遇人脸/短信验证照常操作），令牌自动保存，无需复制粘贴。',
      'card.username': '工号 / 学号',
      'card.password': '密码',
      'card.checkcode': '验证码',
      'card.captchaAlt': '登录验证码',
      'card.captchaRefresh': '换一张',
      'card.captchaLoading': '验证码加载中…',
      'card.captchaEmpty': '验证码未加载',
      'card.accountSignIn': '登录',
      'card.accountBusy': '正在登录…',
      'card.accountOk': '登录成功，令牌已保存。',
      'card.accountFailed': '登录失败，请核对工号、密码与验证码后重试。',
      'card.formMissing': '请填写工号、密码与验证码。',
      'card.browserSignIn': '统一身份认证登录',
      'card.browserBusy': '正在打开浏览器…',
      'card.browserWaiting': '已在浏览器打开同济登录页，请在弹出的窗口完成登录（含人脸/短信）…',
      'card.browserOk': '浏览器登录成功，令牌已保存。',
      'card.browserFailed': '浏览器登录失败，请重试。',
      'card.browserCancelled': '已取消浏览器登录。',
      'card.browserCancel': '取消登录',
    }

    const en = {
      'card.title': 'Tongji AIGC',
      'card.desc': 'Sign in to call the Tongji AIGC workspace for image, video, 3D and music generation right from the conversation.',
      'card.signIn': 'Unified identity sign-in',
      'card.signInBusy': 'Opening the sign-in window…',
      'card.ssoFailed': 'Could not open the sign-in window; make sure Edge or Chrome is installed and retry.',
      'card.waitingTitle': 'Waiting for sign-in',
      'card.waitingHint': 'Finish the Tongji unified identity sign-in in the window that just popped up. This card turns into "signed in" automatically — no token copying or pasting needed. Closing that window ends this sign-in attempt.',
      'card.waitingTimeout': 'Sign-in not detected yet. Try the button again, or use the fallback below.',
      'card.signOut': 'Sign out',
      'card.signOutBusy': 'Signing out…',
      'card.signedInAs': 'Signed in as',
      'card.stateOk': 'Signed in',
      'card.stateExpired': 'Session expired',
      'card.tokenState': 'Token',
      'card.validUntil': 'valid until',
      'card.autoOk': 'Sign-in state synced automatically.',
      'card.signedOutOk': 'Signed out.',
      'card.fallbackTitle': 'Automatic sign-in unavailable',
      'card.fallbackHint': 'No usable Edge / Chrome was detected. Use the fallback: copy a short script, switch to the already signed-in Tongji AIGC page, press F12 and paste it into the Console. The token is sent back automatically.',
      'card.copyScript': 'Copy token script',
      'card.copied': 'Script copied. Switch to the Tongji AIGC page, press F12, paste into the Console and press Enter; this card updates automatically.',
      'card.copyFailed': 'Copy failed. Select the script below and copy it manually.',
      'card.scriptLabel': 'Fallback script',
      'card.notLoggedIn': 'Not signed in',
      'card.offline': 'Could not read the sign-in state',
      'card.retry': 'Retry',
      'card.accountTitle': 'Unified sign-in',
      'card.accountHint': 'Click the button to open the Tongji unified sign-in page and complete the login (follow any face/SMS prompts). The token is saved automatically — no copy-paste needed.',
      'card.username': 'Tongji ID',
      'card.password': 'Password',
      'card.checkcode': 'Captcha',
      'card.captchaAlt': 'Sign-in captcha',
      'card.captchaRefresh': 'New captcha',
      'card.captchaLoading': 'Loading captcha…',
      'card.captchaEmpty': 'Captcha not loaded',
      'card.accountSignIn': 'Sign in',
      'card.accountBusy': 'Signing in…',
      'card.accountOk': 'Signed in. Token saved.',
      'card.accountFailed': 'Sign-in failed. Check your ID, password and captcha, then retry.',
      'card.formMissing': 'Enter your Tongji ID, password and captcha.',
      'card.browserSignIn': 'Sign in with Tongji ID',
      'card.browserBusy': 'Opening browser…',
      'card.browserWaiting': 'Tongji login opened in a browser window. Finish signing in there (face/SMS if asked)…',
      'card.browserOk': 'Signed in via browser. Token saved.',
      'card.browserFailed': 'Browser sign-in failed. Please retry.',
      'card.browserCancelled': 'Browser sign-in cancelled.',
      'card.browserCancel': 'Cancel sign-in',
    }

    const CSS = [
      '.ta-card{display:flex;flex-direction:column;gap:18px;font-family:var(--dsw-font-family, var(--dsw-font, system-ui, sans-serif));color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.ta-card *{box-sizing:border-box;}',
      '.ta-head{display:flex;flex-direction:column;gap:6px;}',
      '.ta-title{margin:0;font-size:20px;font-weight:600;line-height:1.35;letter-spacing:.01em;color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.ta-desc{margin:0;font-size:14px;line-height:1.65;color:var(--dsw-alias-label-secondary, #5a5a5c);max-width:62ch;}',
      '.ta-rule{height:1px;background:var(--dsw-alias-border-l1, #e3e5e8);border:0;margin:0;}',
      '.ta-main{display:flex;flex-direction:column;gap:14px;}',
      '.ta-eyebrow{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary, #7a7a7d);}',
      '.ta-identity{display:flex;flex-direction:column;gap:4px;min-width:0;}',
      '.ta-name{margin:0;font-size:20px;font-weight:600;line-height:1.35;word-break:break-word;color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.ta-meta{margin:0;font-size:14px;line-height:1.6;color:var(--dsw-alias-label-secondary, #5a5a5c);word-break:break-word;}',
      '.ta-state{display:inline-flex;align-items:center;gap:8px;font-size:14px;line-height:1.6;color:var(--dsw-alias-label-secondary, #5a5a5c);flex-wrap:wrap;}',
      '.ta-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-state-success-primary, #1a7f37);}',
      '.ta-dot.bad{background:var(--dsw-alias-state-error-primary, #d93026);}',
      '.ta-dot.idle{background:var(--dsw-alias-label-tertiary, #7a7a7d);}',
      '.ta-token{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-tertiary, #7a7a7d);overflow-wrap:anywhere;}',
      '.ta-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.ta-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--dsw-radius-md, 8px);padding:10px 18px;font-family:inherit;font-size:14px;font-weight:600;line-height:1.4;cursor:pointer;transition:background-color .16s ease, opacity .16s ease;}',
      '.ta-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color, #2f6feb);outline-offset:2px;}',
      '.ta-btn:disabled{opacity:.55;cursor:not-allowed;}',
      '.ta-btn.primary{background:var(--dsw-alias-button-primary-fill, currentColor);color:var(--dsw-alias-label-primary-foreground, CanvasText);border:1px solid transparent;}',
      '.ta-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover, currentColor);}',
      '.ta-btn.ghost{background:transparent;color:var(--dsw-alias-label-secondary, #5a5a5c);border:1px solid var(--dsw-alias-border-l2, #d0d3d8);}',
      '.ta-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover, #f2f4f7);}',
      '.ta-wait{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-radius:var(--dsw-radius-md, 8px);background:var(--dsw-alias-bg-layer-2, #f7f8fa);}',
      '.ta-wait-dot{width:8px;height:8px;margin-top:7px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-brand-primary, #2f6feb);animation:ta-pulse 1.4s ease-in-out infinite;}',
      '@keyframes ta-pulse{0%,100%{opacity:.35;}50%{opacity:1;}}',
      '.ta-wait-body{display:flex;flex-direction:column;gap:4px;min-width:0;}',
      '.ta-wait-title{font-size:14px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.ta-wait-hint{font-size:14px;line-height:1.65;color:var(--dsw-alias-label-secondary, #5a5a5c);overflow-wrap:anywhere;}',
      '.ta-note{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary, #5a5a5c);overflow-wrap:anywhere;}',
      '.ta-note.ok{color:var(--dsw-alias-state-success-primary, #1a7f37);}',
      '.ta-note.bad{color:var(--dsw-alias-state-error-primary, #d93026);}',
      '.ta-fallback{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:var(--dsw-radius-md, 8px);background:var(--dsw-alias-bg-layer-2, #f7f8fa);}',
      '.ta-fallback-title{font-size:14px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.ta-fallback-hint{margin:0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary, #5a5a5c);overflow-wrap:anywhere;}',
      '.ta-script{margin:0;padding:10px 12px;border-radius:var(--dsw-radius-sm, 6px);background:var(--dsw-alias-bg-layer-1, #fff);border:1px solid var(--dsw-alias-border-l2, #d0d3d8);font-family:var(--dsw-font-markdown-code-font-family, ui-monospace, monospace);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary, #1b1b1c);white-space:pre-wrap;word-break:break-all;user-select:all;}',
      '.ta-script-label{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary, #7a7a7d);}',
      '.ta-form{display:flex;flex-direction:column;gap:10px;padding-top:2px;}',
      '.ta-form-hint{margin:0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-tertiary, #7a7a7d);overflow-wrap:anywhere;}',
      '.ta-input{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:var(--dsw-radius-sm, 6px);border:1px solid var(--dsw-alias-border-l2, #d0d3d8);background:var(--dsw-alias-bg-layer-1, #fff);color:var(--dsw-alias-label-primary, #1b1b1c);font-family:inherit;font-size:14px;line-height:1.4;}',
      '.ta-input:focus{outline:2px solid var(--dsw-focus-ring-color, #2f6feb);outline-offset:1px;border-color:transparent;}',
      '.ta-input:disabled{opacity:.55;}',
      '.ta-captcha-row{display:flex;align-items:center;gap:10px;}',
      '.ta-captcha{height:42px;width:auto;border-radius:var(--dsw-radius-sm, 6px);border:1px solid var(--dsw-alias-border-l2, #d0d3d8);display:block;}',
      '.ta-captcha-empty,.ta-captcha-loading{font-size:12px;color:var(--dsw-alias-label-tertiary, #7a7a7d);min-width:96px;}',
      '.ta-captcha-refresh{flex:none;padding:7px 12px;font-size:13px;font-weight:500;}',
      '.ta-form-err{margin:0;font-size:12px;line-height:1.5;color:#c0392b;}',
    ].join('')

    /** 生成备用回传脚本：用运行时宿主源拼端点，端口不写死。 */
    function buildRelayScript(origin) {
      return [
        "(async () => {",
        "  const token = sessionStorage.getItem('access_token');",
        "  if (!token) { console.error('未登录：请先在本页面完成同济统一身份认证'); return; }",
        "  const relay = '" + origin + "/api/tongji-aigc/relay?token=' + encodeURIComponent(token);",
        "  window.location.replace(relay);",
        "})()",
      ].join('\n')
    }

    function App({ React, t }) {
      const [status, setStatus] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [waiting, setWaiting] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [noticeTone, setNoticeTone] = React.useState('info')
      const [fallback, setFallback] = React.useState(null)
      const [scriptVisible, setScriptVisible] = React.useState(false)
      const pollRef = React.useRef(null)

      const stopPolling = React.useCallback(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }, [])

      React.useEffect(() => () => stopPolling(), [stopPolling])

      const load = React.useCallback(async () => {
        try {
          const res = await fetch('/api/tongji-aigc/status', { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || 'status failed')
          setStatus(data)
        } catch {
          setStatus({ __offline: true })
        }
      }, [])

      React.useEffect(() => {
        load()
      }, [load])

      /** 轮询直到 configured=true；auto 模式遇到环境缺失则切到降级。 */
      const startPolling = React.useCallback(
        (mode) => {
          stopPolling()
          let ticks = 0
          pollRef.current = setInterval(async () => {
            ticks += 1
            if (ticks > 90) {
              stopPolling()
              setWaiting(false)
              setNotice(t('card.waitingTimeout'))
              setNoticeTone('bad')
              return
            }
            try {
              const path = mode === 'status' ? '/api/tongji-aigc/status' : '/api/tongji-aigc/auto-login'
              const res = await fetch(path, { cache: 'no-store' })
              const data = await res.json()
              if (data?.configured === true) {
                stopPolling()
                setWaiting(false)
                setFallback(null)
                setScriptVisible(false)
                await load()
                setNotice(mode === 'auto' ? t('card.autoOk') : t('card.autoOk'))
                setNoticeTone('ok')
                return
              }
              if (mode === 'auto' && (res.status === 503 || data?.pending === false)) {
                stopPolling()
                setWaiting(false)
                setFallback(data)
              }
            } catch {
              /* 网络抖动，下一轮继续 */
            }
          }, 2000)
        },
        [load, stopPolling, t],
      )

      const signIn = async () => {
        if (busy || waiting) return
        setBusy('signin')
        setNotice(null)
        setFallback(null)
        setScriptVisible(false)
        try {
          // 关键：不再 window.open 到用户自己的 Chrome，也不依赖浏览器自动化服务。
          // 由宿主 login-start 在本机找一个 Edge / Chrome，开一个隔离的一次性窗口并加载
          // 临时扩展；用户在那个窗口完成 SSO，扩展通过顶层导航把令牌回传 DSH 并落盘。
          // 把当前宿主源带上，扩展回传端点才能真正命中本机 DSH（端口不写死）。
          const origin = String(window.location?.origin || '')
          const res = await fetch('/api/tongji-aigc/login-start', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(origin ? { origin } : {}),
          })
          const data = await res.json()
          if (!res.ok || data?.started !== true) {
            // 环境缺失（503 pending=false）→ 降级；其余当普通错误提示
            if (res.status === 503 || data?.pending === false) {
              setFallback(data)
            } else {
              throw new Error(data?.detail || data?.error || t('card.ssoFailed'))
            }
          } else {
            setWaiting(true)
            startPolling('auto')
          }
        } catch (error) {
          setNotice(String(error?.message || error))
          setNoticeTone('bad')
        } finally {
          setBusy('')
        }
      }

      const signOut = async () => {
        if (busy) return
        stopPolling()
        setWaiting(false)
        setBusy('signout')
        setNotice(null)
        setFallback(null)
        try {
          const res = await fetch('/api/tongji-aigc/token', { method: 'DELETE', cache: 'no-store' })
          if (!res.ok) throw new Error('sign out failed')
          setNotice(t('card.signedOutOk'))
          setNoticeTone('ok')
          await load()
        } catch (error) {
          setNotice(String(error?.message || error))
          setNoticeTone('bad')
        } finally {
          setBusy('')
        }
      }

      const copyScript = async () => {
        const origin = String(window.location?.origin || '')
        const script = buildRelayScript(origin)
        let copied = false
        try {
          await navigator.clipboard.writeText(script)
          copied = true
        } catch {
          copied = false
        }
        setScriptVisible(!copied)
        setNotice(copied ? t('card.copied') : t('card.copyFailed'))
        setNoticeTone(copied ? 'ok' : 'bad')
        // 回传落盘后 status 会变 configured，轮询状态即可，不再依赖浏览器自动化。
        setWaiting(true)
        startPolling('status')
      }

      // ---- 统一身份认证登录（弹浏览器，主路径）----
      const [formErr, setFormErr] = React.useState(null)

      // ---- 浏览器自动化登录（绕开 IAM 风控的人脸/短信增强认证）----
      const [browserBusy, setBrowserBusy] = React.useState(false)
      const [browserPolling, setBrowserPolling] = React.useState(false)

      /** 弹真浏览器登录（含人脸/短信），常驻 CDP 监听抓 token。 */
      const browserSignIn = async () => {
        if (browserBusy || browserPolling || busy !== '') return
        setFormErr(null)
        setBrowserBusy(true)
        try {
          const res = await fetch('/api/tongji-aigc/browser-login-start', { method: 'POST', cache: 'no-store' })
          const data = await res.json()
          if (!res.ok || !data?.started) throw new Error(data?.detail || data?.error || 'start failed')
          setBrowserPolling(true)
          setNotice(t('card.browserWaiting'))
          setNoticeTone('')
          // 轮询，最多 10 分钟
          const deadline = Date.now() + 10 * 60 * 1000
          let ok = false
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500))
            let pr
            try {
              pr = await (await fetch('/api/tongji-aigc/browser-login-poll', { method: 'POST', cache: 'no-store' })).json()
            } catch { continue }
            if (pr?.pending === false) {
              if (pr.configured === true) {
                setBrowserPolling(false)
                setBrowserBusy(false)
                await load()
                setNotice(t('card.browserOk'))
                setNoticeTone('ok')
                ok = true
              } else {
                setFormErr(pr?.detail || t('card.browserFailed'))
                setBrowserPolling(false)
              }
              break
            }
            if (pr?.reason === 'browser_closed' || pr?.reason === 'timeout' || pr?.reason === 'no_session') {
              setBrowserPolling(false)
              break
            }
          }
          if (!ok && !browserPolling === false) { /* loop end without ok */ }
          if (!ok) {
            setBrowserPolling(false)
            if (!formErr) setNotice(t('card.browserCancelled'))
          }
        } catch (error) {
          setFormErr(String(error?.message || error))
          setBrowserPolling(false)
        } finally {
          setBrowserBusy(false)
        }
      }

      /** 取消浏览器登录。 */
      const browserCancel = async () => {
        try { await fetch('/api/tongji-aigc/browser-login-cancel', { method: 'POST', cache: 'no-store' }) } catch {}
        setBrowserPolling(false)
        setNotice(t('card.browserCancelled'))
        setNoticeTone('')
      }

      const e = React.createElement
      const offline = status?.__offline === true
      const configured = status?.configured === true
      const expired = status?.expired === true
      const user = status?.user || null
      const relayScript = buildRelayScript(String(window.location?.origin || ''))

      const meta = user
        ? [user.college, user.role_display_name || user.role_name].filter(Boolean).join(' · ')
        : ''

      return e(
        'div',
        { className: 'ta-card' },
        e('style', null, CSS),
        e(
          'div',
          { className: 'ta-head' },
          e('h3', { className: 'ta-title' }, t('card.title')),
          e('p', { className: 'ta-desc' }, t('card.desc')),
        ),
        e('hr', { className: 'ta-rule' }),

        e(
          'div',
          { className: 'ta-main' },
          configured && user
            ? e(
                'div',
                { className: 'ta-identity' },
                e('span', { className: 'ta-eyebrow' }, t('card.signedInAs')),
                e('p', { className: 'ta-name' }, user.nickname || user.username || t('card.signedInAs')),
                meta ? e('p', { className: 'ta-meta' }, meta) : null,
              )
            : null,

          e(
            'div',
            { className: 'ta-state' },
            e('span', {
              className: 'ta-dot' + (configured ? (expired ? ' bad' : '') : ' idle'),
            }),
            e(
              'span',
              null,
              configured
                ? expired
                  ? t('card.stateExpired')
                  : t('card.stateOk')
                : offline
                  ? t('card.offline')
                  : t('card.notLoggedIn'),
            ),
          ),

          configured
            ? e(
                'div',
                { className: 'ta-token' },
                t('card.tokenState') + ' ' + (status?.hint || '****') + ' · ' + t('card.validUntil') + ' ' + String(status?.expiresAt || '').slice(0, 16).replace('T', ' '),
              )
            : null,

          waiting
            ? e(
                'div',
                { className: 'ta-wait' },
                e('span', { className: 'ta-wait-dot' }),
                e(
                  'div',
                  { className: 'ta-wait-body' },
                  e('span', { className: 'ta-wait-title' }, t('card.waitingTitle')),
                  e('span', { className: 'ta-wait-hint' }, t('card.waitingHint')),
                ),
              )
            : null,

          e(
            'div',
            { className: 'ta-actions' },
            !configured
              ? null
              : e(
                  'button',
                  {
                    className: 'ta-btn ghost',
                    type: 'button',
                    onClick: signOut,
                    disabled: busy !== '',
                  },
                  busy === 'signout' ? t('card.signOutBusy') : t('card.signOut'),
                ),
            offline
              ? e(
                  'button',
                  { className: 'ta-btn ghost', type: 'button', onClick: load },
                  t('card.retry'),
                )
              : null,
          ),

          // 统一身份认证登录：一个按钮，点它弹浏览器完成登录（含人脸/短信）。
          !configured
            ? e(
                'div',
                { className: 'ta-form' },
                e('div', { className: 'ta-eyebrow' }, t('card.accountTitle')),
                e('p', { className: 'ta-form-hint' }, t('card.accountHint')),
                formErr ? e('p', { className: 'ta-form-err' }, formErr) : null,
                e(
                  'button',
                  {
                    className: 'ta-btn primary',
                    type: 'button',
                    onClick: browserPolling ? browserCancel : browserSignIn,
                    disabled: busy !== '' || (browserBusy && !browserPolling),
                  },
                  browserPolling ? t('card.browserCancel') : (browserBusy ? t('card.browserBusy') : t('card.browserSignIn')),
                ),
              )
            : null,

          fallback && !configured
            ? e(
                'div',
                { className: 'ta-fallback' },
                e('span', { className: 'ta-fallback-title' }, t('card.fallbackTitle')),
                e('p', { className: 'ta-fallback-hint' }, t('card.fallbackHint')),
                e(
                  'button',
                  { className: 'ta-btn ghost', type: 'button', onClick: copyScript },
                  t('card.copyScript'),
                ),
                scriptVisible
                  ? e(
                      'div',
                      null,
                      e('div', { className: 'ta-script-label' }, t('card.scriptLabel')),
                      e('pre', { className: 'ta-script' }, relayScript),
                    )
                  : null,
              )
            : null,

          notice
            ? e('div', { className: 'ta-note ' + (noticeTone === 'ok' ? 'ok' : noticeTone === 'bad' ? 'bad' : '') }, notice)
            : null,
        ),
      )
    }

    function apply(ctx) {
      const namespace = 'settings.tongji-aigc'
      ctx.effect(() => ctx.locale.register(namespace, { zh, en }), '[dsh-tongji-aigc] register locale')
      const t = ctx.locale.bind(namespace)
      ctx.slots.inject(
        'plugins.bundle.config',
        () =>
          ctx.slots.register(
            { name: 'plugins.bundle.config', key: '@local/dsh-tongji-aigc', locale: namespace },
            () => ReactTop.createElement(App, { React: ReactTop, t }),
          ),
      )
    }

    return { apply, inject, name }
  },
})
