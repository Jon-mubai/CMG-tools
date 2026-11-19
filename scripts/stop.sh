#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/scripts/.run/pids"

kill_tree() {
  local pid="$1"
  [[ -z "$pid" || "$pid" = "0" ]] && return
  if kill -0 "$pid" 2>/dev/null; then
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    kill -9 "$pid" 2>/dev/null || true
    echo "  已结束 PID $pid"
  fi
}

if [[ -f "$PID_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$PID_FILE" 2>/dev/null || true
  echo "[停止] API=$API_PID Web=$WEB_PID"
  kill_tree "$API_PID"
  kill_tree "$WEB_PID"
  rm -f "$PID_FILE"
fi

for port in 3001 8080; do
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    for p in $pids; do kill_tree "$p"; done
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
done
echo "已停止"
