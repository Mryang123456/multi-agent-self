---
name: job-filler-server
description: job-filler 本地 agent 服务的架构要点与已知坑。当涉及 job-filler 的 /parse /fill 端点、mock 与 LLM 模式切换、CORS 配置时相关。
type: project
status: active
---

# job-filler agent server 架构

## 要点
- 端点:`/parse`(简历文本→结构化 JSON)、`/fill`(字段+简历→填充计划)。
- 双模式:无 `ANTHROPIC_API_KEY` 时跑 mock(`mock.js` 启发式),有 key 时跑真 LLM(`server.js` 内联 prompt `PARSE_SYSTEM`/`FILL_SYSTEM`)。mock 与 LLM schema 必须同步,否则测试与生产静默分叉。
- API key 只在本地服务,扩展/页面不含密钥;background.js 代理所有调用。
- CORS 设了 `*`(本地开发),生产不应暴露。

## 踩坑
- 受控组件填充:必须用原生 value-setter + 合成 input/change 事件,naive `el.value=` 在 React/Vue 上失效。
- mock 的 radio 把每个选项当独立步骤,真 LLM 应只产一条。

## 关联
- 项目维护见 skill `job-fill`。
- 扩展端 XSS 风险已修(sidepanel.js 的 step.action 转义)。
