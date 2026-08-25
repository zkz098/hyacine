/**
 * satteri 浏览器(WASI)绑定修补版。
 *
 * 原版 @bruits/satteri-wasm32-wasi 的 satteri_napi.wasi-browser.js 用
 * `new URL('./satteri_napi.wasm32-wasi.wasm', import.meta.url)` + `new Worker(new URL(...))`
 * 定位 wasm/worker：
 * - tauri dev(vite dev) 下这些 node_modules 原始路径请求会被 SPA 兜底成 index.html，
 *   fetch 拿到 HTML → WebAssembly.instantiate 报
 *   "expected magic word 00 61 73 6d, found 3c 21 64 6f (<!do)"；
 * - 生产 build 下 wasm 文件名被 hash(assets/satteri_napi.wasm32-wasi-<hash>.wasm)，
 *   原相对 URL 同样失效。
 *
 * 这里改用 Vite 的 `?url` 资产导入拿到正确 URL（dev 可服务、build 正确带 hash），
 * 并在 vite.config resolve.alias 把裸导入 `@bruits/satteri-wasm32-wasi` 指向本文件。
 */
import {
  createOnMessage as __wasmCreateOnMessageForFsProxy,
  getDefaultContext as __emnapiGetDefaultContext,
  instantiateNapiModule as __emnapiInstantiateNapiModule,
  WASI as __WASI,
} from "@napi-rs/wasm-runtime";

// ?url 资产导入：Vite 会保证 dev 可服务、build 输出带 hash 的正确资源 URL
import __wasmUrl from "@bruits/satteri-wasm32-wasi/satteri_napi.wasm32-wasi.wasm?url";

const __wasi = new __WASI({
  version: "preview1",
});

const __emnapiContext = __emnapiGetDefaultContext();

const __sharedMemory = new WebAssembly.Memory({
  initial: 4000,
  maximum: 65536,
  shared: true,
});

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer());

const {
  instance: __napiInstance,
  module: __wasiModule,
  napiModule: __napiModule,
} = await __emnapiInstantiateNapiModule(__wasmFile, {
  context: __emnapiContext,
  asyncWorkPoolSize: 4,
  wasi: __wasi,
  onCreateWorker() {
    // 保持静态 new URL 模式：vite/rollup 会把它当作 worker 资产打包/解析
    return new Worker(
      new URL("@bruits/satteri-wasm32-wasi/wasi-worker-browser.mjs", import.meta.url),
      { type: "module" },
    );
  },
  overwriteImports(importObject: { env?: Record<string, unknown>; napi?: Record<string, unknown>; emnapi?: Record<string, unknown> }) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    };
    return importObject;
  },
  beforeInit({ instance }: { instance: { exports: Record<string, () => void> } }) {
    for (const name of Object.keys(instance.exports)) {
      if (name.startsWith("__napi_register__")) {
        instance.exports[name]?.();
      }
    }
  },
});

export default __napiModule.exports;
export const applyCommandsAndCompileHandle = __napiModule.exports.applyCommandsAndCompileHandle;
export const applyCommandsAndConvertToHastHandle =
  __napiModule.exports.applyCommandsAndConvertToHastHandle;
export const applyCommandsAndRenderHandle = __napiModule.exports.applyCommandsAndRenderHandle;
export const applyCommandsToHandle = __napiModule.exports.applyCommandsToHandle;
export const applyCommandsToMdastHandle = __napiModule.exports.applyCommandsToMdastHandle;
export const applyMdastCommandsAndConvertAndCompile =
  __napiModule.exports.applyMdastCommandsAndConvertAndCompile;
export const applyMdastCommandsAndConvertAndRender =
  __napiModule.exports.applyMdastCommandsAndConvertAndRender;
export const compileHandle = __napiModule.exports.compileHandle;
export const compileMdx = __napiModule.exports.compileMdx;
export const convertMdastToHastHandle = __napiModule.exports.convertMdastToHastHandle;
export const createHastHandle = __napiModule.exports.createHastHandle;
export const createHastHandleFromHtml = __napiModule.exports.createHastHandleFromHtml;
export const createHastHandleWithFrontmatter = __napiModule.exports.createHastHandleWithFrontmatter;
export const createMdastHandle = __napiModule.exports.createMdastHandle;
export const createMdxHastHandle = __napiModule.exports.createMdxHastHandle;
export const createMdxHastHandleWithFrontmatter =
  __napiModule.exports.createMdxHastHandleWithFrontmatter;
export const createMdxMdastHandle = __napiModule.exports.createMdxMdastHandle;
export const dropHandle = __napiModule.exports.dropHandle;
export const getHandleSource = __napiModule.exports.getHandleSource;
export const getMdastFrontmatter = __napiModule.exports.getMdastFrontmatter;
export const getNodeData = __napiModule.exports.getNodeData;
export const markdownToHtmlFast = __napiModule.exports.markdownToHtmlFast;
export const markdownToJsFast = __napiModule.exports.markdownToJsFast;
export const mdastTextContentHandle = __napiModule.exports.mdastTextContentHandle;
export const mdxToJsFast = __napiModule.exports.mdxToJsFast;
export const parseEsm = __napiModule.exports.parseEsm;
export const parseExpression = __napiModule.exports.parseExpression;
export const parseToHtml = __napiModule.exports.parseToHtml;
export const renderHandle = __napiModule.exports.renderHandle;
export const serializeHandle = __napiModule.exports.serializeHandle;
export const setNodeData = __napiModule.exports.setNodeData;
export const textContentHandle = __napiModule.exports.textContentHandle;
export const walkHandle = __napiModule.exports.walkHandle;
export const walkMdastHandle = __napiModule.exports.walkMdastHandle;