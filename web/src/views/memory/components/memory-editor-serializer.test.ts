import { describe, expect, it } from "vitest";
import { serializeMemoryDocument } from "./memory-editor-serializer";

describe("serializeMemoryDocument", () => {
  it("保留段落和硬换行并移除空白块", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "第一行" },
              { type: "hardBreak" },
              { type: "text", text: "第二行" },
            ],
          },
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: "结尾" }] },
        ],
      }),
    ).toBe("第一行\n第二行\n\n结尾");
  });

  it("将项目列表和编号列表转换为带前缀的纯文本", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "偏好中文" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "回答简洁" }],
                  },
                ],
              },
            ],
          },
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "先给结论" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("- 偏好中文\n- 回答简洁\n\n3. 先给结论");
  });

  it("为嵌套列表保留层级缩进", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "旅行偏好" }],
                  },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "靠窗座位" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("- 旅行偏好\n  1. 靠窗座位");
  });

  it("忽略文字样式并保留引用内的段落换行", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              { type: "text", text: "回复偏好", marks: [{ type: "bold" }] },
            ],
          },
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "先给结论" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "再补充细节" }],
              },
            ],
          },
        ],
      }),
    ).toBe("回复偏好\n\n先给结论\n再补充细节");
  });

  it("将表格转换为按行换行、单元格分隔的纯文本", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "偏好" }],
                      },
                    ],
                  },
                  {
                    type: "tableHeader",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "内容" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "语言" }],
                      },
                    ],
                  },
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "中文" },
                          { type: "hardBreak" },
                          { type: "text", text: "简洁" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("偏好 | 内容\n语言 | 中文 简洁");
  });

  it("空表格不生成分隔符文本", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    content: [{ type: "paragraph" }],
                  },
                  {
                    type: "tableHeader",
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [{ type: "paragraph" }],
                  },
                  {
                    type: "tableCell",
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("");
  });

  it("将任务清单转换为带勾选状态的纯文本", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "先给结论" }],
                  },
                ],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "补充细节" }],
                  },
                  {
                    type: "taskList",
                    content: [
                      {
                        type: "taskItem",
                        attrs: { checked: false },
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "附带示例" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("- [x] 先给结论\n- [ ] 补充细节\n  - [ ] 附带示例");
  });

  it("空任务清单不生成占位文本", () => {
    expect(
      serializeMemoryDocument({
        type: "doc",
        content: [
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [{ type: "paragraph" }],
              },
            ],
          },
        ],
      }),
    ).toBe("");
  });
});
