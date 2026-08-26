import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { MemoryRouter, Route } from "@solidjs/router";
import { Workspace } from "./Workspace";
import { projectStore } from "../store/project";

vi.mock("../tauri/bridge", () => ({
  isTauri: vi.fn(() => true),
  openFolderDialog: vi.fn(() => Promise.resolve("/mock/blog")),
  writeTextFile: vi.fn(() => Promise.resolve()),
  removeFile: vi.fn(() => Promise.resolve()),
}));

describe("Workspace", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { isTauri } = await import("../tauri/bridge");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it("非 tauri 显示提示", async () => {
    const { isTauri } = await import("../tauri/bridge");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    render(() => (
      <MemoryRouter>
        <Route path="/" component={Workspace} />
      </MemoryRouter>
    ));
    expect(screen.getByText("此功能仅桌面模式可用")).toBeInTheDocument();
  });

  it("显示工作台标题", () => {
    render(() => (
      <MemoryRouter>
        <Route path="/" component={Workspace} />
      </MemoryRouter>
    ));
    expect(screen.getByText("工作台")).toBeInTheDocument();
  });

  it("支持单篇删除与多选批量删除", async () => {
    const { removeFile } = await import("../tauri/bridge");

    // Mock projectStore
    vi.spyOn(projectStore, "projectDir").mockReturnValue("/mock/blog");
    vi.spyOn(projectStore, "loading").mockReturnValue(false);
    vi.spyOn(projectStore, "error").mockReturnValue(null);
    const now = new Date().toISOString();
    vi.spyOn(projectStore, "posts").mockReturnValue([
      {
        path: "src/posts/post-1.md",
        fullPath: "/mock/blog/src/posts/post-1.md",
        title: "Post One",
        slug: "post-1",
        draft: false,
        categories: ["tech"],
        hash: "hash1",
        collection: "posts",
        summaryPresent: true,
        updatedAt: now,
      },
      {
        path: "src/posts/post-2.md",
        fullPath: "/mock/blog/src/posts/post-2.md",
        title: "Post Two",
        slug: "post-2",
        draft: true,
        categories: ["life"],
        hash: "hash2",
        collection: "posts",
        summaryPresent: false,
        updatedAt: now,
      },
    ]);
    const refreshSpy = vi
      .spyOn(projectStore, "refreshPosts")
      .mockImplementation(() => Promise.resolve());

    render(() => (
      <MemoryRouter>
        <Route path="/" component={Workspace} />
      </MemoryRouter>
    ));

    expect(await screen.findByText("Post One")).toBeInTheDocument();
    expect(await screen.findByText("Post Two")).toBeInTheDocument();

    // 单篇删除 Post One
    const deleteBtns = screen.getAllByTitle("删除");
    expect(deleteBtns).toHaveLength(2);
    fireEvent.click(deleteBtns[0]!);

    // 确认弹窗
    expect(await screen.findByText("确认删除本地文章")).toBeInTheDocument();
    expect(screen.getAllByText("src/posts/post-1.md").length).toBeGreaterThan(0);

    const confirmBtn = screen.getByRole("button", { name: /确认删除/i });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(removeFile).toHaveBeenCalledWith("/mock/blog/src/posts/post-1.md");
      expect(refreshSpy).toHaveBeenCalled();
    });

    // 多选全选
    const selectAllCheckbox = screen.getByLabelText("全选");
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("已选择 2 篇")).toBeInTheDocument();
    const batchDeleteBtn = screen.getByRole("button", { name: /批量删除/i });
    fireEvent.click(batchDeleteBtn);

    expect(await screen.findByText("确认删除本地文章")).toBeInTheDocument();
    expect(screen.getAllByText("src/posts/post-1.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/posts/post-2.md").length).toBeGreaterThan(0);

    const confirmBatchBtn = screen.getByRole("button", { name: /确认删除 \(2\)/i });
    fireEvent.click(confirmBatchBtn);

    await vi.waitFor(() => {
      expect(removeFile).toHaveBeenCalledWith("/mock/blog/src/posts/post-2.md");
    });
  });
});
