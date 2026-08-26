import { parse } from "@astrojs/compiler";
import { pascalCase } from "es-toolkit";
import MagicString from "magic-string";
import type { InjectPointDetail } from "@hyacine/contract";

function walkDeep(node: any, callback: (node: any) => void): void {
  callback(node);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkDeep(child, callback);
    }
  }
}

/**
 * 检查 AST 节点是否匹配简易 CSS 选择器（支持 tag, .class, #id）
 */
export function matchesSelector(node: any, selector: string): boolean {
  if (node.type !== "element") return false;

  const sel = selector.trim();
  if (sel.startsWith("#")) {
    const id = sel.slice(1);
    const idAttr = node.attributes?.find((a: any) => a.name === "id");
    return idAttr && idAttr.value === id;
  }

  if (sel.startsWith(".")) {
    const className = sel.slice(1);
    const classAttr = node.attributes?.find((a: any) => a.name === "class");
    if (classAttr && typeof classAttr.value === "string") {
      const classes = classAttr.value.split(/\s+/);
      return classes.includes(className);
    }
    return false;
  }

  return node.name === sel;
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
    walkDeep(ast, (node) => {
      if (node.type !== "element") return;

      for (const [slotName, detail] of activeEntries) {
        // 如果当前模板已经显式声明了该 Slot 的 Outlet，则跳过 AST 注入
        if (existingOutlets.has(slotName)) continue;

        if (matchesSelector(node, detail.selector)) {
          const compName = `HyacineSlot_${pascalCase(slotName)}`;
          slotsToImport.add(slotName);

          const injectTag = `\n<${compName} context={Astro.props?.entry ?? Astro.props?.post ?? Astro.props} />\n`;
          const pos = detail.position ?? "append";

          if (node.position) {
            if (pos === "before" && node.position.start) {
              s.appendLeft(node.position.start.offset, injectTag);
              hasModifications = true;
            } else if (pos === "after" && node.position.end) {
              s.appendRight(node.position.end.offset, injectTag);
              hasModifications = true;
            } else if (pos === "prepend") {
              // 插入到首个子节点前，或开标签后
              const startOffset = node.position.start?.offset ?? 0;
              // 寻找首个 '>' 结束开标签
              const closingAngleIndex = code.indexOf(">", startOffset);
              if (closingAngleIndex !== -1) {
                s.appendRight(closingAngleIndex + 1, injectTag);
                hasModifications = true;
              }
            } else {
              // 默认 append：插入到闭标签前
              if (node.position.end) {
                // 查找最后的 '</'
                const endOffset = node.position.end.offset;
                const lastClosing = code.lastIndexOf("</", endOffset);
                if (lastClosing !== -1 && lastClosing >= (node.position.start?.offset ?? 0)) {
                  s.appendLeft(lastClosing, injectTag);
                } else {
                  s.appendRight(endOffset, injectTag);
                }
                hasModifications = true;
              }
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
        // 在现有的 Frontmatter 顶部注入
        s.appendRight(firstDash + 3, `\n${importStatements}\n`);
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
