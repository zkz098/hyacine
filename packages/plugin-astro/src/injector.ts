import { parse } from "@astrojs/compiler";
import { pascalCase } from "es-toolkit";
import MagicString from "magic-string";
import type { InjectPointDetail } from "@hyacine/contract";

function walkDeep(
  node: any,
  callback: (node: any, ancestors: any[]) => void,
  ancestors: any[] = [],
): void {
  callback(node, ancestors);
  if (node.children && Array.isArray(node.children)) {
    const nextAncestors = [...ancestors, node];
    for (const child of node.children) {
      walkDeep(child, callback, nextAncestors);
    }
  }
}

export function parseSelectorPart(part: string): {
  tag?: string;
  id?: string;
  classes: string[];
} {
  let tag: string | undefined;
  let id: string | undefined;
  const classes: string[] = [];

  const tokens = part.match(/([.#]?[a-zA-Z0-9_-]+)/g) || [];

  for (const token of tokens) {
    if (token.startsWith("#")) {
      id = token.slice(1);
    } else if (token.startsWith(".")) {
      classes.push(token.slice(1));
    } else if (!tag && !token.startsWith(".") && !token.startsWith("#")) {
      tag = token;
    }
  }

  return { tag, id, classes };
}

export function matchesSingleElement(node: any, selectorPart: string): boolean {
  if (!node || node.type !== "element") return false;

  const { tag, id, classes } = parseSelectorPart(selectorPart.trim());

  if (tag && node.name?.toLowerCase() !== tag.toLowerCase()) {
    return false;
  }

  if (id) {
    const idAttr = node.attributes?.find((a: any) => a.name === "id");
    if (!idAttr || idAttr.value !== id) {
      return false;
    }
  }

  if (classes.length > 0) {
    const classAttr = node.attributes?.find((a: any) => a.name === "class");
    if (!classAttr || typeof classAttr.value !== "string") {
      return false;
    }
    const nodeClasses = classAttr.value.split(/\s+/).filter(Boolean);
    const hasAllClasses = classes.every((c) => nodeClasses.includes(c));
    if (!hasAllClasses) {
      return false;
    }
  }

  return true;
}

/**
 * 检查 AST 节点是否匹配 CSS 选择器（支持 tag, .class, #id, tag.class, 以及后代选择器 a b）
 */
export function matchesSelector(node: any, selector: string, ancestors: any[] = []): boolean {
  if (!node || node.type !== "element") return false;

  const parts = selector.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  const targetPart = parts[parts.length - 1]!;
  if (!matchesSingleElement(node, targetPart)) {
    return false;
  }

  if (parts.length === 1) {
    return true;
  }

  let partIndex = parts.length - 2;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (matchesSingleElement(ancestor, parts[partIndex]!)) {
      partIndex--;
      if (partIndex < 0) break;
    }
  }

  return partIndex < 0;
}

export function getOffsetFromLineCol(code: string, line: number, column: number): number {
  let currentLine = 1;
  let currentOffset = 0;
  while (currentLine < line && currentOffset < code.length) {
    const nextNewline = code.indexOf("\n", currentOffset);
    if (nextNewline === -1) break;
    currentOffset = nextNewline + 1;
    currentLine++;
  }
  return Math.min(code.length, currentOffset + (column - 1));
}

export function getNodeOffsets(
  code: string,
  node: any,
): { start: number; end: number } | null {
  if (!node?.position?.start || !node?.position?.end) return null;

  const startLine = node.position.start.line;
  const startCol = node.position.start.column;
  const endLine = node.position.end.line;
  const endCol = node.position.end.column;

  if (
    typeof startLine === "number" &&
    typeof startCol === "number" &&
    typeof endLine === "number" &&
    typeof endCol === "number"
  ) {
    const start = getOffsetFromLineCol(code, startLine, startCol);
    const end = getOffsetFromLineCol(code, endLine, endCol);
    return { start, end };
  }

  if (
    typeof node.position.start.offset === "number" &&
    typeof node.position.end.offset === "number"
  ) {
    return { start: node.position.start.offset, end: node.position.end.offset };
  }

  return null;
}

export interface AstInjectOptions {
  injectPoints: Record<string, InjectPointDetail>;
  /** 是否只处理包含特定选择器的文件 */
  filter?: (id: string) => boolean;
}

/**
 * 将 AST 插槽组件安全注入到 Astro 组件源码中
 */
export async function injectAstroAST(
  code: string,
  id: string,
  options: AstInjectOptions,
): Promise<{ code: string; map: any } | null> {
  const { injectPoints } = options;
  const activeEntries = Object.entries(injectPoints);
  if (activeEntries.length === 0) return null;

  try {
    const result = await parse(code, { position: true });
    const ast = result.ast;
    if (!ast) return null;

    // 1. 扫描当前模板中是否已经存在显式声明的 <HyacineOutlet name="..." />
    const existingOutlets = new Set<string>();
    walkDeep(ast, (node) => {
      if (node.type === "element" || node.type === "component") {
        if (node.name === "HyacineOutlet") {
          const nameAttr = node.attributes?.find((a: any) => a.name === "name");
          if (nameAttr?.value) {
            existingOutlets.add(String(nameAttr.value));
          }
        }
      }
    });

    const s = new MagicString(code);
    const slotsToImport = new Set<string>();
    let hasModifications = false;

    // 2. 遍历 AST 寻找选择器匹配节点
    walkDeep(ast, (node, ancestors) => {
      if (node.type !== "element") return;

      for (const [slotName, detail] of activeEntries) {
        // 如果当前模板已经显式声明了该 Slot 的 Outlet，则跳过 AST 注入
        if (existingOutlets.has(slotName)) continue;

        if (matchesSelector(node, detail.selector, ancestors)) {
          const compName = `HyacineSlot_${pascalCase(slotName)}`;
          slotsToImport.add(slotName);

          const injectTag = `\n<${compName} context={Astro.props?.entry ?? Astro.props?.post ?? Astro.props} />\n`;
          const pos = detail.position ?? "append";
          const offsets = getNodeOffsets(code, node);

          if (offsets) {
            if (pos === "before") {
              s.appendLeft(offsets.start, injectTag);
              hasModifications = true;
            } else if (pos === "after") {
              s.appendRight(offsets.end, injectTag);
              hasModifications = true;
            } else if (pos === "prepend") {
              // 插入到首个子节点前，或开标签后
              const closingAngleIndex = code.indexOf(">", offsets.start);
              if (closingAngleIndex !== -1) {
                s.appendRight(closingAngleIndex + 1, injectTag);
                hasModifications = true;
              }
            } else {
              // 默认 append：插入到闭标签前
              const lastClosing = code.lastIndexOf("</", offsets.end);
              if (lastClosing !== -1 && lastClosing >= offsets.start) {
                s.appendLeft(lastClosing, injectTag);
              } else {
                s.appendRight(offsets.end, injectTag);
              }
              hasModifications = true;
            }
          }
        }
      }
    });

    if (!hasModifications || slotsToImport.size === 0) {
      return null;
    }

    // 3. 在 Frontmatter 中注入虚拟组件导入
    const importStatements = Array.from(slotsToImport)
      .map((slotName) => {
        const compName = `HyacineSlot_${pascalCase(slotName)}`;
        return `import ${compName} from "virtual:hyacine/slots/${slotName}.astro";`;
      })
      .join("\n");

    // 查找 Frontmatter ---
    const firstDash = code.indexOf("---");
    if (firstDash !== -1) {
      const secondDash = code.indexOf("---", firstDash + 3);
      if (secondDash !== -1) {
        // 在现有的 Frontmatter 顶部注入（找到首行 --- 后的换行符处安全插入）
        const lineEnd = code.indexOf("\n", firstDash);
        const insertPos = lineEnd !== -1 && lineEnd < secondDash ? lineEnd + 1 : firstDash + 3;
        s.appendLeft(insertPos, `${importStatements}\n`);
      } else {
        // 新建 Frontmatter
        s.prepend(`---\n${importStatements}\n---\n`);
      }
    } else {
      // 模板没有 Frontmatter，在最顶部新建
      s.prepend(`---\n${importStatements}\n---\n`);
    }

    return {
      code: s.toString(),
      map: s.generateMap({ hires: true, source: id }),
    };
  } catch (err) {
    // 容错沙箱：解析失败不中断构建，仅在调试下警示
    console.warn(`[hyacine:ast-injector] Failed to parse AST for ${id}:`, err);
    return null;
  }
}
