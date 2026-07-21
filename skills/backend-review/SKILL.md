---
name: backend-review
description: 后端代码写完后的检查。审查后端改动(Java/Go/Python/Node/PHP/Ruby 服务端、API、数据库、中间件)的正确性 bug、攻击面规避(SQL注入/鉴权越权IDOR/敏感信息/SSRF/命令注入/反序列化/路径穿越/CSRF/依赖漏洞)、输入校验、幂等与事务、N+1 与性能、错误处理与可观测性、稳定性(限流/熔断/超时/重试)，并按项目实际技术栈与 lint/规范配置跑 lint/类型检查/单测/集成测试。当用户说"后端代码写完了检查一下""review 后端改动""检查这个接口/服务"或 backend agent 完成实现后调用。
---

# backend-review

后端代码写完后、声称完成前的必经检查。覆盖正确性、**安全(攻击面规避)**、契约、数据一致性、性能、稳定性、可观测性七类，并实际按项目技术栈与规范配置跑 lint/类型检查/单测/集成测试，不靠肉眼。**安全与数据一致性问题是阻断级**——发现 SQL 注入 / 鉴权越权 / 敏感信息泄露 / 非幂等写 / 事务缺失等，必须修复或明确上报，不得放行。

## When to use
- 后端代码（Java/Go/Python/Node/PHP/Ruby 服务端、API handler、DAO、中间件消费）写完，提交或交付前。
- 用户要求 review 后端改动、检查某接口/服务。
- `backend` agent 实现完成后自检。

## When NOT to use
- 纯前端改动 → 用 `frontend-review`。
- 只改配置/文档无逻辑 → 直接看。
- 数据库 schema 变更的风险评估 → 本 skill 会查 DDL 安全，但分库分表/大表迁移的容量评估需单独走。

## Steps

0. **探测项目技术栈与规范（先做，决定后续怎么查）**：
   - 识别项目类型与构建：
     - Java：`pom.xml`(Maven) / `build.gradle`(Gradle)
     - Go：`go.mod`
     - Python：`pyproject.toml` / `requirements.txt` / `setup.py`
     - Node：`package.json`（区分是服务端框架 Express/Koa/Nest/Fastify 还是纯库）
     - PHP：`composer.json`；Ruby：`Gemfile`
   - 判断框架与 ORM/数据访问层：Spring Boot + MyBatis/JPA、Gin + GORM、Django/Flask + SQLAlchemy、Prisma/TypeORM/Sequelize、原生 JDBC/database/sql —— **决定 SQL 注入查法**（ORM 参数化基本安全，原生拼接重点查）。
   - 记录关键依赖及版本（web 框架、ORM、序列化库、MQ 客户端），供后面判断已知漏洞和版本相关坑。
   - 读 lint/类型配置：Java 的 `checkstyle.xml`/SpotBugs；Go 的 `.golangci.yml`；Python 的 `ruff.toml`/`mypy.ini`；Node 的 `tsconfig.json`/`.eslintrc`。理解项目**开了哪些规则、关了哪些**——决定哪些问题 lint 会抓、哪些只能靠人工。
   - 读团队规范（若有）：`CONTRIBUTING.md` / API 规范文档 / 错误码字典 / 命名约定。审查时对照，不只信 lint。
   - 记录探测结论：技术栈 = ?，ORM/数据访问 = ?，lint 覆盖了什么/没覆盖什么，据此裁剪后续步骤。

1. **定位改动范围**。优先 git diff：
   ```
   git diff --name-only HEAD
   git diff --cached --name-only
   ```
   关注 controller/handler、service、dao/repository、migration、config、mq consumer。同时记录改动的依赖（pom/requirements/package.json 的 deps 变化）。

2. **跑机械检查（先跑，结果指引后续人工审查）**。命令按第 0 步探测的技术栈选：
   - 编译/类型：Java `mvn compile`/`gradle compileJava`；Go `go build ./...` + `go vet`；TS `tsc --noEmit`；Python `mypy`/`ruff check`
   - Lint：项目脚本 / `golangci-lint run` / `mvn checkstyle:check` / `ruff check` / `npm run lint`
   - 单测：`mvn test` / `go test ./...` / `npm test` / `pytest`
   - 集成测试：若改动涉及接口/DB，跑对应集成测试
   - **依赖漏洞审计**：Java `mvn dependency:tree`+OWASP DependencyCheck / `gradle dependencyCheck`；Go `govulncheck ./...`；Python `pip-audit` / `safety check`；Node `npm audit`；Ruby `bundle audit` —— 有 high/critical 列为问题
   记录每项 pass/fail，失败带真实输出。

3. **正确性审查**：
   - 空指针/nil 解引用、越界、类型转换异常
   - 并发：共享可变状态有无锁/竞态；goroutine/线程泄漏；map 并发读写
   - 资源泄漏：连接/文件/事务未关闭（缺 try-with-resources / defer / finally）
   - 边界：空集合、超长输入、负数、时区/时间格式、分页越界

4. **安全审查（攻击面规避，阻断级）**：
   - **SQL 注入**：字符串拼接 SQL（`"SELECT ... WHERE id=" + id`）→ 必须参数化/ORM 占位符；动态表名/列名拼接尤其危险
   - **鉴权与越权 (IDOR)**：每个接口是否校验权限（认证 ≠ 授权；能否改/查别人的数据？按 ID 直接操作资源必须校验归属）
   - **敏感信息**：密钥/密码/token 是否硬编码、是否写进日志/异常响应、响应是否泄露内部字段/堆栈/SQL
   - **输入校验**：外部输入（query/body/header/path/cookie）是否校验类型/长度/范围/格式；文件上传是否校验类型/大小/路径
   - **SSRF**：用户可控 URL 被服务端请求（爬虫/预览/回调）→ 校验协议与目标 IP，禁内网
   - **命令注入**：`exec`/`Runtime.exec`/`os/exec`/`subprocess` 拼用户输入 → 用参数数组，禁 shell=True
   - **反序列化**：`ObjectInputStream`/`pickle`/`unserialize` 处理用户数据 → 高危，禁用或白名单
   - **路径穿越**：用户输入拼文件路径（`../`）→ 规范化后校验在允许目录内
   - **CSRF**：状态变更接口是否有 CSRF 防护（token / SameSite / Origin 校验）——若该服务同时服务浏览器
   - **XSS（服务端渲染）**：模板输出未转义（Thymeleaf `ut:`、Jinja `|safe`、Go template `template.HTML`）
   - **依赖漏洞**：第 2 步 `govulncheck`/`pip-audit`/`npm audit` 等结果，确认是否在改动引入
   - **正则 ReDoS / XXE**：用户输入喂复杂正则；XML 解析未禁外部实体

5. **契约与一致性**：
   - 接口字段命名/类型/分页/错误码是否与文档/前端约定一致
   - 向后兼容：删字段/改类型/改语义是否破坏老调用方
   - 错误码与 HTTP 状态是否合理（别什么都 200）

6. **数据一致性（阻断级）**：
   - 写操作是否幂等（重试/重复提交会不会脏数据）
   - 跨表/跨服务操作是否在事务内；分布式场景是否有事务/补偿
   - 缓存与 DB 一致性（先写 DB 还是先删缓存；缓存击穿/穿透/雪崩）
   - DDL 安全：加字段是否 NOT NULL 无默认值（锁表）、加索引大表是否走批处理、删字段是否先停用

7. **性能**：
   - N+1 查询（循环里查 DB）；缺索引导致慢查询
   - 大结果集一次性加载（应分页/流式）
   - 缓存使用是否合理、key 设计、TTL
   - 序列化开销、不必要的全量返回

8. **稳定性与可观测性**：
   - 外部依赖（DB/HTTP/MQ）有无超时、重试、熔断、降级
   - 限流：高风险写接口是否限流
   - 日志：关键操作有日志、带 TraceId/请求 ID、结构化、不记敏感信息
   - 监控/告警：新接口/新依赖是否埋了指标
   - 回滚方案：变更是否可回滚

9. **汇总**：按严重度分级（🔴 阻断 / 🟡 应修 / 🔵 建议），每条给：文件:行号、问题、为什么、修法。**安全类与数据一致性类默认 🔴 阻断**。机械检查（含依赖审计）的 pass/fail 单独列。给"是否可上线"结论 + 上线风险提示。

## 输出格式
```
## 技术栈探测
- 语言/框架: Java 17 + Spring Boot 3 / Go 1.22 + Gin / ...
- ORM/数据访问: MyBatis Plus / GORM / SQLAlchemy / ...
- lint 覆盖: 已开 spotbugs / 关了 unchecked / ...
- 团队规范: 有 API 规范文档（错误码...） / 无

## 机械检查
- 编译/类型: ✅/❌
- lint: ✅/❌
- 单测: ✅ 23 passed / ❌ 1 failed
- 集成测试: ✅/❌/⏭️ 未跑
- 依赖审计: ✅ 0 vuln / ⚠️ 1 critical (log4j)

## 问题清单
🔴 [阻断-安全] path/to/File.java:88 — 问题描述 / 原因 / 修法
🔴 [阻断-数据一致性] ...
🟡 [应修] ...
🔵 [建议] ...

## 结论与上线风险
可上线 / 需修复 N 个阻断项（其中安全 X 个、数据一致性 Y 个）
上线风险：...（若有）
```

## 注意
- **第 0 步不能跳**——不探测技术栈就跑错构建命令（Java 项目跑 `go build`）；不判断 ORM 就不知道 SQL 注入该重点查拼接还是基本安全；不读 lint 配置就不知道哪些规则被项目关了。
- **安全与数据一致性是阻断级**：SQL 注入、鉴权越权、敏感信息泄露、命令注入、反序列化、非幂等写、事务缺失等，发现即标 🔴，不得以"建议"放行。
- DDL 改动单独标注锁表/迁移风险，提醒走审批。
- 先跑机械检查再看代码——编译/lint/审计错误常常直接定位 bug 和漏洞。
- 不要假装测试通过——失败就带真实输出。
