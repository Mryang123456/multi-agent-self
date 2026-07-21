---
name: new-skill
description: Scaffold a new Claude Code skill. Use when the user wants to create/write/make a new skill, add a custom slash command, or package a repeatable workflow as a skill. Generates the SKILL.md with frontmatter + workflow, and any supporting files.
---

# new-skill

Scaffold a new skill under `~/.claude/skills/<name>/` (personal) or `.claude/skills/<name>/` (project).

## When to use
- User says "create/write/make a skill", "add a slash command", "package this workflow as a skill".
- User describes a repeatable procedure they want to invoke by name.

## When NOT to use
- One-off task with no reuse value → just do it, don't make a skill.
- The behavior needs to fire automatically on events (e.g. "whenever I save X") → that needs a **hook** in settings.json, not a skill. Skills are invoked on demand; hooks fire on triggers. Offer the hook route if that's what they really want.

## Steps

1. **Decide scope with the user.** Ask (only if unclear):
   - Personal (`~/.claude/skills/`) or project (`.claude/skills/`)?
   - One-line purpose + when it should trigger.
   - Should it trigger automatically on matching requests, or only via `/name`?

2. **Pick a kebab-case `name`.** Short, imperative, matches how it'll be typed as `/<name>`.

3. **Write `SKILL.md`** with this structure:

```markdown
---
name: <the-name>
description: <one sentence: what it does + when to use it. This is the trigger signal — be specific about both the action and the conditions.>
---

# <the-name>

<2-3 sentences: what this skill produces.>

## When to use
- <concrete trigger conditions>

## When NOT to use
- <anti-conditions — prevents over-triggering>

## Steps
1. <first step>
2. <second step>
...
```

4. **Add supporting files only if needed.** Long reference docs, scripts, or templates go in sibling files (e.g. `reference.md`, `template.txt`), referenced from SKILL.md as `Read reference.md`. Keep SKILL.md itself lean — it loads into context every session, so don't dump huge content in it.

5. **Tighten the description.** This is the single most important field — Claude decides whether to auto-invoke from it. Include both WHAT and WHEN. Bad: "Helps with git." Good: "Generate a conventional-commit message from the staged diff and offer to commit. Use when the user wants to commit, write a commit message, or asks what changed."

6. **Confirm it's discoverable.** Tell the user: restart the session (or it'll be picked up), then invoke with `/<name>`. For auto-trigger, just describe the task naturally and it should fire if the description matches.

## Notes
- Skill names must match the folder name.
- One skill = one focused capability. If you're tempted to put two unrelated workflows in one skill, split it.
- Skills run with the main session's tools by default. To restrict, add `allowed-tools:` to frontmatter (e.g. `allowed-tools: [Read, Write]`).
- A skill is instructions to Claude, not a program — write it as a clear procedure a capable assistant could follow, not as code.
