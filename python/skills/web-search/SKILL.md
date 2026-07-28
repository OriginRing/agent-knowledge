---
name: web-search
description: 使用 Tavily 强制检索实时互联网信息。
entrypoint: handler.py:execute
kind: executor
order: 20
---

检索互联网并把结果作为本轮回答上下文。
