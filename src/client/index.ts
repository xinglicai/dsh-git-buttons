/**
 * dsh-git-buttons —— 浏览器半区。
 *
 * 在会话顶部注册「Git 操作」页签：一排按钮直接跑常用 git 命令，
 * 输出原样回显（含 stderr），失败也能一眼看到真实原因。
 */
import * as React from 'react'

export const name = 'git-buttons-client'

export const inject = ['slots']

const API_BASE = 'git-buttons/api/'

/**
 * 只把 HTTP 层失败当错误：git 命令本身失败是正常业务结果（ok:false + 输出文本），
 * 不能因为它变成 "HTTP 200" 这种误导提示。
 */
async function callRaw<T>(method: string, body: unknown = {}): Promise<T> {
  const base = typeof document === 'undefined' ? 'http://127.0.0.1/' : document.baseURI
  const response = await fetch(new URL(API_BASE + method, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  })
  const text = await response.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: `HTTP ${response.status}` }
  }
  if (!response.ok) {
    const message = (data as { error?: string }).error
    throw new Error(String(message ?? `HTTP ${response.status}`))
  }
  return data as T
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 2px 24px 2px' } as React.CSSProperties,
  card: {
    border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  } as React.CSSProperties,
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as React.CSSProperties,
  label: { fontSize: 12, opacity: 0.7, minWidth: 64 } as React.CSSProperties,
  input: {
    flex: '1 1 260px',
    minWidth: 0,
    fontSize: 13,
    padding: '6px 9px',
    borderRadius: 7,
    border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
    background: 'color-mix(in srgb, currentColor 4%, transparent)',
    color: 'inherit',
    outline: 'none',
  } as React.CSSProperties,
  button: {
    fontSize: 12.5,
    padding: '6px 11px',
    borderRadius: 7,
    border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    background: 'color-mix(in srgb, currentColor 8%, transparent)',
    color: 'inherit',
    cursor: 'pointer',
  } as React.CSSProperties,
  primary: {
    fontSize: 12.5,
    padding: '6px 13px',
    borderRadius: 7,
    border: '1px solid transparent',
    background: 'color-mix(in srgb, #4d6bfe 88%, transparent)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  hint: { fontSize: 12, lineHeight: 1.6, opacity: 0.62, margin: 0 } as React.CSSProperties,
  pre: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 8,
    background: 'color-mix(in srgb, currentColor 5%, transparent)',
    border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: 260,
    overflow: 'auto',
  } as React.CSSProperties,
  badge: (tone: 'ok' | 'warn' | 'bad'): React.CSSProperties => ({
    fontSize: 11.5,
    padding: '2px 8px',
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${tone === 'ok' ? '#2f9e44' : tone === 'warn' ? '#f08c00' : '#e03131'} 45%, transparent)`,
    background: `color-mix(in srgb, ${tone === 'ok' ? '#2f9e44' : tone === 'warn' ? '#f08c00' : '#e03131'} 12%, transparent)`,
  }),
}

interface GitInfo {
  ok: boolean
  isRepo: boolean
  path: string
  error?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  changes?: number
  changeList?: string[]
  commits?: string[]
  branches?: string[]
  remotes?: string[]
}

const PICKER = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    width: 540,
    maxWidth: '92vw',
    maxHeight: '80vh',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    padding: '16px 18px',
    borderRadius: 12,
    background: 'var(--dsh-surface, #1e1f22)',
    color: 'var(--dsh-text, #e6e6e6)',
    border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
  },
  entry: {
    textAlign: 'left' as const,
    fontSize: 13,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
}

function DirectoryPicker(props: {
  initial: string
  onPick: (path: string) => void
  onClose: () => void
}): React.ReactElement {
  const [path, setPath] = React.useState(props.initial)
  const [parent, setParent] = React.useState<string | null>(null)
  const [dirs, setDirs] = React.useState<Array<{ name: string; path: string }>>([])
  const [jump, setJump] = React.useState(props.initial)
  const [error, setError] = React.useState('')

  const load = async (target: string): Promise<void> => {
    try {
      const data = await callRaw<{ path: string; parent: string | null; directories: Array<{ name: string; path: string }> }>(
        'fs.list',
        { path: target },
      )
      setPath(data.path)
      setParent(data.parent)
      setDirs(data.directories ?? [])
      setJump(data.path)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  React.useEffect(() => {
    void load(props.initial)
  }, [])

  return React.createElement(
    'div',
    { style: PICKER.overlay },
    React.createElement(
      'div',
      { style: PICKER.modal },
      React.createElement(
        'div',
        { style: { ...S.row, justifyContent: 'space-between' } },
        React.createElement('strong', { style: { fontSize: 13 } }, '选择 Git 仓库目录'),
        React.createElement('button', { style: S.button, onClick: props.onClose }, '关闭'),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('input', {
          style: S.input,
          value: jump,
          placeholder: '粘贴绝对路径后回车',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setJump(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') void load(jump)
          },
        }),
        React.createElement('button', { style: S.button, onClick: () => void load(jump) }, '跳转'),
        React.createElement('button', { style: S.button, onClick: () => void load('') }, '磁盘'),
      ),
      React.createElement('p', { style: S.hint }, path === '' ? '选择磁盘' : path),
      error === '' ? null : React.createElement('p', { style: { ...S.hint, color: '#e03131' } }, error),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' } },
        parent === null ? null : React.createElement('button', { style: PICKER.entry, onClick: () => void load(parent) }, '⬆ 上一级'),
        ...dirs.map((dir) =>
          React.createElement('button', { key: dir.path, style: PICKER.entry, onClick: () => void load(dir.path) }, `📁 ${dir.name}`)),
      ),
      React.createElement(
        'div',
        { style: { ...S.row, justifyContent: 'flex-end' } },
        React.createElement('button', { style: S.primary, disabled: path === '', onClick: () => props.onPick(path) }, '选择此目录'),
      ),
    ),
  )
}

export function GitButtonsView(props?: { sessionId?: string }): React.ReactElement {
  const [repo, setRepo] = React.useState('')
  const [info, setInfo] = React.useState<GitInfo | null>(null)
  const [message, setMessage] = React.useState('')
  const [branchName, setBranchName] = React.useState('')
  const [remoteUrl, setRemoteUrl] = React.useState('')
  const [githubToken, setGithubToken] = React.useState('')
  const [ghLogin, setGhLogin] = React.useState('')
  const [ghMasked, setGhMasked] = React.useState('')
  const [repoName, setRepoName] = React.useState('')
  const [repoPrivate, setRepoPrivate] = React.useState(true)
  const [repoDesc, setRepoDesc] = React.useState('')
  const [output, setOutput] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [picker, setPicker] = React.useState(false)
  const [err, setErr] = React.useState('')

  const refresh = async (target: string): Promise<void> => {
    if (target.trim() === '') {
      setInfo(null)
      return
    }
    try {
      const data = await callRaw<GitInfo>('git.info', { path: target })
      setInfo(data)
      setErr('')
    } catch (caught) {
      setInfo(null)
      setErr(caught instanceof Error ? caught.message : String(caught))
    }
  }

  React.useEffect(() => {
    void (async () => {
      // GitHub token 状态与当前会话无关，先加载
      try {
        const status = await callRaw<{ hasToken: boolean; valid?: boolean; login?: string; masked?: string }>('git.githubStatus')
        if (status.hasToken) {
          setGhMasked(status.masked ?? '')
          if (status.valid === true) setGhLogin(status.login ?? '')
        }
      } catch {
        /* token 状态读不到不影响其他功能 */
      }

      const sessionId = props?.sessionId ?? ''
      if (sessionId === '') return
      try {
        const resolved = await fetch(new URL('backup-sync/api/session.project', document.baseURI), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sessionId }),
        }).then((response) => (response.ok ? response.json() : { projectPath: '' }))
        const projectPath = (resolved as { projectPath?: string }).projectPath ?? ''
        if (projectPath !== '') {
          setRepo(projectPath)
          setRepoName(projectPath.split(/[\\/]/).filter((part) => part !== '').pop() ?? '')
          await refresh(projectPath)
        }
      } catch {
        /* 反查失败就让用户手选 */
      }
    })()
  }, [])

  const run = async (label: string, action: string, args: string[] = []): Promise<void> => {
    if (repo.trim() === '') {
      setOutput('先选择仓库目录')
      return
    }
    setBusy(label)
    setErr('')
    try {
      const result = await callRaw<{ ok: boolean; command: string; code: number; stdout: string; stderr: string }>('git.run', {
        path: repo,
        action,
        args,
      })
      const text = [result.command, result.stdout, result.stderr].filter((part) => part !== '').join('\n')
      setOutput(`${result.ok ? '✔' : `✘ 退出码 ${result.code}`}\n${text}`)
      await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const disabled = busy !== ''
  const isRepo = info?.isRepo === true
  const changeCount = info?.changes ?? 0
  const tone: 'ok' | 'warn' | 'bad' = !isRepo ? 'bad' : changeCount > 0 ? 'warn' : 'ok'

  /** 变更行的 porcelain 前缀（XY）与路径。 */
  const parseChange = (line: string): { code: string; path: string } => ({
    code: line.slice(0, 2).trim(),
    path: line.slice(3).trim(),
  })

  const initRepo = async (): Promise<void> => {
    setBusy('init')
    setErr('')
    try {
      const result = await callRaw<{ ok: boolean; steps: string[]; branch: string }>('git.init', { path: repo, message })
      setOutput(['✔ 仓库已初始化', ...result.steps, `当前分支：${result.branch}`].join('\n'))
      await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const firstCommit = async (): Promise<void> => {
    setBusy('first')
    setErr('')
    try {
      const result = await callRaw<{ ok: boolean; steps: string[]; branch: string }>('git.firstCommit', {
        path: repo,
        message,
      })
      setOutput(['✔ 首次提交完成', ...result.steps, `当前分支：${result.branch}`].join('\n'))
      await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const saveToken = async (): Promise<void> => {
    setBusy('token')
    setErr('')
    try {
      const result = await callRaw<{ hasToken: boolean; login?: string }>('git.githubToken', { token: githubToken })
      if (result.hasToken) {
        setGhLogin(result.login ?? '')
        setGhMasked(`${githubToken.slice(0, 7)}…${githubToken.slice(-4)}`)
        setOutput(`✔ Token 已保存并验证：${result.login ?? ''}`)
      } else {
        setGhLogin('')
        setGhMasked('')
        setOutput('已清除 GitHub Token')
      }
      setGithubToken('')
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const createRemote = async (): Promise<void> => {
    setBusy('create')
    setErr('')
    try {
      const result = await callRaw<{
        ok: boolean
        steps: string[]
        repoUrl: string
        visibility: string
      }>('git.createRemote', {
        path: repo,
        name: repoName.trim(),
        private: repoPrivate,
        description: repoDesc.trim(),
      })
      setOutput([
        `✔ 已在 GitHub 创建${result.visibility === 'private' ? '私有' : '公开'}仓库并推送`,
        ...result.steps,
        result.repoUrl,
      ].join('\n'))
      setRemoteUrl(result.repoUrl)
      await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const publish = async (): Promise<void> => {
    setBusy('publish')
    setErr('')
    try {
      const result = await callRaw<{ ok: boolean; branch: string; steps: string[]; stdout: string; stderr: string }>(
        'git.publish',
        { path: repo, url: remoteUrl.trim() },
      )
      const body = [result.stdout, result.stderr].filter((part) => part !== '').join('\n')
      setOutput([result.ok ? '✔ 已推送并设置 upstream' : '✘ 推送失败', ...result.steps, body].filter((part) => part !== '').join('\n'))
      await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  const fileAction = async (label: string, action: string, target: string): Promise<void> => {
    setBusy(`${label}:${target}`)
    try {
      const result = await callRaw<{ ok: boolean; command: string; code: number; stdout: string; stderr: string }>('git.run', {
        path: repo,
        action,
        args: [target],
      })
      const body = [result.stdout, result.stderr].filter((part) => part !== '').join('\n')
      setOutput([`${result.ok ? '✔' : `✘ 退出码 ${result.code}`} ${result.command}`, body].filter((part) => part !== '').join('\n'))
      if (action !== 'diff_file' && action !== 'diff_file_staged') await refresh(repo)
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy('')
    }
  }

  return React.createElement(
    'div',
    { style: S.wrap },
    React.createElement(
      'div',
      { style: S.card },
      React.createElement(
        'div',
        { style: { ...S.row, justifyContent: 'space-between' } },
        React.createElement(
          'div',
          { style: S.row },
          React.createElement('strong', { style: { fontSize: 13 } }, 'Git 操作'),
          React.createElement(
            'span',
            { style: S.badge(tone) },
            !isRepo ? '不是 Git 仓库 / git 不可用' : changeCount > 0 ? `${changeCount} 项改动` : '工作区干净',
          ),
          isRepo ? React.createElement('span', { style: S.badge('ok') }, `分支 ${info?.branch ?? '?'}`) : null,
          isRepo && (info?.ahead ?? 0) > 0 ? React.createElement('span', { style: S.badge('warn') }, `↑${info?.ahead}`) : null,
          isRepo && (info?.behind ?? 0) > 0 ? React.createElement('span', { style: S.badge('warn') }, `↓${info?.behind}`) : null,
        ),
        React.createElement(
          'button',
          { style: S.button, onClick: () => setPicker(true) },
          '选择仓库…',
        ),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('span', { style: S.label }, '仓库路径'),
        React.createElement('input', {
          style: S.input,
          value: repo,
          placeholder: '选中包含 .git 的目录',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRepo(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') void refresh(repo)
          },
        }),
        React.createElement('button', { style: S.button, disabled, onClick: () => void refresh(repo) }, '刷新状态'),
      ),
      err === '' ? null : React.createElement('p', { style: { ...S.hint, color: '#e03131' } }, err),
      isRepo && info?.error !== undefined
        ? React.createElement('p', { style: { ...S.hint, color: '#e03131' } }, info.error)
        : null,
    ),

    isRepo
      ? null
      : React.createElement(
        'div',
        { style: S.card },
        React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '初始化仓库'),
        React.createElement(
          'p',
          { style: S.hint },
          '这个目录还不是 Git 仓库。点下面的按钮会：git init（分支 main）→ 写入 .gitignore（node_modules/dist/build 等，已存在则不覆盖）→ 暂存全部 → 首次提交。',
        ),
        React.createElement(
          'div',
          { style: S.row },
          React.createElement('input', {
            style: S.input,
            value: message,
            placeholder: '首次提交信息（留空 = chore: init repository）',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMessage(event.target.value),
          }),
          React.createElement(
            'button',
            { style: S.primary, disabled: disabled || repo.trim() === '', onClick: () => void initRepo() },
            busy === 'init' ? '初始化中…' : '初始化仓库',
          ),
        ),
      ),

    isRepo && (info?.commits ?? []).length === 0
      ? React.createElement(
        'div',
        { style: S.card },
        React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '首次提交'),
        React.createElement(
          'p',
          { style: S.hint },
          '这是空仓库（有 .git，但还没有任何提交）。点按钮会：写 .gitignore（无则写）→ 设置仓库级提交身份 → 暂存全部 → 首次提交。',
        ),
        React.createElement(
          'div',
          { style: S.row },
          React.createElement('input', {
            style: S.input,
            value: message,
            placeholder: '首次提交信息（留空 = chore: initial commit）',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMessage(event.target.value),
          }),
          React.createElement(
            'button',
            { style: S.primary, disabled: disabled || repo.trim() === '', onClick: () => void firstCommit() },
            busy === 'first' ? '提交中…' : '创建首次提交',
          ),
        ),
      )
      : null,

    React.createElement(
      'div',
      { style: S.card },
      React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '提交'),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('input', {
          style: S.input,
          value: message,
          placeholder: '提交信息（必填）',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMessage(event.target.value),
        }),
        React.createElement(
          'button',
          {
            style: S.primary,
            disabled: disabled || message.trim() === '',
            onClick: () => void run('commit', 'commit', [message]).then(() => setMessage('')),
          },
          busy === 'commit' ? '提交中…' : '暂存全部并提交',
        ),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('add_all', 'add_all') }, '暂存全部'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('amend', 'amend', [message]) }, '改写上次提交'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('diff', 'diff_stat') }, '改动统计'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('log', 'log') }, '最近 20 条提交'),
      ),
      React.createElement(
        'p',
        { style: S.hint },
        '「暂存全部并提交」= git add -A + git commit -m；「改写上次提交」= git commit --amend（有输入信息就替换原信息）。',
      ),
    ),

    React.createElement(
      'div',
      { style: S.card },
      React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '创建远端仓库（GitHub）'),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('span', { style: S.label }, 'Token'),
        React.createElement('input', {
          style: S.input,
          type: 'password',
          value: githubToken,
          placeholder: ghMasked === '' ? 'ghp_…（需 repo 权限）' : `已保存 ${ghMasked}（留空则不改）`,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setGithubToken(event.target.value),
        }),
        React.createElement(
          'button',
          { style: S.button, disabled, onClick: () => void saveToken() },
          busy === 'token' ? '验证中…' : '保存并验证',
        ),
        ghLogin === '' ? null : React.createElement('span', { style: S.badge('ok') }, `已登录 ${ghLogin}`),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('input', {
          style: S.input,
          value: repoName,
          placeholder: '仓库名（如 my-project）',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRepoName(event.target.value),
        }),
        React.createElement(
          'select',
          {
            style: { ...S.input, flex: '0 0 150px' },
            value: repoPrivate ? 'private' : 'public',
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setRepoPrivate(event.target.value === 'private'),
          },
          React.createElement('option', { value: 'private' }, '私有 Private'),
          React.createElement('option', { value: 'public' }, '公开 Public'),
        ),
        React.createElement(
          'button',
          {
            style: S.primary,
            disabled: disabled || repo.trim() === '' || repoName.trim() === '',
            onClick: () => void createRemote(),
          },
          busy === 'create' ? '创建中…' : '在 GitHub 创建并推送',
        ),
      ),
      React.createElement('input', {
        style: S.input,
        value: repoDesc,
        placeholder: '仓库描述（可选）',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRepoDesc(event.target.value),
      }),
      React.createElement(
        'p',
        { style: S.hint },
        '在你的 GitHub 账号下创建仓库（可选私有/公开）→ 设 origin → 推送当前分支 → 设好 upstream。Token 存在 $DSH_HOME/git-buttons.settings.json（明文，注意保管）。',
      ),
    ),

    React.createElement(
      'div',
      { style: S.card },
      React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '远端'),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('fetch', 'fetch') }, busy === 'fetch' ? '抓取中…' : '抓取 fetch'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('pull', 'pull') }, busy === 'pull' ? '拉取中…' : '拉取 pull --ff-only'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('push', 'push') }, busy === 'push' ? '推送中…' : '推送 push'),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('input', {
          style: S.input,
          value: remoteUrl,
          placeholder: '远端地址，如 https://github.com/you/repo.git',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRemoteUrl(event.target.value),
        }),
        React.createElement(
          'button',
          { style: S.primary, disabled: disabled || repo.trim() === '', onClick: () => void publish() },
          busy === 'publish' ? '推送中…' : '设置远端并推送（-u）',
        ),
      ),
      React.createElement(
        'p',
        { style: S.hint },
        info?.upstream === '' || info?.upstream === undefined
          ? '当前分支还没有 upstream：上面填远端地址 → 点「设置远端并推送（-u）」，之后「推送 push」就能直接用。'
          : `upstream：${info.upstream}（远端已就绪，可直接 push）`,
      ),
      (info?.remotes ?? []).length === 0
        ? null
        : React.createElement('pre', { style: S.pre }, (info?.remotes ?? []).join('\n')),
    ),

    React.createElement(
      'div',
      { style: S.card },
      React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, '分支与贮藏'),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement(
          'select',
          {
            style: { ...S.input, flex: '0 0 200px' },
            value: '',
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              const target = event.target.value
              if (target !== '') void run('switch', 'switch', [target])
            },
          },
          React.createElement('option', { value: '' }, `切换分支（当前 ${info?.branch ?? '?'}）`),
          ...(info?.branches ?? []).map((item) => React.createElement('option', { key: item, value: item }, item)),
        ),
        React.createElement('input', {
          style: { ...S.input, flex: '0 0 180px' },
          value: branchName,
          placeholder: '新分支名',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setBranchName(event.target.value),
        }),
        React.createElement(
          'button',
          { style: S.button, disabled: disabled || branchName.trim() === '', onClick: () => void run('switch_create', 'switch_create', [branchName]).then(() => setBranchName('')) },
          '新建并切换',
        ),
        React.createElement(
          'button',
          { style: S.button, disabled: disabled || branchName.trim() === '', onClick: () => void run('merge', 'merge', [branchName]) },
          '合并到当前',
        ),
      ),
      React.createElement(
        'div',
        { style: S.row },
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('stash_push', 'stash_push') }, '贮藏（含未跟踪）'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('stash_pop', 'stash_pop') }, '取回贮藏'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('stash_list', 'stash_list') }, '贮藏列表'),
        React.createElement('button', { style: S.button, disabled, onClick: () => void run('reset_soft', 'reset_soft') }, '撤销上次提交（保留改动）'),
      ),
    ),

    output === '' ? null : React.createElement('pre', { style: S.pre }, output),

    isRepo && (info?.changeList ?? []).length > 0
      ? React.createElement(
        'div',
        { style: S.card },
        React.createElement('strong', { style: { fontSize: 12.5, opacity: 0.85 } }, `未提交改动（${info?.changeList?.length ?? 0}）`),
        ...(info?.changeList ?? []).slice(0, 200).map((line) => {
          const change = parseChange(line)
          const untracked = change.code.includes('??')
          return React.createElement(
            'div',
            {
              key: line,
              style: { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' },
            },
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 } },
              React.createElement(
                'span',
                { style: { ...S.badge(untracked ? 'warn' : 'ok'), fontFamily: 'ui-monospace', minWidth: 28, textAlign: 'center' } },
                change.code || '·',
              ),
              React.createElement(
                'span',
                { style: { fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all' } },
                change.path,
              ),
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 6, flexShrink: 0 } },
              React.createElement(
                'button',
                { style: S.button, disabled, onClick: () => void fileAction('stage', 'stage_file', change.path) },
                '暂存',
              ),
              React.createElement(
                'button',
                { style: S.button, disabled, onClick: () => void fileAction('unstage', 'unstage_file', change.path) },
                '取消暂存',
              ),
              React.createElement(
                'button',
                {
                  style: S.button,
                  disabled: disabled || untracked,
                  title: untracked ? '未跟踪文件没有 diff，先暂存再看' : '查看该文件的差异',
                  onClick: () => void fileAction('diff', 'diff_file', change.path),
                },
                '差异',
              ),
            ),
          )
        }),
      )
      : null,

    picker
      ? React.createElement(DirectoryPicker, {
        initial: repo,
        onPick: (picked: string) => {
          setPicker(false)
          setRepo(picked)
          void refresh(picked)
        },
        onClose: () => setPicker(false),
      })
      : null,
  )
}

export function apply(ctx: {
  slots: {
    inject(name: string, callback: () => () => void): void
    register(spec: Record<string, unknown>, component: unknown): () => void
  }
}): void {
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: 'git-buttons',
      order: 110,
      label: () => 'Git',
      inject: (sessionId: string) => ({ sessionId }),
    }, GitButtonsView))
}
