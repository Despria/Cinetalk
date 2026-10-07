// movies.jsonl + movie_reviews.jsonl -> MySQL 삽입
// 사용법:
//   DB_USER=... DB_PASSWORD=... DB_NAME=moviedb node import_jsonl.mjs movies.jsonl movie_reviews.jsonl [--dry-run]
//   --dry-run : 파일 검증과 계획 출력만 하고 DB에는 접속하지 않음
//
// 처리 규칙
//  - 영화: movie_id 기준 upsert (poster_url, slogan, 평점 캐시는 덮어쓰지 않음). 배열 director/cast는 ", "로 연결.
//    runtime이 0/빈 값, cast/director가 비면 NULL. tmdb_vote_average, chunk, collected_genre, overview_lang은 저장하지 않음.
//  - 장르: 없는 것만 추가, movie_genres 재연결
//  - 작성자: 작성자마다 users 생성 (login_id = nickname = author, 비밀번호 1234, 일반 사용자). 이미 있으면 재사용
//  - 리뷰: id는 자동 부여, date는 00:00:00 시각. is_critic이 0/1이 아니면 0으로 넣고 보고. 동일 리뷰는 중복 삽입하지 않음
//  - 마지막에 영화별 avg_rating, review_count를 reviews에서 재계산
//  - 검증 오류가 하나라도 있으면 아무것도 삽입하지 않고 종료. 삽입은 하나의 트랜잭션
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const DEFAULT_PASSWORD = '1234';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [moviesPath, reviewsPath] = args.filter((a) => !a.startsWith('--'));
if (!moviesPath || !reviewsPath) {
  console.error('사용법: node import_jsonl.mjs movies.jsonl movie_reviews.jsonl [--dry-run]');
  process.exit(1);
}

// ───────── 파일 읽기 ─────────
function readJsonl(path) {
  const text = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const rows = [], errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      rows.push({ no: i + 1, row: JSON.parse(line) });
    } catch (e) {
      errors.push(`${path} ${i + 1}번째 줄: JSON 파싱 실패 (${e.message})`);
    }
  });
  return { rows, errors };
}

const isValidDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

const joinList = (v) => {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  const s = list.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return s || null;
};

const errors = [];
const warnings = [];

// ───────── 영화 검증 ─────────
const mf = readJsonl(moviesPath);
errors.push(...mf.errors);
const movies = [];
const movieIds = new Set();
for (const { no, row: r } of mf.rows) {
  const where = `${moviesPath} ${no}번째 줄`;
  const id = Number(r.movie_id);
  if (!Number.isInteger(id) || id <= 0) { errors.push(`${where}: movie_id가 올바르지 않음 (${r.movie_id})`); continue; }
  if (movieIds.has(id)) { errors.push(`${where}: movie_id ${id} 중복`); continue; }
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title || title.length > 200) { errors.push(`${where}: title이 비었거나 200자 초과`); continue; }
  const original = typeof r.original_title === 'string' && r.original_title.trim() ? r.original_title.trim() : null;
  if (original && original.length > 200) { errors.push(`${where}: original_title 200자 초과`); continue; }
  const genres = Array.isArray(r.genres) ? [...new Set(r.genres.map((g) => String(g).trim()).filter(Boolean))] : [];
  if (genres.some((g) => g.length > 30)) { errors.push(`${where}: 30자를 넘는 장르 이름`); continue; }
  const rd = r.release_date ? String(r.release_date) : null;
  if (rd && !isValidDate(rd)) { errors.push(`${where}: release_date 형식 오류 (${rd})`); continue; }
  const director = joinList(r.director);
  if (director && director.length > 200) { errors.push(`${where}: director가 200자 초과`); continue; }
  const rt = Number(r.runtime);
  movieIds.add(id);
  movies.push({
    id, title, original, genres,
    releaseDate: rd,
    runtime: Number.isInteger(rt) && rt > 0 ? rt : null,
    director,
    cast: joinList(r.cast),
    overview: typeof r.overview === 'string' && r.overview.trim() ? r.overview : null,
  });
}

// ───────── 리뷰 검증 ─────────
const rf = readJsonl(reviewsPath);
errors.push(...rf.errors);
const reviews = [];
for (const { no, row } of rf.rows) {
  const where = `${reviewsPath} ${no}번째 줄`;
  let r = row;
  // {"text": "<JSON 문자열>"} 형태도 허용
  if (r && typeof r === 'object' && Object.keys(r).length === 1 && typeof r.text === 'string') {
    try { r = JSON.parse(r.text); } catch { errors.push(`${where}: text 안의 JSON 파싱 실패`); continue; }
  }
  const mid = Number(r.movie_id);
  if (!movieIds.has(mid)) { errors.push(`${where}: 영화 파일에 없는 movie_id (${r.movie_id})`); continue; }
  const author = typeof r.author === 'string' ? r.author.trim() : '';
  if (!author || author.length > 50) { errors.push(`${where}: author가 비었거나 50자 초과`); continue; }
  if (!isValidDate(r.date)) { errors.push(`${where}: date 형식 오류 (${r.date})`); continue; }
  const rating = Number(r.rating);
  if (r.rating === null || r.rating === '' || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    errors.push(`${where}: rating이 올바르지 않음 (${r.rating})`); continue;
  }
  if (typeof r.content !== 'string' || !r.content.trim()) { errors.push(`${where}: content가 비어 있음`); continue; }
  let isCritic = r.is_critic;
  if (isCritic !== 0 && isCritic !== 1) {
    warnings.push(`${where}: is_critic=${JSON.stringify(isCritic)} -> 0으로 저장 (author=${author}, rating=${r.rating})`);
    isCritic = 0;
  }
  reviews.push({ movieId: mid, author, date: r.date, isCritic, rating: Math.round(rating * 10) / 10, content: r.content });
}

const authors = [...new Set(reviews.map((r) => r.author))];
const genreNames = [...new Set(movies.flatMap((m) => m.genres))];
const moviesWithoutReview = movies.filter((m) => !reviews.some((r) => r.movieId === m.id)).length;

console.log('== 파일 검증 ==');
console.log(`영화 ${movies.length}편, 리뷰 ${reviews.length}건, 고유 작성자 ${authors.length}명, 장르 ${genreNames.length}종`);
console.log(`리뷰가 없는 영화: ${moviesWithoutReview}편`);
if (warnings.length) { console.log(`\n보정 ${warnings.length}건:`); warnings.slice(0, 20).forEach((w) => console.log('  ' + w)); }
if (errors.length) {
  console.log(`\n오류 ${errors.length}건 — 아무것도 삽입하지 않고 종료합니다:`);
  errors.slice(0, 20).forEach((e) => console.log('  ' + e));
  if (errors.length > 20) console.log(`  ... 외 ${errors.length - 20}건`);
  process.exit(1);
}
if (dryRun) {
  console.log('\n--dry-run: 검증만 하고 종료합니다. (DB 접속 안 함)');
  process.exit(0);
}

// ───────── DB 삽입 ─────────
const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'moviedb',
  charset: 'utf8mb4',
  decimalNumbers: true,
  dateStrings: true,
});

try {
  await conn.beginTransaction();

  // 1) 장르
  const genreId = new Map();
  let genresNew = 0;
  for (const name of genreNames) {
    const [rows] = await conn.query('SELECT genre_id FROM genres WHERE name = ?', [name]);
    if (rows.length) { genreId.set(name, rows[0].genre_id); continue; }
    const [r] = await conn.query('INSERT INTO genres (name) VALUES (?)', [name]);
    genreId.set(name, r.insertId);
    genresNew++;
  }

  // 2) 영화 upsert + 장르 연결 (신규/갱신은 삽입 전에 존재 여부를 조회해서 집계)
  const [existRows] = await conn.query('SELECT movie_id FROM movies WHERE movie_id IN (?)', [movies.map((m) => m.id)]);
  const existing = new Set(existRows.map((x) => Number(x.movie_id)));
  const moviesUpdated = movies.filter((m) => existing.has(m.id)).length;
  const moviesNew = movies.length - moviesUpdated;
  for (const m of movies) {
    await conn.query(
      `INSERT INTO movies (movie_id, title, original_title, release_date, runtime, director, \`cast\`, overview)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), original_title = VALUES(original_title),
         release_date = VALUES(release_date), runtime = VALUES(runtime), director = VALUES(director),
         \`cast\` = VALUES(\`cast\`), overview = VALUES(overview)`,
      [m.id, m.title, m.original, m.releaseDate, m.runtime, m.director, m.cast, m.overview],
    );
    await conn.query('DELETE FROM movie_genres WHERE movie_id = ?', [m.id]);
    for (const g of m.genres) {
      await conn.query('INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)', [m.id, genreId.get(g)]);
    }
  }

  // 3) 작성자 계정 (login_id가 이미 있으면 재사용. MySQL UNIQUE는 대소문자를 구분하지 않을 수 있음)
  const userId = new Map();
  const authorsById = new Map();
  let usersNew = 0, usersReused = 0;
  for (const a of authors) {
    const [rows] = await conn.query('SELECT id FROM users WHERE login_id = ?', [a]);
    let id;
    if (rows.length) { id = rows[0].id; usersReused++; }
    else {
      const [r] = await conn.query(
        'INSERT INTO users (login_id, password, nickname, authority) VALUES (?, ?, ?, 0)',
        [a, DEFAULT_PASSWORD, a],
      );
      id = r.insertId; usersNew++;
    }
    userId.set(a, id);
    if (!authorsById.has(id)) authorsById.set(id, new Set());
    authorsById.get(id).add(a);
  }
  const merged = [...authorsById.values()].filter((s) => s.size > 1);

  // 4) 리뷰 (같은 영화·작성자·날짜·내용이 이미 있으면 건너뜀)
  let reviewsNew = 0, reviewsSkipped = 0;
  for (const r of reviews) {
    const uid = userId.get(r.author);
    const [res] = await conn.query(
      `INSERT INTO reviews (movie_id, user_id, author, \`date\`, is_critic, rating, content)
       SELECT ?, ?, ?, ?, ?, ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE movie_id = ? AND user_id = ? AND \`date\` = ? AND content = ?)`,
      [r.movieId, uid, r.author, `${r.date} 00:00:00`, r.isCritic, r.rating, r.content,
       r.movieId, uid, `${r.date} 00:00:00`, r.content],
    );
    if (res.affectedRows === 1) reviewsNew++; else reviewsSkipped++;
  }

  // 5) 평점 캐시 재계산
  await conn.query(`
    UPDATE movies m SET
      m.review_count = (SELECT COUNT(*) FROM reviews r WHERE r.movie_id = m.movie_id),
      m.avg_rating   = (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.movie_id = m.movie_id)
  `);

  await conn.commit();

  console.log('\n== 삽입 결과 ==');
  console.log(`장르: 신규 ${genresNew}종`);
  console.log(`영화: 신규 ${moviesNew}편, 갱신 ${moviesUpdated}편`);
  console.log(`작성자 계정: 신규 ${usersNew}명, 기존 계정에 연결 ${usersReused}명` +
    (merged.length ? `, 대소문자 등으로 합쳐진 그룹 ${merged.length}개 (${merged.slice(0, 3).map((s) => [...s].join('/')).join(', ')})` : ''));
  console.log(`리뷰: 신규 ${reviewsNew}건, 중복으로 건너뜀 ${reviewsSkipped}건`);

  const [tot] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM movies) movies, (SELECT COUNT(*) FROM users) users,
            (SELECT COUNT(*) FROM reviews) reviews, (SELECT COUNT(*) FROM genres) genres`);
  console.log('DB 전체 건수:', tot[0]);
  console.log('주의: 새 작성자 계정의 비밀번호는 모두 ' + DEFAULT_PASSWORD + ' 입니다. 외부 공개 전에 정리하세요.');
} catch (e) {
  await conn.rollback();
  console.error('삽입 실패, 롤백됨:', e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
