#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-}"

if [ "$PROFILE" != "dev" ] && [ "$PROFILE" != "stage" ]; then
  echo "Usage: ./scripts/start-local.sh dev|stage" >&2
  exit 1
fi

ENV_FILE="$ROOT_DIR/server/.env.$PROFILE"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing server/.env.$PROFILE. Copy server/.env.$PROFILE.example and add this profile's credentials." >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/server/node_modules" ] || [ ! -d "$ROOT_DIR/web/node_modules" ]; then
  echo "Install dependencies in server/ and web/ before starting Astitva." >&2
  exit 1
fi

CONTROL_CENTER_PORT="${CONTROL_CENTER_PORT:-4318}"
if ! [[ "$CONTROL_CENTER_PORT" =~ ^[0-9]+$ ]] || [ "${#CONTROL_CENTER_PORT}" -gt 5 ] || [ "$CONTROL_CENTER_PORT" -lt 1024 ] || [ "$CONTROL_CENTER_PORT" -gt 65535 ] || [ "$CONTROL_CENTER_PORT" -eq 3000 ] || [ "$CONTROL_CENTER_PORT" -eq 3001 ]; then
  echo "CONTROL_CENTER_PORT must be 1024–65535, excluding 3000 and 3001." >&2
  exit 1
fi
if [ ! -f "$ROOT_DIR/tools/control-center/server.mjs" ]; then
  echo "Missing tools/control-center/server.mjs." >&2
  exit 1
fi
export CONTROL_CENTER_PORT

for PORT_TO_CHECK in 3000 3001 "$CONTROL_CENTER_PORT"; do
  if lsof -nP -iTCP:"$PORT_TO_CHECK" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT_TO_CHECK is already in use. Stop the running Astitva profile first." >&2
    exit 1
  fi
done

chmod 600 "$ENV_FILE"

cleanup() {
  trap - INT TERM EXIT
  [ -z "${SERVER_PID:-}" ] || kill "$SERVER_PID" 2>/dev/null || true
  [ -z "${WEB_PID:-}" ] || kill "$WEB_PID" 2>/dev/null || true
  [ -z "${CONTROL_CENTER_PID:-}" ] || kill "$CONTROL_CENTER_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting Astitva $PROFILE locally..."
(cd "$ROOT_DIR/server" && exec node --env-file="$ENV_FILE" src/server.js) &
SERVER_PID=$!
# Launch Vite directly so cleanup owns the server PID, without an npm wrapper.
(cd "$ROOT_DIR/web" && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000) &
WEB_PID=$!
(cd "$ROOT_DIR" && exec node tools/control-center/server.mjs) &
CONTROL_CENTER_PID=$!
echo "Control Center: http://127.0.0.1:$CONTROL_CENTER_PORT"

while kill -0 "$SERVER_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null && kill -0 "$CONTROL_CENTER_PID" 2>/dev/null; do
  sleep 1
done

STATUS=0
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  wait "$SERVER_PID" 2>/dev/null || STATUS=$?
elif ! kill -0 "$WEB_PID" 2>/dev/null; then
  wait "$WEB_PID" 2>/dev/null || STATUS=$?
else
  wait "$CONTROL_CENTER_PID" 2>/dev/null || STATUS=$?
fi
exit "$STATUS"
