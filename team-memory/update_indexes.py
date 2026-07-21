#!/usr/bin/env python3
"""
Team Memory 自动化运维脚本 (B 期)

四步流水线,对应 PROTOCOL.md §记忆运维:
  Step 1 结构同步: 扫 mem/*.md,与 _index.md 表格对账,新增追加 / 删除删行
  Step 2 描述同步: 读 mem/*.md 的 frontmatter description,单向同步到 _index.md
  Step 3 自动归档: type=project 且 status=completed 的,按反悔期规则移入 _archive/
  Step 4 导航刷新: 用各 _index.md 的记忆清单重建 MEMORY.md 的"当前沉淀"区

设计原则(借鉴寄生式记忆系统):
  - frontmatter 是唯一事实源,_index.md 是视图,单向同步
  - 归档只移不删(_archive/ 可恢复),只归 project 类,必须显式 completed
  - 失败模式偏向"宁可多留别误删"

用法:
  python3 update_indexes.py           # 真跑
  python3 update_indexes.py --dry-run # 只打印计划,不改文件
  python3 update_indexes.py --role pm # 只跑某角色
"""

import os
import re
import sys
import shutil
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent  # ~/.claude/team-memory
ROLES = ["pm", "frontend", "backend", "qa", "team-lead"]
ARCHIVE_RETENTION_DAYS = 30  # 反悔期

# ---------- 工具 ----------

def log(msg):
    print(f"[mem-ops] {msg}")

def parse_frontmatter(text):
    """解析 markdown 文件首部 --- 之间的 frontmatter。返回 dict(空则 {})。"""
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    block = text[3:end].strip()
    fm = {}
    for line in block.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm

def read_mem_file(path):
    """读一条沉淀记忆,返回 (frontmatter_dict, body)。"""
    text = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    return fm, text

def parse_index_rows(index_text):
    """
    解析 _index.md 的表格行。返回 list[dict{name, link, desc, type}]。
    只解析 | [name](link) | desc | type | 这种指针行。
    """
    rows = []
    for line in index_text.splitlines():
        m = re.match(r"\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|", line)
        if m:
            rows.append({
                "name": m.group(1).strip(),
                "link": m.group(2).strip(),
                "desc": m.group(3).strip(),
                "type": m.group(4).strip(),
            })
    return rows

def index_table_row(name, link, desc, type_):
    return f"| [{name}]({link}) | {desc} | {type_} |"

# ---------- Step 1 + 2: 结构与描述同步 ----------

def sync_index(role_dir, dry_run):
    """对账 mem/ 与 _index.md: 新文件追加行,删文件删行,描述单向同步。"""
    mem_dir = role_dir / "mem"
    index_file = role_dir / "_index.md"
    if not mem_dir.is_dir() or not index_file.is_file():
        return

    # 现有记忆文件集 {name: (path, frontmatter)}
    mem_files = {}
    for p in sorted(mem_dir.glob("*.md")):
        fm, _ = read_mem_file(p)
        mem_files[p.stem] = (p, fm)

    index_text = index_file.read_text(encoding="utf-8")
    rows = parse_index_rows(index_text)
    rows_by_name = {r["name"]: r for r in rows}

    changes = []

    # 删除: _index 有但 mem/ 没有的
    for name in list(rows_by_name):
        if name not in mem_files:
            changes.append(f"  - 删行(文件已不存在): {name}")
            rows = [r for r in rows if r["name"] != name]

    # 新增 + 描述同步
    for name, (path, fm) in mem_files.items():
        desc = fm.get("description", "").replace("|", "\\|")
        type_ = fm.get("type", "").replace("|", "\\|")
        link = f"mem/{name}.md"
        if name not in rows_by_name:
            changes.append(f"  + 新增行: {name}")
            rows.append({"name": name, "link": link, "desc": desc, "type": type_})
        else:
            # 描述单向同步(frontmatter 为准)
            r = next(r for r in rows if r["name"] == name)
            if r["desc"] != desc or r["type"] != type_:
                changes.append(f"  ~ 同步描述/类型: {name}")
                r["desc"] = desc
                r["type"] = type_
                r["link"] = link

    if not changes:
        return

    # 重建 _index.md: 保留表头,替换数据行
    if changes:
        log(f"[{role_dir.name}] _index 同步:")
        for c in changes:
            log(c)

    if dry_run:
        return

    # 找到表格数据行区间,替换
    lines = index_text.splitlines()
    # 定位表头分隔线 |---|
    header_idx = None
    for i, ln in enumerate(lines):
        if re.match(r"\|[-\s|]+\|[-\s|]+\|", ln) and i > 0:
            header_idx = i
            break
    if header_idx is None:
        log(f"[{role_dir.name}] 警告: 找不到 _index 表头,跳过重建")
        return

    # 删掉分隔线之后的所有表格行(到文件尾或空行)
    tail_start = header_idx + 1
    # 保留 header_idx 之后的非表格内容(空行后的说明等)
    after_table = []
    for ln in lines[tail_start:]:
        if ln.strip().startswith("|"):
            continue
        after_table.append(ln)
    # 去掉前导空行
    while after_table and after_table[0].strip() == "":
        after_table.pop(0)

    new_rows = [index_table_row(r["name"], r["link"], r["desc"], r["type"]) for r in rows]
    # 若无行,留占位
    if not new_rows:
        new_rows = ["| _(暂无沉淀记忆)_ | | |"]

    new_content = "\n".join(lines[:tail_start] + new_rows + [""] + after_table)
    index_file.write_text(new_content, encoding="utf-8")

# ---------- Step 3: 归档 ----------

def archive_completed(role_dir, dry_run, today):
    """
    归档 type=project 且 status=completed 的记忆。
    规则: 无 completed_at → 立即归档; 有 completed_at 且距今 > 反悔期 → 归档。
    只移不删: 移到 _archive/<role>/,从 _index 删行。
    """
    mem_dir = role_dir / "mem"
    if not mem_dir.is_dir():
        return

    archive_dir = role_dir / "_archive"
    archived = []

    for p in sorted(mem_dir.glob("*.md")):
        fm, text = read_mem_file(p)
        if fm.get("type") != "project":
            continue
        if fm.get("status") != "completed":
            continue

        # 反悔期判断
        completed_at = fm.get("completed_at", "").strip()
        if completed_at:
            try:
                # 支持 YYYY-MM-DD
                cdate = datetime.date.fromisoformat(completed_at[:10])
                age = (today - cdate).days
                if age < ARCHIVE_RETENTION_DAYS:
                    continue  # 反悔期内,不归档
            except ValueError:
                log(f"[{role_dir.name}] 警告: {p.name} completed_at 格式无法解析({completed_at}),跳过归档以防误归")
                continue

        archived.append(p.name)

    if not archived:
        return

    log(f"[{role_dir.name}] 归档 {len(archived)} 条(只移不删):")
    for name in archived:
        log(f"  → {name}")

    if dry_run:
        return

    archive_dir.mkdir(exist_ok=True)
    for p in mem_dir.glob("*.md"):
        # 重新判断(避免循环中状态变化)
        fm, text = read_mem_file(p)
        if fm.get("type") != "project" or fm.get("status") != "completed":
            continue
        completed_at = fm.get("completed_at", "").strip()
        if completed_at:
            try:
                cdate = datetime.date.fromisoformat(completed_at[:10])
                if (today - cdate).days < ARCHIVE_RETENTION_DAYS:
                    continue
            except ValueError:
                continue
        dest = archive_dir / p.name
        shutil.move(str(p), str(dest))

    # 归档后 _index 的行会在下次 sync 时自动删(文件没了)。这里主动同步一次。
    sync_index(role_dir, dry_run=False)

# ---------- Step 4: 导航刷新 ----------

def refresh_nav(role_dir, dry_run):
    """
    用 _index.md 的记忆清单重建 MEMORY.md 的"当前沉淀"区。
    诚实说明: 真正的关键词提炼需 LLM(当前无 key),这里用记忆清单替代,
    让导航层至少反映"该类现在有哪些记忆",辅助 agent 判断是否下钻。
    """
    nav_file = role_dir / "MEMORY.md"
    index_file = role_dir / "_index.md"
    if not nav_file.is_file() or not index_file.is_file():
        return

    rows = parse_index_rows(index_file.read_text(encoding="utf-8"))
    real_rows = [r for r in rows if not r["desc"].startswith("_(暂无")]

    nav_text = nav_file.read_text(encoding="utf-8")

    # 删除既有的"## 当前沉淀记忆"区(到文件尾)
    marker = "## 当前沉淀记忆"
    if marker in nav_text:
        nav_text = nav_text.split(marker)[0].rstrip() + "\n"
    else:
        nav_text = nav_text.rstrip() + "\n"

    # 追加新区
    nav_text += f"\n{marker}\n\n"
    nav_text += "> 自动维护(每周 cron 刷新)。关键词提炼需 LLM,当前以记忆清单替代。\n\n"
    if real_rows:
        for r in real_rows:
            nav_text += f"- **{r['name']}** ({r['type']}): {r['desc']}\n"
    else:
        nav_text += "- _(暂无沉淀记忆)_\n"

    log(f"[{role_dir.name}] MEMORY.md 导航刷新({len(real_rows)} 条沉淀)")
    if dry_run:
        return
    nav_file.write_text(nav_text, encoding="utf-8")

# ---------- 主流程 ----------

def main():
    dry_run = "--dry-run" in sys.argv
    only_role = None
    for a in sys.argv[1:]:
        if a.startswith("--role="):
            only_role = a.split("=", 1)[1]
        elif a == "--role" and sys.argv.index(a) + 1 < len(sys.argv):
            only_role = sys.argv[sys.argv.index(a) + 1]

    roles = [only_role] if only_role else ROLES
    today = datetime.date.today()
    log(f"开始运维 (dry_run={dry_run}, roles={roles}, today={today}, 反悔期={ARCHIVE_RETENTION_DAYS}天)")

    for role in roles:
        role_dir = ROOT / role
        if not role_dir.is_dir():
            log(f"跳过不存在的角色目录: {role}")
            continue
        log(f"=== {role} ===")
        sync_index(role_dir, dry_run)
        archive_completed(role_dir, dry_run, today)
        refresh_nav(role_dir, dry_run)

    # shared 契约也同步索引(不归档)
    shared = ROOT / "shared"
    if shared.is_dir() and (not only_role):
        log("=== shared ===")
        sync_index(shared, dry_run)

    log("完成。")

if __name__ == "__main__":
    main()
