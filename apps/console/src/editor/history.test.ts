import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createEditorHistory } from "./history";

describe("createEditorHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始状态为空且不可撤销/重做", () => {
    const history = createEditorHistory();
    expect(history.current().text).toBe("");
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("reset 初始化文本并清空历史栈", () => {
    const history = createEditorHistory();
    history.record("hello", 5, 5, { force: true });
    expect(history.canUndo()).toBe(true);

    history.reset("initial post content", 20, 20);
    expect(history.current().text).toBe("initial post content");
    expect(history.current().cursorStart).toBe(20);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("支持单次强制快照录入 (force: true) 及撤销/重做", () => {
    const history = createEditorHistory();
    history.reset("Hello", 5, 5);

    history.record("Hello World", 11, 11, { force: true });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.current().text).toBe("Hello World");

    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone?.text).toBe("Hello");
    expect(undone?.cursorStart).toBe(5);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone).not.toBeNull();
    expect(redone?.text).toBe("Hello World");
    expect(redone?.cursorStart).toBe(11);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it("连续快速打字合并为同一次撤销批次 (Typing Burst)", () => {
    const history = createEditorHistory({ debounceMs: 400 });
    history.reset("", 0, 0);

    // 用户快速连续输入 'a', 'ab', 'abc'
    history.record("a", 1, 1);
    vi.advanceTimersByTime(100);
    history.record("ab", 2, 2);
    vi.advanceTimersByTime(100);
    history.record("abc", 3, 3);

    expect(history.current().text).toBe("abc");
    expect(history.canUndo()).toBe(true);

    // 撤销时直接回到该打字批次开始前的状态
    const undone = history.undo();
    expect(undone?.text).toBe("");
    expect(undone?.cursorStart).toBe(0);

    // 重做直接恢复整个打字批次
    const redone = history.redo();
    expect(redone?.text).toBe("abc");
  });

  it("超过防抖时间后的连续输入会形成新的撤销步数", () => {
    const history = createEditorHistory({ debounceMs: 400 });
    history.reset("", 0, 0);

    // 第一段输入
    history.record("first", 5, 5);
    // 超过防抖时间，结束第一批次
    vi.advanceTimersByTime(500);

    // 第二段输入
    history.record("first second", 12, 12);
    vi.advanceTimersByTime(500);

    expect(history.current().text).toBe("first second");

    // 第一次撤销 -> 回到 "first"
    expect(history.undo()?.text).toBe("first");
    // 第二次撤销 -> 回到 ""
    expect(history.undo()?.text).toBe("");
    // 无法再撤销
    expect(history.undo()).toBeNull();

    // 第一次重做 -> "first"
    expect(history.redo()?.text).toBe("first");
    // 第二次重做 -> "first second"
    expect(history.redo()?.text).toBe("first second");
  });

  it("插入模板代码时使用 force 产生独立快照", () => {
    const history = createEditorHistory({ debounceMs: 400 });
    history.reset("text before", 11, 11);

    // 模拟从工具栏插入 :::info 模板
    history.record("text before\n:::info\ncontent\n:::\n", 30, 30, { force: true });
    expect(history.current().text).toBe("text before\n:::info\ncontent\n:::\n");

    // 立即撤销
    const undone = history.undo();
    expect(undone?.text).toBe("text before");
    expect(undone?.cursorStart).toBe(11);
  });

  it("在撤销后产生新编辑会清空 Redo 栈", () => {
    const history = createEditorHistory();
    history.reset("A", 1, 1);
    history.record("B", 1, 1, { force: true });
    history.record("C", 1, 1, { force: true });

    history.undo(); // back to B
    expect(history.canRedo()).toBe(true);

    // 在 B 状态下产生新的分支编辑 D
    history.record("D", 1, 1, { force: true });
    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toBeNull();

    // 撤销应该回到 B
    expect(history.undo()?.text).toBe("B");
  });

  it("当文本未变时仅更新光标位置，不产生历史快照", () => {
    const history = createEditorHistory();
    history.reset("Hello", 0, 0);

    history.record("Hello", 3, 3);
    expect(history.current().cursorStart).toBe(3);
    expect(history.canUndo()).toBe(false);
  });

  it("超过 maxDepth 时会丢弃最老快照", () => {
    const history = createEditorHistory({ maxDepth: 3 });
    history.reset("0", 1, 1);

    history.record("1", 1, 1, { force: true });
    history.record("2", 1, 1, { force: true });
    history.record("3", 1, 1, { force: true });
    history.record("4", 1, 1, { force: true });

    // 最多可撤销 3 步：4 -> 3 -> 2 -> 1 (0 被丢弃)
    expect(history.undo()?.text).toBe("3");
    expect(history.undo()?.text).toBe("2");
    expect(history.undo()?.text).toBe("1");
    expect(history.undo()).toBeNull();
  });
});
