/**
 * dsh-git-buttons —— 宿主半区。
 *
 * 把常用 git 操作暴露成白名单 API，供浏览器半区的按钮调用：
 *   POST /git-buttons/api/git.info      { path }                → 分支/upstream/改动数/最近提交
 *   POST /git-buttons/api/git.run       { path, action, args }  → 执行一个白名单动作
 *   POST /git-buttons/api/fs.list       { path }                → 目录浏览（选项目用）
 *
 * 所有 git 调用都用 argv 数组 + 固定 cwd，不拼接 shell；动作与参数都做校验。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, stat, writeFile, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const name = 'git-buttons'

export const inject = ['connection', 'webServer']

interface HttpRequestLike {
  method?: string
  url?: string
  on(event: string, listener: (...args: unknown[]) => void): void
}

interface HttpResponseLike {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

interface WebServer {
  register(spec: {
    kind: 'prefix'
    path: string
    handler: (req: HttpRequestLike, res: HttpResponseLike) => Promise<void> | void
  }): () => void
}

interface Connection {
  requestRejection(req: unknown): unknown
}

export interface Config {
  readonly timeoutMs?: number
}

interface Context {
  readonly webServer: WebServer
  readonly connection: Connection
  effect(setup: () => () => void, label?: string): void
  logger: { info(...args: unknown[]): void; warn(...args: unknown[]): void }
}

const MAX_OUTPUT = 120_000

function writeJson(res: HttpResponseLike, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(text)
}

async function readJsonBody(req: HttpRequestLike): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  await new Promise<void>((done, fail) => {
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)))
    req.on('end', () => done())
    req.on('error', (error) => fail(error))
  })
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw === '') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

interface GitResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function runGit(cwd: string, args: readonly string[], timeoutMs: number): Promise<GitResult> {
  return new Promise<GitResult>((done) => {
    let finished = false
    const finish = (result: GitResult): void => {
      if (finished) return
      finished = true
      done(result)
    }
    const child = spawn('git', [...args], { cwd, windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      finish({ code: -2, stdout, stderr: `${stderr}\n（超时 ${timeoutMs}ms，已终止）` })
    }, timeoutMs)
    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk.toString('utf8')
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      finish({ code: -1, stdout, stderr: `无法启动 git：${error.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ code: code ?? -1, stdout, stderr })
    })
  })
}

const BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/

/** 初始化仓库时写入的 .gitignore（不存在才写，不覆盖已有文件）。 */
const DEFAULT_GITIGNORE = [
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.cache/',
  'coverage/',
  '.venv/',
  '__pycache__/',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '',
].join('\n')

/** 单文件操作里的相对路径：不许绝对路径、不许 ..、不许以 - 开头。 */
function safeRelPath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/')
  if (path === '' || path.startsWith('/') || path.startsWith('-') || path.includes('..')) return null
  return path
}

/** 白名单动作 → git argv；参数不合法返回 null。 */
function gitArgv(action: string, args: readonly string[]): string[] | null {
  const arg = (index: number): string => (args[index] ?? '').trim()
  const branch = (index: number): string | null => {
    const value = arg(index)
    return BRANCH_RE.test(value) ? value : null
  }
  switch (action) {
    case 'status':
      return ['status', '--porcelain=v1', '-b']
    case 'add_all':
      return ['add', '-A']
    case 'commit': {
      const message = arg(0)
      return message === '' || message.includes('\n') ? null : ['commit', '-m', message]
    }
    case 'amend': {
      const message = arg(0)
      return message === '' || message.includes('\n')
        ? ['commit', '--amend', '--no-edit']
        : ['commit', '--amend', '-m', message]
    }
    case 'pull':
      return ['pull', '--ff-only']
    case 'push':
      return ['push']
    case 'fetch':
      return ['fetch', '--all', '--prune']
    case 'switch': {
      const target = branch(0)
      return target === null ? null : ['switch', target]
    }
    case 'switch_create': {
      const target = branch(0)
      return target === null ? null : ['switch', '-c', target]
    }
    case 'merge': {
      const target = branch(0)
      return target === null ? null : ['merge', '--no-edit', target]
    }
    case 'stash_push':
      return ['stash', 'push', '-u']
    case 'stash_pop':
      return ['stash', 'pop']
    case 'stash_list':
      return ['stash', 'list']
    case 'reset_soft':
      return ['reset', '--soft', 'HEAD~1']
    case 'log':
      return ['log', '--oneline', '-20', '--decorate']
    case 'branches':
      return ['branch', '--format=%(refname:short)']
    case 'diff_stat':
      return ['diff', '--stat']
    case 'remote_list':
      return ['remote', '-v']
    case 'stage_file': {
      const target = safeRelPath(arg(0))
      return target === null ? null : ['add', '--', target]
    }
    case 'unstage_file': {
      const target = safeRelPath(arg(0))
      return target === null ? null : ['restore', '--staged', '--', target]
    }
    case 'diff_file': {
      const target = safeRelPath(arg(0))
      return target === null ? null : ['diff', '--', target]
    }
    case 'diff_file_staged': {
      const target = safeRelPath(arg(0))
      return target === null ? null : ['diff', '--cached', '--', target]
    }
    case 'discard_file': {
      const target = safeRelPath(arg(0))
      return target === null ? null : ['checkout', '--', target]
    }
    default:
      return null
  }
}

function requirePath(payload: Record<string, unknown>): string {
  const raw = typeof payload.path === 'string' ? payload.path.trim() : ''
  if (raw === '') throw new Error('缺少仓库路径（path）')
  const target = resolve(raw)
  if (!existsSync(target)) throw new Error(`路径不存在：${target}`)
  return target
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim() !== '')?.trim() ?? ''
}

export function apply(ctx: Context, config: Config = {}): void {
  const timeoutMs = Math.min(Math.max(config.timeoutMs ?? 20_000, 3_000), 120_000)

  // GitHub token 存插件自己的设置文件（$DSH_HOME/git-buttons.settings.json），不写进 profile 配置。
  const settingsPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'git-buttons.settings.json')
  const loadSettings = async (): Promise<{ githubToken?: string }> => {
    try {
      const parsed = JSON.parse(await readFile(settingsPath, 'utf8')) as { githubToken?: unknown }
      return typeof parsed.githubToken === 'string' ? { githubToken: parsed.githubToken } : {}
    } catch {
      return {}
    }
  }
  const saveSettings = async (patch: { githubToken?: string }): Promise<void> => {
    const current = await loadSettings()
    const next = { ...current, ...patch }
    if (next.githubToken === '') delete next.githubToken
    await writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  }

  const github = async (
    token: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<{ status: number; data: Record<string, unknown> }> => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `token ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'dsh-git-buttons',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { status: response.status, data }
  }


  const api: Record<string, (payload: Record<string, unknown>) => Promise<unknown>> = {
    /**
     * 在 GitHub 创建仓库（私有/公开），然后把当前分支推上去并设好 upstream。
     * push 用带 token 的一次性 URL，结束后仓库配置里只留干净的 https 地址。
     */
    'git.createRemote': async (payload) => {
      const cwd = requirePath(payload)
      const name = typeof payload.name === 'string' ? payload.name.trim() : ''
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) throw new Error('仓库名只允许字母、数字、点、下划线、短横线')
      const isPrivate = payload.private !== false
      const description = typeof payload.description === 'string' ? payload.description.trim() : ''

      const stored = await loadSettings()
      const token = typeof payload.token === 'string' && payload.token.trim() !== ''
        ? payload.token.trim()
        : (stored.githubToken ?? '')
      if (token === '') throw new Error('先在面板里填 GitHub Token 并点「保存并验证」')

      const me = await github(token, '/user')
      const login = typeof me.data.login === 'string' ? me.data.login : ''
      if (me.status !== 200 || login === '') throw new Error('Token 无效或没有权限（GET /user 失败）')

      const steps: string[] = []
      const created = await github(token, '/user/repos', {
        method: 'POST',
        body: { name, private: isPrivate, description, auto_init: false },
      })
      if (created.status === 201) {
        steps.push(`已在 GitHub 创建${isPrivate ? '私有' : '公开'}仓库：${login}/${name}`)
      } else if (created.status === 422) {
        steps.push(`仓库 ${login}/${name} 已存在，直接复用`)
      } else {
        const message = typeof created.data.message === 'string' ? created.data.message : `HTTP ${created.status}`
        throw new Error(`创建仓库失败：${message}`)
      }

      const branchRes = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs)
      const branch = firstLine(branchRes.stdout)
      if (branch === '' || branch === 'HEAD') throw new Error('当前没有有效分支：先创建首次提交')

      const cleanUrl = `https://github.com/${login}/${name}.git`
      await runGit(cwd, ['remote', 'remove', 'origin'], timeoutMs)
      const added = await runGit(cwd, ['remote', 'add', 'origin', cleanUrl], timeoutMs)
      if (added.code !== 0) throw new Error(`设置 origin 失败：${(added.stderr || added.stdout).trim()}`)
      steps.push(`origin → ${cleanUrl}`)

      const authedUrl = `https://x-access-token:${token}@github.com/${login}/${name}.git`
      const push = await runGit(cwd, ['push', authedUrl, `HEAD:refs/heads/${branch}`], Math.max(timeoutMs, 60_000))
      if (push.code !== 0) {
        const reason = (push.stderr || push.stdout).replaceAll(token, '***').trim().split('\n').slice(-3).join('\n')
        throw new Error(`推送失败：${reason}`)
      }
      steps.push(`已推送 ${branch} 到远端`)

      await runGit(cwd, ['config', `branch.${branch}.remote`, 'origin'], timeoutMs)
      await runGit(cwd, ['config', `branch.${branch}.merge`, `refs/heads/${branch}`], timeoutMs)
      steps.push(`已设置 upstream：origin/${branch}`)

      return { ok: true, steps, repoUrl: cleanUrl, branch, visibility: isPrivate ? 'private' : 'public' }
    },

    /** 保存并验证 GitHub token（只回 masked 信息，不回传明文）。 */
    'git.githubToken': async (payload) => {
      const token = typeof payload.token === 'string' ? payload.token.trim() : ''
      if (token === '') {
        await saveSettings({ githubToken: '' })
        return { ok: true, hasToken: false }
      }
      const me = await github(token, '/user')
      if (me.status !== 200 || typeof me.data.login !== 'string') {
        throw new Error(`Token 校验失败（HTTP ${me.status}）：${String(me.data.message ?? '')}`)
      }
      await saveSettings({ githubToken: token })
      return { ok: true, hasToken: true, login: me.data.login }
    },

    /** 当前 token 状态（不返回明文）。 */
    'git.githubStatus': async () => {
      const stored = await loadSettings()
      const token = stored.githubToken ?? ''
      if (token === '') return { ok: true, hasToken: false }
      const me = await github(token, '/user')
      return {
        ok: true,
        hasToken: true,
        valid: me.status === 200,
        login: typeof me.data.login === 'string' ? me.data.login : '',
        masked: `${token.slice(0, 7)}…${token.slice(-4)}`,
      }
    },

    /** 空仓库的首次提交：写 .gitignore（无则写）+ 身份兜底 + add -A + commit。 */
    'git.firstCommit': async (payload) => {
      const cwd = requirePath(payload)
      const message = typeof payload.message === 'string' && payload.message.trim() !== ''
        ? payload.message.trim()
        : 'chore: initial commit'
      const probe = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'], timeoutMs)
      if (probe.code !== 0) throw new Error('这个目录还不是 Git 仓库，请先点「初始化仓库」')
      const steps: string[] = []

      const ignorePath = join(cwd, '.gitignore')
      if (!existsSync(ignorePath)) {
        await writeFile(ignorePath, DEFAULT_GITIGNORE, 'utf8')
        steps.push('已写入 .gitignore（node_modules/dist/build 等）')
      }
      const email = await runGit(cwd, ['config', '--get', 'user.email'], timeoutMs)
      if (email.code !== 0 || email.stdout.trim() === '') {
        await runGit(cwd, ['config', 'user.name', 'DSH User'], timeoutMs)
        await runGit(cwd, ['config', 'user.email', 'dsh@localhost'], timeoutMs)
        steps.push('已设置仓库级提交身份：DSH User <dsh@localhost>')
      }
      const staged = await runGit(cwd, ['add', '-A'], timeoutMs)
      if (staged.code !== 0) steps.push(`暂存有警告：${(staged.stderr || staged.stdout).trim().split('\n')[0] ?? ''}`)
      const commit = await runGit(cwd, ['commit', '-m', message], timeoutMs)
      if (commit.code !== 0) {
        throw new Error(`提交失败：${(commit.stderr || commit.stdout).trim().split('\n')[0] ?? '未知原因'}`)
      }
      steps.push(`已提交：${message}`)
      const branch = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs)
      return { ok: true, steps, branch: firstLine(branch.stdout) }
    },

    /** 初始化仓库：git init（-b main）+ 写 .gitignore（不存在时）+ 首次提交。 */
    'git.init': async (payload) => {
      const cwd = requirePath(payload)
      const message = typeof payload.message === 'string' && payload.message.trim() !== ''
        ? payload.message.trim()
        : 'chore: init repository'
      const steps: string[] = []

      const probe = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'], timeoutMs)
      if (probe.code === 0) throw new Error('该目录已经是 Git 仓库，无需初始化')

      let init = await runGit(cwd, ['init', '-b', 'main'], timeoutMs)
      if (init.code !== 0) init = await runGit(cwd, ['init'], timeoutMs)
      if (init.code !== 0) {
        throw new Error(`git init 失败：${(init.stderr || init.stdout).trim() || `退出码 ${init.code}`}`)
      }
      steps.push('已执行 git init')

      const ignorePath = join(cwd, '.gitignore')
      if (!existsSync(ignorePath)) {
        await writeFile(ignorePath, DEFAULT_GITIGNORE, 'utf8')
        steps.push('已写入 .gitignore（node_modules/dist/build 等）')
      }

      // 首次提交前确认提交身份：没配 user.email 时写仓库级身份，避免 "Author identity unknown"。
      const email = await runGit(cwd, ['config', '--get', 'user.email'], timeoutMs)
      if (email.code !== 0 || email.stdout.trim() === '') {
        await runGit(cwd, ['config', 'user.name', 'DSH User'], timeoutMs)
        await runGit(cwd, ['config', 'user.email', 'dsh@localhost'], timeoutMs)
        steps.push('已设置仓库级提交身份：DSH User <dsh@localhost>')
      }

      const staged = await runGit(cwd, ['add', '-A'], timeoutMs)
      if (staged.code !== 0) {
        steps.push(`暂存有警告：${(staged.stderr || staged.stdout).trim().split('\n')[0] ?? ''}`)
      }
      const commit = await runGit(cwd, ['commit', '-m', message], timeoutMs)
      if (commit.code === 0) steps.push(`已首次提交：${message}`)
      else steps.push(`首次提交未完成：${(commit.stderr || commit.stdout).trim().split('\n')[0] ?? '未知原因'}`)

      const branch = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs)
      return { ok: true, steps, branch: firstLine(branch.stdout) }
    },

    /** 仓库概况：分支、upstream、ahead/behind、改动数、最近提交、是否 git 仓库。 */
    'git.info': async (payload) => {
      const cwd = requirePath(payload)
      const probe = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'], timeoutMs)
      if (probe.code !== 0) {
        return {
          ok: true,
          isRepo: false,
          path: cwd,
          error: (probe.stderr || probe.stdout || `git 退出码 ${probe.code}`).trim(),
        }
      }
      const [branch, status, log, branches, remotes] = await Promise.all([
        runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs),
        runGit(cwd, ['status', '--porcelain=v1', '-b'], timeoutMs),
        runGit(cwd, ['log', '--oneline', '-10', '--decorate'], timeoutMs),
        runGit(cwd, ['branch', '--format=%(refname:short)'], timeoutMs),
        runGit(cwd, ['remote', '-v'], timeoutMs),
      ])
      const statusLines = status.stdout.split(/\r?\n/).filter((line) => line.trim() !== '')
      const header = statusLines.find((line) => line.startsWith('##')) ?? ''
      const changes = statusLines.filter((line) => !line.startsWith('##'))
      const ahead = /ahead (\d+)/.exec(header)?.[1] ?? '0'
      const behind = /behind (\d+)/.exec(header)?.[1] ?? '0'
      const upstream = /\.\.\.(\S+)/.exec(header)?.[1] ?? ''
      return {
        ok: true,
        isRepo: true,
        path: cwd,
        branch: firstLine(branch.stdout) || '(detached)',
        upstream,
        ahead: Number(ahead),
        behind: Number(behind),
        changes: changes.length,
        changeList: changes.slice(0, 200),
        commits: log.stdout.split(/\r?\n/).filter((line) => line.trim() !== ''),
        branches: branches.stdout.split(/\r?\n/).filter((line) => line.trim() !== ''),
        remotes: remotes.stdout.split(/\r?\n/).filter((line) => line.trim() !== ''),
      }
    },

    /**
     * 设置远端并首次推送：可选 url →（add 或 set-url origin）→ git push -u origin <branch>。
     * 这是 upstream 唯一需要手动指定一次的步骤，之后 push 直接可用。
     */
    'git.publish': async (payload) => {
      const cwd = requirePath(payload)
      const url = typeof payload.url === 'string' ? payload.url.trim() : ''
      const steps: string[] = []

      const branchRes = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs)
      const branch = firstLine(branchRes.stdout)
      if (branch === '' || branch === 'HEAD') {
        throw new Error('当前没有有效分支（可能还没有提交）：先点「创建首次提交」')
      }

      if (url !== '') {
        if (!/^(https?:\/\/|ssh:\/\/|git@|file:\/\/)/.test(url)) {
          throw new Error('远端地址需以 https:// 、ssh:// 、file:// 或 git@ 开头')
        }
        const existing = await runGit(cwd, ['remote', 'get-url', 'origin'], timeoutMs)
        const changed = existing.code === 0
          ? await runGit(cwd, ['remote', 'set-url', 'origin', url], timeoutMs)
          : await runGit(cwd, ['remote', 'add', 'origin', url], timeoutMs)
        if (changed.code !== 0) {
          throw new Error(`设置 origin 失败：${(changed.stderr || changed.stdout).trim().split('\n')[0] ?? ''}`)
        }
        steps.push(existing.code === 0 ? `已更新 origin → ${url}` : `已添加 origin → ${url}`)
      } else {
        const hasRemote = await runGit(cwd, ['remote', 'get-url', 'origin'], timeoutMs)
        if (hasRemote.code !== 0) throw new Error('还没有配置 origin：请在输入框填远端地址（如 https://github.com/user/repo.git）')
      }

      const push = await runGit(cwd, ['push', '-u', 'origin', branch], timeoutMs)
      steps.push(`git push -u origin ${branch}（退出码 ${push.code}）`)
      return {
        ok: push.code === 0,
        branch,
        steps,
        stdout: push.stdout.trimEnd(),
        stderr: push.stderr.trimEnd(),
      }
    },

    /** 执行一个白名单 git 动作。 */
    'git.run': async (payload) => {
      const cwd = requirePath(payload)
      const action = typeof payload.action === 'string' ? payload.action.trim() : ''
      const rawArgs = Array.isArray(payload.args)
        ? payload.args.filter((item): item is string => typeof item === 'string')
        : []
      const argv = gitArgv(action, rawArgs)
      if (argv === null) throw new Error(`不支持的动作或参数不合法：${action}`)
      let result = await runGit(cwd, argv, timeoutMs)
      let command = `git ${argv.join(' ')}`
      // 空仓库（还没有任何提交）没有 HEAD，restore --staged 不可用，改用 rm --cached。
      if (action === 'unstage_file' && result.code !== 0 && result.stderr.includes("could not resolve 'HEAD'")) {
        const target = safeRelPath(rawArgs[0] ?? '')
        if (target !== null) {
          result = await runGit(cwd, ['rm', '--cached', '--', target], timeoutMs)
          command = `git rm --cached -- ${target}`
        }
      }
      return {
        ok: result.code === 0,
        action,
        command,
        code: result.code,
        stdout: result.stdout.trimEnd(),
        stderr: result.stderr.trimEnd(),
      }
    },

    /** 目录浏览（给「选择…」用，只返回目录）。 */
    'fs.list': async (payload) => {
      const raw = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (raw === '') {
        const drives: Array<{ name: string; path: string }> = []
        for (let code = 65; code <= 90; code += 1) {
          const letter = `${String.fromCharCode(code)}:\\`
          if (existsSync(letter)) drives.push({ name: letter, path: letter })
        }
        return { ok: true, path: '', parent: null, directories: drives }
      }
      const target = resolve(raw)
      const info = await stat(target).catch(() => undefined)
      if (info === undefined) throw new Error(`路径不存在：${target}`)
      if (!info.isDirectory()) throw new Error(`不是目录：${target}`)
      const entries = await readdir(target, { withFileTypes: true }).catch(() => [])
      const directories = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => ({ name: entry.name, path: join(target, entry.name) }))
        .sort((a, b) => a.name.localeCompare(b.name))
      const parent = dirname(target) === target ? '' : dirname(target)
      return { ok: true, path: target, parent, directories }
    },
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/git-buttons/api',
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req as unknown)
      if (rejection !== undefined) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if ((req.method ?? '').toUpperCase() !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/git-buttons/api/') ? pathname.slice('/git-buttons/api/'.length) : ''
      if (method === '' || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: 'unknown method' })
        return
      }
      const handlerFor = Object.hasOwn(api, method) ? api[method] : undefined
      if (handlerFor === undefined) {
        writeJson(res, 404, { ok: false, error: `unknown method "${method}"` })
        return
      }
      try {
        const payload = await readJsonBody(req)
        writeJson(res, 200, await handlerFor(payload))
      } catch (error) {
        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'git-buttons: /git-buttons/api routes')

  ctx.logger.info('git-buttons: 已挂载 /git-buttons/api')
}
