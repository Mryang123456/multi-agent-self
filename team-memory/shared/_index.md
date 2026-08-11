# 共享契约索引

> 检索·索引层。跨角色共享的接口契约/数据模型/错误码。
> 单一事实源,所有角色读此处,不各自维护副本。协议见 `../PROTOCOL.md` §4。

| 契约 | description | 产出方 |
|------|-------------|--------|
| [multi-tenant-login-api](contracts/multi-tenant-login-api.md) | 多租户登录功能后端接口契约(登录/登出/鉴权/租户上下文/错误码/session store)。前后端联调单一事实源。MVP:路径租户识别+账密+一用户一租户+共享库 tenant_id 行级隔离。 | backend |
| [procureflow-api](contracts/procureflow-api.md) | ProcureFlow V1 前后端并行开发的单一事实源，定义模块化单体架构、数据模型、认证、RBAC/数据范围、REST API、状态机、幂等并发、事务、错误码、配置与种子数据。 | backend |

