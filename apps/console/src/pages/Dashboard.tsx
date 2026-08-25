import { createResource, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { Spinner } from "../components/Spinner";
import { isTauri } from "../tauri/bridge";

export function Dashboard(): import("solid-js").JSX.Element {
  const [stats, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    return client.stats();
  });

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.title")}
        description="云端博客数据统计与文章/资产分布总览"
        actions={
          <div class="flex items-center gap-2">
            <Show when={isTauri()}>
              <a href="#/workspace">
                <Button variant="secondary" size="sm" icon="i-ri-folder-open-line">
                  {t("workspace.title")}
                </Button>
              </a>
            </Show>
            <a href="#/posts">
              <Button variant="secondary" size="sm" icon="i-ri-article-line">
                {t("nav.posts")}
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              loading={stats.loading}
              icon="i-ri-refresh-line"
              onClick={() => void refetch()}
            >
              {t("dashboard.refresh")}
            </Button>
          </div>
        }
      />

      <Show when={stats.error}>
        <Alert variant="error" title="加载统计数据失败">
          {messageOf(stats.error)}
        </Alert>
      </Show>

      <Show when={stats.loading}>
        <div class="p-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <Spinner size="md" />
          <span class="text-xs">{t("common.loading")}</span>
        </div>
      </Show>

      <Show when={stats()}>
        {(data) => (
          <div class="flex flex-col gap-6">
            {/* Stat Cards (4 grid) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={t("dashboard.posts")}
                value={data().totals.posts}
                icon="i-ri-article-line"
                accentColor="primary"
                description={`已发布 ${data().totals.published} 篇 · 草稿 ${data().totals.drafts} 篇`}
              />
              <StatCard
                title={t("dashboard.drafts")}
                value={data().totals.drafts}
                icon="i-ri-draft-line"
                accentColor="warning"
                description="未发布文章，仅本地与 D1 存储"
              />
              <StatCard
                title={t("dashboard.published")}
                value={data().totals.published}
                icon="i-ri-checkbox-circle-line"
                accentColor="ok"
                description="已进入生产环境构建发布"
              />
              <StatCard
                title={t("dashboard.assets")}
                value={`${data().assets.remote} / ${data().assets.total}`}
                icon="i-ri-image-line"
                accentColor="info"
                description={`远程 R2 存储 / 总资产`}
              />
            </div>

            {/* Distribution Visualizations */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category distribution */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t("dashboard.byCategory")}</CardTitle>
                    <CardDescription>各文章分类文章收录数量分布</CardDescription>
                  </div>
                  <span class="text-xs font-semibold text-[var(--muted)] bg-[var(--g-2)] px-2 py-0.5 rounded-[4px]">
                    共 {Object.keys(data().byCategory).length} 个分类
                  </span>
                </CardHeader>

                <div class="flex flex-wrap gap-2 pt-2">
                  <For each={Object.entries(data().byCategory)}>
                    {([cat, count]) => {
                      const total = data().totals.posts || 1;
                      const percent = Math.round(((count as number) / total) * 100);
                      return (
                        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--g-1)] border border-[var(--border)] text-xs hover:border-[var(--accent)] transition-colors">
                          <span class="font-medium text-[var(--text)]">{cat}</span>
                          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--accent)] text-white font-mono">
                            {String(count)}
                          </span>
                          <span class="text-[10px] text-[var(--muted)] font-mono">({percent}%)</span>
                        </div>
                      );
                    }}
                  </For>
                  <Show when={Object.keys(data().byCategory).length === 0}>
                    <p class="text-xs text-[var(--muted)] py-4">暂无分类数据</p>
                  </Show>
                </div>
              </Card>

              {/* Monthly distribution chart */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t("dashboard.byMonth")}</CardTitle>
                    <CardDescription>近期各月份文章发布与归档趋势</CardDescription>
                  </div>
                  <span class="text-xs text-[var(--muted)]">近 {data().byMonth.length} 个月</span>
                </CardHeader>

                <div class="pt-4">
                  <div class="flex items-end gap-2 sm:gap-3 h-36 px-2 pb-1 border-b border-[var(--border)]">
                    <For each={data().byMonth}>
                      {(entry: { month: string; count: number }) => {
                        const max = Math.max(
                          ...data().byMonth.map((m: { count: number }) => m.count),
                          1,
                        );
                        const h = Math.round((entry.count / max) * 100);
                        return (
                          <div class="flex flex-col items-center gap-1.5 flex-1 min-w-[28px] group">
                            <div
                              class="w-full rounded-t-[4px] bg-[var(--accent)] hover:brightness-110 transition-all cursor-pointer relative"
                              style={`height:${String(Math.max(h, 8))}%`}
                              title={`${entry.month}: ${String(entry.count)} 篇`}
                            />
                            <span class="text-[10px] font-mono text-[var(--muted)] tracking-tighter truncate">
                              {entry.month.slice(5)}
                            </span>
                          </div>
                        );
                      }}
                    </For>
                    <Show when={data().byMonth.length === 0}>
                      <div class="w-full flex items-center justify-center h-full text-xs text-[var(--muted)]">
                        暂无月度数据
                      </div>
                    </Show>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
