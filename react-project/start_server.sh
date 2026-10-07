#!/bin/bash
# kopolab-auto-server : labport 웹 서버 실행 (앱별 고유 포트, 실행하면 자동 외부공개)
cd "$(dirname "$0")"
proj=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+|-+$//g')
URL="https://aisw-apps.kopoctc.kr/g/$(basename "$HOME")/${proj}/"
if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null && [ -f server.port ]; then
  echo "이미 실행 중 (포트 $(cat server.port))"; echo "외부 접속 주소: $URL"; exit 0
fi
[ -f server.pid ] && kill "$(cat server.pid)" 2>/dev/null; rm -f server.pid
PORT=$(python3 - <<'PY'
import socket, random
def free(p):
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', p)); s.close(); return r != 0
old = None
try: old = int(open('server.port').read().strip())
except Exception: pass
if old and 10000 <= old < 20000 and free(old):
    print(old)
else:
    for p in random.sample(range(10000, 20000), 100):
        if free(p): print(p); break
PY
)
[ -z "$PORT" ] && PORT=10080
export PORT
export HOST=0.0.0.0
: > server.log
IS_JSON_SERVER=0
# 실행 명령 자동 판별 (동적 서버는 반드시 $PORT 를 읽고 0.0.0.0 에 바인딩해야 자동공개됨)
if [ -f run.sh ]; then
  setsid bash run.sh >> server.log 2>&1 &
elif [ -f package.json ]; then
  if [ ! -d node_modules ] && command -v npm >/dev/null 2>&1; then npm install >> server.log 2>&1; fi
  if command -v npm >/dev/null 2>&1 && grep -q '"start"' package.json 2>/dev/null; then
    # npm start 에 덧붙일 인자를 판별(#71 의 --port/--host + #73 의 --static).
    # $PORT 를 env 뿐 아니라 인자로도 전달하는 이유(#71): json-server 등은 PORT env 를
    # 읽지 않아(실측 0.17.4) 기본 3000/localhost 로 떠 외부에서 도달 불가했다.
    # 인자를 모르는 러너(node server.js 등)는 그냥 무시하고 env 로 동작 — #71 실측 확인.
    #
    # ★★ 단, **없을 때만** 붙인다(#73). yargs 는 같은 옵션이 두 번 오면 값을 배열로
    #   만든다(실측 yargs 17.7.3: --port 15142 --port 15142 → [15142,15142]). json-server 는
    #   그 배열을 app.listen(argv.port) 로 넘겨 ERR_INVALID_ARG_VALUE 로 즉사하고, 이 크래시는
    #   uncaughtException 핸들러 등록 前이라 잡히지도 않는다. --static 도 동일
    #   (path.join(cwd, [배열]) → TypeError). 즉 학생이 start 에 이미 --port 를 써 뒀으면
    #   (실측: kopo08/hotel-page) 무조건 덧붙이는 방식은 앱을 죽인다.
    NPM_DECIDE=$(timeout 10 python3 - <<'PY'
import json, os, shlex, stat
PORT = os.environ.get("PORT", "")
# json-server 가 아닌 러너에게 주는 기본값(#71 과 동일 — 무시되거나 env 로 처리된다)
DEFAULT = ["--port", PORT, "--host", "0.0.0.0"]

def read_json(path):
    # ★ 반드시 정규파일 확인 후 연다. 학생 소유 $HOME 이라 'mkfifo json-server.json' 하나로
    #   open() 이 writer 를 영구 대기해 start_server.sh 전체가 멈춘다(try/except 는 예외를
    #   잡지 블로킹을 못 막는다). #71 의 'mkfifo server.port' → cat 영구 블록과 같은 유형.
    #   크기 상한도 둔다(거대 파일로 메모리 압박 방지).
    try:
        st = os.lstat(path)
        if not stat.S_ISREG(st.st_mode) or st.st_size > 1_000_000:
            return None
        with open(path) as f:
            v = json.load(f)
        return v if isinstance(v, dict) else None
    except Exception:
        return None

def start_tokens():
    pkg = read_json("package.json")
    if not pkg:
        return []          # 읽기 불가/비정상 → 기본값(기존 #71 동작 유지)
    try:
        return shlex.split((pkg.get("scripts") or {}).get("start") or "")
    except Exception:
        return []

def decide():
    # (json_server 여부, npm start 에 덧붙일 인자) 반환
    tok = start_tokens()
    # npx / npm exec / yarn 같은 래퍼를 건너뛰고 실제 명령을 본다
    i = 0
    while i < len(tok) and tok[i] in ("npx", "npm", "yarn", "pnpm", "exec", "run", "-y", "--yes"):
        i += 1
    # json-server 확정이 아니면 기존 동작 유지. concurrently 등으로 감싼 경우도 여기서
    # 걸러진다 — 그때 인자는 json-server 가 아닌 래퍼에게 가므로 붙이면 안 된다.
    if i >= len(tok) or os.path.basename(tok[i]) != "json-server":
        return False, DEFAULT
    rest = tok[i + 1:]

    def has(*names):
        # ★ 긴 옵션은 정확일치/'=' 형태, 짧은 옵션은 **접두 일치**까지 봐야 한다.
        #   yargs 는 '-p3000'·'-sdist'·'-wp3000' 처럼 값을 붙여 쓴 형태와 묶어 쓴 형태를
        #   모두 정상 파싱한다. 이걸 놓치면 우리가 같은 옵션을 또 붙여 값이 배열이 되고
        #   json-server 가 즉사한다(실측: '-p3000' + '--port N' → ERR_INVALID_ARG_VALUE,
        #   '-sdist' + '--static dist' → ERR_INVALID_ARG_TYPE).
        for t in rest:
            if t == "--":      # 이후는 positional — 옵션으로 세면 안 된다
                break
            for n in names:
                if t == n or t.startswith(n + "="):
                    return True
                # 짧은 옵션(-p 등): 붙여 쓴 값(-p3000) + 묶어 쓴 플래그(-wp3000)
                if (len(n) == 2 and n[0] == "-" and n[1] != "-"
                        and t.startswith("-") and not t.startswith("--") and n[1] in t[1:]):
                    return True
        return False

    extra = []
    if not has("--port", "-p"):
        extra += ["--port", PORT]
    if not has("--host", "-H"):
        extra += ["--host", "0.0.0.0"]

    # 학생이 명시한 --static 은 절대 건드리지 않는다(회귀 금지)
    if has("--static", "-s"):
        return True, extra
    # 설정파일의 static 도 존중. -c/--config 로 파일을 지정했으면 그 파일까지 본다.
    cfg = "json-server.json"
    for j, t in enumerate(rest):
        if t in ("-c", "--config") and j + 1 < len(rest):
            cfg = rest[j + 1]
        elif t.startswith("--config="):
            cfg = t.split("=", 1)[1]
    conf = read_json(cfg)
    if conf and "static" in conf:
        return True, extra
    # 정적 루트 자동 판별: **index.html 이 실제로 있는** 디렉터리만 고른다.
    #   - public/ 이 있어도 index.html 이 없으면(실측 kopo14/FOODPLACE: 에셋만) 건너뛴다.
    #     그 경우 dist 를 골라 --static dist 를 주면 json-server 의 public/ 자동선택
    #     (lib/server/defaults.js — cwd/public 이 있으면 그쪽으로 고정)을 덮어써 404 가 고쳐진다.
    #   - 후보는 **배포 산출물 디렉터리로 한정**한다. 루트(".")와 src/ 는 제외:
    #     ① 소스 트리를 공개 /g/ 로 열면 비밀이 샌다. 실측(json-server 0.17.4 + send):
    #        '.env' 는 404 로 막히지만 **'.git/config' 200 / 'config.js' 200 /
    #        'credentials.json' 200**. 프론트엔드 수업에서 소스에 API 키를 넣는 건 흔하고,
    #        한 번 크롤링된 키는 되돌려도 회수할 수 없다.
    #     ② Vite 루트 index.html 은 빌드 입력 템플릿이라 src="/src/main.tsx" 를 가리켜
    #        서빙해도 흰 화면이다.
    #     소스만 있는 앱은 부착 대신 아래 HTTP 자가진단이 --static 지정법을 안내한다.
    #     학생이 직접 지정하면 본인 판단이므로 노출 책임이 명확해진다.
    for d in ("dist", "build", "out", "public"):
        if os.path.isfile(os.path.join(d, "index.html")):
            return True, extra + ["--static", d]
    return True, extra     # 후보 없음 → 부착 안 함. 기동 후 HTTP 자가진단 안내가 뒤를 받는다.

is_js, args = decide()
# 한 줄로 끝내고 맨 앞에 완료 sentinel(OK)을 둔다. 여러 줄로 나누면 파이썬이 중간에
# 죽거나 timeout 에 걸려 **일부만** 출력됐을 때 셸이 그걸 정상 결과와 구분하지 못한다
# (인자가 정상적으로 비는 경우 — 학생이 --port/--host/--static 을 모두 지정한 앱 — 와
# 부분 출력이 똑같이 "빈 인자" 로 보인다). sentinel 이 있어야 폴백 조건이 확실해진다.
#   형식: OK <0|1> [인자...]
print(" ".join(["OK", "1" if is_js else "0"] + args))
PY
)
    # sentinel 이 없으면(python3 부재·예외·timeout·부분출력) 판별 실패로 보고 폴백한다.
    # 폴백을 안 하면 #71 이 고친 결함(json-server 가 3000/localhost 에 떠 외부 도달 불가)이
    # 아무 경고 없이 되살아난다.
    case "$NPM_DECIDE" in
      "OK 1"|"OK 1 "*) IS_JSON_SERVER=1; NPM_ARGS=${NPM_DECIDE#OK 1} ;;
      "OK 0"|"OK 0 "*) IS_JSON_SERVER=0; NPM_ARGS=${NPM_DECIDE#OK 0} ;;
      *)               IS_JSON_SERVER=0; NPM_ARGS="--port $PORT --host 0.0.0.0" ;;
    esac
    # NPM_ARGS 는 위에서 만든 안전한 토큰열 — 공백 분리가 의도라 따옴표로 감싸지 않는다.
    setsid npm start -- $NPM_ARGS >> server.log 2>&1 &
  else
    entry=""
    for c in server.js app.js index.js main.js; do [ -f "$c" ] && entry="$c" && break; done
    setsid node "${entry:-index.js}" >> server.log 2>&1 &
  fi
elif [ -f app.py ] || [ -f main.py ] || [ -f requirements.txt ]; then
  [ -f requirements.txt ] && python3 -m pip install -q --user -r requirements.txt >> server.log 2>&1
  if [ -f main.py ] && grep -qi fastapi main.py 2>/dev/null; then
    setsid python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT" >> server.log 2>&1 &
  elif [ -f app.py ]; then
    setsid python3 app.py >> server.log 2>&1 &
  else
    setsid python3 -m http.server "$PORT" --bind 0.0.0.0 >> server.log 2>&1 &
  fi
else
  setsid python3 -m http.server "$PORT" --bind 0.0.0.0 >> server.log 2>&1 &
fi
echo $! > server.pid
# ★ 기동 검증 후에만 server.port 기록(#71). 예전에는 성공 여부와 무관하게 기록해서,
#   실제로는 안 뜬 앱이 "포트는 있는데 LISTEN 없음" 유령 상태로 남았다. 그러면
#   share_project 가 ProvisionError("서버를 준비하는 중입니다")를 영구히 던져
#   /g/ 자가치유가 절대 성공하지 못한다(실측: 학생 앱 다수, json-server 가 3000 에 뜬 사례).
#   실패해도 server.pid 는 지우지 않는다 — 지우면 방금 띄운 프로세스가 고아가 되어
#   다음 실행 때 종료할 수 없다(포트만 점유). 종료는 기존 상단 로직이 담당.
STARTED=0
for _ in $(seq 1 40); do
  if python3 -c "import socket,sys; s=socket.socket(); r=s.connect_ex(('127.0.0.1', $PORT)); s.close(); sys.exit(0 if r==0 else 1)" 2>/dev/null; then
    STARTED=1; break
  fi
  sleep 1
done
if [ "$STARTED" = 1 ]; then
  echo "$PORT" > server.port
  echo "서버 실행됨 (포트 $PORT)."
  echo "외부 접속 주소(잠시 후 자동으로 열림): $URL"
  # HTTP 레벨 자가진단(#73). 위 --static 자동 부착으로도 못 고치는 경우가 남는다
  # (후보 디렉터리가 하나도 없을 때 — 예: 빌드 안 한 Vite 앱, 소스만 있는 앱). 그때 증상은
  # 두 가지인데 **원인은 같다**(정적 루트 미지정):
  #   ① GET / = 404          — cwd 에 public/ 이 있는데 그 안에 index.html 이 없는 경우
  #   ② GET / = 200 인데 json-server 내장 데모 페이지  — public/ 이 아예 없는 경우
  # 특히 ②는 200 이라 학생 눈에 "켜졌는데 내 페이지가 아님" 으로만 보여 404 보다 헷갈린다.
  #
  # ★ json-server 앱에만 실행한다 — 안내 문구가 --static 얘기라 Flask/FastAPI/node 앱에
  #   나가면 사실과 다른 지시가 된다(/ 라우트가 없어 404 인 API 앱은 그게 정상이다).
  # ★ timeout 으로 감싼다 — urlopen 의 timeout 은 **소켓 유휴** 기준이라 서버가 조금씩
  #   계속 보내면(SSE·스트리밍) 영원히 안 끝난다. 여기서 멈추면 server.port 는 이미
  #   기록됐는데 스크립트가 안 끝나 터미널이 붙잡힌다.
  # 진단 실패는 그냥 무시한다 — 안내가 목적이고 자동공개를 막아선 안 된다.
  if [ "$IS_JSON_SERVER" = 1 ]; then
  timeout 8 python3 - "$PORT" <<'PY' 2>/dev/null
import sys, urllib.request, urllib.error
port = sys.argv[1]
try:
    with urllib.request.urlopen("http://127.0.0.1:%s/" % port, timeout=3) as r:
        code, body = r.status, r.read(4096).decode("utf-8", "replace")
except urllib.error.HTTPError as e:
    code, body = e.code, ""
except Exception:
    raise SystemExit(0)

if code == 404:
    why = "메인 페이지(/)가 404 입니다."
elif code == 200 and "<title>JSON Server</title>" in body:
    why = "내 페이지가 아니라 json-server 기본 안내 페이지가 열립니다."
else:
    raise SystemExit(0)

print("")
print("[안내] 서버는 켜졌지만 " + why)
print("  json-server 는 --static <폴더> 없이는 내가 만든 HTML 을 보여주지 않습니다.")
print("  index.html 이 있는 폴더를 package.json 의 start 에 지정하세요. 예:")
print('    "start": "json-server --watch db.json --static dist"')
print("  빌드가 필요한 앱(Vite/React)이라면 먼저 'npm run build' 로 dist 를 만드세요.")
print("  ※ 지정한 폴더는 인터넷에 그대로 공개되니 비밀(API 키 등)이 없는지 확인하세요.")
PY
  fi
  # 진단은 어디까지나 부가 안내다. timeout 에 걸리면 rc=124 인데 이게 성공 분기의
  # 마지막 명령이라 그대로 스크립트 exit code 가 된다 — 서버는 정상 기동하고
  # server.port 까지 기록됐는데 "실패" 로 끝나는 셈. 성공은 성공으로 끝낸다.
  true
else
  echo "서버가 포트 $PORT 에서 응답하지 않습니다 (40초 대기)."
  echo "server.log 를 확인하세요. 서버는 PORT 환경변수(또는 --port 인자)를 읽고 0.0.0.0 에 바인딩해야 합니다."
  tail -20 server.log 2>/dev/null
  exit 1
fi
