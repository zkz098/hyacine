// oxlint-disable eslint/no-await-in-loop
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8787;
const BASE = `http://127.0.0.1:${PORT}`;

function log(message) {
  console.log(`[smoke] ${message}`);
}

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) {
        const json = await response.json();
        log(`health ok: ${JSON.stringify(json)}`);
        return;
      }
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error("health not reachable");
}

async function run() {
  log("starting wrangler dev --local");
  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  // Ensure D1 migrations are applied for local state
  try {
    const { execSync } = await import("node:child_process");
    execSync("pnpm exec wrangler d1 migrations apply DB --local", { cwd, stdio: "pipe" });
    log("migrations applied");
  } catch (error) {
    log(`migrations apply warning: ${String(error)}`);
  }
  // Write .dev.vars for wrangler --local (worker env, not process env)
  const devVarsPath = path.join(cwd, ".dev.vars");
  const devVarsContent = [
    'SETUP_CODE="smoke-setup-code-123"',
    'AI_SUMMARY_ENDPOINT="http://127.0.0.1:9999/fake"',
    'AI_SUMMARY_KEY="sk-smoke"',
    'AI_SUMMARY_MODEL="smoke-model"',
    'R2_S3_ENDPOINT="https://account.r2.cloudflarestorage.com"',
    'R2_ACCESS_KEY_ID="akid"',
    'R2_SECRET_ACCESS_KEY="secret"',
    'R2_BUCKET="hyacine-assets"',
    'EMBED_MODEL="@cf/baai/bge-m3"',
  ].join("\n");
  const { writeFile, unlink } = await import("node:fs/promises");
  let hasVarsFile = false;
  try {
    await writeFile(devVarsPath, devVarsContent, "utf8");
    hasVarsFile = true;
  } catch {
    // ignore
  }
  const cleanupVars = async () => {
    if (hasVarsFile) {
      try {
        await unlink(devVarsPath);
      } catch {
        /* ignore */
      }
    }
  };
  const child = spawn("pnpm", ["exec", "wrangler", "dev", "--port", String(PORT), "--local"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: {
      ...process.env,
      SETUP_CODE: "smoke-setup-code-123",
      AI_SUMMARY_ENDPOINT: "http://127.0.0.1:9999/fake",
      AI_SUMMARY_KEY: "sk-smoke",
      AI_SUMMARY_MODEL: "smoke-model",
      R2_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "akid",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "hyacine-assets",
      EMBED_MODEL: "@cf/baai/bge-m3",
    },
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[wrangler] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[wrangler] ${chunk}`));

  const kill = () => {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { shell: true });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
  };

  process.on("exit", kill);
  process.on("SIGINT", () => {
    kill();
    process.exit(1);
  });

  try {
    await waitForHealth(30000);

    // setup
    const setupResponse = await fetch(`${BASE}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "smoke-setup-code-123", label: "smoke" }),
    });
    if (!setupResponse.ok)
      throw new Error(`setup failed: ${setupResponse.status} ${await setupResponse.text()}`);
    const setupJson = await setupResponse.json();
    const token = setupJson.token;
    log(`setup token ${setupJson.tokenId}`);

    const authHeaders = { "content-type": "application/json", authorization: `Bearer ${token}` };

    // sync
    const now = new Date().toISOString();
    const syncResponse = await fetch(`${BASE}/api/sync`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        generatedAt: now,
        posts: [
          {
            path: "hello.md",
            slug: "hello",
            title: "Hello",
            draft: false,
            categories: [],
            hash: "a".repeat(16),
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      }),
    });
    if (!syncResponse.ok)
      throw new Error(`sync failed: ${syncResponse.status} ${await syncResponse.text()}`);
    const syncJson = await syncResponse.json();
    log(`sync: ${JSON.stringify(syncJson)}`);

    // presign
    const presignResponse = await fetch(`${BASE}/api/assets/presign`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ key: "images/smoke.png", contentType: "image/png", size: 1024 }),
    });
    if (!presignResponse.ok)
      throw new Error(`presign failed: ${presignResponse.status} ${await presignResponse.text()}`);
    const presignJson = await presignResponse.json();
    log(`presign: ${JSON.stringify(presignJson)}`);
    if (presignJson.method !== "PUT" || !presignJson.url.includes("hyacine-assets")) {
      throw new Error(`presign shape invalid: ${JSON.stringify(presignJson)}`);
    }

    log("smoke passed");
  } finally {
    await cleanupVars();
    kill();
    await delay(1000);
  }
}

run().catch((error) => {
  console.error(`[smoke] failed: ${error.stack ?? String(error)}`);
  process.exit(1);
});
