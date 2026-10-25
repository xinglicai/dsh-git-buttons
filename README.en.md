# dsh-git-buttons

A **Git button panel** for DeepSeek Harness (DSH): one `Git` tab in the conversation header where every common Git action is a button — init repository, first commit, stage/unstage, commit, pull/push, branches, stash, and **creating a GitHub repository (private or public) and pushing to it**. No terminal, no typing git commands.

## Features

| Area | Actions |
|---|---|
| Repository state | auto-detects the current conversation's workspace; branch / ahead / behind / change count badges |
| Lifecycle | **Init repository** (git init -b main + .gitignore + identity + first commit) or **First commit** for an empty repo |
| Commit | `add -A` + commit, stage all, amend last commit, diff stat, last 20 commits |
| Changes | per-file `stage` / `unstage` / `diff` |
| Remote | fetch, pull --ff-only, push, set remote + `push -u`, **create GitHub repo (private/public) and push** |
| Branch & stash | switch, create+switch, merge, stash (with untracked), stash pop, stash list, `reset --soft HEAD~1` |
| Output | every command echoes its argv, stdout, stderr and exit code |

## Install

```powershell
cd "$env:USERPROFILE\.dsh\plugins-src\dsh-git-buttons"
powershell -ExecutionPolicy Bypass -File .\build.ps1

$deploy = "$env:USERPROFILE\.dsh\profiles\desktop\.dsh-plugins\dsh-git-buttons"
New-Item -ItemType Directory -Force -Path "$deploy\lib" | Out-Null
Copy-Item lib\index.js,lib\client.js "$deploy\lib\" -Force
Copy-Item package.json,cordis.patch.yml $deploy -Force
```

Add to `~/.dsh/profiles/desktop/package.json`:

```jsonc
{
  "dependencies": { "@dsh-external/dsh-git-buttons": "link:.dsh-plugins/dsh-git-buttons" },
  "dsh": { "profile": { "bundles": [ /* … */ "@dsh-external/dsh-git-buttons" ] } }
}
```

Then either `pnpm install`, or create a junction when pnpm is unavailable:

```powershell
cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\@dsh-external\dsh-git-buttons" "%USERPROFILE%\.dsh\profiles\desktop\.dsh-plugins\dsh-git-buttons"
```

Restart DSH; a `Git` tab appears in the conversation header. Requires DSH `0.2.1-rc.3`, Node >= 22 and a working `git` CLI.

## Configuration

- `timeoutMs` in `cordis.patch.yml` (default 20000, clamped 3s–120s)
- GitHub token stored in `$DSH_HOME/git-buttons.settings.json` (plain text — keep it safe)

## HTTP API

Same-origin `POST /git-buttons/api/<method>`:

`git.info`, `git.run`, `git.init`, `git.firstCommit`, `git.publish`, `git.createRemote`, `git.githubToken`, `git.githubStatus`, `fs.list`

Whitelisted `git.run` actions: `status add_all commit amend pull push fetch switch switch_create merge stash_push stash_pop stash_list reset_soft log branches diff_stat remote_list stage_file unstage_file diff_file diff_file_staged discard_file`.

## Safety

- argv arrays with a fixed cwd, never shell string concatenation, never `--force`
- relative-path validation for per-file actions (no absolute paths, no `..`, no leading `-`)
- the GitHub token appears only in that single `git push` invocation; `.git/config` keeps a clean HTTPS URL
- the panel does no network I/O except `GET /user` (token check) and the git commands you click

Full Chinese documentation: [README.md](README.md).

## License

MIT
