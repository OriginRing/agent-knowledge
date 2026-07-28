---
name: knowledge-search
description: 强制检索本地知识库并返回引用资料。
entrypoint: handler.py:execute
kind: executor
order: 30
---

检索知识库并把命中的资料作为本轮回答上下文。
