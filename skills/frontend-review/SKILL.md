---
name: frontend-review
description: 前端代码写完后的检查。审查前端改动(React/Vue/Svelte/TS/JS、组件、样式、构建)的正确性 bug、攻击面规避(XSS/CSRF/CSP/依赖漏洞/token存储/开放重定向/postMessage/SRI/点击劫持)、类型安全、可访问性、性能(bundle/重渲染/代码分割)、错误边界与表单校验，并按项目实际技术栈与 eslint/规范配置跑 lint/类型检查/测试/构建验证。当用户说"前端代码写完了检查一下""review 前端改动""前端代码 review""检查这个组件/页面"或 frontend agent 完成实现后调用。
---

# frontend-review

前端代码写完后、声称完成前的必经检查。覆盖正确性、**安全(攻击面规避)**、类型、可访问性、性能、工程化六类，并实际按项目技术栈与规范配置跑 lint/类型检查/测试/构建，不靠肉眼。**安全问题是阻断级**——发现 XSS / 敏感信息泄露 / 鉴权绕过等，必须修复或明确上报，不得放行。

## When to use
- 前端代码（React/Vue/Svelte/TS/JS/JSX/TSX/Vue/CSS）写完，提交或交付前。
- 用户要求 review 前端改动、检查某组件/页面。
- `frontend` agent 实现完成后自检。

## When NOT to use
- 纯后端改动 → 用 `backend-review`。
- 只是改文档/配置且无逻辑 → 直接看，不必走全套。
- UI/UX 设计还原度问题（视觉对齐、间距）→ 这是设计审查，不是本 skill 职责，但可顺带提。

## Steps

0. **探测项目技术栈与规范（先做，决定后续怎么查）**：
   - 读 `package.json`（或 `pnpm-workspace.yaml`/monorepo 各包）：
     - 判断框架：React / Vue / Svelte / Solid / 原生 —— 决定哪些检查项适用（如 Hooks 规则只查 React，`v-html` 只查 Vue，Svelte 的 `$:`/store 响应式有自己的坑）。
     - 判断语言：TS / JS —— TS 跑 `tsc --noEmit`，JS 不跑类型检查。
     - 判断构建工具：Vite / Webpack / Next / Nuxt / Rollup —— 决定构建命令和 SSR/CSR 场景（SSR 场景额外查 SSRF、服务端渲染时的注入）。
     - 记录关键依赖及版本（React/Vue/Next 等），供后面判断已知漏洞和版本相关坑。
   - 读 lint 配置：`.eslintrc*` / `eslint.config.js` / `tsconfig.json` / `.prettierrc*`。理解项目**自定义了哪些规则、关掉了哪些默认规则**——这决定了哪些问题 lint 会抓、哪些只能靠人工（例如项目若关了 `@typescript-eslint/no-explicit-any`，则 `any` 滥用必须人工查）。
   - 读团队规范（若有）：`CONTRIBUTING.md` / `README.md` 里的代码风格约定、命名约定、目录结构约定。审查时对照这些，不只信 lint。
   - 记录探测结论：技术栈 = ?，lint 覆盖了什么/没覆盖什么，据此裁剪后续步骤。

1. **定位改动范围**。优先用 git diff 看本次改了哪些前端文件：
   ```
   git diff --name-only HEAD   # 已暂存+工作区
   git diff --cached --name-only
   ```
   无 git 仓库时，让用户指明要查的文件/目录。同时记录改动的依赖（package.json 的 deps 变化）。

2. **跑机械检查（先跑，结果指引后续人工审查）**。命令按第 0 步探测的技术栈选：
   - 类型检查：TS 项目 `npx tsc --noEmit`（JS 跳过）
   - Lint：优先项目脚本 `npm run lint`，否则 `npx eslint .`
   - 格式：`npx prettier --check .`（若项目用 prettier）
   - 单测：`npm test` / `npx vitest run` / `npx jest`（按项目实际）
   - 构建：`npm run build`（确认没引入构建错误）
   - **依赖漏洞审计**：`npm audit` / `pnpm audit` / `yarn audit` —— 有 high/critical 要列为问题
   若项目有自定义脚本（package.json scripts），优先用项目脚本。记录每项 pass/fail，失败要把真实输出带上。

3. **正确性审查**（读改动代码，按框架适用项查）：
   - React：Hooks 规则（条件/循环里调 hook？依赖数组漏项/多余？）；闭包陷阱（setState 用旧值？effect 引用陈旧闭包？）
   - Vue：`watch`/`computed` 依赖追踪、`ref` vs `reactive` 误用、`v-for` 的 `:key`
   - key 是否稳定唯一（列表用 index 当 key 且会增删 → bug）
   - 受控/非受控混用；表单未校验就提交
   - 异步竞态（组件卸载后 setState；请求未取消；Promise 顺序错乱）
   - 边界：空数组/null/undefined/超长列表是否崩

4. **安全审查（攻击面规避，阻断级）**：
   - **XSS**：`dangerouslySetInnerHTML`(React) / `v-html`(Vue) / `innerHTML=` / `eval` / `new Function` / `document.write` → 确认内容可信或已消毒（DOMPurify 等），否则阻断
   - **CSRF**：状态变更请求（POST/PUT/DELETE）是否带 CSRF token 或依赖 SameSite cookie；纯 fetch/axios 不带凭据时确认是否该带 credentials
   - **敏感信息泄露**：API key/token/密码是否硬编码或进了前端 bundle（`process.env` 里非 `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_` 前缀的变量在客户端拿不到，确认没误用）；.env 是否进了版本库
   - **token 存储**：access token / refresh token / 敏感凭证是否存进了 `localStorage`/`sessionStorage`（XSS 可窃取，阻断级建议改用 httpOnly cookie 或内存）
   - **CSP**：是否配置 Content-Security-Policy；有无 `unsafe-inline`/`unsafe-eval` 滥用（尤其用了内联脚本或 eval 的库）
   - **依赖漏洞**：第 2 步 `npm audit` 的 high/critical 结果，确认是否在改动引入
   - **URL/开放重定向**：`window.location` / `location.href` 来自用户输入未校验 → 阻断
   - **postMessage**：未校验 `event.origin` 就处理消息 → 阻断
   - **点击劫持**：关键交互页是否有 `X-Frame-Options` / CSP `frame-ancestors` 防护（部署配置层面，代码里若有 iframe 嵌套则查）
   - **第三方脚本 SRI**：`<script src>`/`<link rel=stylesheet>` 外链是否有 `integrity` 属性
   - **正则 ReDoS / 原型污染**：用户输入直接喂给复杂正则、`Object.assign`/解构合并用户输入到对象原型链

5. **类型安全**：`any` 滥用、`as` 断言绕过类型、可选链缺失导致运行时 undefined、`@ts-ignore`/`@ts-expect-error` 滥用。对照第 0 步——若项目关了相关 lint 规则，人工查更要紧。

6. **可访问性 (a11y)**：交互元素是否 `button`/`a`（非 `div onClick`）、`img` 有 `alt`、表单有 `label`、键盘可达、对比度、`aria-*` 用对。

7. **性能**：
   - 不必要的重渲染（缺 `memo`/`useMemo`/`useCallback`；context 值每次新建）
   - 大列表未虚拟化、大图未懒加载、未做代码分割（路由级 `lazy`）
   - bundle 体积异常（引入整个库 vs 按需导入）
   - 布局抖动（CLS）、首屏阻塞

8. **工程化/规范**（对照第 0 步读到的团队规范）：`console.log` 残留、TODO 未清理、硬编码文案（应走 i18n）、魔法数字、死代码、命名/目录是否违反团队约定。

9. **汇总**：按严重度分级（🔴 阻断 / 🟡 应修 / 🔵 建议）列出问题，每条给：文件:行号、问题、为什么、修法。**安全类问题默认 🔴 阻断**。机械检查（含 `npm audit`）的 pass/fail 单独列。最后给一句"是否可交付"的结论。

## 输出格式
```
## 技术栈探测
- 框架: React 18 / Vue 3 / ...
- 语言: TS / JS
- 构建: Vite / Next / ...
- lint 覆盖: 已开 no-explicit-any / 关了 no-unused-vars / ...
- 团队规范: 有 CONTRIBUTING.md（命名约定...） / 无

## 机械检查
- tsc: ✅/❌/⏭️(JS 跳过)
- eslint: ✅/❌
- 测试: ✅ 12 passed / ❌ 2 failed
- build: ✅/❌
- npm audit: ✅ 0 vuln / ⚠️ 2 high

## 问题清单
🔴 [阻断-安全] path/to/file.tsx:42 — 问题描述 / 原因 / 修法
🟡 [应修] ...
🔵 [建议] ...

## 结论
可交付 / 需修复 N 个阻断项（其中安全 X 个）后可交付
```

## 注意
- **第 0 步不能跳**——不探测技术栈就跑 `tsc --noEmit`，JS 项目会瞎报错；不读 lint 配置就不知道哪些规则被项目关了。
- **安全问题是阻断级**：XSS、敏感信息泄露、token 存储、开放重定向、未校验 postMessage 这类，发现即标 🔴，不得以"建议"放行。
- 先跑机械检查再看代码——lint/类型/audit 错误常常直接定位 bug 和漏洞，省读代码时间。
- 不要只说"建议优化"，要给出具体可执行的修法。
- 跑测试/构建/audit 失败时，带上真实报错输出，不要假装通过。
