import { exists, isTauri, readDirRecursive, readTextFile } from "../../tauri/bridge";
import { getRegisteredPlugins, registerSyntaxPlugin, type SyntaxPlugin } from "./types";

/**
 * 项目级语法插件加载：
 * 用户在自己的博客仓库放 `.hyacine/plugins/<name>.js`，文件内调用
 * `registerSyntaxPlugin({...})` 注册自定义组件/CSS（以及可选 mdast/hast）。
 *
 * 安全模型（v1）：本地项目插件 = 用户自持代码，等价于在自己机器上运行脚本；
 * 文档明示不要安装来源不明的插件文件。
 */

export interface ProjectPluginResult {
  loaded: string[];
  plugins: SyntaxPlugin[];
  errors: string[];
}

export async function loadProjectSyntaxPlugins(projectDir: string): Promise<ProjectPluginResult> {
  const empty: ProjectPluginResult = { loaded: [], plugins: [], errors: [] };
  if (!isTauri() || projectDir.length === 0) return empty;

  const dir = `${projectDir}/.hyacine/plugins`;
  if (!(await exists(dir))) return empty;

  let files: string[];
  try {
    files = (await readDirRecursive(dir)).filter((f) => f.endsWith(".js"));
  } catch {
    return empty;
  }

  const before = new Set(getRegisteredPlugins().map((p) => p.name));
  const errors: string[] = [];
  for (const file of files) {
    try {
      const code = await readTextFile(file);
      // 受限执行：仅暴露注册器；函数体默认访问全局（浏览器/WebView 环境）。
      // oxlint-disable-next-line typescript/no-implied-eval -- 本地插件加载器（用户自持代码）
      const exec = new Function(
        "registerSyntaxPlugin",
        `${code}\n//# sourceURL=hyacine-plugin:${encodeURIComponent(file)}`,
      );
      exec(registerSyntaxPlugin);
    } catch (e) {
      errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const plugins = getRegisteredPlugins().filter((p) => !p.builtin);
  const loaded = plugins.map((p) => p.name).filter((n) => !before.has(n));
  return { loaded, plugins, errors };
}
