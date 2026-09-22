export function createHtmlBlob(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container
    .querySelectorAll("script, iframe, object, embed, form")
    .forEach((element) => element.remove());
  container
    .querySelectorAll(".markdown-code-actions")
    .forEach((element) => element.remove());
  container.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (
        attribute.name.toLowerCase().startsWith("on") ||
        (["href", "src"].includes(attribute.name.toLowerCase()) &&
          /^\s*javascript:/i.test(attribute.value))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return new Blob(
    [
      `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>智能体回答</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    * { box-sizing: border-box; }
    body { max-width: 170mm; margin: 0 auto; color: #1f1f1f; font: 14px/1.75 Arial, "Microsoft YaHei", sans-serif; overflow-wrap: anywhere; }
    img, svg, canvas { display: block; max-width: 100% !important; height: auto !important; margin: 12px auto; }
    table { width: 100% !important; max-width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 6px 8px; border: 1px solid #666; word-break: break-word; }
    code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
    code { padding: 0.2em 0.4em; border-radius: 6px; background: #eff1f3; }
    pre { max-width: 100%; padding: 16px; overflow: auto; color: #28282b; font-size: 13px; line-height: 1.6; overflow-wrap: normal; white-space: pre; background: #f9fafb; }
    pre code { padding: 0; color: inherit; font: inherit; white-space: inherit; background: transparent; }
    .markdown-code-block { display: block; margin: 16px 0; overflow: hidden; border: 1px solid #e0e1e3; border-radius: 10px; background: #f9fafb; break-inside: auto; }
    .markdown-code-block pre { margin: 0; border-radius: 0; }
    .markdown-code-toolbar { display: flex; min-height: 42px; align-items: center; padding: 0 14px; border-bottom: 1px solid #e0e1e3; color: #616268; background: #f3f4f6; }
    .markdown-code-language { overflow: hidden; font: 500 12px/1.4 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
    .markdown-code-actions { display: none; }
    a { color: #1677ff; }
    @media print { pre { overflow-wrap: anywhere; white-space: pre-wrap; } }
  </style>
</head>
<body class="markdown-body">${container.innerHTML}</body>
</html>`,
    ],
    { type: "text/html;charset=utf-8" },
  );
}
