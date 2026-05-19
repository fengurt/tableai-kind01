#!/usr/bin/env bash
# KiND H5 prototype — local static server
#
# Usage:
#   ./scripts/dev-up.sh              # start (default port 8787)
#   PORT=8790 ./scripts/dev-up.sh    # fixed port
#   AUTO_PORT=1 ./scripts/dev-up.sh  # if port busy (foreign), try next free port
#   ./scripts/dev-up.sh stop         # stop KiND server(s) for this repo
#   ./scripts/dev-up.sh status       # show listeners + pid file
#   ./scripts/dev-up.sh check-port   # exit 0 if PORT free (or only our process)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_PORT=8787
PORT="${PORT:-$DEFAULT_PORT}"
AUTO_PORT="${AUTO_PORT:-0}"
NO_OPEN="${NO_OPEN:-0}"
PID_FILE="$ROOT/.kind-dev.pid"
META_FILE="$ROOT/.kind-dev.meta"
LOG_FILE="${TMPDIR:-/tmp}/kind-dev-${PORT}.log"
ENTRY="kind-dual-role.html"

# --- helpers -----------------------------------------------------------------

listeners_on_port() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

is_our_server() {
  local pid="$1"
  local expect_port="${2:-}"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1

  local cmd cwd port_in_meta
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$cmd" == *"python"*"http.server"* ]] || [[ "$cmd" == *"Python"*"http.server"* ]] || return 1

  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true)"
  [[ "$cwd" == "$ROOT" ]] || return 1

  if [[ -f "$META_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$META_FILE" 2>/dev/null || true
    if [[ -n "${KIND_DEV_ROOT:-}" && "$KIND_DEV_ROOT" != "$ROOT" ]]; then
      return 1
    fi
    if [[ -n "${KIND_DEV_PID:-}" && "$KIND_DEV_PID" == "$pid" ]]; then
      return 0
    fi
  fi

  if [[ -n "$expect_port" ]]; then
    [[ "$cmd" == *"${expect_port}"* ]] || return 1
  fi
  return 0
}

collect_our_pids() {
  local -a found=()
  local pid

  if [[ -f "$PID_FILE" ]]; then
    pid="$(tr -d '[:space:]' <"$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && is_our_server "$pid"; then
      found+=("$pid")
    fi
  fi

  local port
  for port in $(seq "$DEFAULT_PORT" $((DEFAULT_PORT + 30))); do
    for pid in $(listeners_on_port "$port"); do
      if is_our_server "$pid" "$port"; then
        found+=("$pid")
      fi
    done
  done

  # unique PIDs
  printf '%s\n' "${found[@]}" 2>/dev/null | sort -u
}

foreign_listeners_on_port() {
  local port="$1"
  local pid
  for pid in $(listeners_on_port "$port"); do
    if ! is_our_server "$pid" "$port"; then
      echo "$pid"
    fi
  done
}

stop_pid() {
  local pid="$1"
  local label="${2:-$pid}"
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  echo "Stopping KiND dev server PID $label..."
  kill "$pid" 2>/dev/null || true
  local i
  for i in 1 2 3 4 5 6 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "  Force kill PID $pid"
    kill -9 "$pid" 2>/dev/null || true
  fi
}

stop_all_ours() {
  local pid
  local any=0
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    stop_pid "$pid" "$pid"
    any=1
  done < <(collect_our_pids)

  rm -f "$PID_FILE" "$META_FILE"
  if [[ "$any" == 1 ]]; then
    sleep 0.15
  fi
}

port_free_for_us() {
  local port="$1"
  local foreign
  foreign="$(foreign_listeners_on_port "$port" | head -1)"
  [[ -z "$foreign" ]]
}

find_available_port() {
  local start="$1"
  local max="${2:-25}"
  local p="$start"
  local n=0
  while (( n < max )); do
    if port_free_for_us "$p"; then
      echo "$p"
      return 0
    fi
    # Port held only by our server — stop and reuse
    local pid
    for pid in $(listeners_on_port "$p"); do
      if is_our_server "$pid" "$p"; then
        stop_pid "$pid" "$pid (port $p)"
      fi
    done
    if port_free_for_us "$p"; then
      echo "$p"
      return 0
    fi
    p=$((p + 1))
    n=$((n + 1))
  done
  return 1
}

write_meta() {
  local pid="$1"
  local port="$2"
  cat >"$META_FILE" <<EOF
KIND_DEV_PID=$pid
KIND_DEV_PORT=$port
KIND_DEV_ROOT=$ROOT
KIND_DEV_STARTED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
  echo "$pid" >"$PID_FILE"
}

cmd_status() {
  echo "Repo:  $ROOT"
  echo "Entry: $ENTRY"
  if [[ -f "$META_FILE" ]]; then
    echo "--- .kind-dev.meta ---"
    cat "$META_FILE"
  else
    echo "--- .kind-dev.meta --- (none)"
  fi
  echo "--- Listeners (8787–$((DEFAULT_PORT + 10))) ---"
  local port pid
  local found=0
  for port in $(seq "$DEFAULT_PORT" $((DEFAULT_PORT + 10))); do
    for pid in $(listeners_on_port "$port"); do
      found=1
      local tag="foreign"
      if is_our_server "$pid" "$port"; then tag="KiND"; fi
      printf "  port %-5s PID %-6s [%s] %s\n" "$port" "$pid" "$tag" "$(ps -p "$pid" -o command= 2>/dev/null || echo '?')"
    done
  done
  if [[ "$found" == 0 ]]; then
    echo "  (no listeners in range)"
  fi
}

cmd_check_port() {
  local p="${1:-$PORT}"
  local foreign pid

  foreign="$(foreign_listeners_on_port "$p" | head -1)"
  if [[ -n "$foreign" ]]; then
    echo "Port $p: blocked by non-KiND process (PID $foreign)"
    lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true
    exit 1
  fi

  for pid in $(listeners_on_port "$p"); do
    if is_our_server "$pid" "$p"; then
      echo "Port $p: KiND dev server (PID $pid)"
      exit 0
    fi
  done

  echo "Port $p: free"
  exit 0
}

cmd_stop() {
  stop_all_ours
  echo "KiND dev server(s) stopped for $ROOT"
}

cmd_start() {
  stop_all_ours

  local chosen_port="$PORT"
  if [[ "$AUTO_PORT" == "1" ]]; then
    if ! chosen_port="$(find_available_port "$PORT" 30)"; then
      echo "No free port found starting at $PORT (tried 30 ports)." >&2
      exit 1
    fi
    if [[ "$chosen_port" != "$PORT" ]]; then
      echo "Port $PORT busy; using $chosen_port (AUTO_PORT=1)"
    fi
  else
    if ! port_free_for_us "$chosen_port"; then
      echo "Port $chosen_port is in use by a non-KiND process:" >&2
      lsof -nP -iTCP:"${chosen_port}" -sTCP:LISTEN 2>/dev/null >&2 || true
      echo "Stop that process, set PORT=..., or run: AUTO_PORT=1 $0" >&2
      exit 1
    fi
  fi

  PORT="$chosen_port"
  LOG_FILE="${TMPDIR:-/tmp}/kind-dev-${PORT}.log"
  URL="http://127.0.0.1:${PORT}/${ENTRY}"

  cd "$ROOT"
  nohup python3 -m http.server "$PORT" >"$LOG_FILE" 2>&1 &
  local new_pid=$!
  write_meta "$new_pid" "$PORT"
  sleep 0.4

  if ! kill -0 "$new_pid" 2>/dev/null; then
    echo "Failed to start server. Log: $LOG_FILE" >&2
    cat "$LOG_FILE" 2>/dev/null || true
    rm -f "$PID_FILE" "$META_FILE"
    exit 1
  fi

  if ! lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Server process started but port $PORT is not listening. Log: $LOG_FILE" >&2
    cat "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  echo "KiND prototype running"
  echo "  URL:  $URL"
  echo "  PID:  $new_pid"
  echo "  Log:  $LOG_FILE"
  echo "  Stop: $0 stop"

  if [[ "$NO_OPEN" != "1" ]] && command -v open >/dev/null 2>&1; then
    open "$URL"
  fi
}

# --- main --------------------------------------------------------------------

case "${1:-start}" in
  start|"")
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  status)
    cmd_status
    ;;
  check-port)
    cmd_check_port "${2:-$PORT}"
    ;;
  restart)
    cmd_stop
    cmd_start
    ;;
  -h|--help)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    echo ""
    echo "Commands: start (default) | stop | status | check-port [PORT] | restart"
    echo "Env: PORT, AUTO_PORT=1, NO_OPEN=1"
    ;;
  *)
    echo "Unknown command: $1 (try --help)" >&2
    exit 1
    ;;
esac
