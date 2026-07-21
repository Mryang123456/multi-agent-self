#!/bin/bash
# Team Memory 每周自动运维 (B 期)
# 由 crontab 每周一 10:15 触发。跑 update_indexes.py 四步流水线。
# 日志写 .ops.log

set -euo pipefail

MEM_DIR="$HOME/.claude/team-memory"
LOG="$MEM_DIR/.ops.log"
PY="${PYTHON3:-python3}"

echo "========================================" >> "$LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始每周记忆运维" >> "$LOG"

cd "$MEM_DIR"
"$PY" update_indexes.py >> "$LOG" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 运维失败(退出码 $?)" >> "$LOG"
  exit 1
}

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 运维完成" >> "$LOG"
