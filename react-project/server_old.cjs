// kopolab 통합 서버 (json-server 커스텀 래핑)
// - 정적(dist) 서빙 + REST API(json-server) + POST /upload(외부 URL → 다운로드 → posters 저장)
// - package.json 이 "type":"module" 이므로 CommonJS 로 작성(.cjs 확장자가 require 사용을 보장).
// - start_server.sh 가 PORT/HOST 환경변수를 주입한다.
// - 외부 이미지 다운로드는 curl(child_process) 사용:
//   이 환경은 외부 인터넷이 HTTP 프록시를 통해서만 접근 가능하며,
//   curl 은 HTTPS_PROXY/HTTP_PROXY 환경변수를 자동으로 사용하지만 Node 의 http/https 모듈은
//   무시하므로(직접 나가면 ETIMEDOUT), 프록시를 자동 처리하는 curl 에 다운로드를 위임한다.
const jsonServer = require("json-server");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const ROOT = __dirname;
const PUBLIC_POSTERS = path.join(ROOT, "public", "posters");
const DIST_POSTERS = path.join(ROOT, "dist", "posters");

// 업로드 제한
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const TIMEOUT_S = 20; // curl --max-time (초)

// posters 디렉토리 보장
function ensureDirs() {
  for (const d of [PUBLIC_POSTERS, DIST_POSTERS]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

// Content-Type → 확장자
function extFromContentType(ct) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const base = (ct || "").split(";")[0].trim().toLowerCase();
  return map[base] || null;
}

// URL 의 이미지를 한 번의 GET 으로 다운로드하면서 헤더도 함께 캡처.
// (HEAD(-I)를 쓰면 일부 호스트(picsum 등)가 405 로 막으므로 GET 으로 통일)
// -sL: 진행 출력 숨김 + 리다이렉트 follow / --fail: 4xx·5xx → exit 22
// -D <headerfile>: 응답 헤더를 파일로 / -o <destfile>: 본문을 파일로
function downloadWithCurl(url, destPath, headerPath) {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      [
        "-sL",
        "--fail",
        "--max-time",
        String(TIMEOUT_S),
        "--max-filesize",
        String(MAX_BYTES),
        "-D",
        headerPath,
        "-o",
        destPath,
        url,
      ],
      (err, _stdout, stderr) => {
        if (err) {
          return reject(
            new Error(
              `다운로드 실패 (curl exit ${err.code || "?"}): ${(stderr || "").trim() || err.message}`,
            ),
          );
        }
        resolve();
      },
    );
  });
}

// 캡처한 헤더 파일에서 최종(리다이렉트 후) Content-Type 추출
function readContentType(headerPath) {
  if (!fs.existsSync(headerPath)) return "";
  const text = fs.readFileSync(headerPath, "utf8");
  const lines = text.split(/\r?\n/);
  // 여러 응답(리다이렉트)이 이어질 수 있으므로 마지막 content-type 사용
  const ct = lines.filter((l) => /^content-type:/i.test(l)).pop();
  return (ct || "").replace(/^content-type:\s*/i, "").trim();
}

// URL → 이미지 다운로드 후 destPath 에 저장. Content-Type 검증으로 확장자 결정.
async function downloadToFile(url, destPath) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("http/https URL만 허용됩니다.");
  }

  const headerPath = destPath + ".headers";
  await downloadWithCurl(url, destPath, headerPath);

  const contentType = readContentType(headerPath);
  const ext = extFromContentType(contentType);
  // 헤더 파일 정리
  try {
    fs.unlinkSync(headerPath);
  } catch {
    /* 무시 */
  }

  if (!ext) {
    throw new Error(
      `이미지가 아닙니다 (Content-Type: ${contentType || "알 수 없음"})`,
    );
  }

  const stat = fs.statSync(destPath);
  if (stat.size === 0) throw new Error("빈 파일이 저장되었습니다.");
  if (stat.size > MAX_BYTES) throw new Error("파일이 너무 큽니다.");

  return { ext, contentType };
}



// ---- json-server 커스텀 래핑 ----
const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults({
  static: "dist",
  logger: true,
});

// /upload 에서 req.body(JSON) 를 읽기 위해 body 파서 적용
// (json-server 0.17 은 bodyParser 미들웨어를 제공하지 않으므로 express.json 사용)
server.use(express.json());
server.use(middlewares);

// POST /upload  — body: { url }
//   외부 이미지 URL을 받아 다운로드한 뒤 public/posters + dist/posters 에 저장하고
//   브라우저에서 참조 가능한 상대경로("posters/xxx.jpg")를 반환한다.
server.post("/upload", async (req, res) => {
  try {
    const url = req.body && req.body.url;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url이 필요합니다." });
    }

    ensureDirs();

    const stamp = Date.now();
    const rnd = Math.floor(Math.random() * 1e6);
    const tmpPath = path.join(PUBLIC_POSTERS, `.tmp-${stamp}-${rnd}`);
    const { ext } = await downloadToFile(url, tmpPath);

    const filename = `poster-${stamp}-${rnd}.${ext}`;
    const finalName = path.join(PUBLIC_POSTERS, filename);

    fs.renameSync(tmpPath, finalName);

    // 배포 서빙(dist) 즉시 반영을 위해 dist/posters 에도 복사.
    // dist가 없으면(빌드 전) 무시 — 다음 빌드 시 public/ → dist/ 로 복사됨.
    try {
      fs.copyFileSync(finalName, path.join(DIST_POSTERS, filename));
    } catch {
      /* dist 없으면 무시 */
    }

    return res.json({ path: `posters/${filename}` });
  } catch (err) {
    console.error("[/upload error]", err && err.message);
    return res
      .status(500)
      .json({ error: (err && err.message) || "업로드 실패" });
  }
});

server.use(router);

server.listen(PORT, HOST, () => {
  console.log(
    `통합 서버 실행: http://${HOST}:${PORT} (정적 dist + json-server API + /upload)`,
  );
});
