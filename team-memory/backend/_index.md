# backend 沉淀记忆索引

> 检索·索引层。每行一条长期记忆的指针 + description。
> description 以 `mem/<name>.md` 的 frontmatter 为唯一事实源,本表单向同步。

| 记忆 | description | type |
|------|-------------|------|
| [job-filler-server](mem/job-filler-server.md) | job-filler 本地 agent 服务的架构要点与已知坑。当涉及 job-filler 的 /parse /fill 端点、mock 与 LLM 模式切换、CORS 配置时相关。 | project |
| [saas-erp-api](mem/saas-erp-api.md) | saas-erp 多租户登录后端(TS/Express/node:sqlite/argon2)架构要点与已知坑。当涉及 ~/saas-erp/api 的 login/logout/鉴权/限流、node:sqlite fallback、§3 logout 幂等矛盾时相关。 | project |
