import { createSignal, type Accessor } from "solid-js";

export interface EditorSnapshot {
  text: string;
  cursorStart: number;
  cursorEnd: number;
  timestamp?: number;
}

export interface EditorHistoryOptions {
  /** 最大历史记录步数，默认 100 */
  maxDepth?: number;
  /** 连续打字合并防抖阈值（毫秒），默认 400ms */
  debounceMs?: number;
}

export interface EditorHistory {
  /** 记录一次文本变更（输入或模板插入等） */
  record: (
    text: string,
    cursorStart?: number,
    cursorEnd?: number,
    options?: { force?: boolean },
  ) => void;
  /** 执行撤销，返回上一快照（若不可撤销则返回 null） */
  undo: () => EditorSnapshot | null;
  /** 执行重做，返回下一快照（若不可重做则返回 null） */
  redo: () => EditorSnapshot | null;
  /** 重置历史栈（载入文章或主动重置时调用） */
  reset: (initialText: string, cursorStart?: number, cursorEnd?: number) => void;
  /** 是否可以撤销（响应式 Signal） */
  canUndo: Accessor<boolean>;
  /** 是否可以重做（响应式 Signal） */
  canRedo: Accessor<boolean>;
  /** 当前快照（响应式 Signal） */
  current: Accessor<EditorSnapshot>;
}

/**
 * 创建用于编辑器文本内容与光标选区的撤销/重做历史栈管理引擎
 */
export function createEditorHistory(options: EditorHistoryOptions = {}): EditorHistory {
  const maxDepth = options.maxDepth ?? 100;
  const debounceMs = options.debounceMs ?? 400;

  let undoStack: EditorSnapshot[] = [];
  let redoStack: EditorSnapshot[] = [];

  let currentSnapshot: EditorSnapshot = {
    text: "",
    cursorStart: 0,
    cursorEnd: 0,
    timestamp: Date.now(),
  };

  let isTypingBurst = false;
  let burstTimer: ReturnType<typeof setTimeout> | undefined;

  const [canUndoSignal, setCanUndo] = createSignal(false);
  const [canRedoSignal, setCanRedo] = createSignal(false);
  const [currentSignal, setCurrent] = createSignal<EditorSnapshot>(currentSnapshot);

  const updateSignals = (): void => {
    setCanUndo(undoStack.length > 0);
    setCanRedo(redoStack.length > 0);
    setCurrent({ ...currentSnapshot });
  };

  const endBurst = (): void => {
    isTypingBurst = false;
    if (burstTimer !== undefined) {
      clearTimeout(burstTimer);
      burstTimer = undefined;
    }
  };

  const reset = (
    initialText: string,
    cursorStart = initialText.length,
    cursorEnd = initialText.length,
  ): void => {
    endBurst();
    undoStack = [];
    redoStack = [];
    currentSnapshot = {
      text: initialText,
      cursorStart,
      cursorEnd,
      timestamp: Date.now(),
    };
    updateSignals();
  };

  const record = (
    text: string,
    cursorStart = text.length,
    cursorEnd = text.length,
    opts: { force?: boolean } = {},
  ): void => {
    if (text === currentSnapshot.text) {
      currentSnapshot.cursorStart = cursorStart;
      currentSnapshot.cursorEnd = cursorEnd;
      updateSignals();
      return;
    }

    if (opts.force === true) {
      endBurst();
      undoStack.push({ ...currentSnapshot });
      if (undoStack.length > maxDepth) undoStack.shift();
      redoStack = [];
      currentSnapshot = {
        text,
        cursorStart,
        cursorEnd,
        timestamp: Date.now(),
      };
      updateSignals();
      return;
    }

    // 连续打字合并防抖处理
    if (isTypingBurst) {
      currentSnapshot = {
        text,
        cursorStart,
        cursorEnd,
        timestamp: Date.now(),
      };
      if (burstTimer !== undefined) clearTimeout(burstTimer);
      burstTimer = setTimeout(endBurst, debounceMs);
      updateSignals();
    } else {
      undoStack.push({ ...currentSnapshot });
      if (undoStack.length > maxDepth) undoStack.shift();
      redoStack = [];
      currentSnapshot = {
        text,
        cursorStart,
        cursorEnd,
        timestamp: Date.now(),
      };
      isTypingBurst = true;
      if (burstTimer !== undefined) clearTimeout(burstTimer);
      burstTimer = setTimeout(endBurst, debounceMs);
      updateSignals();
    }
  };

  const undo = (): EditorSnapshot | null => {
    endBurst();
    if (undoStack.length === 0) return null;

    const previous = undoStack.pop()!;
    redoStack.push({ ...currentSnapshot });
    currentSnapshot = previous;
    updateSignals();
    return { ...currentSnapshot };
  };

  const redo = (): EditorSnapshot | null => {
    endBurst();
    if (redoStack.length === 0) return null;

    const next = redoStack.pop()!;
    undoStack.push({ ...currentSnapshot });
    currentSnapshot = next;
    updateSignals();
    return { ...currentSnapshot };
  };

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: canUndoSignal,
    canRedo: canRedoSignal,
    current: currentSignal,
  };
}
