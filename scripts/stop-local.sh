#!/usr/bin/env bash
set -eu

if [ "$#" -ne 0 ]; then
  echo "Usage: ./scripts/stop-local.sh" >&2
  exit 1
fi

CONTROL_CENTER_PORT="${CONTROL_CENTER_PORT:-4318}"
if ! [[ "$CONTROL_CENTER_PORT" =~ ^[0-9]+$ ]] || [ "${#CONTROL_CENTER_PORT}" -gt 5 ] || [ "$CONTROL_CENTER_PORT" -lt 1024 ] || [ "$CONTROL_CENTER_PORT" -gt 65535 ] || [ "$CONTROL_CENTER_PORT" -eq 3000 ] || [ "$CONTROL_CENTER_PORT" -eq 3001 ]; then
  echo "CONTROL_CENTER_PORT must be 1024–65535, excluding 3000 and 3001." >&2
  exit 1
fi

command -v lsof >/dev/null 2>&1 || { echo "lsof is required." >&2; exit 1; }

STATUS=0
for PORT_TO_STOP in 3000 3001 "$CONTROL_CENTER_PORT"; do
  PIDS="$(lsof -tiTCP:"$PORT_TO_STOP" -sTCP:LISTEN || true)"
  if [ -z "$PIDS" ]; then
    echo "Port $PORT_TO_STOP: already stopped."
    continue
  fi
  for SERVICE_PID in $PIDS; do
    if ! kill -TERM "$SERVICE_PID" 2>/dev/null && kill -0 "$SERVICE_PID" 2>/dev/null; then
      echo "Could not stop PID $SERVICE_PID on port $PORT_TO_STOP." >&2
      STATUS=1
    fi
  done
done

# Allow graceful shutdown and the launcher's cleanup trap to finish.
for ATTEMPT in 1 2 3 4 5; do
  STILL_RUNNING=0
  for PORT_TO_CHECK in 3000 3001 "$CONTROL_CENTER_PORT"; do
    if lsof -tiTCP:"$PORT_TO_CHECK" -sTCP:LISTEN >/dev/null 2>&1; then
      STILL_RUNNING=1
    fi
  done
  if [ "$STILL_RUNNING" -eq 0 ]; then
    echo "Local web, backend and Control Center are stopped."
    exit "$STATUS"
  fi
  sleep 1
done

echo "Some services are still listening. No processes were force-killed." >&2
exit 1
