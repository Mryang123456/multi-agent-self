# backend 记忆导航

> 检索·导航层(自动注入)。恒定短小,只列分类与核心话题关键词。
> 具体记忆见 `_index.md`(索引) → `mem/<name>.md`(正文)。协议见 `../PROTOCOL.md`。

## 分类与核心话题关键词

| 分类 | 核心话题关键词 |
|------|---------------|
| 后端架构 | 微服务、接口设计、DB 设计 |
| 稳定性 | 限流熔断、超时重试、幂等事务 |
| 踩坑 | SQL 注入、N+1、缓存一致性 |

(随记忆沉淀由 team-lead 或本 agent 周期刷新关键词;暂无沉淀记忆时为空)

## 当前沉淀记忆

> 自动维护(每周 cron 刷新)。关键词提炼需 LLM,当前以记忆清单替代。

- **job-filler-server** (project): job-filler 本地 agent 服务的架构要点与已知坑。当涉及 job-filler 的 /parse /fill 端点、mock 与 LLM 模式切换、CORS 配置时相关。
