// oxlint-disable typescript/no-unnecessary-type-parameters, typescript/no-unsafe-type-assertion, eslint/no-unused-vars, eslint/no-await-in-loop, unicorn/no-array-sort
import type { Env } from "./types";

interface PostRow {
  path: string;
  slug: string;
  title: string;
  draft: number;
  categories: string;
  hash: string;
  created_at: string;
  updated_at: string;
  last_modified: string;
  content: string | null;
}

interface AiRow {
  hash: string;
  summary: string | null;
  summary_model: string | null;
  summary_at: string | null;
  embed_model: string | null;
  embed_dim: number | null;
  embed_at: string | null;
  embed_vec: string | null;
  embed_chunks: number | null;
}

interface AssetRow {
  path: string;
  is_remote: number;
  asset_type: string;
  file_type: string;
  r2_key: string | null;
  checksum: string | null;
  size: number | null;
  updated_at: string;
}

interface TokenRow {
  token_hash: string;
  label: string;
  scopes: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked: number;
}

interface SyncLogRow {
  id: number;
  at: string;
  post_count: number;
  changed: number;
  deleted: number;
}

interface AiQueueRow {
  hash: string;
  path: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

class FakePreparedStatement {
  sql: string;
  db: FakeD1Database;
  params: unknown[];
  constructor(sql: string, db: FakeD1Database, params: unknown[] = []) {
    this.sql = sql;
    this.db = db;
    this.params = params;
  }

  bind(...params: unknown[]): FakePreparedStatement {
    return new FakePreparedStatement(this.sql, this.db, params);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(): Promise<{ success: boolean; meta: unknown }> {
    this.db.executeRun(this.sql, this.params);
    return { success: true, meta: {} };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async all<T>(): Promise<{ results: T[] }> {
    const results = this.db.executeAll<T>(this.sql, this.params);
    return { results };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async first<T>(): Promise<T | null> {
    const results = this.db.executeAll<T>(this.sql, this.params);
    return results[0] ?? null;
  }
}

export class FakeD1Database {
  posts = new Map<string, PostRow>();
  aiResults = new Map<string, AiRow>();
  assets = new Map<string, AssetRow>();
  tokens = new Map<string, TokenRow>();
  appConfig = new Map<string, string>();
  aiQueue = new Map<string, AiQueueRow>();
  syncLogs: SyncLogRow[] = [];
  nextSyncLogId = 1;

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(sql, this);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async exec(_sql: string): Promise<unknown> {
    return { count: 0, duration: 0 };
  }

  async batch(statements: FakePreparedStatement[]): Promise<unknown[]> {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  executeRun(sql: string, params: unknown[]): void {
    const lower = sql.toLowerCase().trim();

    if (lower.startsWith("insert into posts")) {
      // sync 的 INSERT 带列清单（可选 content）；按列名映射避免列序硬编码
      const columnsMatch = sql.match(/\(([^)]+)\)\s+values/i);
      const columns =
        columnsMatch?.[1]?.split(",").map((column) => column.trim().toLowerCase()) ?? [];
      const path = params[columns.indexOf("path")] as string;
      const slug = params[columns.indexOf("slug")] as string;
      const title = params[columns.indexOf("title")] as string;
      const draft = params[columns.indexOf("draft")] as number;
      const categories = params[columns.indexOf("categories")] as string;
      const hash = params[columns.indexOf("hash")] as string;
      const createdAt = params[columns.indexOf("created_at")] as string;
      const updatedAt = params[columns.indexOf("updated_at")] as string;
      const lastModified = params[columns.indexOf("last_modified")] as string;
      const content = (params[columns.indexOf("content")] as string | null) ?? null;
      const existing = this.posts.get(path);
      if (existing !== undefined) {
        existing.slug = slug;
        existing.title = title;
        existing.draft = draft;
        existing.categories = categories;
        existing.hash = hash;
        existing.updated_at = updatedAt;
        existing.last_modified = lastModified;
        if (content !== null) existing.content = content;
      } else {
        this.posts.set(path, {
          path,
          slug,
          title,
          draft,
          categories,
          hash,
          created_at: createdAt,
          updated_at: updatedAt,
          last_modified: lastModified,
          content,
        });
      }
      return;
    }

    if (lower.startsWith("delete from posts where path =")) {
      const [path] = params as [string];
      this.posts.delete(path);
      return;
    }

    if (lower.startsWith("insert into ai_results")) {
      // Extract columns
      const columnsMatch = sql.match(/\(([^)]+)\)\s+values/i);
      const columns =
        columnsMatch?.[1]?.split(",").map((column) => column.trim().toLowerCase()) ?? [];
      const values = params;
      // First column is always hash
      const hash = values[0] as string;
      let row = this.aiResults.get(hash);
      if (row === undefined) {
        row = {
          hash,
          summary: null,
          summary_model: null,
          summary_at: null,
          embed_model: null,
          embed_dim: null,
          embed_at: null,
          embed_vec: null,
          embed_chunks: null,
        };
        this.aiResults.set(hash, row);
      }
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        const value = values[index] as string | number | null;
        if (column === "summary") row.summary = value as string | null;
        else if (column === "summary_model") row.summary_model = value as string | null;
        else if (column === "summary_at") row.summary_at = value as string | null;
        else if (column === "embed_model") row.embed_model = value as string | null;
        else if (column === "embed_dim") row.embed_dim = value as number | null;
        else if (column === "embed_at") row.embed_at = value as string | null;
        else if (column === "embed_vec") row.embed_vec = value as string | null;
        else if (column === "embed_chunks") row.embed_chunks = value as number | null;
        else if (column === "hash") row.hash = value as string;
      }
      return;
    }

    if (lower.startsWith("delete from ai_results where hash =")) {
      const [hash] = params as [string];
      // Do not delete if we still have other field? For simplicity delete row
      // but preserve if other fields exist? Spec: DELETE FROM ai_results WHERE hash = ? for deleted posts -> remove whole row.
      this.aiResults.delete(hash);
      return;
    }

    if (lower.startsWith("insert into assets")) {
      const [path, isRemote, assetType, fileType, r2Key, checksum, size, updatedAt] = params as [
        string,
        number,
        string,
        string,
        string | null,
        string | null,
        number | null,
        string,
      ];
      this.assets.set(path, {
        path,
        is_remote: isRemote,
        asset_type: assetType,
        file_type: fileType,
        r2_key: r2Key,
        checksum,
        size,
        updated_at: updatedAt,
      });
      return;
    }

    if (lower.startsWith("insert into app_config")) {
      const [key, value] = params as [string, string];
      this.appConfig.set(key, value);
      return;
    }

    if (lower.startsWith("delete from app_config")) {
      const [key] = params as [string];
      this.appConfig.delete(key);
      return;
    }

    if (lower.startsWith("insert into api_tokens")) {
      const [tokenHash, label, scopes, expiresAt, lastUsedAt, createdAt, revoked] = params as [
        string,
        string,
        string,
        string | null,
        string | null,
        string,
        number,
      ];
      this.tokens.set(tokenHash, {
        token_hash: tokenHash,
        label,
        scopes,
        expires_at: expiresAt,
        last_used_at: lastUsedAt,
        created_at: createdAt,
        revoked,
      });
      return;
    }

    if (lower.startsWith("update api_tokens set revoked = 1")) {
      const [tokenHash] = params as [string];
      const row = this.tokens.get(tokenHash);
      if (row !== undefined) row.revoked = 1;
      return;
    }

    if (lower.startsWith("update api_tokens set last_used_at")) {
      const [now, tokenHash] = params as [string, string];
      const row = this.tokens.get(tokenHash);
      if (row !== undefined) row.last_used_at = now;
      return;
    }

    if (lower.startsWith("insert into sync_logs")) {
      const [at, postCount, changed, deleted] = params as [string, number, number, number];
      this.syncLogs.push({
        id: this.nextSyncLogId++,
        at,
        post_count: postCount,
        changed,
        deleted,
      });
      return;
    }

    if (lower.startsWith("insert into ai_queue")) {
      // 我们控制的 SQL：VALUES (?, ?, ?, 'pending', 0, ?, ?, ?) → 参数即 [hash, path, kind, nextRunAt, createdAt, updatedAt]
      const [hash, path, kind, nextRunAt, createdAt, updatedAt] = params as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const existing = this.aiQueue.get(hash);
      if (existing !== undefined) {
        existing.path = path;
        existing.kind =
          existing.kind === "both" || kind === "both"
            ? "both"
            : existing.kind !== kind
              ? "both"
              : existing.kind;
        existing.status = "pending";
        existing.next_run_at = nextRunAt;
        existing.updated_at = updatedAt;
      } else {
        this.aiQueue.set(hash, {
          hash,
          path,
          kind,
          status: "pending",
          attempts: 0,
          last_error: null,
          next_run_at: nextRunAt,
          created_at: createdAt,
          updated_at: updatedAt,
        });
      }
      return;
    }

    if (lower.startsWith("delete from ai_queue")) {
      const [hash] = params as [string];
      this.aiQueue.delete(hash);
      return;
    }

    if (lower.startsWith("update ai_queue")) {
      const statusMatch = sql.match(/status='([^']+)'/i);
      const status = statusMatch?.[1] ?? "";
      const setPart = sql.match(/set\s+(.*?)\s+where/i)?.[1] ?? "";
      const paramCols: string[] = [];
      for (const pair of setPart.split(",")) {
        const eq = pair.indexOf("=");
        const col = pair.slice(0, eq).trim().toLowerCase();
        if (pair.slice(eq + 1).trim() === "?") paramCols.push(col);
      }
      const setParams = params.slice(0, paramCols.length) as unknown[];
      const [hash] = params.slice(paramCols.length) as [string];
      const row = this.aiQueue.get(hash);
      if (row !== undefined) {
        row.status = status; // 字面量 set 子句（status='...'）不在参数列，需显式赋值
        paramCols.forEach((col, index) => {
          const value = setParams[index];
          if (col === "attempts") row.attempts = value as number;
          else if (col === "last_error") row.last_error = (value as string | null) ?? null;
          else if (col === "next_run_at") row.next_run_at = value as string;
          else if (col === "updated_at") row.updated_at = value as string;
        });
      }
      return;
    }
  }

  executeAll<T>(sql: string, params: unknown[]): T[] {
    const lower = sql.toLowerCase().trim();

    if (lower.includes("from posts")) {
      let rows = [...this.posts.values()];
      if (lower.includes("where path =")) {
        const [path] = params as [string];
        rows = rows.filter((row) => row.path === path);
      } else if (lower.includes("where hash =")) {
        const [hash] = params as [string];
        rows = rows.filter((row) => row.hash === hash);
      }
      return rows as unknown as T[];
    }

    if (lower.includes("from ai_results")) {
      let rows = [...this.aiResults.values()];
      if (lower.includes("where hash =")) {
        const [hash] = params as [string];
        rows = rows.filter((row) => row.hash === hash);
      } else if (lower.includes("where embed_vec is not null")) {
        rows = rows.filter((row) => row.embed_vec !== null);
      }
      // Handle SELECT hash, embed_vec etc - return filtered rows as-is
      return rows as unknown as T[];
    }

    if (lower.includes("from assets")) {
      const rows = [...this.assets.values()];
      return rows as unknown as T[];
    }

    if (lower.includes("from app_config")) {
      const rows = [...this.appConfig.entries()].map(([key, value]) => ({ key, value }));
      return rows as unknown as T[];
    }

    if (lower.includes("from api_tokens")) {
      let rows = [...this.tokens.values()];
      if (lower.includes("where token_hash =") && !lower.includes(">=")) {
        const [hash] = params as [string];
        rows = rows.filter((row) => row.token_hash === hash);
      } else if (lower.includes("token_hash >=")) {
        // 前缀范围查询（revoke 用）：token_hash >= id AND token_hash < id+\uffff
        const [id] = params as [string];
        rows = rows.filter((row) => row.token_hash >= id && row.token_hash < `${id}\uffff`);
      }
      // Order by created_at DESC for list
      if (lower.includes("order by created_at desc")) {
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      return rows as unknown as T[];
    }

    if (lower.includes("from sync_logs")) {
      let rows = [...this.syncLogs] as unknown as T[];
      // ORDER BY at DESC LIMIT 50 handled by caller slicing? our caller expects up to 50.
      // Sorting already insertion order by at; mimic sort
      const syncRows = [...this.syncLogs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
      return syncRows as unknown as T[];
    }

    if (lower.includes("from ai_queue")) {
      let rows = [...this.aiQueue.values()];
      const hasWhere = lower.includes("status in");
      let budget = 100000;
      if (lower.includes("limit")) {
        budget = Number(hasWhere ? params[1] : params[0]);
      }
      if (hasWhere) {
        const [nowIso] = params as [string];
        rows = rows.filter(
          (r) => (r.status === "pending" || r.status === "waiting") && r.next_run_at <= nowIso,
        );
      }
      rows.sort((a, b) => a.next_run_at.localeCompare(b.next_run_at));
      return rows.slice(0, budget) as unknown as T[];
    }

    return [];
  }
}

export class FakeKVNamespace {
  store = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async put(key: string, value: string, _options?: unknown): Promise<void> {
    this.store.set(key, value);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  const db = new FakeD1Database();
  const cache = new FakeKVNamespace();
  const fakeAi = {
    run: async (_model: string, _input: unknown) => {
      // default mock: return 3-dim embedding
      return { data: [[0.1, 0.2, 0.3]] } as unknown as never;
    },
  } as unknown as Ai;

  return {
    DB: db as unknown as D1Database,
    CACHE: cache as unknown as KVNamespace,
    ASSETS: {} as unknown as R2Bucket,
    AI: fakeAi,
    SETUP_CODE: "test-setup-code-123",
    EMBED_MODEL: "@cf/baai/bge-m3",
    ...overrides,
  };
}

export function getFakeD1(env: Env): FakeD1Database {
  return env.DB as unknown as FakeD1Database;
}

export function getFakeKV(env: Env): FakeKVNamespace {
  return env.CACHE as unknown as FakeKVNamespace;
}
