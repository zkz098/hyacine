import { createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { HyacineClient } from "@hyacine/contract";

const STORAGE_URL = "hyacine.apiUrl";
const STORAGE_TOKEN = "hyacine.token";
const STORAGE_THEME = "hyacine.theme";

export type Theme = "light" | "dark";

interface AppState {
  baseUrl: string;
  token: string | null;
  theme: Theme;
}

function loadState(): AppState {
  const baseUrl = localStorage.getItem(STORAGE_URL) ?? "";
  const token = localStorage.getItem(STORAGE_TOKEN);
  const themeRaw = localStorage.getItem(STORAGE_THEME);
  const theme: Theme = themeRaw === "dark" ? "dark" : "light";
  return { baseUrl, token, theme };
}

function persistState(state: AppState): void {
  if (state.baseUrl.length > 0) {
    localStorage.setItem(STORAGE_URL, state.baseUrl);
  } else {
    localStorage.removeItem(STORAGE_URL);
  }
  if (state.token !== null && state.token.length > 0) {
    localStorage.setItem(STORAGE_TOKEN, state.token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN);
  }
  localStorage.setItem(STORAGE_THEME, state.theme);
  document.documentElement.dataset.theme = state.theme;
}

const initial = loadState();
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = initial.theme;
}

const [state, setState] = createStore<AppState>(initial);

let clientCache: HyacineClient | null = null;
let cacheKey = "";

function getClient(): HyacineClient {
  const key = `${state.baseUrl}::${state.token ?? ""}`;
  if (clientCache !== null && cacheKey === key) return clientCache;
  cacheKey = key;
  clientCache = new HyacineClient({
    baseUrl: state.baseUrl.length > 0 ? state.baseUrl : "http://localhost:8787",
    token: state.token ?? undefined,
  });
  return clientCache;
}

function setBaseUrl(url: string): void {
  setState("baseUrl", url);
  persistState({ ...state, baseUrl: url });
  clientCache = null;
}

function setToken(token: string | null): void {
  setState("token", token);
  persistState({ ...state, token });
  clientCache = null;
}

function setTheme(theme: Theme): void {
  setState("theme", theme);
  persistState({ ...state, theme });
}

function clearAuth(): void {
  setToken(null);
}

function isAuthed(): boolean {
  return state.token !== null && state.token.length > 0;
}

export const apiStore = {
  get state() {
    return state;
  },
  getClient,
  setBaseUrl,
  setToken,
  setTheme,
  clearAuth,
  isAuthed,
};

export const ApiContext = createContext(apiStore);

export function useApi() {
  return useContext(ApiContext) ?? apiStore;
}
