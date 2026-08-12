#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="${SCRIPT_DIR}/webterm"
CONFIG="${SCRIPT_DIR}/config.yaml"
PID_FILE="${SCRIPT_DIR}/webterm.pid"
PORT=$(grep -oP 'port:\s*\K\d+' "$CONFIG" 2>/dev/null || echo "8888")

running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

case "${1:-}" in
start)
    if running; then
        echo "webterm is already running (pid $(cat "$PID_FILE"))"
        exit 0
    fi
    echo -n "Starting webterm ... "
    nohup "$BIN" -config "$CONFIG" > webterm.log 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if running; then
        echo "ok (pid $(cat "$PID_FILE"), http://localhost:${PORT})"
    else
        echo "failed — check webterm.log"
        rm -f "$PID_FILE"
        exit 1
    fi
    ;;

stop)
    if ! running; then
        echo "webterm is not running"
        rm -f "$PID_FILE"
        exit 0
    fi
    echo -n "Stopping webterm (pid $(cat "$PID_FILE")) ... "
    kill "$(cat "$PID_FILE")"
    for i in $(seq 10); do
        if ! running; then
            echo "ok"
            rm -f "$PID_FILE"
            exit 0
        fi
        sleep 0.3
    done
    echo "timeout — sending SIGKILL"
    kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
    ;;

restart)
    "$0" stop
    sleep 0.5
    "$0" start
    ;;

status)
    if running; then
        echo "webterm is running (pid $(cat "$PID_FILE"), http://localhost:${PORT})"
    else
        echo "webterm is stopped"
        rm -f "$PID_FILE"
    fi
    ;;

*)
    echo "Starting webterm on http://localhost:${PORT} ..."
    "$BIN" -config "$CONFIG" &
    PID=$!
    sleep 1
    if command -v xdg-open &>/dev/null; then
        xdg-open "http://localhost:${PORT}" 2>/dev/null &
    elif command -v open &>/dev/null; then
        open "http://localhost:${PORT}" 2>/dev/null &
    fi
    wait "$PID"
    ;;
esac
