#!/bin/bash
# json-server(db.json) + Vite dev 서버를 함께 띄우는 헬퍼 (dev 테스트용)
# server.port(시스템 공개 감시) = Vite 포트(0.0.0.0 외부 노출).
# json-server는 127.0.0.1 전용 → Vite /api proxy 로만 중계(외부 노출 X).

cd "$(dirname "$0")"

JSON_PORT=3001

# 1) json-server 기동 (db.json 감시) — npx 사용(로컬 설치된 패키지)
#    --host 127.0.0.1 : json-server는 외부 직접 노출 X (Vite proxy(/api)로만 중계).
echo "▶ json-server 기동 (port $JSON_PORT, 127.0.0.1 only) ..."
npx json-server --watch db.json --host 127.0.0.1 --port "$JSON_PORT" > json-server.log 2>&1 &
JSON_PID=$!
echo "$JSON_PID" > json-server.pid
# 주의: server.port(시스템 공개 감시 파일)에는 json-server(127.0.0.1)가 아닌
#       아래 VITE_PORT를 기록해야 외부 공개가 됨. (이 줄에서는 기록 X)

# 실제 응답할 때까지 폴링 (최대 ~20초)
JSON_READY=0
for i in $(seq 1 20); do
  if curl -sf -o /dev/null "http://127.0.0.1:$JSON_PORT/movies" 2>/dev/null; then
    echo "  json-server 준비됨 (${i}s)"
    JSON_READY=1
    break
  fi
  sleep 1
done
if [ "$JSON_READY" -eq 0 ]; then
  echo "  [경고] json-server가 응답하지 않습니다. json-server.log 확인."
fi

# 2) Vite dev 서버 기동
echo "▶ Vite dev 서버 기동 ..."
npm run dev > vite.log 2>&1 &
VITE_PID=$!
echo "$VITE_PID" > vite.pid

# Vite가 할당한 포트가 로그에 찍힐 때까지 폴링 (최대 ~20초)
VITE_PORT=""
for i in $(seq 1 20); do
  VITE_PORT=$(grep -oE "localhost:[0-9]+" vite.log | head -1 | cut -d: -f2)
  if [ -n "$VITE_PORT" ]; then
    echo "  Vite 준비됨 (port $VITE_PORT, ${i}s)"
    break
  fi
  sleep 1
done
VITE_PORT="${VITE_PORT:-5173}"
echo "$VITE_PORT" > vite.port
# server.port(시스템 공개 감시 파일) = Vite 포트. Vite는 0.0.0.0 외부 노출이므로
# 시스템이 이 포트를 감지해 서브도메인으로 자동 공개하고, /api proxy로 API까지 동작.
echo "$VITE_PORT" > server.port

# Vite proxy(BASE 하위 /api → json-server)가 실제 응답하는지 폴링 (최대 ~20초)
# base(/g/<user>/<앱>/) 하위 경로로 API를 요청하므로 그 경로로 검사.
PROXY_READY=0
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:$VITE_PORT/g/kopo10/react-project/api/movies" 2>/dev/null | grep -q '"title"'; then
    echo "  proxy(BASE/api → json-server) 정상 응답 (${i}s)"
    PROXY_READY=1
    break
  fi
  sleep 1
done
if [ "$PROXY_READY" -eq 0 ]; then
  echo "  [경고] Vite proxy가 아직 응답하지 않습니다. 잠시 후 브라우저 새로고침."
fi

echo ""
echo "==============================================="
echo " json-server (API) : http://localhost:$JSON_PORT (127.0.0.1 only)"
echo " Vite dev (웹)     : http://localhost:$VITE_PORT/g/kopo10/react-project/"
echo "   proxy 예) http://localhost:$VITE_PORT/g/kopo10/react-project/api/movies"
echo " 외부(자동공개)     : https://aisw-apps.kopoctc.kr/g/kopo10/react-project/"
echo "==============================================="
echo " 종료: kill \$(cat json-server.pid) \$(cat vite.pid)"
