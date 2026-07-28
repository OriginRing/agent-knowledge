import type { AgentChat } from "@view/interfaces/agent-interface";
import type { HistorySessionInterface } from "@view/interfaces/history-interface";

export const rehydrateHistoryMessages = (
  records: HistorySessionInterface[],
): AgentChat[] =>
  records.map((record, index) => {
    const nodes = [...(record.nodes ?? [])];
    if (
      record.role === "assistant" &&
      record.artifacts?.length &&
      !nodes.some((node) => node.kind === "file")
    ) {
      const files = record.artifacts.map((artifact) => ({
        fileUrl: artifact.url,
        fileName: artifact.name,
        format: artifact.format,
        mimeType: artifact.mimeType,
        size: artifact.size,
      }));
      nodes.push({
        id: `legacy-file-node-${index}`,
        kind: "file",
        name: "artifact_generator",
        title: "生成文件",
        summary: `已生成 ${files.length} 个文件`,
        status: "success",
        fileUrl: files.map((file) => file.fileUrl).join(","),
        details: { files, errors: [] },
      });
    }
    return {
      key: record.key || `history-${index}`,
      role:
        record.role === "assistant" || record.role === "system"
          ? record.role
          : "user",
      content: record.content ?? "",
      files: record.files ?? "",
      thinkMessage: record.thinkMessage ?? "",
      nodes,
      artifacts: record.artifacts ?? [],
      knowledge: record.knowledge ?? [],
      skills: record.skills ?? [],
      status: record.status ?? "complete",
      complete: record.complete ?? true,
      error: record.error ?? null,
      thinking: false,
      loading: false,
    };
  });
