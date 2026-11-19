#!/usr/bin/env bash
# CMG WMS — 后台启动 API(3001) + Web(8080)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/scripts/.run"
LOG="$ROOT/scripts/logs"
mkdir -p "$RUN" "$LOG"
PID_FILE="$RUN/pids"

port_busy() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$p " && return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -q ":$p " && return 0
  fi
  return 1
}

start_one() {
  local name="$1" dir="$2" cmd="$3"
  local out="$LOG/${name}.out.log"
  local err="$LOG/${name}.err.log"
  (
    cd "$dir"
    nohup bash -c "$cmd" >>"$out" 2>>"$err" &
    echo $!
  )
}

API_PID=""
WEB_PID=""

if ! port_busy 3001; then
  if [[ ! -f "$ROOT/apps/api/.env" && -f "$ROOT/apps/api/.env.example" ]]; then
    cp "$ROOT/apps/api/.env.example" "$ROOT/apps/api/.env"
    echo "[提示] 已复制 apps/api/.env，请检查 DATABASE_URL"
  fi
  API_PID=$(start_one api "$ROOT/apps/api" "npm run start:dev")
  echo "[启动] API PID=$API_PID → :3001"
else
  echo "[跳过] 3001 已占用"
fi

if ! port_busy 8080; then
  WEB_PID=$(start_one web "$ROOT/apps/web" "npm run dev")
  echo "[启动] Web PID=$WEB_PID → :8080"
else
  echo "[跳过] 8080 已占用"
fi

{
  echo "API_PID=$API_PID"
  echo "WEB_PID=$WEB_PID"
  echo "STARTED=$(date -Iseconds 2>/dev/null || date)"
} >"$PID_FILE"

echo "后台已启动。前端 http://127.0.0.1:8080  后端 http://127.0.0.1:3001/api/v1"
echo "停止: ./scripts/stop.sh   日志: scripts/logs/"
