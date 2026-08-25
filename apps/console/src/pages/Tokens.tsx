import { createResource, createSignal, For, Show } from "solid-js";
import type { Scope } from "@hyacine/contract";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import {
  TableContainer,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "../components/Table";
import { toast } from "../components/Toast";

const ALL_SCOPES: readonly { key: Scope; label: string; desc: string }[] = [
  { key: "posts.r", label: "posts.r", desc: "读取文章与数据" },
  { key: "posts.w", label: "posts.w", desc: "写入/更新文章" },
  { key: "ai", label: "ai", desc: "生成摘要与向量嵌入" },
  { key: "admin", label: "admin", desc: "全权系统与配置管理" },
];

export function Tokens(): import("solid-js").JSX.Element {
  const [label, setLabel] = createSignal("");
  const [scopes, setScopes] = createSignal<Scope[]>(ALL_SCOPES.map((s) => s.key));
  const [expires, setExpires] = createSignal("");
  const [createdToken, setCreatedToken] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);

  const [tokens, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.listTokens();
    return res.tokens;
  });

  const handleCreate = async (): Promise<void> => {
    const l = label().trim();
    if (l.length === 0) {
      setError("请输入令牌标签名称");
      return;
    }
    if (scopes().length === 0) {
      setError("至少选择一个权限 Scope");
      return;
    }
    setError(null);
    setCreatedToken(null);
    setCreating(true);
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
      toast.success("访问令牌创建成功，请及时复制保存");
      await refetch();
    } catch (err: unknown) {
      setError(messageOf(err));
      toast.error(messageOf(err), "创建令牌失败");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string): Promise<void> => {
    setError(null);
    setRevokingId(id);
    try {
      const client = apiStore.getClient();
      await client.revokeToken(id);
      toast.info("令牌已成功撤销");
      await refetch();
    } catch (err: unknown) {
      setError(messageOf(err));
      toast.error(messageOf(err), "撤销令牌失败");
    } finally {
      setRevokingId(null);
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
    toast.success("令牌已复制到剪贴板");
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("tokens.title")}
        description="创建与管理用于 CLI、CI/CD 自动化流水线及第三方集成的 API 访问令牌"
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={tokens.loading}
            icon="i-ri-refresh-line"
            onClick={() => void refetch()}
          >
            {t("common.refresh")}
          </Button>
        }
      />

      <Show when={error() !== null}>
        <Alert variant="error" title="错误提示">
          {error()}
        </Alert>
      </Show>

      {/* Newly Created Token Display */}
      <Show when={createdToken() !== null}>
        <Alert variant="success" title="新令牌创建成功（仅显示一次）">
          <div class="flex flex-col gap-2.5 pt-1">
            <span class="text-xs">{t("tokens.created")}</span>
            <div class="flex items-center gap-2">
              <code class="px-3 py-1.5 rounded-[4px] bg-[var(--surface)] border border-[var(--note-success-border)] text-xs font-mono break-all flex-1 text-[var(--text)] select-all">
                {createdToken()}
              </code>
              <Button
                variant="primary"
                size="sm"
                icon="i-ri-file-copy-line"
                onClick={() => void copyToken()}
              >
                {t("tokens.copy")}
              </Button>
            </div>
          </div>
        </Alert>
      </Show>

      {/* Create Token Form Card */}
      <Card class="flex flex-col gap-4">
        <CardHeader>
          <div>
            <CardTitle>{t("tokens.create")}</CardTitle>
            <CardDescription>配置新令牌的用途、生效权限与有效时长</CardDescription>
          </div>
        </CardHeader>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="令牌标签"
            value={label()}
            onInput={(e) => setLabel(e.currentTarget.value)}
            placeholder="例如：GitHub Action Deployer, Workstation CLI"
            icon="i-ri-price-tag-3-line"
          />

          <div class="flex flex-col gap-1 text-sm">
            <label class="font-medium text-xs text-[var(--text)]">有效期 (天数)</label>
            <div class="flex items-center gap-2">
              <Input
                value={expires()}
                onInput={(e) => setExpires(e.currentTarget.value)}
                placeholder="留空为永久"
                type="number"
                min="1"
                containerClass="flex-1"
              />
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpires("7")}
                  class="px-2 py-1.5 text-xs rounded-[4px] border border-[var(--border)] hover:bg-[var(--g-2)] text-[var(--muted)]"
                >
                  7天
                </button>
                <button
                  type="button"
                  onClick={() => setExpires("30")}
                  class="px-2 py-1.5 text-xs rounded-[4px] border border-[var(--border)] hover:bg-[var(--g-2)] text-[var(--muted)]"
                >
                  30天
                </button>
                <button
                  type="button"
                  onClick={() => setExpires("")}
                  class="px-2 py-1.5 text-xs rounded-[4px] border border-[var(--border)] hover:bg-[var(--g-2)] text-[var(--muted)]"
                >
                  永久
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scope Selector */}
        <div class="flex flex-col gap-2 pt-1">
          <label class="font-medium text-xs text-[var(--text)]">选择权限范围 (Scopes)</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <For each={ALL_SCOPES}>
              {(s) => {
                const selected = (): boolean => scopes().includes(s.key);
                return (
                  <button
                    type="button"
                    onClick={() => toggleScope(s.key)}
                    class={`p-3 rounded-[6px] border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      selected()
                        ? "border-[var(--accent)] bg-[var(--note-primary-bg)] shadow-xs"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--g-1)]"
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <span class={`font-mono text-xs font-semibold ${selected() ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
                        {s.label}
                      </span>
                      <span class={selected() ? "i-ri-checkbox-circle-fill text-[var(--accent)] text-sm" : "i-ri-checkbox-blank-circle-line text-[var(--muted)] text-sm"} />
                    </div>
                    <span class="text-[11px] text-[var(--muted)]">{s.desc}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <div class="pt-2">
          <Button
            variant="primary"
            size="md"
            loading={creating()}
            icon="i-ri-key-2-line"
            onClick={() => void handleCreate()}
          >
            {t("tokens.submit")}
          </Button>
        </div>
      </Card>

      <Show when={tokens.loading}>
        <div class="p-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <Spinner size="md" />
          <span class="text-xs">{t("common.loading")}</span>
        </div>
      </Show>

      {/* Existing Tokens Table */}
      <Show when={tokens()}>
        {(list) => (
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-[var(--text)]">现有访问令牌</h3>
              <Badge variant="neutral">{list().length} 个令牌</Badge>
            </div>

            <Show
              when={list().length > 0}
              fallback={
                <EmptyState
                  icon="i-ri-key-line"
                  title={t("tokens.empty")}
                  description="在上方填写表单创建您的第一个 API 访问令牌"
                />
              }
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow hoverable={false}>
                      <TableHeader class="w-[25%]">标签名称</TableHeader>
                      <TableHeader class="w-[30%]">权限 Scopes</TableHeader>
                      <TableHeader class="w-[20%]">过期时间</TableHeader>
                      <TableHeader class="w-[12%]">状态</TableHeader>
                      <TableHeader class="w-[13%] text-right">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={list()}>
                      {(tok) => (
                        <TableRow>
                          <TableCell>
                            <span class="font-medium text-xs text-[var(--text)]">{tok.label}</span>
                          </TableCell>

                          <TableCell>
                            <div class="flex flex-wrap gap-1">
                              <For each={tok.scopes}>
                                {(sc) => (
                                  <Badge variant="neutral" size="sm">
                                    {sc}
                                  </Badge>
                                )}
                              </For>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span class="text-xs text-[var(--muted)] font-mono">
                              {tok.expiresAt ? new Date(tok.expiresAt).toLocaleDateString() : "永久有效"}
                            </span>
                          </TableCell>

                          <TableCell>
                            {tok.revoked ? (
                              <Badge variant="danger" size="sm" dot>
                                已撤销
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm" dot>
                                正常使用
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell class="text-right">
                            <Show when={!tok.revoked}>
                              <Button
                                variant="danger"
                                size="xs"
                                loading={revokingId() === tok.id}
                                icon="i-ri-delete-bin-line"
                                onClick={() => void handleRevoke(tok.id)}
                              >
                                {t("tokens.revoke")}
                              </Button>
                            </Show>
                          </TableCell>
                        </TableRow>
                      )}
                    </For>
                  </TableBody>
                </Table>
              </TableContainer>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
