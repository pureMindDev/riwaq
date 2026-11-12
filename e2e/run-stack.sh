#!/bin/sh
# Starts MongoDB (throwaway), the MOCK Qur'an provider (placeholder text, NOT Qur'an), the API and the frontend.
# Usage: ./e2e/run-stack.sh [dev|strict]
#   dev    (default) no recognition engine, ALLOW_SELF_DECLARATION=true  -> general flows can be tested
#   strict a scriptable TEST engine, no self-declaration                  -> the real Muallim rules
# Needs `mongod` on PATH (or MONGOD_BIN=/path/to/mongod). Stop with: sh e2e/stop-stack.sh
cd "$(dirname "$0")/.."
BIN=${MONGOD_BIN:-mongod}
DB=$(mktemp -d)
("$BIN" --dbpath "$DB" --port 27098 --bind_ip 127.0.0.1 --nounixsocket > /tmp/e2e-mongod.log 2>&1 &)
(cd backend && MOCK_PORT=4100 node dev/mock-provider.js > /tmp/e2e-mock.log 2>&1 &)
sleep 3
MODE=${1:-dev}
if [ "$MODE" = strict ]; then
  (node e2e/file-engine.js > /tmp/e2e-engine.log 2>&1 &)
  EXTRA="RECITATION_ENGINE_URL=http://localhost:4200"
else
  EXTRA="ALLOW_SELF_DECLARATION=true"
fi
(cd backend && env $EXTRA MONGODB_URI=mongodb://127.0.0.1:27098/digital-tahfidh-e2e AUTH_RATE_LIMIT_MAX=1000 QF_CLIENT_ID=test-id QF_CLIENT_SECRET=test-secret QF_AUTH_URL=http://localhost:4100 QF_API_URL=http://localhost:4100 QF_AUDIO_BASE_URL=http://localhost:4100/audio/ QF_CACHE_SECONDS=0 PORT=4000 node server.js > /tmp/e2e-api.log 2>&1 &)
(cd frontend && npx vite --port 5173 --strictPort > /tmp/e2e-web.log 2>&1 &)
for i in $(seq 1 60); do curl -sf localhost:4000/api/status >/dev/null && curl -sf -o /dev/null localhost:5173/ && break; sleep 1; done
curl -s localhost:4000/api/status; echo
curl -s -o /dev/null -w "web %{http_code}\n" localhost:5173/
