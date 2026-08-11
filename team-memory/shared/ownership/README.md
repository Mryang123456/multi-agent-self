# 文件所有权

Ownership 是任务期间的写入租约，不代表代码所有权。主 Agent 派单前登记，子 Agent 修改前核对；只读任务通常不需要申请独占写租约。

- `ownership.schema.json`：租约注册表 schema；
- `example.ownership.json`：已释放租约示例。

规则：

- 精确文件优先于宽泛目录；
- `forbiddenPaths` 永远优先于 ownership；
- 重叠的独占写租约必须先仲裁；
- Agent 中断后不得直接抢占，必须先检查租约、实际文件和最近事件，再由主 Agent 释放或转交；
- ownership 只约束写入范围，不扩大任务授权；
- 只读诊断不应申请独占写租约，避免阻塞实现 Agent。
