// @vitest-environment happy-dom

import { saveAs } from "file-saver";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStandardDocxBlob } from "./docx-export";
import { saveChatResult } from "./save-file";
import { createHtmlBlob } from "./save-html";
import { createStandardXlsxBlob } from "./xlsx-export";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("./docx-export", () => ({ createStandardDocxBlob: vi.fn() }));
vi.mock("./save-html", () => ({ createHtmlBlob: vi.fn() }));
vi.mock("./xlsx-export", () => ({ createStandardXlsxBlob: vi.fn() }));

const mockedSaveAs = vi.mocked(saveAs);
const creators = {
  docx: vi.mocked(createStandardDocxBlob),
  html: vi.mocked(createHtmlBlob),
  xlsx: vi.mocked(createStandardXlsxBlob),
};

describe("下载格式路由", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-message-1">回答内容</div>';
    vi.clearAllMocks();
    creators.docx.mockResolvedValue(new Blob(["content"]));
    creators.html.mockReturnValue(new Blob(["content"]));
    creators.xlsx.mockResolvedValue(new Blob(["content"]));
  });

  it.each(["docx", "html", "xlsx"] as const)(
    "%s 只调用对应的格式实现",
    async (format) => {
      await saveChatResult("chat-message-1", format, "回答");

      expect(creators[format]).toHaveBeenCalledOnce();
      expect(
        Object.entries(creators).filter(
          ([key, creator]) => key !== format && creator.mock.calls.length > 0,
        ),
      ).toHaveLength(0);
      expect(mockedSaveAs).toHaveBeenCalledWith(
        expect.any(Blob),
        `回答.${format}`,
      );
    },
  );
});
