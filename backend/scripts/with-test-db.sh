#!/bin/sh
# Runs a command with a throwaway MongoDB, e.g.:  sh scripts/with-test-db.sh npm test
# Needs `mongod` on your PATH (or set MONGOD_BIN). Or skip this and set TEST_MONGODB_URI yourself.
BIN=${MONGOD_BIN:-mongod}
PORT=${TEST_DB_PORT:-27099}
DIR=$(mktemp -d)
"$BIN" --dbpath "$DIR" --port "$PORT" --bind_ip 127.0.0.1 --nounixsocket >"$DIR/mongod.log" 2>&1 &
PID=$!
node -e "
const net=require('net');let n=0;(function t(){const s=net.connect($PORT,'127.0.0.1');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>{if(++n>60){console.error('mongod did not start');process.exit(1)}setTimeout(t,500)})})()" || { kill $PID 2>/dev/null; cat "$DIR/mongod.log" | tail -5; exit 1; }
TEST_MONGODB_URI="mongodb://127.0.0.1:$PORT" "$@"
CODE=$?
kill $PID 2>/dev/null; wait $PID 2>/dev/null; rm -rf "$DIR"
exit $CODE
