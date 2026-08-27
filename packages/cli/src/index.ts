#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { autoSlug, getCollections, HyacineApiError, HyacineClient } from "@hyacine/contract";
import { Command } from "commander";
import matter from "gray-matter";
import { generateCollectionsFile } from "./collections/generate";
import { findProjectRoot, loadProjectConfig, resolveProjectId } from "./config/project";
import { hasUpToDateSummary, materializeSummary } from "./frontmatter";
import { t } from "./i18n";
import { isRemoteConfigured, loadRemoteState, saveRemoteState } from "./remote/state";
import { createBackup } from "./services/backup";
import { findBuildCommand, runCommand } from "./services/build";
import { gitAddAll, gitCommit, gitPush, isGitRepo } from "./services/git";
import { installBlog } from "./services/install";
import { createPost, findPostByQuery, scanPosts } from "./services/posts";
import { buildSyncPayload, chunkText } from "./services/sync";

const program = new Command();
program
  .name("hyc")
  .description("hyacine CLI")
  .version(__VERSION__)
  .option("--local", "force local mode", false)
  .option("--json", "json output", false);

function getProjectInfo() {
  const root = findProjectRoot();
  if (root === null) {
    console.error(t("error.notInProject"));
    process.exit(1);
  }
  const config = loadProjectConfig(root);
  return { root, config };
}

function isRemoteMode(): boolean {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- commander opts
  const opts = program.opts() as { local?: boolean };
  if (opts.local === true) return false;
  const state = loadRemoteState();
  return isRemoteConfigured(state);
}

function requireRemote(): { url: string; token: string } {
  const state = loadRemoteState();
  if (!isRemoteConfigured(state) || state.apiUrl === undefined || state.apiToken === undefined) {
    console.error(t("error.remoteOnly"));
    process.exit(1);
  }
  return { url: state.apiUrl, token: state.apiToken };
}

function getClient(): HyacineClient {
  const { url, token } = requireRemote();
  return new HyacineClient({ baseUrl: url, token });
}

function handleApiError(err: unknown): never {
  if (err instanceof HyacineApiError) {
    if (err.code === "network_error") {
      console.error(t("error.network"));
    } else if (err.code === "unauthorized" || err.status === 401) {
      console.error(t("error.unauthorized"));
    } else if (err.code === "PROJECT_MISMATCH" || err.status === 409) {
      console.error(`\x1b[31m[项目身份不匹配 (409 Conflict)]\x1b[0m ${err.message}`);
      console.error(`\x1b[33m提示：如确定需要将当前本地项目绑定并覆盖远程，请执行：\x1b[0m`);
      console.error(`  hyc sync --force --rebind-project （需持有 admin 权限令牌）`);
    } else if (err.code === "DELETION_THRESHOLD_EXCEEDED" || err.status === 422) {
      console.error(`\x1b[31m[大批量删除熔断保护 (422)]\x1b[0m ${err.message}`);
      console.error(`\x1b[33m提示：如确定需要批量下架/删除这些文章，请执行：\x1b[0m`);
      console.error(`  hyc sync --allow-batch-delete`);
    } else {
      console.error(`${err.code}: ${err.message}`);
    }
    process.exit(1);
  }
  if (err instanceof Error) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(String(err));
  process.exit(1);
}

// ---- init ----
program
  .command("init")
  .description("initialize hyacine project")
  .action(() => {
    const cwd = process.cwd();
    const ymlPath = join(cwd, "hyacine.yml");
    if (existsSync(ymlPath)) {
      console.log(t("init.exists", { path: ymlPath }));
      return;
    }
    const content = `contentDir: src/posts\nassetsDir: src/assets\npostExtension:\n  - .md\n  - .mdx\n`;
    writeFileSync(ymlPath, content, "utf8");
    mkdirSync(join(cwd, "src/posts"), { recursive: true });
    mkdirSync(join(cwd, "src/assets"), { recursive: true });
    console.log(t("init.created", { path: ymlPath }));
    console.log(t("init.done", { contentDir: "src/posts", assetsDir: "src/assets" }));
  });

// ---- install / setup（旧 hyc setup 模式移植） ----
program
  .command("install")
  .alias("setup")
  .argument("[dir]", "target directory (default: cwd)")
  .option("--source <source>", "clone source: github|gh-proxy|gh-proxy-v6", "github")
  .option("--repository <url>", "template repository URL")
  .option("--install", "run dependency install after clone", false)
  .option("--pm <pm>", "package manager: pnpm|npm|bun", "pnpm")
  .description("install a new blog from astro-blog-shokax template (setup mode)")
  .action(
    async (
      dirArg: string | undefined,
      opts: {
        source?: string;
        repository?: string;
        install?: boolean;
        pm?: string;
      },
    ) => {
      try {
        const source = (opts.source ?? "github") as "github" | "gh-proxy" | "gh-proxy-v6";
        const pm = (opts.pm ?? "pnpm") as "pnpm" | "npm" | "bun";
        const result = await installBlog({
          dir: dirArg ?? process.cwd(),
          source,
          repository: opts.repository,
          install: opts.install === true,
          packageManager: pm,
        });
        console.log(
          `√ 安装完成：${result.clonedInto}${result.installed ? "（已安装依赖）" : "（未安装依赖，可在目录内执行 pnpm install）"}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✘ 安装失败：${message}`);
        process.exitCode = 1;
      }
    },
  );

// ---- new ----
program
  .command("new")
  .argument("[title]", "post title")
  .option("-c, --category <category>", "category")
  .option("--draft", "draft", true)
  .option("--no-draft", "not draft")
  .description("create new post")
  .action((titleArg: string | undefined, opts: { category?: string; draft?: boolean }) => {
    const title = titleArg ?? "Untitled";
    const { root, config } = getProjectInfo();
    const cats = opts.category !== undefined ? [opts.category] : [];
    const draft = opts.draft ?? true;
    const rel = createPost(root, config, title, cats, draft);
    console.log(t("new.created", { path: rel }));
  });

// ---- list ----
program
  .command("list")
  .argument("[query]", "filter query")
  .description("list posts")
  .action((query: string | undefined) => {
    const { root, config } = getProjectInfo();
    const posts = scanPosts(root, config);
    let filtered = posts;
    if (query !== undefined && query.length > 0) {
      const lower = query.toLowerCase();
      filtered = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.slug.toLowerCase().includes(lower) ||
          p.path.toLowerCase().includes(lower),
      );
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- commander opts
    const opts = program.opts() as { json?: boolean };
    if (opts.json === true) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }
    if (filtered.length === 0) {
      console.log(t("list.empty"));
      return;
    }
    for (const p of filtered) {
      console.log(`${p.draft ? "[draft]" : "[pub]"} ${p.title} (${p.slug}) - ${p.path}`);
    }
  });

// ---- edit ----
program
  .command("edit")
  .argument("<query>", "post query")
  .description("open post in editor")
  .action((query: string) => {
    const { root, config } = getProjectInfo();
    const found = findPostByQuery(root, config, query);
    if (found === null) {
      console.error(t("edit.notFound", { query }));
      process.exit(1);
    }
    const editor = process.env.EDITOR ?? process.env.VISUAL;
    if (editor === undefined || editor.length === 0) {
      console.log(found);
      return;
    }
    const proc = spawn(editor, [found], { stdio: "inherit", shell: true });
    proc.on("close", (code) => process.exit(code ?? 0));
  });

// ---- rename ----
program
  .command("rename")
  .argument("<query>", "post query")
  .argument("<newName>", "new file name")
  .option("--also-slug", "also update slug in frontmatter")
  .description("rename post file")
  .action((query: string, newName: string, opts: { alsoSlug?: boolean }) => {
    const { root, config } = getProjectInfo();
    const found = findPostByQuery(root, config, query);
    if (found === null) {
      console.error(t("rename.notFound", { query }));
      process.exit(1);
    }
    const ext = extname(found);
    const newFilename = newName.endsWith(ext) ? newName : `${newName}${ext}`;
    const dest = join(dirname(found), newFilename);
    if (opts.alsoSlug === true) {
      const raw = readFileSync(found, "utf8");
      const parsed = matter(raw);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- gray-matter data
      const data = parsed.data as Record<string, unknown>;
      data.slug = autoSlug(newName.replace(ext, ""));
      const newRaw = matter.stringify(parsed.content, data);
      writeFileSync(found, newRaw, "utf8");
    }
    renameSync(found, dest);
    console.log(
      t("rename.done", {
        from: relative(root, found).replace(/\\/g, "/"),
        to: relative(root, dest).replace(/\\/g, "/"),
      }),
    );
  });

// ---- move ----
program
  .command("move")
  .argument("<query>", "post query")
  .argument("<destDir>", "destination directory relative to contentDir")
  .description("move post to category directory")
  .action((query: string, destDir: string) => {
    const { root, config } = getProjectInfo();
    const found = findPostByQuery(root, config, query);
    if (found === null) {
      console.error(t("move.notFound", { query }));
      process.exit(1);
    }
    const [first] = getCollections(config);
    const contentDir = join(root, first?.dir ?? config.contentDir);
    const dest = join(contentDir, destDir, basename(found));
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(found, dest);
    console.log(
      t("move.done", {
        from: relative(root, found).replace(/\\/g, "/"),
        to: relative(root, dest).replace(/\\/g, "/"),
      }),
    );
  });

// ---- build / preview ----
program
  .command("build")
  .description("run build")
  .action(async () => {
    const { root } = getProjectInfo();
    const cmd = findBuildCommand(root);
    if (cmd === null) {
      console.error(t("build.noScript"));
      process.exit(1);
    }
    console.log(t("build.running", { cmd: cmd.join(" ") }));
    const code = await runCommand(cmd, root);
    process.exit(code);
  });

program
  .command("preview")
  .description("run preview")
  .action(async () => {
    const { root } = getProjectInfo();
    const pkgPath = join(root, "package.json");
    let cmd: string[] | null = null;
    if (existsSync(pkgPath)) {
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- package.json shape
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          scripts?: Record<string, string>;
        };
        if (pkg.scripts?.preview !== undefined) cmd = ["pnpm", "run", "preview"];
        else if (pkg.scripts?.["preview:site"] !== undefined) cmd = ["pnpm", "run", "preview:site"];
      } catch {}
    }
    if (cmd === null) cmd = ["npx", "astro", "preview"];
    console.log(t("build.running", { cmd: cmd.join(" ") }));
    const code = await runCommand(cmd, root);
    process.exit(code);
  });

// ---- deploy ----
program
  .command("deploy")
  .argument("[message]", "commit message")
  .option("--no-push", "do not push")
  .description("git add, commit, push")
  .action(async (message: string | undefined, opts: { push?: boolean }) => {
    const { root } = getProjectInfo();
    const isRepo = await isGitRepo(root);
    if (!isRepo) {
      console.error(t("deploy.notGit"));
      process.exit(1);
    }
    const msg = message ?? `chore: update blog ${new Date().toISOString().slice(0, 10)}`;
    await gitAddAll(root);
    const code = await gitCommit(root, msg);
    if (code !== 0) {
      console.log("Nothing to commit or commit failed");
      return;
    }
    console.log(t("deploy.committed", { message: msg }));
    if (opts.push === false) {
      console.log(t("deploy.noPush"));
      return;
    }
    const pushCode = await gitPush(root);
    if (pushCode === 0) console.log(t("deploy.pushed"));
    else console.error("Push failed");
  });

// ---- backup ----
program
  .command("backup")
  .description("create tar.gz backup")
  .action(async () => {
    const { root, config } = getProjectInfo();
    try {
      const out = await createBackup(root, config);
      console.log(t("backup.created", { path: out }));
    } catch (err) {
      console.error(t("backup.failed", { message: String(err) }));
      process.exit(1);
    }
  });

// ---- theme:config ----
const themeCmd = program.command("theme:config").description("theme config");
themeCmd
  .command("view")
  .description("view theme config")
  .action(() => {
    const { root, config } = getProjectInfo();
    const p =
      config.themeConfigPath !== null
        ? join(root, config.themeConfigPath)
        : join(root, "src/theme.config.ts");
    if (!existsSync(p)) {
      console.error(t("theme.notFound", { path: p }));
      process.exit(1);
    }
    console.log(readFileSync(p, "utf8"));
  });
themeCmd
  .command("edit")
  .description("edit theme config in $EDITOR")
  .action(() => {
    const { root, config } = getProjectInfo();
    const p =
      config.themeConfigPath !== null
        ? join(root, config.themeConfigPath)
        : join(root, "src/theme.config.ts");
    if (!existsSync(p)) {
      console.error(t("theme.notFound", { path: p }));
      process.exit(1);
    }
    const editor = process.env.EDITOR;
    if (editor === undefined || editor.length === 0) {
      console.error(t("edit.noEditor"));
      process.exit(1);
    }
    const proc = spawn(editor, [p], { stdio: "inherit", shell: true });
    proc.on("close", (code) => process.exit(code ?? 0));
  });

// ---- login ----
program
  .command("login")
  .argument("[code]", "setup code")
  .option("--url <url>", "api base url")
  .option("--code <code>", "setup code (alternative)")
  .description("login to remote API")
  .action(async (codeArg: string | undefined, opts: { url?: string; code?: string }) => {
    const code = opts.code ?? codeArg;
    let url = opts.url;
    const state = loadRemoteState();
    if (url === undefined) url = state.apiUrl;
    if (url === undefined || url.length === 0) {
      console.error("Missing --url <api base url>");
      process.exit(1);
    }
    if (code === undefined || code.length === 0) {
      console.error("Missing setup code");
      process.exit(1);
    }
    const client = new HyacineClient({ baseUrl: url });
    try {
      const res = await client.setup({ code, label: "cli" });
      saveRemoteState({ ...state, apiUrl: url, apiToken: res.token });
      console.log(t("login.success", { url }));
    } catch (err) {
      if (err instanceof HyacineApiError) {
        console.error(t("login.failed", { message: err.message }));
      } else {
        console.error(String(err));
      }
      process.exit(1);
    }
  });

// ---- logout ----
program
  .command("logout")
  .description("logout")
  .action(() => {
    const state = loadRemoteState();
    saveRemoteState({ ...state, apiToken: undefined });
    console.log(t("logout.done"));
  });

// ---- status ----
program
  .command("status")
  .description("show status")
  .action(async () => {
    const state = loadRemoteState();
    if (!isRemoteConfigured(state)) {
      console.log(t("status.local"));
      return;
    }
    console.log(t("status.remote", { url: state.apiUrl ?? "" }));
    if (state.lastSync !== undefined) {
      console.log(`Last sync: ${state.lastSync.at} (${state.lastSync.paths.length} posts)`);
    }
    try {
      const client = new HyacineClient({
        baseUrl: state.apiUrl ?? "",
        token: state.apiToken,
      });
      const health = await client.health();
      console.log(
        t("status.ai", {
          summary: String(health.ai.summary),
          embed: String(health.ai.embed),
        }),
      );
      if (health.needsSetup) console.log(t("status.needsSetup"));
    } catch {
      console.log(t("error.network"));
    }
  });

// ---- tokens ----
program
  .command("tokens:list")
  .description("list tokens (admin)")
  .action(async () => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    try {
      const client = getClient();
      const res = await client.listTokens();
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- commander opts
      const opts = program.opts() as { json?: boolean };
      if (opts.json === true) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      for (const tok of res.tokens) {
        console.log(
          `${tok.id} ${tok.label} [${tok.scopes.join(",")}] revoked=${String(tok.revoked)}`,
        );
      }
    } catch (err) {
      handleApiError(err);
    }
  });

program
  .command("tokens:create")
  .argument("<label>", "token label")
  .option("-s, --scopes <scopes>", "comma separated scopes", "posts.r,posts.w,ai")
  .option("--expires <days>", "expires in days")
  .description("create token (admin)")
  .action(async (label: string, opts: { scopes: string; expires?: string }) => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- scopes narrow
    const scopes = opts.scopes
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0) as ("posts.r" | "posts.w" | "ai" | "admin")[];
    const expiresInDays = opts.expires !== undefined ? Number.parseInt(opts.expires, 10) : null;
    try {
      const client = getClient();
      const res = await client.createToken({ label, scopes, expiresInDays });
      console.log(`Token: ${res.token}`);
      console.log(`ID: ${res.tokenId}`);
    } catch (err) {
      handleApiError(err);
    }
  });

program
  .command("tokens:revoke")
  .argument("<id>", "token id")
  .description("revoke token (admin)")
  .action(async (id: string) => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    try {
      const client = getClient();
      await client.revokeToken(id);
      console.log(`Revoked ${id}`);
    } catch (err) {
      handleApiError(err);
    }
  });

// ---- sync ----
program
  .command("sync")
  .option("--force", "force sync (bypass safety checks)")
  .option("--rebind-project", "rebind remote project identity (requires admin scope)")
  .option("--allow-batch-delete", "allow deleting posts exceeding safety threshold")
  .description("sync index to remote")
  .action(
    async (opts: { force?: boolean; rebindProject?: boolean; allowBatchDelete?: boolean }) => {
      if (!isRemoteMode()) {
        console.error(t("error.remoteOnly"));
        process.exit(1);
      }
      const { root, config } = getProjectInfo();
      const state = loadRemoteState();
      const lastPaths = state.lastSync?.paths ?? null;
      const { posts, assets, deletedPaths } = buildSyncPayload(root, config, lastPaths);
      const projectId = resolveProjectId(root, config);
      const payload = {
        generatedAt: new Date().toISOString(),
        posts,
        assets,
        deletedPaths,
        projectId,
        force: opts.force,
        rebindProject: opts.rebindProject,
        allowBatchDelete: opts.allowBatchDelete,
      };
      try {
        const client = getClient();
        const res = await client.syncUpload(payload);
        console.log(
          t("sync.uploaded", {
            posts: String(res.accepted.posts),
            assets: String(res.accepted.assets),
            changed: String(res.changedHashes.length),
            deleted: String(res.deletedPaths.length),
          }),
        );
        console.log(t("sync.needs", { count: String(res.ai.needs.length) }));
        if (res.ai.needs.length > 0) {
          for (const n of res.ai.needs) {
            console.log(`  ${n.path}: ${n.reason}`);
          }
        }
        saveRemoteState({
          ...state,
          lastSync: {
            at: new Date().toISOString(),
            paths: posts.map((p) => p.path),
          },
        });
      } catch (err) {
        handleApiError(err);
      }
    },
  );

// ---- ai:summary ----
program
  .command("ai:summary")
  .argument("[query]", "post query or --all")
  .option("--all", "all posts")
  .option("--force", "force re-generate")
  .option("--dry-run", "dry run")
  .description("generate summary via API and materialize")
  .action(
    async (
      query: string | undefined,
      opts: { all?: boolean; force?: boolean; dryRun?: boolean },
    ) => {
      if (!isRemoteMode()) {
        console.error(t("error.remoteOnly"));
        process.exit(1);
      }
      const { root, config } = getProjectInfo();
      const posts = scanPosts(root, config);
      let targets = posts;
      if (opts.all !== true) {
        if (query === undefined || query.length === 0) {
          console.error("Provide <query> or --all");
          process.exit(1);
        }
        const lower = query.toLowerCase();
        targets = posts.filter(
          (p) =>
            p.path.toLowerCase().includes(lower) ||
            p.slug.toLowerCase().includes(lower) ||
            p.title.toLowerCase().includes(lower),
        );
        if (targets.length === 0) {
          console.error(t("edit.notFound", { query }));
          process.exit(1);
        }
      }
      const client = getClient();
      for (const post of targets) {
        // path 为 repo 相对（src/posts/hello.md）
        const filePath = join(root, post.path);
        const raw = readFileSync(filePath, "utf8");
        if (opts.force !== true && hasUpToDateSummary(raw, post.hash)) {
          console.log(t("ai.summary.skipped", { path: post.path }));
          continue;
        }
        try {
          const res = await client.aiSummary({ hash: post.hash, content: raw });
          if (opts.dryRun === true) {
            console.log(
              t("ai.summary.dryRun", {
                path: post.path,
                summary: res.summary.slice(0, 80),
              }),
            );
            continue;
          }
          const updated = materializeSummary(
            raw,
            res.summary,
            res.model,
            res.sourceHash,
            new Date().toISOString(),
          );
          writeFileSync(filePath, updated, "utf8");
          console.log(t("ai.summary.done", { path: post.path }));
        } catch (err) {
          handleApiError(err);
        }
      }
    },
  );

// ---- ai:similar ----
program
  .command("ai:similar")
  .argument("<query>", "post query")
  .option("--limit <n>", "limit", "5")
  .description("find similar posts")
  .action(async (query: string, opts: { limit: string }) => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    const { root, config } = getProjectInfo();
    const posts = scanPosts(root, config);
    const lower = query.toLowerCase();
    const found = posts.find(
      (p) =>
        p.path.toLowerCase().includes(lower) ||
        p.slug.toLowerCase().includes(lower) ||
        p.title.toLowerCase().includes(lower),
    );
    if (found === undefined) {
      console.error(t("edit.notFound", { query }));
      process.exit(1);
    }
    const limit = Number.parseInt(opts.limit, 10) || 5;
    try {
      const client = getClient();
      const res = await client.aiSimilar({ hash: found.hash, limit });
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- commander opts
      const progOpts = program.opts() as { json?: boolean };
      if (progOpts.json === true) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      if (res.items.length === 0) {
        console.log(t("ai.similar.empty"));
        return;
      }
      for (const item of res.items) {
        console.log(`${item.path} | ${item.title} | score=${item.score.toFixed(3)}`);
      }
    } catch (err) {
      handleApiError(err);
    }
  });

// ---- ai:embed ----
program
  .command("ai:embed")
  .argument("[query]", "post query")
  .option("--all", "all posts")
  .description("embed posts")
  .action(async (query: string | undefined, opts: { all?: boolean }) => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    const { root, config } = getProjectInfo();
    const posts = scanPosts(root, config);
    let targets = posts;
    if (opts.all !== true) {
      if (query === undefined || query.length === 0) {
        console.error("Provide <query> or --all");
        process.exit(1);
      }
      const lower = query.toLowerCase();
      targets = posts.filter(
        (p) =>
          p.path.toLowerCase().includes(lower) ||
          p.slug.toLowerCase().includes(lower) ||
          p.title.toLowerCase().includes(lower),
      );
    }
    const client = getClient();
    for (const post of targets) {
      // path 为 repo 相对（src/posts/hello.md）
      const filePath = join(root, post.path);
      const raw = readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const chunks = chunkText(parsed.content, 800);
      if (chunks.length === 0) continue;
      try {
        const res = await client.aiEmbed({ hash: post.hash, chunks });
        console.log(
          t("ai.embed.done", {
            path: post.path,
            count: String(res.chunkCount),
          }),
        );
      } catch (err) {
        handleApiError(err);
      }
    }
  });

// ---- stats ----
program
  .command("stats")
  .description("show stats from remote")
  .action(async () => {
    if (!isRemoteMode()) {
      console.error(t("error.remoteOnly"));
      process.exit(1);
    }
    try {
      const client = getClient();
      const res = await client.stats();
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion -- commander opts
      const opts = program.opts() as { json?: boolean };
      if (opts.json === true) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      console.log(
        t("stats.totals", {
          posts: String(res.totals.posts),
          drafts: String(res.totals.drafts),
          published: String(res.totals.published),
        }),
      );
      for (const [cat, count] of Object.entries(res.byCategory)) {
        console.log(`  ${cat}: ${count}`);
      }
      for (const m of res.byMonth) {
        console.log(`  ${m.month}: ${m.count}`);
      }
      console.log(`Assets: total=${res.assets.total} remote=${res.assets.remote}`);
    } catch (err) {
      handleApiError(err);
    }
  });

// ---- collections（Astro 内容集合 → hyacine.collections.json） ----------------
program
  .command("collections")
  .option("--out <path>", "输出路径（相对项目根，默认 hyacine.collections.json）")
  .option("--force", "覆盖已存在的更强来源文件", false)
  .description("从 Astro 内容集合生成类型信息文件（UI/校验来源）")
  .action(async (opts: { out?: string; force?: boolean }) => {
    const { root, config } = getProjectInfo();
    const result = await generateCollectionsFile(root, config, {
      outPath: opts.out,
      force: opts.force === true,
    });
    if (result === null) {
      console.error("✘ 生成失败");
      process.exitCode = 1;
      return;
    }
    const sourceLabel =
      result.source === "content.config.ts" ? "content.config.ts" : "Astro sync 产物(降级)";
    if (result.file.collections.length === 0) {
      console.error(`✘ 未提取到任何集合（来源 ${sourceLabel}）`);
      console.error("  提示：先在博客目录运行 astro sync/dev/build，或检查 src/content.config.ts");
      process.exitCode = 1;
      return;
    }
    console.log(
      `√ 提取 ${result.file.collections.length} 个集合（来源 ${sourceLabel}）${result.overwritten ? "（已覆盖旧文件）" : ""}`,
    );
    for (const c of result.file.collections) {
      const fields = c.ui.fields.length > 0 ? `，${c.ui.fields.length} 个字段` : "";
      const ext = c.extensions.join("/");
      console.log(`  ${c.name} → ${c.dir} [${ext}]${fields}`);
    }
    if (result.file.warnings.length > 0) {
      for (const w of result.file.warnings) {
        console.log(`  ! ${w}`);
      }
    }
    console.log(`→ ${result.outPath}`);
  });

program.parse();
