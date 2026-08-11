# 运行环境状态目录

本目录定义共享本地服务注册表，由 Runtime/DevOps Agent 使用。

第一阶段只做观察，不做修改：`scripts/runtime-status.mjs` 和 `scripts/runtime-health.mjs` 只读取注册表，并检查进程、TCP 监听、HTTP 端点和依赖声明。它们不会启动、停止、重启、修复或修改任何服务。

## 文件说明

- `services.schema.json`：服务注册表契约；
- `services.local.example.json`：无敏感信息的示例和默认发现配置；
- `services.local.json`：本机实时注册表，已被 Git 忽略；
- `DESIGN.md`：运行环境所有者、注册表、租约、锁、状态对账和健康检查模型；
- `locks/`：未来部署锁文件目录，只提交 `.gitkeep`；
- `leases/`：未来资源租约文件目录，只提交 `.gitkeep`；
- `logs/`：未来运行日志目录，只提交 `.gitkeep`。

本机注册表不得包含凭据、token、环境变量 dump、请求头或完整数据库 URL。第一阶段 schema 故意排除了命令和环境变量数据。

## 只读命令

```powershell
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

可用 `--registry <path>` 检查其他注册表，用 `--json` 输出机器可读结果。当 `services.local.json` 不存在时，脚本会回退到 `services.local.example.json`，并明确报告数据来源。

退出码：

- Status：注册表可读取时返回 `0`，输入无效时返回 `1`；
- Health：所有必需检查通过时返回 `0`，任一必需检查失败或输入无效时返回 `1`。

PID 只是辅助信息。单独匹配 PID 不能证明进程身份；生命周期工具在行动前必须同时核验监听端口和启动身份。

示例注册表是发现配置，不代表服务已被当前 Agent 拥有或正在运行。示例里的空 PID/session 会产生 `untracked` 状态，health 探测会独立报告可达性。
