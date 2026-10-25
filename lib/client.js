window.__ModuleLoader__.load({ id: '@dsh-external/dsh-git-buttons', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../.dsh/plugins-src/dsh-git-buttons/src/client/index.ts
var index_exports = {};
__export(index_exports, {
  GitButtonsView: () => GitButtonsView,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var React = __toESM(require("react"), 1);
var name = "git-buttons-client";
var inject = ["slots"];
var API_BASE = "git-buttons/api/";
async function callRaw(method, body = {}) {
  const base = typeof document === "undefined" ? "http://127.0.0.1/" : document.baseURI;
  const response = await fetch(new URL(API_BASE + method, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body ?? {})
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: `HTTP ${response.status}` };
  }
  if (!response.ok) {
    const message = data.error;
    throw new Error(String(message ?? `HTTP ${response.status}`));
  }
  return data;
}
var S = {
  wrap: { display: "flex", flexDirection: "column", gap: 12, padding: "12px 2px 24px 2px" },
  card: {
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  label: { fontSize: 12, opacity: 0.7, minWidth: 64 },
  input: {
    flex: "1 1 260px",
    minWidth: 0,
    fontSize: 13,
    padding: "6px 9px",
    borderRadius: 7,
    border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
    background: "color-mix(in srgb, currentColor 4%, transparent)",
    color: "inherit",
    outline: "none"
  },
  button: {
    fontSize: 12.5,
    padding: "6px 11px",
    borderRadius: 7,
    border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
    background: "color-mix(in srgb, currentColor 8%, transparent)",
    color: "inherit",
    cursor: "pointer"
  },
  primary: {
    fontSize: 12.5,
    padding: "6px 13px",
    borderRadius: 7,
    border: "1px solid transparent",
    background: "color-mix(in srgb, #4d6bfe 88%, transparent)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer"
  },
  hint: { fontSize: 12, lineHeight: 1.6, opacity: 0.62, margin: 0 },
  pre: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 8,
    background: "color-mix(in srgb, currentColor 5%, transparent)",
    border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: 260,
    overflow: "auto"
  },
  badge: (tone) => ({
    fontSize: 11.5,
    padding: "2px 8px",
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${tone === "ok" ? "#2f9e44" : tone === "warn" ? "#f08c00" : "#e03131"} 45%, transparent)`,
    background: `color-mix(in srgb, ${tone === "ok" ? "#2f9e44" : tone === "warn" ? "#f08c00" : "#e03131"} 12%, transparent)`
  })
};
var PICKER = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  },
  modal: {
    width: 540,
    maxWidth: "92vw",
    maxHeight: "80vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "16px 18px",
    borderRadius: 12,
    background: "var(--dsh-surface, #1e1f22)",
    color: "var(--dsh-text, #e6e6e6)",
    border: "1px solid color-mix(in srgb, currentColor 18%, transparent)"
  },
  entry: {
    textAlign: "left",
    fontSize: 13,
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: "inherit",
    cursor: "pointer"
  }
};
function DirectoryPicker(props) {
  const [path, setPath] = React.useState(props.initial);
  const [parent, setParent] = React.useState(null);
  const [dirs, setDirs] = React.useState([]);
  const [jump, setJump] = React.useState(props.initial);
  const [error, setError] = React.useState("");
  const load = async (target) => {
    try {
      const data = await callRaw(
        "fs.list",
        { path: target }
      );
      setPath(data.path);
      setParent(data.parent);
      setDirs(data.directories ?? []);
      setJump(data.path);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  React.useEffect(() => {
    void load(props.initial);
  }, []);
  return React.createElement(
    "div",
    { style: PICKER.overlay },
    React.createElement(
      "div",
      { style: PICKER.modal },
      React.createElement(
        "div",
        { style: { ...S.row, justifyContent: "space-between" } },
        React.createElement("strong", { style: { fontSize: 13 } }, "\u9009\u62E9 Git \u4ED3\u5E93\u76EE\u5F55"),
        React.createElement("button", { style: S.button, onClick: props.onClose }, "\u5173\u95ED")
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: jump,
          placeholder: "\u7C98\u8D34\u7EDD\u5BF9\u8DEF\u5F84\u540E\u56DE\u8F66",
          onChange: (event) => setJump(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") void load(jump);
          }
        }),
        React.createElement("button", { style: S.button, onClick: () => void load(jump) }, "\u8DF3\u8F6C"),
        React.createElement("button", { style: S.button, onClick: () => void load("") }, "\u78C1\u76D8")
      ),
      React.createElement("p", { style: S.hint }, path === "" ? "\u9009\u62E9\u78C1\u76D8" : path),
      error === "" ? null : React.createElement("p", { style: { ...S.hint, color: "#e03131" } }, error),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 1, maxHeight: 300, overflow: "auto" } },
        parent === null ? null : React.createElement("button", { style: PICKER.entry, onClick: () => void load(parent) }, "\u2B06 \u4E0A\u4E00\u7EA7"),
        ...dirs.map((dir) => React.createElement("button", { key: dir.path, style: PICKER.entry, onClick: () => void load(dir.path) }, `\u{1F4C1} ${dir.name}`))
      ),
      React.createElement(
        "div",
        { style: { ...S.row, justifyContent: "flex-end" } },
        React.createElement("button", { style: S.primary, disabled: path === "", onClick: () => props.onPick(path) }, "\u9009\u62E9\u6B64\u76EE\u5F55")
      )
    )
  );
}
function GitButtonsView(props) {
  const [repo, setRepo] = React.useState("");
  const [info, setInfo] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [branchName, setBranchName] = React.useState("");
  const [remoteUrl, setRemoteUrl] = React.useState("");
  const [githubToken, setGithubToken] = React.useState("");
  const [ghLogin, setGhLogin] = React.useState("");
  const [ghMasked, setGhMasked] = React.useState("");
  const [repoName, setRepoName] = React.useState("");
  const [repoPrivate, setRepoPrivate] = React.useState(true);
  const [repoDesc, setRepoDesc] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [picker, setPicker] = React.useState(false);
  const [err, setErr] = React.useState("");
  const refresh = async (target) => {
    if (target.trim() === "") {
      setInfo(null);
      return;
    }
    try {
      const data = await callRaw("git.info", { path: target });
      setInfo(data);
      setErr("");
    } catch (caught) {
      setInfo(null);
      setErr(caught instanceof Error ? caught.message : String(caught));
    }
  };
  React.useEffect(() => {
    void (async () => {
      try {
        const status = await callRaw("git.githubStatus");
        if (status.hasToken) {
          setGhMasked(status.masked ?? "");
          if (status.valid === true) setGhLogin(status.login ?? "");
        }
      } catch {
      }
      const sessionId = props?.sessionId ?? "";
      if (sessionId === "") return;
      try {
        const resolved = await fetch(new URL("backup-sync/api/session.project", document.baseURI), {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId })
        }).then((response) => response.ok ? response.json() : { projectPath: "" });
        const projectPath = resolved.projectPath ?? "";
        if (projectPath !== "") {
          setRepo(projectPath);
          setRepoName(projectPath.split(/[\\/]/).filter((part) => part !== "").pop() ?? "");
          await refresh(projectPath);
        }
      } catch {
      }
    })();
  }, []);
  const run = async (label, action, args = []) => {
    if (repo.trim() === "") {
      setOutput("\u5148\u9009\u62E9\u4ED3\u5E93\u76EE\u5F55");
      return;
    }
    setBusy(label);
    setErr("");
    try {
      const result = await callRaw("git.run", {
        path: repo,
        action,
        args
      });
      const text = [result.command, result.stdout, result.stderr].filter((part) => part !== "").join("\n");
      setOutput(`${result.ok ? "\u2714" : `\u2718 \u9000\u51FA\u7801 ${result.code}`}
${text}`);
      await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const disabled = busy !== "";
  const isRepo = info?.isRepo === true;
  const changeCount = info?.changes ?? 0;
  const tone = !isRepo ? "bad" : changeCount > 0 ? "warn" : "ok";
  const parseChange = (line) => ({
    code: line.slice(0, 2).trim(),
    path: line.slice(3).trim()
  });
  const initRepo = async () => {
    setBusy("init");
    setErr("");
    try {
      const result = await callRaw("git.init", { path: repo, message });
      setOutput(["\u2714 \u4ED3\u5E93\u5DF2\u521D\u59CB\u5316", ...result.steps, `\u5F53\u524D\u5206\u652F\uFF1A${result.branch}`].join("\n"));
      await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const firstCommit = async () => {
    setBusy("first");
    setErr("");
    try {
      const result = await callRaw("git.firstCommit", {
        path: repo,
        message
      });
      setOutput(["\u2714 \u9996\u6B21\u63D0\u4EA4\u5B8C\u6210", ...result.steps, `\u5F53\u524D\u5206\u652F\uFF1A${result.branch}`].join("\n"));
      await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const saveToken = async () => {
    setBusy("token");
    setErr("");
    try {
      const result = await callRaw("git.githubToken", { token: githubToken });
      if (result.hasToken) {
        setGhLogin(result.login ?? "");
        setGhMasked(`${githubToken.slice(0, 7)}\u2026${githubToken.slice(-4)}`);
        setOutput(`\u2714 Token \u5DF2\u4FDD\u5B58\u5E76\u9A8C\u8BC1\uFF1A${result.login ?? ""}`);
      } else {
        setGhLogin("");
        setGhMasked("");
        setOutput("\u5DF2\u6E05\u9664 GitHub Token");
      }
      setGithubToken("");
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const createRemote = async () => {
    setBusy("create");
    setErr("");
    try {
      const result = await callRaw("git.createRemote", {
        path: repo,
        name: repoName.trim(),
        private: repoPrivate,
        description: repoDesc.trim()
      });
      setOutput([
        `\u2714 \u5DF2\u5728 GitHub \u521B\u5EFA${result.visibility === "private" ? "\u79C1\u6709" : "\u516C\u5F00"}\u4ED3\u5E93\u5E76\u63A8\u9001`,
        ...result.steps,
        result.repoUrl
      ].join("\n"));
      setRemoteUrl(result.repoUrl);
      await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const publish = async () => {
    setBusy("publish");
    setErr("");
    try {
      const result = await callRaw(
        "git.publish",
        { path: repo, url: remoteUrl.trim() }
      );
      const body = [result.stdout, result.stderr].filter((part) => part !== "").join("\n");
      setOutput([result.ok ? "\u2714 \u5DF2\u63A8\u9001\u5E76\u8BBE\u7F6E upstream" : "\u2718 \u63A8\u9001\u5931\u8D25", ...result.steps, body].filter((part) => part !== "").join("\n"));
      await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  const fileAction = async (label, action, target) => {
    setBusy(`${label}:${target}`);
    try {
      const result = await callRaw("git.run", {
        path: repo,
        action,
        args: [target]
      });
      const body = [result.stdout, result.stderr].filter((part) => part !== "").join("\n");
      setOutput([`${result.ok ? "\u2714" : `\u2718 \u9000\u51FA\u7801 ${result.code}`} ${result.command}`, body].filter((part) => part !== "").join("\n"));
      if (action !== "diff_file" && action !== "diff_file_staged") await refresh(repo);
    } catch (caught) {
      setOutput(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy("");
    }
  };
  return React.createElement(
    "div",
    { style: S.wrap },
    React.createElement(
      "div",
      { style: S.card },
      React.createElement(
        "div",
        { style: { ...S.row, justifyContent: "space-between" } },
        React.createElement(
          "div",
          { style: S.row },
          React.createElement("strong", { style: { fontSize: 13 } }, "Git \u64CD\u4F5C"),
          React.createElement(
            "span",
            { style: S.badge(tone) },
            !isRepo ? "\u4E0D\u662F Git \u4ED3\u5E93 / git \u4E0D\u53EF\u7528" : changeCount > 0 ? `${changeCount} \u9879\u6539\u52A8` : "\u5DE5\u4F5C\u533A\u5E72\u51C0"
          ),
          isRepo ? React.createElement("span", { style: S.badge("ok") }, `\u5206\u652F ${info?.branch ?? "?"}`) : null,
          isRepo && (info?.ahead ?? 0) > 0 ? React.createElement("span", { style: S.badge("warn") }, `\u2191${info?.ahead}`) : null,
          isRepo && (info?.behind ?? 0) > 0 ? React.createElement("span", { style: S.badge("warn") }, `\u2193${info?.behind}`) : null
        ),
        React.createElement(
          "button",
          { style: S.button, onClick: () => setPicker(true) },
          "\u9009\u62E9\u4ED3\u5E93\u2026"
        )
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("span", { style: S.label }, "\u4ED3\u5E93\u8DEF\u5F84"),
        React.createElement("input", {
          style: S.input,
          value: repo,
          placeholder: "\u9009\u4E2D\u5305\u542B .git \u7684\u76EE\u5F55",
          onChange: (event) => setRepo(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") void refresh(repo);
          }
        }),
        React.createElement("button", { style: S.button, disabled, onClick: () => void refresh(repo) }, "\u5237\u65B0\u72B6\u6001")
      ),
      err === "" ? null : React.createElement("p", { style: { ...S.hint, color: "#e03131" } }, err),
      isRepo && info?.error !== void 0 ? React.createElement("p", { style: { ...S.hint, color: "#e03131" } }, info.error) : null
    ),
    isRepo ? null : React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u521D\u59CB\u5316\u4ED3\u5E93"),
      React.createElement(
        "p",
        { style: S.hint },
        "\u8FD9\u4E2A\u76EE\u5F55\u8FD8\u4E0D\u662F Git \u4ED3\u5E93\u3002\u70B9\u4E0B\u9762\u7684\u6309\u94AE\u4F1A\uFF1Agit init\uFF08\u5206\u652F main\uFF09\u2192 \u5199\u5165 .gitignore\uFF08node_modules/dist/build \u7B49\uFF0C\u5DF2\u5B58\u5728\u5219\u4E0D\u8986\u76D6\uFF09\u2192 \u6682\u5B58\u5168\u90E8 \u2192 \u9996\u6B21\u63D0\u4EA4\u3002"
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: message,
          placeholder: "\u9996\u6B21\u63D0\u4EA4\u4FE1\u606F\uFF08\u7559\u7A7A = chore: init repository\uFF09",
          onChange: (event) => setMessage(event.target.value)
        }),
        React.createElement(
          "button",
          { style: S.primary, disabled: disabled || repo.trim() === "", onClick: () => void initRepo() },
          busy === "init" ? "\u521D\u59CB\u5316\u4E2D\u2026" : "\u521D\u59CB\u5316\u4ED3\u5E93"
        )
      )
    ),
    isRepo && (info?.commits ?? []).length === 0 ? React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u9996\u6B21\u63D0\u4EA4"),
      React.createElement(
        "p",
        { style: S.hint },
        "\u8FD9\u662F\u7A7A\u4ED3\u5E93\uFF08\u6709 .git\uFF0C\u4F46\u8FD8\u6CA1\u6709\u4EFB\u4F55\u63D0\u4EA4\uFF09\u3002\u70B9\u6309\u94AE\u4F1A\uFF1A\u5199 .gitignore\uFF08\u65E0\u5219\u5199\uFF09\u2192 \u8BBE\u7F6E\u4ED3\u5E93\u7EA7\u63D0\u4EA4\u8EAB\u4EFD \u2192 \u6682\u5B58\u5168\u90E8 \u2192 \u9996\u6B21\u63D0\u4EA4\u3002"
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: message,
          placeholder: "\u9996\u6B21\u63D0\u4EA4\u4FE1\u606F\uFF08\u7559\u7A7A = chore: initial commit\uFF09",
          onChange: (event) => setMessage(event.target.value)
        }),
        React.createElement(
          "button",
          { style: S.primary, disabled: disabled || repo.trim() === "", onClick: () => void firstCommit() },
          busy === "first" ? "\u63D0\u4EA4\u4E2D\u2026" : "\u521B\u5EFA\u9996\u6B21\u63D0\u4EA4"
        )
      )
    ) : null,
    React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u63D0\u4EA4"),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: message,
          placeholder: "\u63D0\u4EA4\u4FE1\u606F\uFF08\u5FC5\u586B\uFF09",
          onChange: (event) => setMessage(event.target.value)
        }),
        React.createElement(
          "button",
          {
            style: S.primary,
            disabled: disabled || message.trim() === "",
            onClick: () => void run("commit", "commit", [message]).then(() => setMessage(""))
          },
          busy === "commit" ? "\u63D0\u4EA4\u4E2D\u2026" : "\u6682\u5B58\u5168\u90E8\u5E76\u63D0\u4EA4"
        )
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("add_all", "add_all") }, "\u6682\u5B58\u5168\u90E8"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("amend", "amend", [message]) }, "\u6539\u5199\u4E0A\u6B21\u63D0\u4EA4"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("diff", "diff_stat") }, "\u6539\u52A8\u7EDF\u8BA1"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("log", "log") }, "\u6700\u8FD1 20 \u6761\u63D0\u4EA4")
      ),
      React.createElement(
        "p",
        { style: S.hint },
        "\u300C\u6682\u5B58\u5168\u90E8\u5E76\u63D0\u4EA4\u300D= git add -A + git commit -m\uFF1B\u300C\u6539\u5199\u4E0A\u6B21\u63D0\u4EA4\u300D= git commit --amend\uFF08\u6709\u8F93\u5165\u4FE1\u606F\u5C31\u66FF\u6362\u539F\u4FE1\u606F\uFF09\u3002"
      )
    ),
    React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u521B\u5EFA\u8FDC\u7AEF\u4ED3\u5E93\uFF08GitHub\uFF09"),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("span", { style: S.label }, "Token"),
        React.createElement("input", {
          style: S.input,
          type: "password",
          value: githubToken,
          placeholder: ghMasked === "" ? "ghp_\u2026\uFF08\u9700 repo \u6743\u9650\uFF09" : `\u5DF2\u4FDD\u5B58 ${ghMasked}\uFF08\u7559\u7A7A\u5219\u4E0D\u6539\uFF09`,
          onChange: (event) => setGithubToken(event.target.value)
        }),
        React.createElement(
          "button",
          { style: S.button, disabled, onClick: () => void saveToken() },
          busy === "token" ? "\u9A8C\u8BC1\u4E2D\u2026" : "\u4FDD\u5B58\u5E76\u9A8C\u8BC1"
        ),
        ghLogin === "" ? null : React.createElement("span", { style: S.badge("ok") }, `\u5DF2\u767B\u5F55 ${ghLogin}`)
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: repoName,
          placeholder: "\u4ED3\u5E93\u540D\uFF08\u5982 my-project\uFF09",
          onChange: (event) => setRepoName(event.target.value)
        }),
        React.createElement(
          "select",
          {
            style: { ...S.input, flex: "0 0 150px" },
            value: repoPrivate ? "private" : "public",
            onChange: (event) => setRepoPrivate(event.target.value === "private")
          },
          React.createElement("option", { value: "private" }, "\u79C1\u6709 Private"),
          React.createElement("option", { value: "public" }, "\u516C\u5F00 Public")
        ),
        React.createElement(
          "button",
          {
            style: S.primary,
            disabled: disabled || repo.trim() === "" || repoName.trim() === "",
            onClick: () => void createRemote()
          },
          busy === "create" ? "\u521B\u5EFA\u4E2D\u2026" : "\u5728 GitHub \u521B\u5EFA\u5E76\u63A8\u9001"
        )
      ),
      React.createElement("input", {
        style: S.input,
        value: repoDesc,
        placeholder: "\u4ED3\u5E93\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09",
        onChange: (event) => setRepoDesc(event.target.value)
      }),
      React.createElement(
        "p",
        { style: S.hint },
        "\u5728\u4F60\u7684 GitHub \u8D26\u53F7\u4E0B\u521B\u5EFA\u4ED3\u5E93\uFF08\u53EF\u9009\u79C1\u6709/\u516C\u5F00\uFF09\u2192 \u8BBE origin \u2192 \u63A8\u9001\u5F53\u524D\u5206\u652F \u2192 \u8BBE\u597D upstream\u3002Token \u5B58\u5728 $DSH_HOME/git-buttons.settings.json\uFF08\u660E\u6587\uFF0C\u6CE8\u610F\u4FDD\u7BA1\uFF09\u3002"
      )
    ),
    React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u8FDC\u7AEF"),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("fetch", "fetch") }, busy === "fetch" ? "\u6293\u53D6\u4E2D\u2026" : "\u6293\u53D6 fetch"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("pull", "pull") }, busy === "pull" ? "\u62C9\u53D6\u4E2D\u2026" : "\u62C9\u53D6 pull --ff-only"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("push", "push") }, busy === "push" ? "\u63A8\u9001\u4E2D\u2026" : "\u63A8\u9001 push")
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("input", {
          style: S.input,
          value: remoteUrl,
          placeholder: "\u8FDC\u7AEF\u5730\u5740\uFF0C\u5982 https://github.com/you/repo.git",
          onChange: (event) => setRemoteUrl(event.target.value)
        }),
        React.createElement(
          "button",
          { style: S.primary, disabled: disabled || repo.trim() === "", onClick: () => void publish() },
          busy === "publish" ? "\u63A8\u9001\u4E2D\u2026" : "\u8BBE\u7F6E\u8FDC\u7AEF\u5E76\u63A8\u9001\uFF08-u\uFF09"
        )
      ),
      React.createElement(
        "p",
        { style: S.hint },
        info?.upstream === "" || info?.upstream === void 0 ? "\u5F53\u524D\u5206\u652F\u8FD8\u6CA1\u6709 upstream\uFF1A\u4E0A\u9762\u586B\u8FDC\u7AEF\u5730\u5740 \u2192 \u70B9\u300C\u8BBE\u7F6E\u8FDC\u7AEF\u5E76\u63A8\u9001\uFF08-u\uFF09\u300D\uFF0C\u4E4B\u540E\u300C\u63A8\u9001 push\u300D\u5C31\u80FD\u76F4\u63A5\u7528\u3002" : `upstream\uFF1A${info.upstream}\uFF08\u8FDC\u7AEF\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u76F4\u63A5 push\uFF09`
      ),
      (info?.remotes ?? []).length === 0 ? null : React.createElement("pre", { style: S.pre }, (info?.remotes ?? []).join("\n"))
    ),
    React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, "\u5206\u652F\u4E0E\u8D2E\u85CF"),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement(
          "select",
          {
            style: { ...S.input, flex: "0 0 200px" },
            value: "",
            onChange: (event) => {
              const target = event.target.value;
              if (target !== "") void run("switch", "switch", [target]);
            }
          },
          React.createElement("option", { value: "" }, `\u5207\u6362\u5206\u652F\uFF08\u5F53\u524D ${info?.branch ?? "?"}\uFF09`),
          ...(info?.branches ?? []).map((item) => React.createElement("option", { key: item, value: item }, item))
        ),
        React.createElement("input", {
          style: { ...S.input, flex: "0 0 180px" },
          value: branchName,
          placeholder: "\u65B0\u5206\u652F\u540D",
          onChange: (event) => setBranchName(event.target.value)
        }),
        React.createElement(
          "button",
          { style: S.button, disabled: disabled || branchName.trim() === "", onClick: () => void run("switch_create", "switch_create", [branchName]).then(() => setBranchName("")) },
          "\u65B0\u5EFA\u5E76\u5207\u6362"
        ),
        React.createElement(
          "button",
          { style: S.button, disabled: disabled || branchName.trim() === "", onClick: () => void run("merge", "merge", [branchName]) },
          "\u5408\u5E76\u5230\u5F53\u524D"
        )
      ),
      React.createElement(
        "div",
        { style: S.row },
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("stash_push", "stash_push") }, "\u8D2E\u85CF\uFF08\u542B\u672A\u8DDF\u8E2A\uFF09"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("stash_pop", "stash_pop") }, "\u53D6\u56DE\u8D2E\u85CF"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("stash_list", "stash_list") }, "\u8D2E\u85CF\u5217\u8868"),
        React.createElement("button", { style: S.button, disabled, onClick: () => void run("reset_soft", "reset_soft") }, "\u64A4\u9500\u4E0A\u6B21\u63D0\u4EA4\uFF08\u4FDD\u7559\u6539\u52A8\uFF09")
      )
    ),
    output === "" ? null : React.createElement("pre", { style: S.pre }, output),
    isRepo && (info?.changeList ?? []).length > 0 ? React.createElement(
      "div",
      { style: S.card },
      React.createElement("strong", { style: { fontSize: 12.5, opacity: 0.85 } }, `\u672A\u63D0\u4EA4\u6539\u52A8\uFF08${info?.changeList?.length ?? 0}\uFF09`),
      ...(info?.changeList ?? []).slice(0, 200).map((line) => {
        const change = parseChange(line);
        const untracked = change.code.includes("??");
        return React.createElement(
          "div",
          {
            key: line,
            style: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "3px 0" }
          },
          React.createElement(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center", minWidth: 0 } },
            React.createElement(
              "span",
              { style: { ...S.badge(untracked ? "warn" : "ok"), fontFamily: "ui-monospace", minWidth: 28, textAlign: "center" } },
              change.code || "\xB7"
            ),
            React.createElement(
              "span",
              { style: { fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" } },
              change.path
            )
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 6, flexShrink: 0 } },
            React.createElement(
              "button",
              { style: S.button, disabled, onClick: () => void fileAction("stage", "stage_file", change.path) },
              "\u6682\u5B58"
            ),
            React.createElement(
              "button",
              { style: S.button, disabled, onClick: () => void fileAction("unstage", "unstage_file", change.path) },
              "\u53D6\u6D88\u6682\u5B58"
            ),
            React.createElement(
              "button",
              {
                style: S.button,
                disabled: disabled || untracked,
                title: untracked ? "\u672A\u8DDF\u8E2A\u6587\u4EF6\u6CA1\u6709 diff\uFF0C\u5148\u6682\u5B58\u518D\u770B" : "\u67E5\u770B\u8BE5\u6587\u4EF6\u7684\u5DEE\u5F02",
                onClick: () => void fileAction("diff", "diff_file", change.path)
              },
              "\u5DEE\u5F02"
            )
          )
        );
      })
    ) : null,
    picker ? React.createElement(DirectoryPicker, {
      initial: repo,
      onPick: (picked) => {
        setPicker(false);
        setRepo(picked);
        void refresh(picked);
      },
      onClose: () => setPicker(false)
    }) : null
  );
}
function apply(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "git-buttons",
    order: 110,
    label: () => "Git",
    inject: (sessionId) => ({ sessionId })
  }, GitButtonsView));
}
return module.exports; } });
