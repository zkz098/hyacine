import type { Env } from "../types";
import { loadEffectiveConfig } from "./config";

/**
 * Primary 模式：远程编辑保存后通过 GitHub repository_dispatch 触发
 * 博客仓库的 hyacine-bridge workflow（D1 → git 导出方向）。
 */

export interface DispatchResult {
  dispatched: boolean;
  repo: string | null;
  error?: string;
}

export async function triggerExportDispatch(env: Env): Promise<DispatchResult> {
  const cfg = await loadEffectiveConfig(env);
  const owner = cfg.github.repoOwner.trim();
  const repo = cfg.github.repoName.trim();
  const token = cfg.github.token.trim();
  if (owner.length === 0 || repo.length === 0 || token.length === 0) {
    return { dispatched: false, repo: null, error: "GitHub 未配置（repoOwner/repoName/token）" };
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "hyacine:export", client_payload: {} }),
    });
    if (!response.ok) {
      const text = await response.text();
      return {
        dispatched: false,
        repo: `${owner}/${repo}`,
        error: `GitHub API ${response.status}: ${text.slice(0, 300)}`,
      };
    }
    return { dispatched: true, repo: `${owner}/${repo}` };
  } catch (error) {
    return { dispatched: false, repo: `${owner}/${repo}`, error: String(error) };
  }
}