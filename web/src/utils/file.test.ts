import { describe, expect, it } from "vitest";

import { splitUrlToFileArr } from "./file";

describe("splitUrlToFileArr", () => {
  it("从按日期归档的 OSS URL 还原带时间戳文件名", () => {
    const files = splitUrlToFileArr(
      "https://bucket.example/uploads/20260729/%E5%AD%A3%E5%BA%A6%20%E6%8A%A5%E5%91%8A-1785328000000000000.docx",
    );

    expect(files).toEqual([
      {
        name: "季度 报告-1785328000000000000.docx",
        url: "https://bucket.example/uploads/20260729/%E5%AD%A3%E5%BA%A6%20%E6%8A%A5%E5%91%8A-1785328000000000000.docx",
      },
    ]);
  });
});
