# 智能体管理端

独立 Vue 3 管理端，默认开发地址 `http://127.0.0.1:5174`。

```bash
npm ci
npm run dev
```

先启动更新后的 `python/` 后端。使用现有管理员账号登录，无默认新增管理员账号。构建：`npm run build`。

代码检查与测试：

```bash
npm run lint
npm run lint:fix
npm run test
```

完整配置、工作流变量、Skill 包格式、部署和验收说明见 [管理端文档](../docs/admin-console.md)。
