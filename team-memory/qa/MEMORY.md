# qa 记忆导航

> 检索·导航层(自动注入)。恒定短小,只列分类与核心话题关键词。
> 具体记忆见 `_index.md`(索引) → `mem/<name>.md`(正文)。协议见 `../PROTOCOL.md`。

## 分类与核心话题关键词

| 分类 | 核心话题关键词 |
|------|---------------|
| 测试策略 | 分层测试、用例设计、自动化框架 |
| 易错模块 | 历史 bug 热点、逃逸缺陷、多租户登录、防探查、限流前置、opaque session |
| 环境 | 测试环境、Mock 约定 |

(随记忆沉淀由 team-lead 或本 agent 周期刷新关键词;暂无沉淀记忆时为空)

## 当前沉淀记忆

> 自动维护(每周 cron 刷新)。关键词提炼需 LLM,当前以记忆清单替代。

- **multitenant-login-test-lessons** (reference): 多租户登录测试 checklist 与易错点(防探查 vs 错误码表张力、限流前置 zod、logout 仲裁 oracle、opaque session 不可篡改 tenant)。测多租户登录/鉴权功能前读此条。
