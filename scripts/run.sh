#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="${SCRIPT_DIR}/config.yaml"
PORT=$(grep -oP 'port:\s*\K\d+' "$CONFIG" 2>/dev/null || echo "8443")

echo "Starting webterm on http://localhost:${PORT} ..."
"${SCRIPT_DIR}/webterm" -config "$CONFIG" &
PID=$!

sleep 1
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${PORT}" &
elif command -v open &>/dev/null; then
    open "http://localhost:${PORT}" &
fi

wait "$PID"
