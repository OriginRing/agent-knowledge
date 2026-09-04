# Agent Skills

每个技能放在独立子目录中，入口固定为 `SKILL.md`。服务启动后会从本目录自动发现技能，也可以通过 `AGENT_SKILLS_DIR` 指向其他目录。

```text
skills/
└── my-skill/
    └── SKILL.md
```

`SKILL.md` 示例：

```markdown
---
name: my-skill
description: 技能说明
entrypoint: handler.py:execute
kind: executor
order: 20
file_extensions: .png,.jpg
intent_keywords: 关键词一,关键词二
artifact: docx
---

这里填写注入模型的系统提示词。
```

- `name`：通过 Chat 请求的 `skill` 字段显式启用时使用。
- `entrypoint`：可执行技能的 Python 文件和函数，函数返回字典结果。
- `kind`：`prompt`、`executor`、`hybrid` 或 `artifact`。`hybrid` 可同时提供提示词和执行入口。
- `order`：多个强制技能的执行顺序。
- `agent_codes`：允许执行该技能的智能体标识，多个值使用逗号分隔；留空表示不限制。
- `file_extensions` 和 `intent_keywords`：用于自动匹配，可留空。
- `artifact`：支持以逗号声明 `docx,xlsx,pptx,pdf` 等产物格式；模型回答后生成文件、上传 OSS，并由 Chat 的 `file` 节点返回一个或多个地址。

## 管理端与最新配置

新增的管理端可展示内置 Skill，并上传完整 Skill ZIP 包。内置 Skill 只读，同名上传替换当前 Skill，相关智能体需重新发布后使用最新配置；删除前检查工作流、智能体及运行中的引用。

管理端存储使用独立的 `ADMIN_SKILLS_DIR`（默认 `python/data/admin-skills/`），不改写本目录。包限制、变量传递和执行权限见 [管理端文档](../../docs/admin-console.md)。
