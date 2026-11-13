/**
 * dsh-tongji-aigc 客户端设置卡片。
 *
 * 出现在「设置 → 插件」。功能：
 *   - 「统一身份认证登录」按钮：调宿主端点取 IAM 授权地址，用浏览器跳转完成
 *     同济大学统一身份认证；登录后令牌写在浏览器 sessionStorage，地址栏不显示，
 *     用户在浏览器里登录后，把令牌复制粘贴到下方令牌框保存；
 *   - 保存/清除令牌（经宿主同源端点，明文只存本机、永不回传）；
 *   - 显示个人信息：登录状态（掩码、是否过期）与当前用户。
 *
 * 约定（照 dsh-api-rules 卡片）：
 *   - 纯 React DOM + 组件级 <style>，React 在 factory 顶层取一次；
 *   - 文案用扁平点号 key，`t(key)` 调用，中英两份字典同写；
 *   - 样式只用宿主真实存在的 --dsw-* token，且带兜底色，主按钮随深浅主题反转。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-tongji-aigc',
  factory(require) {
    const name = 'dsh-tongji-aigc-client'
    const inject = ['slots', 'locale']
    const ReactTop = require('react')

    const zh = {
      'card.title': '同济 AIGC',
      'card.desc': '在对话里直接调用同济 AIGC 专区生图 / 生视频 / 3D / 音乐。登录后即可使用。',
      'card.loginHint': '尚未登录。点下方「统一身份认证登录」跳转到同济大学 IAM 完成认证；登录后把浏览器里的 access_token 复制粘贴到下方令牌框保存。',
      'card.loginTitle': '登录',
      'card.ssoLogin': '统一身份认证登录',
      'card.ssoNeed': '点上方按钮用浏览器打开同济大学统一身份认证。登录完成后站点会把令牌写进浏览器并跳回站内，地址栏不显示 token；此时在浏览器页面按 F12 → Console 执行 sessionStorage.getItem("access_token")，复制结果粘到下方令牌框保存。',
      'card.ssoBusy': '正在获取登录地址…',
      'card.ssoFailed': '获取登录地址失败，请稍后重试。',
      'card.tokenAdvanced': '令牌（SSO 登录后复制粘贴）',
      'card.tokenPlaceholder': '粘贴登录后的 access_token（JWT，形如 xxx.yyy.zzz）',
      'card.save': '保存令牌',
      'card.clear': '清除令牌',
      'card.busySave': '保存中…',
      'card.busyClear': '清除中…',
      'card.busyLogin': '校验中…',
      'card.saved': '已保存，登录有效。',
      'card.cleared': '已清除令牌。',
      'card.invalid': '令牌无效或已过期，请重新登录并粘贴新的 access_token。',
      'card.notLoggedIn': '未登录或登录态已失效。',
      'card.status': '当前状态',
      'card.personal': '个人信息',
      'card.expired': '令牌已过期，请重新登录。',
      'card.user': '当前用户',
    }

    const en = {
      'card.title': 'Tongji AIGC',
      'card.desc': 'Call the Tongji AIGC workspace for image / video / 3D / music generation right from the conversation. Log in to start.',
      'card.loginHint': 'Not logged in yet. Click "Unified identity sign-in" below to open the Tongji IAM login in your browser; after signing in, copy the access_token from the browser and paste it into the field below to save.',
      'card.loginTitle': 'Sign in',
      'card.ssoLogin': 'Unified identity sign-in',
      'card.ssoNeed': 'Click the button above to open the Tongji unified identity sign-in in your browser. After signing in the site writes the token into the browser and returns in-site; the address bar does not show the token. Open the browser page devtools (F12) and run sessionStorage.getItem("access_token") in the Console, then copy the result into the field below to save.',
      'card.ssoBusy': 'Getting the login URL…',
      'card.ssoFailed': 'Could not get the login URL; retry later.',
      'card.tokenAdvanced': 'Token (paste after SSO sign-in)',
      'card.tokenPlaceholder': 'Paste the access_token (JWT, like xxx.yyy.zzz)',
      'card.save': 'Save token',
      'card.clear': 'Clear token',
      'card.busySave': 'Saving…',
      'card.busyClear': 'Clearing…',
      'card.busyLogin': 'Verifying…',
      'card.saved': 'Saved; login is valid.',
      'card.cleared': 'Token cleared.',
      'card.invalid': 'Token is invalid or expired; please sign in again and paste a new access_token.',
      'card.notLoggedIn': 'Not logged in or the session expired.',
      'card.status': 'Current status',
      'card.personal': 'Account',
      'card.expired': 'Token expired; please sign in again.',
      'card.user': 'Signed in as',
    }

    const CSS = [
      '.arc-card{display:flex;flex-direction:column;gap:12px;font-family:var(--dsw-font, system-ui, sans-serif);font-size:var(--dsw-font-base-16, 14px);color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.arc-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}',
      '.arc-head h3{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary, #1b1b1c);}',
      '.arc-desc{margin:0;color:var(--dsw-alias-label-secondary, #5a5a5c);line-height:1.5;}',
      '.arc-link{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-brand-primary, #2f6feb);text-decoration:none;border:1px solid var(--dsw-alias-border-l2, #d0d3d8);border-radius:var(--dsw-radius-sm, 6px);padding:5px 10px;background:var(--dsw-alias-bg-layer-1, #fff);}',
      '.arc-link:hover{background:var(--dsw-alias-interactive-bg-hover, #f2f4f7);}',
      '.arc-pane{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l2, #d0d3d8);border-radius:var(--dsw-radius-lg, 10px);padding:12px;background:var(--dsw-alias-bg-layer-1, #fff);}',
      '.arc-pane__head{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.arc-label{font-size:12px;color:var(--dsw-alias-label-secondary, #5a5a5c);}',
      '.arc-field{display:flex;flex-direction:column;gap:6px;}',
      '.arc-input, .arc-textarea, .arc-select{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2, #d0d3d8);border-radius:var(--dsw-radius-sm, 6px);padding:8px 10px;font:inherit;color:var(--dsw-alias-label-primary, #1b1b1c);background:var(--dsw-alias-bg-layer-2, #f7f8fa);}',
      '.arc-textarea{min-height:72px;resize:vertical;}',
      '.arc-input:focus, .arc-textarea:focus, .arc-select:focus{outline:2px solid var(--dsw-focus-ring-color, #2f6feb);border-color:transparent;}',
      '.arc-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.arc-row > *{flex:0 0 auto;}',
      '.arc-grow{flex:1 1 220px;min-width:0;}',
      '.arc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l2, #d0d3d8);border-radius:var(--dsw-radius-sm, 6px);padding:7px 14px;font:inherit;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary, #1b1b1c);background:var(--dsw-alias-bg-layer-1, #fff);}',
      '.arc-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover, #f2f4f7);}',
      '.arc-btn:disabled{opacity:.55;cursor:not-allowed;}',
      '.arc-btn.primary{background:var(--dsw-alias-button-primary-fill, currentColor);color:var(--dsw-alias-label-primary-foreground, CanvasText);border-color:transparent;}',
      '.arc-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover, currentColor);}',
      '.arc-btn.danger{color:var(--dsw-alias-state-error-primary, #d93026);border-color:var(--dsw-alias-border-l2, #d0d3d8);}',
      '.arc-alert{border:1px solid var(--dsw-alias-state-error-primary, #d93026);color:var(--dsw-alias-state-error-primary, #d93026);background:var(--dsw-alias-bg-layer-2, #f7f8fa);border-radius:var(--dsw-radius-sm, 6px);padding:8px 10px;font-size:13px;}',
      '.arc-ok{color:var(--dsw-alias-state-success-primary, #1a7f37);font-size:13px;}',
      '.arc-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary, #5a5a5c);}',
      '.arc-status strong{color:var(--dsw-alias-label-primary, #1b1b1c);font-weight:600;}',
      '.arc-pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:11px;border:1px solid var(--dsw-alias-border-l2, #d0d3d8);}',
      '.arc-pill.ok{border-color:var(--dsw-alias-state-success-primary, #1a7f37);color:var(--dsw-alias-state-success-primary, #1a7f37);}',
      '.arc-pill.bad{border-color:var(--dsw-alias-state-error-primary, #d93026);color:var(--dsw-alias-state-error-primary, #d93026);}',
      '.arc-hint{font-size:12px;color:var(--dsw-alias-label-tertiary, #7a7a7d);line-height:1.5;}',
      '.arc-output{font-size:12px;color:var(--dsw-alias-label-secondary, #5a5a5c);word-break:break-all;}',
      '.arc-divider{height:1px;background:var(--dsw-alias-border-l1, #e3e5e8);margin:2px 0;}',
    ].join('')

    function App({ React, t }) {
      const [token, setToken] = React.useState('')
      const [status, setStatus] = React.useState(null)
      const [message, setMessage] = React.useState(null)
      const [messageTone, setMessageTone] = React.useState('info')
      const [busy, setBusy] = React.useState('')

      const load = React.useCallback(async () => {
        try {
          const res = await fetch('/api/tongji-aigc/status', { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || 'status failed')
          setStatus(data)
          if (typeof data?.hint === 'string' && data.hint !== '') setToken('')
        } catch {
          setStatus(null)
        }
      }, [])

      React.useEffect(() => {
        load()
      }, [load])

      const saveToken = async () => {
        if (busy) return
        setBusy('save')
        setMessage(null)
        setMessageTone('info')
        try {
          const res = await fetch('/api/tongji-aigc/token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token }),
            cache: 'no-store',
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error === 'invalid_token' ? t('card.invalid') : data?.error || 'save failed')
          setMessage(t('card.saved'))
          setMessageTone('ok')
          setToken('')
          await load()
        } catch (error) {
          setMessage(String(error?.message || error))
          setMessageTone('error')
        } finally {
          setBusy('')
        }
      }

      const clearToken = async () => {
        if (busy) return
        setBusy('clear')
        setMessage(null)
        setMessageTone('info')
        try {
          const res = await fetch('/api/tongji-aigc/token', { method: 'DELETE', cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || 'clear failed')
          setMessage(t('card.cleared'))
          setMessageTone('ok')
          setResult(null)
          await load()
        } catch (error) {
          setMessage(String(error?.message || error))
          setMessageTone('error')
        } finally {
          setBusy('')
        }
      }

      const ssoLogin = async () => {
        if (busy) return
        setBusy('signin')
        setMessage(null)
        setMessageTone('info')
        try {
          const res = await fetch('/api/tongji-aigc/sso-url', { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.detail || data?.error || 'sso failed')
          const url = String(data?.url || '').trim()
          if (url === '') throw new Error(t('card.ssoFailed'))
          window.open(url, '_blank', 'noopener,noreferrer')
          setMessage(t('card.ssoNeed'))
          setMessageTone('ok')
        } catch (error) {
          setMessage(String(error?.message || error))
          setMessageTone('error')
        } finally {
          setBusy('')
        }
      }

      const configured = status?.configured === true
      const expired = status?.expired === true

      return React.createElement(
        'div',
        { className: 'arc-card' },
        React.createElement('style', null, CSS),
        React.createElement(
          'div',
          { className: 'arc-head' },
          React.createElement('h3', null, t('card.title')),
          configured
            ? React.createElement('span', { className: expired ? 'arc-pill bad' : 'arc-pill ok' }, expired ? t('card.expired') : t('card.saved'))
            : null,
        ),
        React.createElement('p', { className: 'arc-desc' }, t('card.desc')),

        React.createElement(
          'div',
          { className: 'arc-pane' },
          React.createElement('div', { className: 'arc-pane__head' }, React.createElement('span', { className: 'arc-label' }, t('card.personal'))),
          React.createElement(
            'div',
            { className: 'arc-status' },
            configured
              ? React.createElement(
                  'span',
                  null,
                  React.createElement('strong', null, t('card.status')),
                  '：',
                  status?.hint || '****',
                )
              : React.createElement('span', null, t('card.notLoggedIn')),
            status?.user
              ? React.createElement(
                  'span',
                  null,
                  t('card.user'),
                  '：',
                  JSON.stringify(status.user),
                )
              : null,
          ),
        ),

        React.createElement(
          'div',
          { className: 'arc-pane' },
          React.createElement('div', { className: 'arc-pane__head' }, React.createElement('span', { className: 'arc-label' }, t('card.loginTitle'))),
          React.createElement('p', { className: 'arc-hint' }, t('card.ssoNeed')),
          React.createElement(
            'div',
            { className: 'arc-row' },
            React.createElement(
              'button',
              { className: 'arc-btn primary', type: 'button', onClick: ssoLogin, disabled: busy !== '' },
              busy === 'signin' ? t('card.ssoBusy') : t('card.ssoLogin'),
            ),
          ),
        ),

        React.createElement(
          'div',
          { className: 'arc-field' },
          React.createElement('label', { className: 'arc-label' }, t('card.tokenAdvanced')),
          React.createElement('textarea', {
            className: 'arc-textarea',
            value: token,
            placeholder: t('card.tokenPlaceholder'),
            onChange: (event) => setToken(event.target.value),
          }),
        ),
        React.createElement(
          'div',
          { className: 'arc-row' },
          React.createElement(
            'button',
            { className: 'arc-btn primary', type: 'button', onClick: saveToken, disabled: busy !== '' || token.trim() === '' },
            busy === 'save' ? t('card.busySave') : t('card.save'),
          ),
          React.createElement(
            'button',
            { className: 'arc-btn danger', type: 'button', onClick: clearToken, disabled: busy !== '' },
            busy === 'clear' ? t('card.busyClear') : t('card.clear'),
          ),
        ),
        message
          ? React.createElement(
              'div',
              { className: messageTone === 'ok' ? 'arc-ok' : messageTone === 'error' ? 'arc-alert' : 'arc-hint' },
              message,
            )
          : null,
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
