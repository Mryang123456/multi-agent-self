# 子 Agent 文件放置规范

日期：2026-08-10

本规范用于防止子 Agent 把不同职责的文件全部平铺到一个目录里。文件位置不是“美观问题”，而是架构质量的一部分。

## 1. 核心规则

子 Agent 开发时，必须按照文件的职责、领域和复用范围放置代码。一个功能即使能跑通，如果文件被随意平铺，也不能直接视为完成，除非任务契约明确允许临时平铺原型。

每次创建或移动文件前，子 Agent 必须判断：

- 这个文件属于哪个业务域？
- 它是应用入口、业务功能、共享基础设施，还是测试？
- 它是否靠近被它修改或验证的代码？
- 它的位置是否符合项目已有结构？

如果无法判断，子 Agent 必须先停下来提出目录方案，或请求主 Agent 路由，而不是继续批量写文件。

## 2. 渐进式分布原则

采用渐进式分布，而不是一开始就过度嵌套：

1. 先划分少量有意义的顶层职责；
2. 优先按业务域或功能拆分；
3. 业务域变大后，再在域内按技术职责细分；
4. 框架要求放在根目录的文件保留在根目录。

目标不是“目录越深越专业”，而是维护者可以预测文件应该放在哪里。

## 3. 前端目录规范

推荐结构：

```txt
src/
  app/
    main.tsx
    App.tsx
    routes/providers
  features/
    <feature>/
      pages/components/hooks/tests
  shared/
    components/
    lib/
    styles/
    test/
```

规则：

- `src/app` 放应用启动、Provider、路由和应用壳层集成；
- `src/features/<feature>` 放业务域 UI、业务组件、页面和测试；
- `src/shared` 放跨业务域复用的组件、工具库、样式、测试设置和通用类型；
- feature 测试尽量靠近对应 feature；
- shared 测试靠近 shared 代码；
- 项目进入 feature/shared 结构后，不得继续新增或扩展宽泛平铺目录，例如 `src/pages`、`src/lib`、`src/components`；
- 不要把框架根文件移入 `src`，例如 `package.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`、`Dockerfile`。

允许例外：

- 很小的 spike 可以临时平铺，但任务契约必须显式写 `filePlacementPolicy.allowFlatPrototype=true`，并在交付前设置结构化重构质量门。

## 4. 后端目录规范

推荐 Nest 风格结构：

```txt
src/
  main.ts
  app.module.ts
  common/
  config/
  infrastructure/
    prisma/
  modules/
    <domain>/
      controller/service/dto/tests-or-specs
```

规则：

- `src/common` 放跨模块装饰器、filter、interceptor、guard、错误类型和通用 helper；
- `src/config` 放配置校验和环境适配；
- `src/infrastructure` 放 Prisma、队列、存储、邮件、第三方客户端等外部适配；
- `src/modules/<domain>` 放业务域 controller、service、DTO、policy 和领域测试；
- 不得把所有 controller、DTO、service 都直接平铺到 `src` 根目录；
- 不得把不相关业务域混在同一个 module 目录；
- `main.ts` 和 `app.module.ts` 可以保留在 `src` 根部，这是低风险 Nest 约定；
- `package.json`、`nest-cli.json`、`tsconfig*.json`、`Dockerfile`、`docker-compose.yml` 等框架/构建文件保留在项目根目录，除非明确改造构建系统。

## 5. 结构门

所有创建、移动或大幅修改文件的编码任务，都必须通过结构门。

子 Agent 必须提供：

```txt
git status --short
rg --files <changed-root>
rg --files <changed-root> | <forbidden-flat-pattern scan>
```

主 Agent 需要核验：

- 预期目录是否存在；
- 修改文件是否位于对应 domain/shared/infrastructure 目录；
- 是否新增或扩大了禁止的平铺目录；
- 测试是否跟随被测代码移动或保持邻近；
- 框架根文件例外是否合理。

如果结构门不通过，即使测试全绿，也不能算完成。

## 6. 禁止平铺模式

项目契约可以覆盖这些规则，但默认情况下，一旦项目已经进入领域化结构，以下模式都需要警惕。

前端：

```txt
src/pages/*
src/components/*
src/lib/*
```

后端：

```txt
src/*Controller.ts
src/*.controller.ts
src/*Service.ts
src/*.service.ts
src/*.dto.ts
src/*Dto.ts
```

这些模式对历史遗留代码不一定立刻阻断，但新工作不得继续扩大它们，除非有显式例外。

## 7. 任务契约字段

任务契约应包含：

```json
{
  "filePlacementPolicy": {
    "required": true,
    "expectedStructure": ["src/app", "src/features", "src/shared"],
    "forbiddenFlatPatterns": ["src/pages/*", "src/lib/*", "src/components/*"],
    "allowedRootFiles": ["package.json", "vite.config.ts", "tsconfig.json"],
    "allowFlatPrototype": false,
    "notes": "测试必须靠近被验证的 feature/shared 代码。"
  }
}
```

## 8. ProcureFlow 参考结构

前端发布仓库：

```txt
src/app
src/features/auth
src/features/dashboard
src/features/applications
src/features/approvals
src/features/audit
src/features/organization
src/shared/components
src/shared/lib
src/shared/styles
src/shared/test
```

后端发布仓库：

```txt
src/common
src/config
src/infrastructure/prisma
src/modules/auth
src/modules/applications
src/modules/operations
src/modules/organization
src/modules/dashboard
src/modules/health
```

后续子 Agent 派单应优先引用这些结构作为示例。
