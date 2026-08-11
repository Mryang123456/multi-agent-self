# 运行环境所有权设计

本文定义目标协作模型。第一阶段只实现只读注册表状态和健康探测，不实现生命周期修改、租约获取、部署锁、恢复或自动修复。

## 单写者所有权

共享环境只能有一个 运行环境所有者 写入状态。开发和 QA Agent 可以请求 `inspect`、`ensure-running`、`restart-after-build` 或 `release`，但不能直接修改共享服务。如果 运行环境所有者 消失，接替者必须先对账当前进程和端口，再接受生命周期任务。

数据库所有权更严格：默认只允许观察。重启、迁移、seed、清理和恢复都必须获得该精确操作的明确授权。

## 服务注册表

注册表是本机状态。Git 只保存 schema 和无凭据示例，`services.local.json` 被忽略。

每个条目描述稳定的期望配置：project、service name、type、endpoint、required、dependencies、health probe；也可以包含可选观测信息：PID、session、owner、build ID、start time。未来可写实现应把 desired 与 observed 显式分开，并增加 registry generation。

注册表规则：

- 运行环境所有者 是唯一写者，其他 Agent 只读；
- 更新必须先写临时文件，再原子 rename；
- 同一 project 内 service name 唯一；
- dependency 引用只在同一 project 内解析；
- PID 只是辅助信息，不能单独授权生命周期动作；
- 不保存或打印凭据、token、请求头、环境变量 dump、带秘密的命令行或完整数据库 URL；
- 观测数据在使用前必须与当前 PID、监听端口、进程启动时间、可执行文件身份和 health 对账。

## 资源租约

租约表示临时使用资源，但不改变 运行环境所有者。建议模式：

- `shared-read`：QA 或只读检查；
- `exclusive-write`：部署或生命周期修改。

未来租约记录必须包含 `resource`、`holder`、`taskId`、`leaseId`、`mode`、`purpose`、`acquiredAt`、`heartbeatAt`、`expiresAt`、`fencingToken`。

租约规则：

- 租约如果没有心跳续期会过期；
- 过期允许状态对账，不允许盲目接管进程；
- 多个 `shared-read` 可以共存；
- `exclusive-write` 与任何其他有效租约冲突；
- 任务结束或中断时应释放租约，TTL 处理遗留记录；
- 租约记录不得携带凭据或 kill 权限。

## 部署锁

部署锁用于串行化构建产物和服务变更。推荐 key：

- `project:deploy`
- `project:frontend`
- `project:backend`
- `project:database`

锁记录必须原子获取，并包含 owner task、获取时间、过期时间、心跳和单调递增的 fencing token。后续注册表写入必须携带当前 token，防止旧 owner 过期后恢复并覆盖新状态。

固定获取顺序：project → service → database。前端-only 操作不得获取或影响数据库锁。失败部署应保留安全诊断状态，释放已持有锁，不扩大清理范围。

## PID 与端口对账

未来执行生命周期动作前，运行环境所有者 必须：

1. 查询目标 host/port 的当前监听者；
2. 对比监听 PID 与注册表 PID，但不单独相信任一来源；
3. 验证进程启动时间、可执行文件、工作目录或等价启动身份；
4. 确认当前租约和 fencing token；
5. 优先通过拥有该进程的 session 做优雅关闭；
6. 关闭后验证监听已消失，再启动替代进程。

禁止按可执行文件名批量终止，也禁止只凭历史 PID 终止。

## 只读健康模型

健康检查分层：

1. Process：记录的 PID 存在，第一阶段仅作信息；
2. Transport：声明的 TCP endpoint 可连接；
3. Service：HTTP health 或页面端点返回期望状态；
4. Dependency/business：依赖健康，且授权的只读 API 探测成功。

第一阶段只执行 TCP 或 HTTP 检查，并校验依赖声明。失败只报告，不重启、不修复、不迁移、不 seed、不清理。未来 monitor 应记录延迟、连续失败次数、首次失败时间和最后成功时间；自动恢复必须具备阈值、冷却、有限重试和防重启风暴机制。

## 部署 Gate

部署完成必须同时满足：typecheck/test/build 成功，产物可识别，预期进程拥有 endpoint，必需健康检查通过，依赖健康，注册表 observed 状态原子更新，锁已释放。

构建产物成功、构建进程退出状态和运行时健康是三个不同结果，不能互相替代。
