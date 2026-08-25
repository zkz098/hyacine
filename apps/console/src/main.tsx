import { render } from "solid-js/web";
import { installBufferPolyfill } from "./lib/buffer";
import { App } from "./app";
import "./styles/theme.css";
import "virtual:uno.css";

// 必须先于任何 gray-matter 解析调用前装好 Buffer（渲染进程无 Node 全局）
installBufferPolyfill();

const root = document.getElementById("app");
if (root === null) throw new Error("missing #app");
render(() => <App />, root);
