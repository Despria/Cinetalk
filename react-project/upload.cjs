// POST /upload — 기존 server.cjs의 업로드 로직을 그대로 옮긴 모듈 (동작 변경 없음)
// 외부 이미지 URL을 curl로 다운로드 → public/posters (+ dist/posters) 저장 → { path } 반환
const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = __dirname;
const PUBLIC_POSTERS = path.join(ROOT, "public", "posters");
const DIST_POSTERS = path.join(ROOT, "dist", "posters");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const TIMEOUT_S = 20; // curl --max-time (초)

function ensureDirs() {
  for (const d of [PUBLIC_POSTERS, DIST_POSTERS]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

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

function readContentType(headerPath) {
  if (!fs.existsSync(headerPath)) return "";
  const text = fs.readFileSync(headerPath, "utf8");
  const lines = text.split(/\r?\n/);
  const ct = lines.filter((l) => /^content-type:/i.test(l)).pop();
  return (ct || "").replace(/^content-type:\s*/i, "").trim();
}

async function downloadToFile(url, destPath) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("http/https URL만 허용됩니다.");
  }

  const headerPath = destPath + ".headers";
  await downloadWithCurl(url, destPath, headerPath);

  const contentType = readContentType(headerPath);
  const ext = extFromContentType(contentType);
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

const router = express.Router();

router.post("/upload", async (req, res) => {
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

module.exports = router;
