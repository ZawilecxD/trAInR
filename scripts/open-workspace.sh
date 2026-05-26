#!/usr/bin/env bash
# Start local dev and open trAInR-related dashboards in the browser.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEV_URL="http://localhost:4321"
LINEAR_URL="https://linear.app/zawilecxd/project/trainr-mvp-5d6b10ab8d1e/issues"
SUPABASE_URL="https://supabase.com/dashboard/project/ywcshfujgapoptdkdqtj"
VERCEL_URL="https://vercel.com/zawilecxd1/tr-a-in-r"

open_url() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 &
  else
    echo "Open in your browser: $url"
  fi
}

echo "Opening project dashboards..."
open_url "$LINEAR_URL"
open_url "$SUPABASE_URL"
open_url "$VERCEL_URL"

echo "Starting dev server (Ctrl+C to stop)..."
npm run dev &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Waiting for $DEV_URL ..."
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "$DEV_URL" 2>/dev/null; then
    echo "Dev server ready — opening app."
    open_url "$DEV_URL"
    wait "$DEV_PID"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for dev server. Open manually: $DEV_URL"
wait "$DEV_PID"
