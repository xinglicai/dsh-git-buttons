// ../../../.dsh/plugins-src/dsh-git-buttons/src/index.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
var name = "git-buttons";
var inject = ["connection", "webServer"];
var MAX_OUTPUT = 12e4;
function writeJson(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(text);
}
async function readJsonBody(req) {
  const chunks = [];
  await new Promise((done, fail) => {
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => done());
    req.on("error", (error) => fail(error));
  });
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON");
  }
}
function runGit(cwd, args, timeoutMs) {
  return new Promise((done) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      done(result);
    };
    const child = spawn("git", [...args], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      finish({ code: -2, stdout, stderr: `${stderr}
\uFF08\u8D85\u65F6 ${timeoutMs}ms\uFF0C\u5DF2\u7EC8\u6B62\uFF09` });
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({ code: -1, stdout, stderr: `\u65E0\u6CD5\u542F\u52A8 git\uFF1A${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ code: code ?? -1, stdout, stderr });
    });
  });
}
var BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/;
var DEFAULT_GITIGNORE = [
  "node_modules/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".cache/",
  "coverage/",
  ".venv/",
  "__pycache__/",
  ".DS_Store",
  "Thumbs.db",
  "*.log",
  ""
].join("\n");
function safeRelPath(value) {
  const path = value.trim().replace(/\\/g, "/");
  if (path === "" || path.startsWith("/") || path.startsWith("-") || path.includes("..")) return null;
  return path;
}
function gitArgv(action, args) {
  const arg = (index) => (args[index] ?? "").trim();
  const branch = (index) => {
    const value = arg(index);
    return BRANCH_RE.test(value) ? value : null;
  };
  switch (action) {
    case "status":
      return ["status", "--porcelain=v1", "-b"];
    case "add_all":
      return ["add", "-A"];
    case "commit": {
      const message = arg(0);
      return message === "" || message.includes("\n") ? null : ["commit", "-m", message];
    }
    case "amend": {
      const message = arg(0);
      return message === "" || message.includes("\n") ? ["commit", "--amend", "--no-edit"] : ["commit", "--amend", "-m", message];
    }
    case "pull":
      return ["pull", "--ff-only"];
    case "push":
      return ["push"];
    case "fetch":
      return ["fetch", "--all", "--prune"];
    case "switch": {
      const target = branch(0);
      return target === null ? null : ["switch", target];
    }
    case "switch_create": {
      const target = branch(0);
      return target === null ? null : ["switch", "-c", target];
    }
    case "merge": {
      const target = branch(0);
      return target === null ? null : ["merge", "--no-edit", target];
    }
    case "stash_push":
      return ["stash", "push", "-u"];
    case "stash_pop":
      return ["stash", "pop"];
    case "stash_list":
      return ["stash", "list"];
    case "reset_soft":
      return ["reset", "--soft", "HEAD~1"];
    case "log":
      return ["log", "--oneline", "-20", "--decorate"];
    case "branches":
      return ["branch", "--format=%(refname:short)"];
    case "diff_stat":
      return ["diff", "--stat"];
    case "remote_list":
      return ["remote", "-v"];
    case "stage_file": {
      const target = safeRelPath(arg(0));
      return target === null ? null : ["add", "--", target];
    }
    case "unstage_file": {
      const target = safeRelPath(arg(0));
      return target === null ? null : ["restore", "--staged", "--", target];
    }
    case "diff_file": {
      const target = safeRelPath(arg(0));
      return target === null ? null : ["diff", "--", target];
    }
    case "diff_file_staged": {
      const target = safeRelPath(arg(0));
      return target === null ? null : ["diff", "--cached", "--", target];
    }
    case "discard_file": {
      const target = safeRelPath(arg(0));
      return target === null ? null : ["checkout", "--", target];
    }
    default:
      return null;
  }
}
function requirePath(payload) {
  const raw = typeof payload.path === "string" ? payload.path.trim() : "";
  if (raw === "") throw new Error("\u7F3A\u5C11\u4ED3\u5E93\u8DEF\u5F84\uFF08path\uFF09");
  const target = resolve(raw);
  if (!existsSync(target)) throw new Error(`\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF1A${target}`);
  return target;
}
function firstLine(text) {
  return text.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? "";
}
function apply(ctx, config = {}) {
  const timeoutMs = Math.min(Math.max(config.timeoutMs ?? 2e4, 3e3), 12e4);
  const settingsPath = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "git-buttons.settings.json");
  const loadSettings = async () => {
    try {
      const parsed = JSON.parse(await readFile(settingsPath, "utf8"));
      return typeof parsed.githubToken === "string" ? { githubToken: parsed.githubToken } : {};
    } catch {
      return {};
    }
  };
  const saveSettings = async (patch) => {
    const current = await loadSettings();
    const next = { ...current, ...patch };
    if (next.githubToken === "") delete next.githubToken;
    await writeFile(settingsPath, `${JSON.stringify(next, null, 2)}
`, "utf8");
  };
  const github = async (token, path, init = {}) => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `token ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "dsh-git-buttons",
        ...init.body === void 0 ? {} : { "content-type": "application/json" }
      },
      body: init.body === void 0 ? void 0 : JSON.stringify(init.body)
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };
  const api = {
    /**
     * 在 GitHub 创建仓库（私有/公开），然后把当前分支推上去并设好 upstream。
     * push 用带 token 的一次性 URL，结束后仓库配置里只留干净的 https 地址。
     */
    "git.createRemote": async (payload) => {
      const cwd = requirePath(payload);
      const name2 = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(name2)) throw new Error("\u4ED3\u5E93\u540D\u53EA\u5141\u8BB8\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u3001\u77ED\u6A2A\u7EBF");
      const isPrivate = payload.private !== false;
      const description = typeof payload.description === "string" ? payload.description.trim() : "";
      const stored = await loadSettings();
      const token = typeof payload.token === "string" && payload.token.trim() !== "" ? payload.token.trim() : stored.githubToken ?? "";
      if (token === "") throw new Error("\u5148\u5728\u9762\u677F\u91CC\u586B GitHub Token \u5E76\u70B9\u300C\u4FDD\u5B58\u5E76\u9A8C\u8BC1\u300D");
      const me = await github(token, "/user");
      const login = typeof me.data.login === "string" ? me.data.login : "";
      if (me.status !== 200 || login === "") throw new Error("Token \u65E0\u6548\u6216\u6CA1\u6709\u6743\u9650\uFF08GET /user \u5931\u8D25\uFF09");
      const steps = [];
      const created = await github(token, "/user/repos", {
        method: "POST",
        body: { name: name2, private: isPrivate, description, auto_init: false }
      });
      if (created.status === 201) {
        steps.push(`\u5DF2\u5728 GitHub \u521B\u5EFA${isPrivate ? "\u79C1\u6709" : "\u516C\u5F00"}\u4ED3\u5E93\uFF1A${login}/${name2}`);
      } else if (created.status === 422) {
        steps.push(`\u4ED3\u5E93 ${login}/${name2} \u5DF2\u5B58\u5728\uFF0C\u76F4\u63A5\u590D\u7528`);
      } else {
        const message = typeof created.data.message === "string" ? created.data.message : `HTTP ${created.status}`;
        throw new Error(`\u521B\u5EFA\u4ED3\u5E93\u5931\u8D25\uFF1A${message}`);
      }
      const branchRes = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], timeoutMs);
      const branch = firstLine(branchRes.stdout);
      if (branch === "" || branch === "HEAD") throw new Error("\u5F53\u524D\u6CA1\u6709\u6709\u6548\u5206\u652F\uFF1A\u5148\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4");
      const cleanUrl = `https://github.com/${login}/${name2}.git`;
      await runGit(cwd, ["remote", "remove", "origin"], timeoutMs);
      const added = await runGit(cwd, ["remote", "add", "origin", cleanUrl], timeoutMs);
      if (added.code !== 0) throw new Error(`\u8BBE\u7F6E origin \u5931\u8D25\uFF1A${(added.stderr || added.stdout).trim()}`);
      steps.push(`origin \u2192 ${cleanUrl}`);
      const authedUrl = `https://x-access-token:${token}@github.com/${login}/${name2}.git`;
      const push = await runGit(cwd, ["push", authedUrl, `HEAD:refs/heads/${branch}`], Math.max(timeoutMs, 6e4));
      if (push.code !== 0) {
        const reason = (push.stderr || push.stdout).replaceAll(token, "***").trim().split("\n").slice(-3).join("\n");
        throw new Error(`\u63A8\u9001\u5931\u8D25\uFF1A${reason}`);
      }
      steps.push(`\u5DF2\u63A8\u9001 ${branch} \u5230\u8FDC\u7AEF`);
      await runGit(cwd, ["config", `branch.${branch}.remote`, "origin"], timeoutMs);
      await runGit(cwd, ["config", `branch.${branch}.merge`, `refs/heads/${branch}`], timeoutMs);
      steps.push(`\u5DF2\u8BBE\u7F6E upstream\uFF1Aorigin/${branch}`);
      return { ok: true, steps, repoUrl: cleanUrl, branch, visibility: isPrivate ? "private" : "public" };
    },
    /** 保存并验证 GitHub token（只回 masked 信息，不回传明文）。 */
    "git.githubToken": async (payload) => {
      const token = typeof payload.token === "string" ? payload.token.trim() : "";
      if (token === "") {
        await saveSettings({ githubToken: "" });
        return { ok: true, hasToken: false };
      }
      const me = await github(token, "/user");
      if (me.status !== 200 || typeof me.data.login !== "string") {
        throw new Error(`Token \u6821\u9A8C\u5931\u8D25\uFF08HTTP ${me.status}\uFF09\uFF1A${String(me.data.message ?? "")}`);
      }
      await saveSettings({ githubToken: token });
      return { ok: true, hasToken: true, login: me.data.login };
    },
    /** 当前 token 状态（不返回明文）。 */
    "git.githubStatus": async () => {
      const stored = await loadSettings();
      const token = stored.githubToken ?? "";
      if (token === "") return { ok: true, hasToken: false };
      const me = await github(token, "/user");
      return {
        ok: true,
        hasToken: true,
        valid: me.status === 200,
        login: typeof me.data.login === "string" ? me.data.login : "",
        masked: `${token.slice(0, 7)}\u2026${token.slice(-4)}`
      };
    },
    /** 空仓库的首次提交：写 .gitignore（无则写）+ 身份兜底 + add -A + commit。 */
    "git.firstCommit": async (payload) => {
      const cwd = requirePath(payload);
      const message = typeof payload.message === "string" && payload.message.trim() !== "" ? payload.message.trim() : "chore: initial commit";
      const probe = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], timeoutMs);
      if (probe.code !== 0) throw new Error("\u8FD9\u4E2A\u76EE\u5F55\u8FD8\u4E0D\u662F Git \u4ED3\u5E93\uFF0C\u8BF7\u5148\u70B9\u300C\u521D\u59CB\u5316\u4ED3\u5E93\u300D");
      const steps = [];
      const ignorePath = join(cwd, ".gitignore");
      if (!existsSync(ignorePath)) {
        await writeFile(ignorePath, DEFAULT_GITIGNORE, "utf8");
        steps.push("\u5DF2\u5199\u5165 .gitignore\uFF08node_modules/dist/build \u7B49\uFF09");
      }
      const email = await runGit(cwd, ["config", "--get", "user.email"], timeoutMs);
      if (email.code !== 0 || email.stdout.trim() === "") {
        await runGit(cwd, ["config", "user.name", "DSH User"], timeoutMs);
        await runGit(cwd, ["config", "user.email", "dsh@localhost"], timeoutMs);
        steps.push("\u5DF2\u8BBE\u7F6E\u4ED3\u5E93\u7EA7\u63D0\u4EA4\u8EAB\u4EFD\uFF1ADSH User <dsh@localhost>");
      }
      const staged = await runGit(cwd, ["add", "-A"], timeoutMs);
      if (staged.code !== 0) steps.push(`\u6682\u5B58\u6709\u8B66\u544A\uFF1A${(staged.stderr || staged.stdout).trim().split("\n")[0] ?? ""}`);
      const commit = await runGit(cwd, ["commit", "-m", message], timeoutMs);
      if (commit.code !== 0) {
        throw new Error(`\u63D0\u4EA4\u5931\u8D25\uFF1A${(commit.stderr || commit.stdout).trim().split("\n")[0] ?? "\u672A\u77E5\u539F\u56E0"}`);
      }
      steps.push(`\u5DF2\u63D0\u4EA4\uFF1A${message}`);
      const branch = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], timeoutMs);
      return { ok: true, steps, branch: firstLine(branch.stdout) };
    },
    /** 初始化仓库：git init（-b main）+ 写 .gitignore（不存在时）+ 首次提交。 */
    "git.init": async (payload) => {
      const cwd = requirePath(payload);
      const message = typeof payload.message === "string" && payload.message.trim() !== "" ? payload.message.trim() : "chore: init repository";
      const steps = [];
      const probe = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], timeoutMs);
      if (probe.code === 0) throw new Error("\u8BE5\u76EE\u5F55\u5DF2\u7ECF\u662F Git \u4ED3\u5E93\uFF0C\u65E0\u9700\u521D\u59CB\u5316");
      let init = await runGit(cwd, ["init", "-b", "main"], timeoutMs);
      if (init.code !== 0) init = await runGit(cwd, ["init"], timeoutMs);
      if (init.code !== 0) {
        throw new Error(`git init \u5931\u8D25\uFF1A${(init.stderr || init.stdout).trim() || `\u9000\u51FA\u7801 ${init.code}`}`);
      }
      steps.push("\u5DF2\u6267\u884C git init");
      const ignorePath = join(cwd, ".gitignore");
      if (!existsSync(ignorePath)) {
        await writeFile(ignorePath, DEFAULT_GITIGNORE, "utf8");
        steps.push("\u5DF2\u5199\u5165 .gitignore\uFF08node_modules/dist/build \u7B49\uFF09");
      }
      const email = await runGit(cwd, ["config", "--get", "user.email"], timeoutMs);
      if (email.code !== 0 || email.stdout.trim() === "") {
        await runGit(cwd, ["config", "user.name", "DSH User"], timeoutMs);
        await runGit(cwd, ["config", "user.email", "dsh@localhost"], timeoutMs);
        steps.push("\u5DF2\u8BBE\u7F6E\u4ED3\u5E93\u7EA7\u63D0\u4EA4\u8EAB\u4EFD\uFF1ADSH User <dsh@localhost>");
      }
      const staged = await runGit(cwd, ["add", "-A"], timeoutMs);
      if (staged.code !== 0) {
        steps.push(`\u6682\u5B58\u6709\u8B66\u544A\uFF1A${(staged.stderr || staged.stdout).trim().split("\n")[0] ?? ""}`);
      }
      const commit = await runGit(cwd, ["commit", "-m", message], timeoutMs);
      if (commit.code === 0) steps.push(`\u5DF2\u9996\u6B21\u63D0\u4EA4\uFF1A${message}`);
      else steps.push(`\u9996\u6B21\u63D0\u4EA4\u672A\u5B8C\u6210\uFF1A${(commit.stderr || commit.stdout).trim().split("\n")[0] ?? "\u672A\u77E5\u539F\u56E0"}`);
      const branch = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], timeoutMs);
      return { ok: true, steps, branch: firstLine(branch.stdout) };
    },
    /** 仓库概况：分支、upstream、ahead/behind、改动数、最近提交、是否 git 仓库。 */
    "git.info": async (payload) => {
      const cwd = requirePath(payload);
      const probe = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], timeoutMs);
      if (probe.code !== 0) {
        return {
          ok: true,
          isRepo: false,
          path: cwd,
          error: (probe.stderr || probe.stdout || `git \u9000\u51FA\u7801 ${probe.code}`).trim()
        };
      }
      const [branch, status, log, branches, remotes] = await Promise.all([
        runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], timeoutMs),
        runGit(cwd, ["status", "--porcelain=v1", "-b"], timeoutMs),
        runGit(cwd, ["log", "--oneline", "-10", "--decorate"], timeoutMs),
        runGit(cwd, ["branch", "--format=%(refname:short)"], timeoutMs),
        runGit(cwd, ["remote", "-v"], timeoutMs)
      ]);
      const statusLines = status.stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
      const header = statusLines.find((line) => line.startsWith("##")) ?? "";
      const changes = statusLines.filter((line) => !line.startsWith("##"));
      const ahead = /ahead (\d+)/.exec(header)?.[1] ?? "0";
      const behind = /behind (\d+)/.exec(header)?.[1] ?? "0";
      const upstream = /\.\.\.(\S+)/.exec(header)?.[1] ?? "";
      return {
        ok: true,
        isRepo: true,
        path: cwd,
        branch: firstLine(branch.stdout) || "(detached)",
        upstream,
        ahead: Number(ahead),
        behind: Number(behind),
        changes: changes.length,
        changeList: changes.slice(0, 200),
        commits: log.stdout.split(/\r?\n/).filter((line) => line.trim() !== ""),
        branches: branches.stdout.split(/\r?\n/).filter((line) => line.trim() !== ""),
        remotes: remotes.stdout.split(/\r?\n/).filter((line) => line.trim() !== "")
      };
    },
    /**
     * 设置远端并首次推送：可选 url →（add 或 set-url origin）→ git push -u origin <branch>。
     * 这是 upstream 唯一需要手动指定一次的步骤，之后 push 直接可用。
     */
    "git.publish": async (payload) => {
      const cwd = requirePath(payload);
      const url = typeof payload.url === "string" ? payload.url.trim() : "";
      const steps = [];
      const branchRes = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], timeoutMs);
      const branch = firstLine(branchRes.stdout);
      if (branch === "" || branch === "HEAD") {
        throw new Error("\u5F53\u524D\u6CA1\u6709\u6709\u6548\u5206\u652F\uFF08\u53EF\u80FD\u8FD8\u6CA1\u6709\u63D0\u4EA4\uFF09\uFF1A\u5148\u70B9\u300C\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4\u300D");
      }
      if (url !== "") {
        if (!/^(https?:\/\/|ssh:\/\/|git@|file:\/\/)/.test(url)) {
          throw new Error("\u8FDC\u7AEF\u5730\u5740\u9700\u4EE5 https:// \u3001ssh:// \u3001file:// \u6216 git@ \u5F00\u5934");
        }
        const existing = await runGit(cwd, ["remote", "get-url", "origin"], timeoutMs);
        const changed = existing.code === 0 ? await runGit(cwd, ["remote", "set-url", "origin", url], timeoutMs) : await runGit(cwd, ["remote", "add", "origin", url], timeoutMs);
        if (changed.code !== 0) {
          throw new Error(`\u8BBE\u7F6E origin \u5931\u8D25\uFF1A${(changed.stderr || changed.stdout).trim().split("\n")[0] ?? ""}`);
        }
        steps.push(existing.code === 0 ? `\u5DF2\u66F4\u65B0 origin \u2192 ${url}` : `\u5DF2\u6DFB\u52A0 origin \u2192 ${url}`);
      } else {
        const hasRemote = await runGit(cwd, ["remote", "get-url", "origin"], timeoutMs);
        if (hasRemote.code !== 0) throw new Error("\u8FD8\u6CA1\u6709\u914D\u7F6E origin\uFF1A\u8BF7\u5728\u8F93\u5165\u6846\u586B\u8FDC\u7AEF\u5730\u5740\uFF08\u5982 https://github.com/user/repo.git\uFF09");
      }
      const push = await runGit(cwd, ["push", "-u", "origin", branch], timeoutMs);
      steps.push(`git push -u origin ${branch}\uFF08\u9000\u51FA\u7801 ${push.code}\uFF09`);
      return {
        ok: push.code === 0,
        branch,
        steps,
        stdout: push.stdout.trimEnd(),
        stderr: push.stderr.trimEnd()
      };
    },
    /** 执行一个白名单 git 动作。 */
    "git.run": async (payload) => {
      const cwd = requirePath(payload);
      const action = typeof payload.action === "string" ? payload.action.trim() : "";
      const rawArgs = Array.isArray(payload.args) ? payload.args.filter((item) => typeof item === "string") : [];
      const argv = gitArgv(action, rawArgs);
      if (argv === null) throw new Error(`\u4E0D\u652F\u6301\u7684\u52A8\u4F5C\u6216\u53C2\u6570\u4E0D\u5408\u6CD5\uFF1A${action}`);
      let result = await runGit(cwd, argv, timeoutMs);
      let command = `git ${argv.join(" ")}`;
      if (action === "unstage_file" && result.code !== 0 && result.stderr.includes("could not resolve 'HEAD'")) {
        const target = safeRelPath(rawArgs[0] ?? "");
        if (target !== null) {
          result = await runGit(cwd, ["rm", "--cached", "--", target], timeoutMs);
          command = `git rm --cached -- ${target}`;
        }
      }
      return {
        ok: result.code === 0,
        action,
        command,
        code: result.code,
        stdout: result.stdout.trimEnd(),
        stderr: result.stderr.trimEnd()
      };
    },
    /** 目录浏览（给「选择…」用，只返回目录）。 */
    "fs.list": async (payload) => {
      const raw = typeof payload.path === "string" ? payload.path.trim() : "";
      if (raw === "") {
        const drives = [];
        for (let code = 65; code <= 90; code += 1) {
          const letter = `${String.fromCharCode(code)}:\\`;
          if (existsSync(letter)) drives.push({ name: letter, path: letter });
        }
        return { ok: true, path: "", parent: null, directories: drives };
      }
      const target = resolve(raw);
      const info = await stat(target).catch(() => void 0);
      if (info === void 0) throw new Error(`\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF1A${target}`);
      if (!info.isDirectory()) throw new Error(`\u4E0D\u662F\u76EE\u5F55\uFF1A${target}`);
      const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
      const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules").map((entry) => ({ name: entry.name, path: join(target, entry.name) })).sort((a, b) => a.name.localeCompare(b.name));
      const parent = dirname(target) === target ? "" : dirname(target);
      return { ok: true, path: target, parent, directories };
    }
  };
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/git-buttons/api",
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req);
      if (rejection !== void 0) {
        writeJson(res, 403, { ok: false, error: "forbidden" });
        return;
      }
      if ((req.method ?? "").toUpperCase() !== "POST") {
        writeJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
      const method = pathname.startsWith("/git-buttons/api/") ? pathname.slice("/git-buttons/api/".length) : "";
      if (method === "" || method.includes("/")) {
        writeJson(res, 404, { ok: false, error: "unknown method" });
        return;
      }
      const handlerFor = Object.hasOwn(api, method) ? api[method] : void 0;
      if (handlerFor === void 0) {
        writeJson(res, 404, { ok: false, error: `unknown method "${method}"` });
        return;
      }
      try {
        const payload = await readJsonBody(req);
        writeJson(res, 200, await handlerFor(payload));
      } catch (error) {
        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }), "git-buttons: /git-buttons/api routes");
  ctx.logger.info("git-buttons: \u5DF2\u6302\u8F7D /git-buttons/api");
}
export {
  apply,
  inject,
  name
};
