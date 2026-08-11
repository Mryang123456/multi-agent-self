# 运行环境状态目录

本目录定义共享本地服务注册表，由 Runtime/DevOps Agent 使用。它是可移植架构的一部分：schema 和 example 可以随仓库迁移，本机真实状态由初始化脚本在每台电脑上单独生成。

## 文件说明

- `services.schema.json`：服务注册表契约；
- `services.local.example.json`：无敏感信息的通用示例；
- `services.local.json`：本机实时注册表，已被 Git 忽略；
- `DESIGN.md`：运行环境所有者、注册表、租约、锁、状态对账和健康检查模型；
- `locks/`：部署锁文件目录，只提交 `.gitkeep`；
- `leases/`：资源租约文件目录，只提交 `.gitkeep`；
- `logs/`：运行日志目录，只提交 `.gitkeep`。

本机注册表不得包含凭据、token、环境变量 dump、请求头或完整数据库 URL。schema 故意排除了命令和环境变量数据。

## 新电脑初始化

```powershell
node scripts/runtime-init.mjs --project my-project
```

脚本会从 `services.local.example.json` 生成 `services.local.json`，并把示例 project 名替换成你的项目名。已有本机文件时默认不覆盖；需要重建时使用 `--force`。

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

在其他电脑上，先运行初始化脚本，再按本机实际端口和健康检查修改 `services.local.json`。不要直接把某台电脑的 `services.local.json` 拷给另一台电脑。
