// server.cjs — 통합 서버 (Express + MySQL)
// - REST API(api.cjs) + POST /upload(upload.cjs) + 정적 dist 서빙
// - json-server 를 대체한다. 프런트(src/api/*.ts)의 경로·응답 모양은 그대로 유지.
// - PORT/HOST 환경변수를 읽는다 (start_server.sh 호환). 기본 3001 (vite proxy 대상).
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

app.use(
  "/chat-api",
  createProxyMiddleware({
    target: "http://127.0.0.1:8000",
    changeOrigin: true,

    pathRewrite: {
      "^/": "/api/",
    },

    on: {
      proxyReq: (proxyReq, req) => {
        console.log(
          `[chat-api] ${req.method} ${req.originalUrl} → ${proxyReq.path}`
        );
      },

      error: (err, req, res) => {
        console.error("[chat-api proxy error]", err.message);

        if (!res.headersSent) {
          res.status(502).json({
            error: "챗봇 서버에 연결할 수 없습니다.",
          });
        }
      },
    },
  })
);

app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.use(require("./api.cjs"));
app.use(require("./upload.cjs"));

// 정적 서빙: 빌드 결과(dist), 그리고 dist에 아직 없는 포스터는 public/posters 에서
app.use(express.static(path.join(__dirname, "dist")));
app.use("/posters", express.static(path.join(__dirname, "public", "posters")));


// 오류 처리
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ error: "이미 존재하는 값입니다." });
  if (err.code === "ER_NO_REFERENCED_ROW_2")
    return res.status(400).json({ error: "참조하는 데이터가 존재하지 않습니다." });
  console.error("[server error]", err);
  res.status(500).json({ error: "서버 오류" });
});

app.listen(PORT, HOST, () => {
  console.log(`통합 서버 실행: http://${HOST}:${PORT} (정적 dist + MySQL API + /upload)`);
});
