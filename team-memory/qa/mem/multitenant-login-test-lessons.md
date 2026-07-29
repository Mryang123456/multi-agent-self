---
name: multitenant-login-test-lessons
description: 多租户登录测试 checklist 与易错点(防探查 vs 错误码表张力、限流前置 zod、logout 仲裁 oracle、opaque session 不可篡改 tenant)。测多租户登录/鉴权功能前读此条。
type: reference
status: active
---

# 多租户登录测试 checklist 与易错点(来源:S4 multi-tenant-login,2026-07-24)

## 易错点(下次必查)
1. **防探查 vs 错误码表张力**:契约错误码表若列 `TENANT_NOT_FOUND`(非存在租户),但登录流程按 username 查用户不查租户存在性 → 非存在租户折叠为 `401 INVALID_CREDENTIALS`(更安全,不泄漏租户存在)。这是正确行为但与错误码表/前端 code→UI 映射冲突(前端该 code 成死代码)。测时必须显式验"非存在租户 login 返回什么",并 flag 此张力给 pm/backend 定。
2. **logout 幂等性 oracle**:已吊销/无效/无 token 登出,鉴权中间件先跑 → 一律 `401 UNAUTHENTICATED`(NOT 幂等 204)。契约若写"已吊销→204"是内部不自洽(与鉴权 step1 冲突)。以 401 为准。
3. **限流前置 zod**:rate-limit 中间件在 zod 校验前 → 空 body/畸形 body 也消耗配额,防"用畸形体绕过限流爆破"。测时发 6 次空 body 验第 6 次 429(不是 400)。
4. **opaque session 不可篡改 tenant**:token=sess_<random>,tenantId 只存服务端 sessions.tenant_id,客户端无法篡改。篡改/伪造 token → findSessionById 空 → 401;有效 token 用在别租户 path → 403(path 复核)。
5. **行级隔离无 API 入口时**:MVP 若只有 login/logout 无业务数据端点,则"行级隔离"无 API 可测;改测:(a)DB 直查验 `WHERE id=? AND tenant_id=?` 谓词强制;(b)login path≠user 归属→TENANT_MISMATCH 折叠;(c)A token 用 B path→403。业务端点上线后必须经 tenant-scoped repo helper,禁裸跨租户查。

## 必测矩阵(下次照抄)
login 成功(200+裸对象+user.tenantId==path+expiresAt ISO8601 Z+≈now+TTL) / 密码错 401 / 租户不匹配折叠 401(对外与密码错同体) / 限流 5次+1→429(带 retryAfter) / logout 有效→204 / logout 已吊销→401 / logout 无 token→401 / logout 伪造 token→401 / 跨租户 path≠token→403 / 未知路由→404 RESOURCE_NOT_FOUND / 畸形 JSON→400 / zod 边界(u 1-64/p 8-128 过短超长)→400 / 并发登录多 session 独立(logout A 不影响 B) / 过期 session→401(直改 DB expires_at 为过去测)/ 密码哈希(argon2 非明文)/ 审计 6 事件无 secrets / 前端 code→Notice 路由(vitest)。

## 环境备注
- node:sqlite 实验性;`node_modules/.bin/tsx` 可能被后台 npm install 完成时 prune 掉,已起进程不受影响、新起需 npx 或重装。
- 限流 ip 轴在单 localhost 无法测(需第二源 IP),只能验 tenantId 轴;逻辑按 tenantId:ip 键,ip 轴由构造保证。
