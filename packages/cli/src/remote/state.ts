import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface RemoteState {
  apiUrl?: string;
  apiToken?: string;
  lastSync?: {
    at: string;
    paths: string[];
  };
  lang?: string;
}

function getConfigDir(): string {
  const envDir = process.env.HYACINE_CONFIG_DIR;
  if (envDir !== undefined && envDir.length > 0) return envDir;
  // XDG config home or homedir fallback
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg !== undefined && xdg.length > 0) return join(xdg, "hyacine");
  // Windows APPDATA
  const appData = process.env.APPDATA;
  if (appData !== undefined && process.platform === "win32") return join(appData, "hyacine");
  return join(homedir(), ".config", "hyacine");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function loadRemoteState(): RemoteState {
  const p = getConfigPath();
  if (!existsSync(p)) return {};
  try {
    const raw = readFileSync(p, "utf8");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON parse returns any
    return JSON.parse(raw) as RemoteState;
  } catch {
    return {};
  }
}

export function saveRemoteState(state: RemoteState): void {
  const p = getConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2), "utf8");
}

export function clearRemoteState(): void {
  saveRemoteState({});
}

export function isRemoteConfigured(state: RemoteState): boolean {
  return (
    typeof state.apiUrl === "string" &&
    state.apiUrl.length > 0 &&
    typeof state.apiToken === "string" &&
    state.apiToken.length > 0
  );
}
