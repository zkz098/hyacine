import { createResource, createSignal, For, Show } from "solid-js";
import type { Scope } from "@hyacine/contract";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

const ALL_SCOPES: readonly Scope[] = ["posts.r", "posts.w", "ai", "admin"];

export function Tokens(): import("solid-js").JSX.Element {
  const [label, setLabel] = createSignal("");
  const [scopes, setScopes] = createSignal([...ALL_SCOPES]);
  const [expires, setExpires] = createSignal("");
  const [createdToken, setCreatedToken] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const [tokens, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.listTokens();
    return res.tokens;
  });

  const handleCreate = async (): Promise<void> => {
    const l = label().trim();
    if (l.length === 0) {
      setError("请输入标签");
      return;
    }
    if (scopes().length === 0) {
      setError("至少选择一个权限");
      return;
    }
    setError(null);
    setCreatedToken(null);
    try {
      const client = apiStore.getClient();
      const raw = expires().trim();
      const expiresInDays = raw.length > 0 ? Number.parseInt(raw, 10) : undefined;
      const res = await client.createToken({
        label: l,
        scopes: scopes(),
        expiresInDays:
          expiresInDays !== undefined && !Number.isNaN(expiresInDays) ? expiresInDays : undefined,
      });
      setCreatedToken(res.token);
      setLabel("");
      await refetch();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  };

  const handleRevoke = async (id: string): Promise<void> => {
    setError(null);
    try {
      const client = apiStore.getClient();
      await client.revokeToken(id);
      await refetch();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  };

  const toggleScope = (scope: Scope): void => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const copyToken = async (): Promise<void> => {
    const token = createdToken();
    if (token === null) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div class="flex flex-col gap-4">
      <h1 class="text-xl font-bold">{t("tokens.title")}</h1>

      <Show when={error() !== null}>
        <Alert variant="error">{error()}</Alert>
      </Show>
      <Show when={createdToken() !== null}>
        <Alert variant="info">
          <div class="flex flex-col gap-2">
            <span>{t("tokens.created")}</span>
            <code class="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-xs break-all">
              {createdToken()}
            </code>
            <button
              type="button"
              onClick={() => void copyToken()}
              class="self-start px-3 py-1 rounded bg-[var(--accent)] text-white text-xs"
            >
              {copied() ? t("tokens.copied") : t("tokens.copy")}
            </button>
          </div>
        </Alert>
      </Show>

      <div class="surface p-4 flex flex-col gap-3">
        <h2 class="font-semibold text-sm">{t("tokens.create")}</h2>
        <input
          value={label()}
          onInput={(e) => setLabel(e.currentTarget.value)}
          placeholder={t("tokens.label")}
          class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
        />
        <div class="flex flex-wrap gap-2">
          <For each={ALL_SCOPES}>
            {(scope) => (
              <label class="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={scopes().includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                {scope}
              </label>
            )}
          </For>
        </div>
        <input
          value={expires()}
          onInput={(e) => setExpires(e.currentTarget.value)}
          placeholder={t("tokens.expires")}
          class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm w-48"
          type="number"
          min="1"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          class="self-start px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
        >
          {t("tokens.submit")}
        </button>
      </div>

      <Show when={tokens.error}>
        <Alert variant="error">{messageOf(tokens.error)}</Alert>
      </Show>
      <Show when={tokens.loading}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>
      <Show when={tokens()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<p class="text-sm text-muted">{t("tokens.empty")}</p>}
          >
            <div class="surface overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th class="px-3 py-2">标签</th>
                    <th class="px-3 py-2">权限</th>
                    <th class="px-3 py-2">过期</th>
                    <th class="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={list()}>
                    {(tok) => (
                      <tr class="border-b border-[var(--border)] last:border-0">
                        <td class="px-3 py-2">{tok.label}</td>
                        <td class="px-3 py-2 text-xs text-muted">{tok.scopes.join(", ")}</td>
                        <td class="px-3 py-2 text-xs text-muted">
                          {tok.expiresAt ?? "—"} {tok.revoked ? "(已撤销)" : ""}
                        </td>
                        <td class="px-3 py-2">
                          <Show when={!tok.revoked}>
                            <button
                              type="button"
                              onClick={() => void handleRevoke(tok.id)}
                              class="px-2 py-1 rounded btn-danger text-xs"
                            >
                              {t("tokens.revoke")}
                            </button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        )}
      </Show>
    </div>
  );
}
