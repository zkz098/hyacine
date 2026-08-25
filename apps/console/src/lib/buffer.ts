// gray-matter 会在渲染进程（浏览器 / Tauri WebView）里无条件引用 Node 的全局
// Buffer（lib/to-file.js -> utils.toBuffer 调 Buffer.from(input)），而浏览器/webview
// 没有 Buffer，导致 parseFrontmatter 抛 "Buffer is not defined"（症状：文章能列目录、
// 文件能读，但逐个解析全部静默失败 -> 空列表无报错）。
// 这里用官方 buffer 包在全局装一个 Buffer，让 gray-matter 全路径（parse/stringify）
// 都能用。
import { Buffer } from "buffer";

export function installBufferPolyfill(): void {
  const g = globalThis as unknown as { Buffer?: unknown };
  if (g.Buffer === undefined) {
    g.Buffer = Buffer;
  }
}
