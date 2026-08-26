import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { Editor } from "./Editor";

// Mock router
vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{ path: "posts/hello.md" }],
}));

// Mock tauri bridge
const mockFileContent = `---
title: Hello Post
tags: [tag1]
---
Initial content here.
`;

vi.mock("../tauri/bridge", () => ({
  isTauri: () => true,
  readTextFile: vi.fn(() => Promise.resolve(mockFileContent)),
  writeTextFile: vi.fn(() => Promise.resolve()),
}));

// Mock project store
vi.mock("../store/project", () => ({
  projectStore: {
    projectDir: () => "/mock/project",
    projectConfig: () => null,
    collectionsFile: () => null,
    refreshPosts: vi.fn(() => Promise.resolve()),
  },
}));

// Mock preview
vi.mock("../editor/preview", () => ({
  renderPreview: vi.fn(() => Promise.resolve(document.createElement("div"))),
}));

// Mock plugins
vi.mock("../editor/syntax/pluginSettings", () => ({
  loadEnabledPlugins: () => [],
}));

vi.mock("../editor/syntax/projectPlugins", () => ({
  loadProjectSyntaxPlugins: () => Promise.resolve({ plugins: [], errors: [] }),
}));

describe("Editor Component with Undo/Redo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正确渲染编辑器，撤销/重做按钮初始处于禁用状态", async () => {
    render(() => <Editor />);

    const undoBtn = await screen.findByRole("button", { name: /撤销/i });
    const redoBtn = await screen.findByRole("button", { name: /重做/i });

    expect(undoBtn).toBeInTheDocument();
    expect(redoBtn).toBeInTheDocument();

    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it("输入新文本后撤销按钮变为可用，点击撤销可恢复到初始文本", async () => {
    render(() => <Editor />);

    const undoBtn = await screen.findByRole("button", { name: /撤销/i });
    const redoBtn = await screen.findByRole("button", { name: /重做/i });
    const textarea = await screen.findByPlaceholderText("开始书写 Markdown / MDX 精彩内容...");

    expect((textarea as HTMLTextAreaElement).value).toContain("Initial content here.");
    expect(undoBtn).toBeDisabled();

    // 模拟用户输入
    fireEvent.input(textarea, { target: { value: "Initial content here. Added extra text." } });

    expect((textarea as HTMLTextAreaElement).value).toBe("Initial content here. Added extra text.");
    expect(undoBtn).toBeEnabled();
    expect(redoBtn).toBeDisabled();

    // 点击撤销
    fireEvent.click(undoBtn);

    expect((textarea as HTMLTextAreaElement).value).toBe("Initial content here.\n");
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeEnabled();

    // 点击重做
    fireEvent.click(redoBtn);
    expect((textarea as HTMLTextAreaElement).value).toBe("Initial content here. Added extra text.");
    expect(undoBtn).toBeEnabled();
    expect(redoBtn).toBeDisabled();
  });

  it("点击 ShokaX 提示卡插入模板后，可立即通过撤销恢复", async () => {
    render(() => <Editor />);

    const undoBtn = await screen.findByRole("button", { name: /撤销/i });
    const snippetBtn = await screen.findByTitle("提示卡");
    const textarea = (await screen.findByPlaceholderText("开始书写 Markdown / MDX 精彩内容...")) as HTMLTextAreaElement;

    expect(undoBtn).toBeDisabled();

    // 点击插入提示卡
    fireEvent.click(snippetBtn);

    expect(textarea.value).toContain(":::info");
    expect(undoBtn).toBeEnabled();

    // 撤销插入
    fireEvent.click(undoBtn);
    expect(textarea.value).toBe("Initial content here.\n");
  });

  it("支持通过键盘快捷键 Ctrl+Z / Ctrl+Y 触发撤销与重做", async () => {
    render(() => <Editor />);

    const undoBtn = await screen.findByRole("button", { name: /撤销/i });
    const textarea = (await screen.findByPlaceholderText("开始书写 Markdown / MDX 精彩内容...")) as HTMLTextAreaElement;

    // 输入文本
    fireEvent.input(textarea, { target: { value: "Keyboard shortcut test" } });
    expect(undoBtn).toBeEnabled();

    // 触发 Ctrl+Z 撤销
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true });
    expect(textarea.value).toBe("Initial content here.\n");

    // 触发 Ctrl+Y 重做
    fireEvent.keyDown(textarea, { key: "y", ctrlKey: true });
    expect(textarea.value).toBe("Keyboard shortcut test");

    // 再次触发 Ctrl+Shift+Z 重做（先撤销再用 Ctrl+Shift+Z 重做）
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true });
    expect(textarea.value).toBe("Initial content here.\n");

    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true, shiftKey: true });
    expect(textarea.value).toBe("Keyboard shortcut test");
  });
});
