// api.cjs — json-server 와 같은 경로/응답 모양(camelCase)으로 MySQL 데이터를 제공
const express = require("express");
const { pool, withTx } = require("./db.cjs");

const router = express.Router();

// 사이트에서 새로 등록하는 영화에 부여하는 임시 id 시작값 (TMDB id 교체 전용 범위)
const TEMP_ID_BASE = 9999991;

// ───────── 공통 헬퍼 ─────────
const httpError = (status, message) =>
  Object.assign(new Error(message), { status });
const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const pad = (n) => String(n).padStart(2, "0");
// Date → "YYYY-MM-DD HH:MM:SS" (서버 로컬 시각; 기존 db.json 데이터와 동일하게 로컬 시각 기준)
const toSqlDateTime = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
// "2025-01-10 14:30:00" → "2025-01-10T14:30:00"
const toIsoLocal = (s) => (s ? String(s).replace(" ", "T") : s);

// ───────── movies ─────────
const MOVIE_SELECT = `
  SELECT m.*, GROUP_CONCAT(g.name ORDER BY g.genre_id SEPARATOR '|') AS genre_names,
    -- 평균 평점(소수 1자리). 캐시(avg_rating, 2자리)를 다시 반올림하면 2.545 -> 2.55 -> 2.6 처럼
    -- 리뷰에서 직접 계산한 값(2.5)과 달라질 수 있어, 리뷰에서 한 번만 반올림해서 내려준다.
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.movie_id = m.movie_id) AS rating_1dp
  FROM movies m
  LEFT JOIN movie_genres mg ON mg.movie_id = m.movie_id
  LEFT JOIN genres g ON g.genre_id = mg.genre_id`;
const MOVIE_TAIL = " GROUP BY m.movie_id ORDER BY m.movie_id";

function toMovie(r) {
  const genres = r.genre_names ? r.genre_names.split("|") : [];
  return {
    id: r.movie_id,
    title: r.title,
    poster: r.poster_url ?? "",
    genre: genres.join(", "), // 기존 프런트 호환: 문자열
    genres, // 신규: 배열
    director: r.director ?? "",
    actors: r.cast ?? "",
    releaseDate: r.release_date ?? "",
    runningTime: r.runtime ?? 0,
    // 리뷰 평균(소수 1자리). Movie.rating 이 number 타입이라 리뷰가 없으면 0
    rating: r.rating_1dp ?? 0,
    reviewCount: r.review_count ?? 0,
    slogan: r.slogan ?? "",
    plot: r.overview ?? "",
  };
}

async function fetchMovies(db, id) {
  const [rows] =
    id == null
      ? await db.query(MOVIE_SELECT + MOVIE_TAIL)
      : await db.query(MOVIE_SELECT + " WHERE m.movie_id = ?" + MOVIE_TAIL, [id]);
  return rows.map(toMovie);
}

// 장르 입력("SF" / "SF, 드라마" / ["SF","드라마"]) → 이름 배열
function parseGenres(v) {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : String(v).split(",");
  const names = [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
  if (names.some((n) => n.length > 30))
    throw httpError(400, "장르 이름은 30자 이하여야 합니다.");
  return names;
}

async function setGenres(conn, movieId, names) {
  await conn.query("DELETE FROM movie_genres WHERE movie_id = ?", [movieId]);
  for (const name of names) {
    let [[g]] = await conn.query("SELECT genre_id FROM genres WHERE name = ?", [name]);
    if (!g) {
      const [r] = await conn.query("INSERT INTO genres (name) VALUES (?)", [name]);
      g = { genre_id: r.insertId };
    }
    await conn.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)", [
      movieId,
      g.genre_id,
    ]);
  }
}

// 요청 body(camelCase) → movies 컬럼. rating/id 는 무시(평점은 리뷰 집계값)
function movieColumns(body) {
  const cols = {};
  const str = (v) => (v == null ? null : String(v));
  if ("title" in body) {
    const t = String(body.title ?? "").trim();
    if (!t) throw httpError(400, "title이 필요합니다.");
    cols.title = t;
  }
  if ("poster" in body) cols.poster_url = str(body.poster);
  if ("director" in body) cols.director = str(body.director);
  if ("actors" in body) cols.cast = str(body.actors);
  if ("releaseDate" in body)
    cols.release_date = body.releaseDate ? String(body.releaseDate).slice(0, 10) : null;
  if ("runningTime" in body) {
    const n = Math.trunc(Number(body.runningTime));
    cols.runtime = body.runningTime === "" || body.runningTime == null || Number.isNaN(n) ? null : n;
  }
  if ("slogan" in body) cols.slogan = str(body.slogan);
  if ("plot" in body) cols.overview = str(body.plot);
  return cols;
}

router.get("/movies", ah(async (_req, res) => {
  res.json(await fetchMovies(pool));
}));

router.get("/movies/:id", ah(async (req, res) => {
  const id = toId(req.params.id);
  const [movie] = id == null ? [] : await fetchMovies(pool, id);
  if (!movie) throw httpError(404, "Not Found");
  res.json(movie);
}));

router.post("/movies", ah(async (req, res) => {
  const body = req.body || {};
  const cols = movieColumns(body);
  if (!cols.title) throw httpError(400, "title이 필요합니다.");
  const genres = parseGenres(body.genres ?? body.genre);

  const movie = await withTx(async (conn) => {
    const [[{ maxId }]] = await conn.query(
      "SELECT MAX(movie_id) AS maxId FROM movies WHERE movie_id >= ?",
      [TEMP_ID_BASE],
    );
    const id = maxId == null ? TEMP_ID_BASE : maxId + 1;
    const keys = ["movie_id", ...Object.keys(cols)];
    await conn.query(
      `INSERT INTO movies (${keys.map((k) => `\`${k}\``).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      [id, ...Object.values(cols)],
    );
    await setGenres(conn, id, genres);
    return (await fetchMovies(conn, id))[0];
  });
  res.status(201).json(movie);
}));

router.patch("/movies/:id", ah(async (req, res) => {
  const id = toId(req.params.id);
  const body = req.body || {};
  const cols = movieColumns(body);
  const touchGenres = "genre" in body || "genres" in body;
  const genres = touchGenres ? parseGenres(body.genres ?? body.genre) : null;

  const movie = await withTx(async (conn) => {
    const [[exists]] = await conn.query("SELECT movie_id FROM movies WHERE movie_id = ?", [id]);
    if (!exists) throw httpError(404, "Not Found");
    const keys = Object.keys(cols);
    if (keys.length) {
      await conn.query(
        `UPDATE movies SET ${keys.map((k) => `\`${k}\` = ?`).join(", ")} WHERE movie_id = ?`,
        [...Object.values(cols), id],
      );
    }
    if (touchGenres) await setGenres(conn, id, genres);
    return (await fetchMovies(conn, id))[0];
  });
  res.json(movie);
}));

router.delete("/movies/:id", ah(async (req, res) => {
  const id = toId(req.params.id);
  await withTx(async (conn) => {
    await conn.query("DELETE FROM likes WHERE movie_id = ?", [id]);
    await conn.query("DELETE FROM reviews WHERE movie_id = ?", [id]);
    await conn.query("DELETE FROM movie_genres WHERE movie_id = ?", [id]);
    const [r] = await conn.query("DELETE FROM movies WHERE movie_id = ?", [id]);
    if (r.affectedRows === 0) throw httpError(404, "Not Found");
  });
  res.json({});
}));

// ───────── users ─────────
// 이 프런트는 로그인 검증을 클라이언트에서 하므로(loginId 조회 후 비교) password 도 내려준다.
const toUser = (r) => ({
  id: r.id,
  loginId: r.login_id,
  password: r.password,
  nickname: r.nickname,
  authority: !!r.authority,
});

router.get("/users", ah(async (req, res) => {
  let sql = "SELECT * FROM users";
  const params = [];
  if (req.query.loginId !== undefined) {
    sql += " WHERE login_id = ?";
    params.push(String(req.query.loginId));
  }
  const [rows] = await pool.query(sql + " ORDER BY id", params);
  res.json(rows.map(toUser)); // loginId 필터도 json-server 처럼 배열
}));

router.get("/users/:id", ah(async (req, res) => {
  const [[row]] = await pool.query("SELECT * FROM users WHERE id = ?", [toId(req.params.id)]);
  if (!row) throw httpError(404, "Not Found");
  res.json(toUser(row));
}));

router.post("/users", ah(async (req, res) => {
  const { loginId, password, nickname } = req.body || {};
  if (![loginId, password, nickname].every((v) => typeof v === "string" && v.trim()))
    throw httpError(400, "loginId, password, nickname 이 필요합니다.");
  const [r] = await pool.query(
    "INSERT INTO users (login_id, password, nickname, authority) VALUES (?, ?, ?, 0)",
    [loginId, password, nickname],
  );
  const [[row]] = await pool.query("SELECT * FROM users WHERE id = ?", [r.insertId]);
  res.status(201).json(toUser(row));
}));

router.patch("/users/:id", ah(async (req, res) => {
  const id = toId(req.params.id);
  const body = req.body || {};
  const sets = [], params = [];
  if ("authority" in body) { sets.push("authority = ?"); params.push(body.authority ? 1 : 0); }
  if ("nickname" in body) { sets.push("nickname = ?"); params.push(String(body.nickname)); }
  if ("password" in body) { sets.push("password = ?"); params.push(String(body.password)); }

  const user = await withTx(async (conn) => {
    const [[exists]] = await conn.query("SELECT id FROM users WHERE id = ?", [id]);
    if (!exists) throw httpError(404, "Not Found");
    if (sets.length) await conn.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    // reviews.author 는 nickname 의 복사본이므로 함께 갱신
    if ("nickname" in body)
      await conn.query("UPDATE reviews SET author = ? WHERE user_id = ?", [String(body.nickname), id]);
    const [[row]] = await conn.query("SELECT * FROM users WHERE id = ?", [id]);
    return toUser(row);
  });
  res.json(user);
}));

// ───────── reviews ─────────
const REVIEW_SELECT = `
  SELECT r.*, u.login_id, u.nickname, u.authority
  FROM reviews r JOIN users u ON u.id = r.user_id`;

function toReview(r, expandUser) {
  const review = {
    id: r.id,
    movieId: r.movie_id,
    userId: r.user_id,
    rating: r.rating,
    content: r.content,
    createdAt: toIsoLocal(r.date),
  };
  if (expandUser) {
    // 비밀번호는 제외하고 작성자 정보만 중첩
    review.user = {
      id: r.user_id,
      loginId: r.login_id,
      nickname: r.nickname,
      authority: !!r.authority,
    };
  }
  return review;
}

async function refreshMovieStats(conn, movieId) {
  await conn.query(
    `UPDATE movies SET
       review_count = (SELECT COUNT(*) FROM reviews WHERE movie_id = ?),
       avg_rating   = (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE movie_id = ?)
     WHERE movie_id = ?`,
    [movieId, movieId, movieId],
  );
}

router.get("/reviews", ah(async (req, res) => {
  const where = [], params = [];
  for (const [q, col] of [["movieId", "r.movie_id"], ["userId", "r.user_id"]]) {
    if (req.query[q] !== undefined) {
      const n = toId(req.query[q]);
      if (n == null) return res.json([]);
      where.push(`${col} = ?`);
      params.push(n);
    }
  }
  const sortCols = { createdAt: "r.`date`", id: "r.id", rating: "r.rating" };
  const sortCol = sortCols[req.query._sort] || "r.id";
  const order = String(req.query._order).toLowerCase() === "desc" ? "DESC" : "ASC";
  const expand = [].concat(req.query._expand || []).includes("user");

  const [rows] = await pool.query(
    `${REVIEW_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY ${sortCol} ${order}, r.id ${order}`,
    params,
  );
  res.json(rows.map((r) => toReview(r, expand)));
}));

router.post("/reviews", ah(async (req, res) => {
  const { movieId, userId, rating, content, createdAt } = req.body || {};
  const mid = toId(movieId), uid = toId(userId), score = Number(rating);
  if (mid == null || uid == null) throw httpError(400, "movieId, userId 가 필요합니다.");
  if (!Number.isFinite(score) || score < 0 || score > 5)
    throw httpError(400, "rating 은 0~5 사이여야 합니다.");
  if (typeof content !== "string" || !content.trim())
    throw httpError(400, "content 가 필요합니다.");
  const when = createdAt && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt) : new Date();

  const review = await withTx(async (conn) => {
    const [[user]] = await conn.query("SELECT nickname FROM users WHERE id = ?", [uid]);
    if (!user) throw httpError(400, "존재하지 않는 사용자입니다.");
    const [[movie]] = await conn.query("SELECT movie_id FROM movies WHERE movie_id = ?", [mid]);
    if (!movie) throw httpError(400, "존재하지 않는 영화입니다.");

    const [r] = await conn.query(
      "INSERT INTO reviews (movie_id, user_id, author, `date`, is_critic, rating, content) VALUES (?, ?, ?, ?, 0, ?, ?)",
      [mid, uid, user.nickname, toSqlDateTime(when), Math.round(score * 10) / 10, content],
    );
    await refreshMovieStats(conn, mid);
    const [[row]] = await conn.query(`${REVIEW_SELECT} WHERE r.id = ?`, [r.insertId]);
    return toReview(row, false);
  });
  res.status(201).json(review);
}));

router.delete("/reviews/:id", ah(async (req, res) => {
  const id = toId(req.params.id);
  await withTx(async (conn) => {
    const [[row]] = await conn.query("SELECT movie_id FROM reviews WHERE id = ?", [id]);
    if (!row) throw httpError(404, "Not Found");
    await conn.query("DELETE FROM reviews WHERE id = ?", [id]);
    await refreshMovieStats(conn, row.movie_id);
  });
  res.json({});
}));

// ───────── likes ─────────
const toLike = (r) => ({ id: r.id, userId: r.user_id, movieId: r.movie_id, type: r.type });

router.get("/likes", ah(async (req, res) => {
  const where = [], params = [];
  for (const [q, col] of [["userId", "user_id"], ["movieId", "movie_id"]]) {
    if (req.query[q] !== undefined) {
      const n = toId(req.query[q]);
      if (n == null) return res.json([]);
      where.push(`${col} = ?`);
      params.push(n);
    }
  }
  if (req.query.type !== undefined) { where.push("type = ?"); params.push(String(req.query.type)); }
  const [rows] = await pool.query(
    `SELECT * FROM likes${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY id`,
    params,
  );
  res.json(rows.map(toLike));
}));

router.post("/likes", ah(async (req, res) => {
  const { userId, movieId, type } = req.body || {};
  const uid = toId(userId), mid = toId(movieId);
  if (uid == null || mid == null || !["like", "favorite"].includes(type))
    throw httpError(400, "userId, movieId, type(like|favorite) 이 필요합니다.");
  const [r] = await pool.query(
    "INSERT INTO likes (user_id, movie_id, type) VALUES (?, ?, ?)",
    [uid, mid, type],
  );
  res.status(201).json({ id: r.insertId, userId: uid, movieId: mid, type });
}));

router.delete("/likes/:id", ah(async (req, res) => {
  const [r] = await pool.query("DELETE FROM likes WHERE id = ?", [toId(req.params.id)]);
  if (r.affectedRows === 0) throw httpError(404, "Not Found");
  res.json({});
}));

module.exports = router;
