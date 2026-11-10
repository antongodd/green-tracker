#!/bin/bash
# Fresh private copy of the app on port 8790, seeded.
D=$(cd "$(dirname "$0")" && pwd)
pkill -f "test/e2e/server.mjs"; pkill -f "wrangler dev"; pkill -f workerd; sleep 2
cd /home/user/green-tracker && (E2E_PORT=8790 nohup node test/e2e/server.mjs > "$D/server.log" 2>&1 &)
for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null http://localhost:8790/ && break; done
sleep 2; cd "$D" && node seed.mjs
