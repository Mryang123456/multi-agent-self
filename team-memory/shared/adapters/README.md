# 项目适配器

项目适配器用于把“全局多 Agent 协议”映射到具体技术栈。它回答三个问题：

1. 这个组件的文件应该放在哪里？
2. 这个组件应该跑哪些检查？
3. 这个组件适合哪些 QA 策略？

适配器只描述技术栈和工程约定，不描述业务需求。

推荐目录：

```txt
team-memory/shared/adapters/
  adapter.schema.json
  frontend/
    react-vite.adapter.json
    nextjs.adapter.json
    vue-vite.adapter.json
  backend/
    nest-prisma.adapter.json
    spring-boot.adapter.json
    fastapi.adapter.json
  qa/
    web-saas.adapter.json
    api-service.adapter.json
```

新增技术栈时，不要改全局 Agent 角色；新增一个 adapter 即可。
