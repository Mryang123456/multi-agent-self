# saas-erp

多租户登录 SaaS MVP 仓库(monorepo skeleton)。

## 目录
- `api/` — 后端,Node + Express + SQLite(TypeScript)。登录/登出/鉴权/限流/session。
- `web/` — 前端,React + TypeScript + Vite。登录入口 + 状态码消费 UI。

## 关联文档
- PRD: `~/.claude/team-workspaces/pm/multi-tenant-login-prd.md`
- 接口契约(前后端联调单一事实源): `~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md`
- 决策日志: `~/.claude/team-memory/team-lead/decisions.md`

## 启动
> 待 S3 补具体命令。当前为骨架(占位 + TODO 引契约,未写真实现)。

预期(实现后):
- api: `cd api && npm install && npm run dev`(默认 :3000)
- web: `cd web && npm install && npm run dev`(Vite dev,proxy `/api` → http://localhost:3000)

## 状态
- 阶段: S2 契约已收敛,骨架已 scaffold,未进 S3。
- git remote 暂未设(待网络恢复 + 用户补完整 repo URL 后 `git remote add origin <url> && git push -u origin main`)。
