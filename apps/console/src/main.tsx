import { render } from "solid-js/web";
import { App } from "./app";
import "./styles/theme.css";
import "virtual:uno.css";

const root = document.getElementById("app");
if (root === null) throw new Error("missing #app");
render(() => <App />, root);
