# dsh-git-buttons

DeepSeek Harness（DSH）的 **Git 按钮面板**：在会话顶部加一个 `Git` 页签，把常用 Git 操作全部做成按钮 —— 初始化仓库、首次提交、暂存/取消暂存、提交、拉取/推送、分支、贮藏、**在 GitHub 上创建仓库（私有/公开）并推送**。全程点鼠标，不需要在终端敲 git 命令。

> 为替代「只能看历史、缺初始化与远端创建」的纯展示型 Git 面板而写；本插件自己实现宿主与浏览器两半，不依赖第三方压缩产物。

---

## 截图里的样子

```
Git
┌────────────────────────────────────────────────────────────────┐
│ 工作区干净   分支 main   ↑0 ↓0          [选择仓库…]             │
│ 仓库路径 [ C:\path\to\repo                ]  [刷新状态]          │
├────────────────────────────────────────────────────────────────┤
│ 初始化仓库 / 首次提交（按仓库状态自动出现其中一个）              │
│ 提交信息 [                         ]  [创建首次提交]            │
├────────────────────────────────────────────────────────────────┤
│ 提交   [暂存全部并提交] [暂存全部] [改写上次提交] [改动统计] [最近20条提交]
├────────────────────────────────────────────────────────────────┤
│ 创建远端仓库（GitHub）                                          │
│ Token [••••] [保存并验证]  已登录 xinglicai                      │
│ 仓库名 [my-project]  [私有/公开]  [在 GitHub 创建并推送]         │
├────────────────────────────────────────────────────────────────┤
│ 远端   [抓取] [拉取 pull --ff-only] [推送 push]                  │
│        [远端地址…] [设置远端并推送（-u）]                        │
├────────────────────────────────────────────────────────────────┤
│ 分支与贮藏 [切换分支▾] [新分支名—新建并切换] [合并到当前]        │
│           [贮藏] [取回贮藏] [贮藏列表] [撤销上次提交（保留改动）] │
├────────────────────────────────────────────────────────────────┤
│ 未提交改动（3）                                                 │
│  M  src/app.ts        [暂存] [取消暂存] [差异]                   │
│ ??  new-file.md       [暂存] [取消暂存] [差异(禁用)]             │
└────────────────────────────────────────────────────────────────┘
```

---

## 功能

### 仓库状态

- 自动识别当前会话所属工作区（读 `$DSH_HOME/storages/workspace.json` 的 `sessionIds`），也可点「选择仓库…」逐级挑目录
- 顶部徽标显示：是否是仓库、当前分支、`ahead/behind`、未提交改动数
- 提交列表、分支列表、远端地址一览

### 仓库生命周期（可视化）

| 状态 | 面板显示 | 点一下会做什么 |
|---|---|---|
| 目录没有 `.git` | **初始化仓库** | `git init -b main` → 写 `.gitignore`（已存在不覆盖）→ 设仓库级提交身份 → `add -A` → 首次提交 |
| 有 `.git` 但零提交 | **创建首次提交** | 写 `.gitignore` → 设身份 → `add -A` → 首次提交 |
| 有提交 | 正常操作区 | — |

首次提交时会自动补 `user.name/user.email`（仓库级 `DSH User <dsh@localhost>`），避免 `Author identity unknown`。

### 提交

- `暂存全部并提交`（`add -A` + `commit -m`）
- `暂存全部`、`改写上次提交`（`--amend`，有输入信息则替换）
- `改动统计`（`diff --stat`）、`最近 20 条提交`
- **未提交改动逐文件操作**：`暂存` / `取消暂存` / `差异`（未跟踪文件禁用差异，提示先暂存）

### 远端

- `抓取 fetch`、`拉取 pull --ff-only`、`推送 push`
- **`设置远端并推送（-u）`**：填 https/ssh/git@ 地址 → `remote add|set-url origin` → `push -u origin <分支>` → upstream 就绪
- **`在 GitHub 创建并推送`**：填 Token（保存并验证）→ 仓库名 → 私有/公开 → 一键创建仓库 + 推送 + 设 upstream

### 分支与贮藏

- 分支下拉切换、`新建并切换`（`switch -c`）、`合并到当前`（`merge --no-edit`）
- `贮藏（含未跟踪）`、`取回贮藏`、`贮藏列表`、`撤销上次提交（保留改动）`（`reset --soft HEAD~1`）

### 输出区

每条命令都原样回显：实际执行的 `git …`、stdout、stderr、退出码。失败不会被吞掉。

---

## 安装

### 1. 构建

```powershell
cd "$env:USERPROFILE\.dsh\plugins-src\dsh-git-buttons"
# 用本机 DSH profile 里已有的 esbuild 二进制，无需联网装构建链
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

产物：`lib/index.js`（宿主，ESM）、`lib/client.js`（浏览器，CJS + `window.__ModuleLoader__` 包装）。

### 2. 部署

```powershell
$deploy = "$env:USERPROFILE\.dsh\profiles\desktop\.dsh-plugins\dsh-git-buttons"
New-Item -ItemType Directory -Force -Path "$deploy\lib" | Out-Null
Copy-Item lib\index.js,lib\client.js "$deploy\lib\" -Force
Copy-Item package.json,cordis.patch.yml $deploy -Force
```

### 3. 接入 profile

编辑 `~/.dsh/profiles/desktop/package.json`：

```jsonc
{
  "dependencies": {
    "@dsh-external/dsh-git-buttons": "link:.dsh-plugins/dsh-git-buttons"
  },
  "dsh": {
    "profile": {
      "bundles": [ /* … */ "@dsh-external/dsh-git-buttons" ]
    }
  }
}
```

然后二选一：

```powershell
# A. 有 pnpm
pnpm install

# B. pnpm 不可用（DSH Desktop 由自己管理 pnpm 时常见）——直接建目录联接
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@dsh-external" | Out-Null
cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\@dsh-external\dsh-git-buttons" "%USERPROFILE%\.dsh\profiles\desktop\.dsh-plugins\dsh-git-buttons"
```

**重启 DSH** 后，会话顶部出现 `Git` 页签。

### 依赖

- DSH `0.2.1-rc.3`（peer 按此对齐；更旧版本需放宽 `peerDependencies`）
- Node.js `>= 22`
- 系统里有可用的 `git` CLI（面板会显示 git 的真实报错，便于排查被安全软件拦截等问题）

---

## 配置

| 项 | 位置 | 说明 |
|---|---|---|
| `timeoutMs` | `cordis.patch.yml`（默认 20000） | 单条 git 命令超时，3s–120s |
| GitHub Token | `$DSH_HOME/git-buttons.settings.json` | 面板「保存并验证」写入；**明文**，注意保管 |
| 页签顺序 | `package.json` 的 `order: 110` | 排在其它 view 之后 |

> 若同时装了 `@xbzbing/dsh-git-panel`，两个页签会并存。要只保留本插件：把它的包名从 profile 的 `dsh.profile.bundles` 移除（依赖留着随时可恢复）。

---

## HTTP API

同源 `POST /git-buttons/api/<method>`，JSON body。所有接口都受 DSH 的会话校验（未带签名 cookie 返回 403）。

| method | body | 说明 |
|---|---|---|
| `git.info` | `{path}` | 分支/upstream/ahead/behind/改动列表/提交/分支/远端 |
| `git.run` | `{path, action, args[]}` | 执行白名单动作 |
| `git.init` | `{path, message?}` | 初始化仓库 + 首次提交 |
| `git.firstCommit` | `{path, message?}` | 空仓库首次提交 |
| `git.publish` | `{path, url?}` | 设远端 origin + `push -u` |
| `git.createRemote` | `{path, name, private, description?}` | 在 GitHub 建仓库并推送 |
| `git.githubToken` | `{token}` | 保存并验证 token（空字符串=清除） |
| `git.githubStatus` | `{}` | token 状态（只回 masked） |
| `fs.list` | `{path}` | 目录浏览（`path:""` 列盘符） |

### 动作白名单（`git.run`）

```
status  add_all  commit  amend  pull  push  fetch
switch  switch_create  merge
stash_push  stash_pop  stash_list
reset_soft  log  branches  diff_stat  remote_list
stage_file  unstage_file  diff_file  diff_file_staged  discard_file
```

`discard_file`（`git checkout -- <file>` 丢弃改动）只在 API 层开放，面板未暴露 —— 避免误点。

---

## 安全与边界

- 所有 git 调用都用 **argv 数组 + 固定 cwd**，不拼接 shell 字符串；不使用 `--force`
- 单文件操作的路径经过校验：拒绝绝对路径、`..`、以 `-` 开头的值
- 分支名匹配 `[A-Za-z0-9._/-]{1,120}`；提交信息不允许换行
- 创建 GitHub 仓库时，token 只出现在那一次 `git push` 的进程参数里，**不写入 `.git/config`**；仓库配置里保存的是干净的 `https://github.com/...` 地址
- `git.createRemote` 创建的仓库按你的选择设为私有或公开；同名仓库已存在时复用，不报错中断
- 面板不做 fetch/pull/push 之外的任何联网；token 校验只打 `GET /user`

### 已知限制

- 差异是**纯文本** `git diff` 输出，没有语法高亮/并排视图/提交图（需要那类视图请装带图形界面的面板）
- 首次 `push` 到新仓库需要一次 `-u`（面板已做成按钮）
- HTTPS 远程的日常推送依赖系统 git 凭据（Windows 凭据管理器）；本插件不保存 git 凭据
- 非 Git 目录只能看状态报错，不能浏览文件树

---

## 开发

```
src/index.ts        宿主半区：git 命令封装、白名单、GitHub API、路由
src/client/index.ts 浏览器半区：conversation.view 页签与全部 UI
build.ps1           esbuild 打包（host: ESM / client: CJS + module-loader 包装）
cordis.patch.yml    bundle patch：插入 git-buttons 行
```

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

浏览器半区通过 `window.__ModuleLoader__.load({ id: '@dsh-external/dsh-git-buttons', factory })` 包装，React 走 `require('react')`（外部依赖）。

### 页签注册

```js
ctx.slots.inject('conversation.view', () => ctx.slots.register({
  name: 'conversation.view',
  id: 'git-buttons',
  order: 110,
  label: () => 'Git',
  inject: (sessionId) => ({ sessionId }),   // 框架按会话注入，组件靠它定位工作区
}, GitButtonsView))
```

---

## License

MIT
