import { describe, expect, it } from "vitest";
import { validateFrontmatter, coerceFieldValue } from "./collectionValidate";
import type { CollectionFieldUi } from "@hyacine/contract";

const fields: CollectionFieldUi[] = [
  { key: "title", kind: "string", required: true, hasDefault: false },
  { key: "date", kind: "date", required: true, hasDefault: false },
  {
    key: "license",
    kind: "enum",
    required: false,
    hasDefault: false,
    values: ["CC-BY-4.0", "CC-BY-NC-4.0"],
  },
  { key: "draft", kind: "boolean", required: false, hasDefault: false },
  { key: "tags", kind: "string[]", required: false, hasDefault: false },
  { key: "password", kind: "string", required: false, hasDefault: false, secret: true },
];

describe("validateFrontmatter", () => {
  it("合法数据通过", () => {
    expect(
      validateFrontmatter(fields, {
        title: "Hello",
        date: "2026-08-24",
        license: "CC-BY-4.0",
        draft: false,
        tags: ["a", "b"],
      }),
    ).toEqual([]);
  });

  it("缺必填 → 报错（空串也算缺失）", () => {
    expect(validateFrontmatter(fields, { title: " ", date: "" })).toEqual([
      "缺少必填字段 title",
      "缺少必填字段 date",
    ]);
  });

  it("enum 越界 / date 非法", () => {
    const errors = validateFrontmatter(fields, {
      title: "t",
      date: "2026/13/99",
      license: "CC-OTHER",
    });
    expect(errors).toContain("license 须为：CC-BY-4.0 / CC-BY-NC-4.0");
    expect(errors.some((e) => e.startsWith("date"))).toBe(true);
  });

  it("date 仅支持 YYYY-MM-DD 或可解析串", () => {
    expect(validateFrontmatter(fields, { title: "t", date: "2026-08-24T12:00:00.000Z" })).toEqual(
      [],
    );
    expect(validateFrontmatter(fields, { title: "t", date: "not-a-date" }).length).toBeGreaterThan(
      0,
    );
  });

  it("boolean 接受 true/false 字符串；string[] 必须是数组", () => {
    expect(validateFrontmatter(fields, { title: "t", date: "2026-01-01", draft: "true" })).toEqual(
      [],
    );
    expect(validateFrontmatter(fields, { title: "t", date: "2026-01-01", tags: "a" })).toContain(
      "tags 须为数组",
    );
  });

  it("空值不参与非必填校验", () => {
    expect(validateFrontmatter(fields, { title: "t", date: "2026-01-01", license: "" })).toEqual(
      [],
    );
  });
});

describe("coerceFieldValue", () => {
  it("boolean/string[] 转换；空串 → undefined", () => {
    expect(coerceFieldValue(fields[3]!, "true")).toBe(true);
    expect(coerceFieldValue(fields[3]!, "false")).toBe(false);
    expect(coerceFieldValue(fields[4]!, " a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(coerceFieldValue(fields[1]!, "  ")).toBeUndefined();
  });
});
