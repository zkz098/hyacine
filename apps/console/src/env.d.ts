declare module "*.css";
declare module "virtual:uno.css";
// Vite 资产 URL 导入（satteri WASM 修补绑定用）
declare module "*?url" {
  const url: string;
  export default url;
}

// @napi-rs/wasm-runtime 无类型声明：napi-rs 生成的 wasm 绑定运行时，按需宽类型声明
// oxlint-disable-next-line @typescript-eslint/no-explicit-any -- napi 动态导出，宽类型合理
declare module "@napi-rs/wasm-runtime" {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- 见上
  export function createOnMessage(...args: any[]): any;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- 见上
  export function getDefaultContext(): any;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- 见上
  export function instantiateNapiModule(
    bytes: ArrayBuffer,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- 见上
    options: any,
  ): Promise<{ instance: any; module: any; napiModule: { exports: any } }>;
  // oxlint-disable-next-line typescript/no-extraneous-class
  export class WASI {
    constructor(options?: { version?: string });
  }
}
