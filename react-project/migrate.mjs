// db.json -> MySQL 마이그레이션
// 사용법:
//   npm install
//   DB_HOST=localhost DB_USER=root DB_PASSWORD=xxx DB_NAME=moviedb node migrate.mjs [db.json 경로] [--reset]
//   --reset : 기존 테이블을 모두 DROP 후 schema.sql로 재생성 (기존 데이터 삭제됨)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const reset = args.includes('--reset');
const jsonPath = args.find((a) => !a.startsWith('--')) ?? path.join(__dirname, 'db.json');

// ─────────────────────────────────────────────
// 임시 TMDB id 매핑 (로컬 id -> movie_id)
// 실제 TMDB id를 찾으면 이 객체만 수정하거나, 이전 후 아래 SQL로 교체:
//   UPDATE movies SET movie_id = <실제ID> WHERE movie_id = 9999991;
// (FK에 ON UPDATE CASCADE가 걸려 있어 reviews/likes/movie_genres도 함께 변경됨)
// ─────────────────────────────────────────────
const TMDB_ID_MAP = {
  1: 9999991, // 인터스텔라
  2: 9999992, // 듄
  3: 9999993, // 마션
  4: 9999994, // 덩케르크
  5: 9999995, // 쇼생크 탈출
  6: 9999996, // 행복을 찾아서
  7: 9999997, // 오리엔트 특급 살인
};
const toMovieId = (localId) => {
  const id = TMDB_ID_MAP[localId];
  if (id === undefined) throw new Error(`TMDB_ID_MAP에 없는 movie id: ${localId}`);
  return id;
};

// "2025-01-10T14:30:00" -> "2025-01-10 14:30:00"
const toDateTime = (s) => s.replace('T', ' ').slice(0, 19);

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { movies, users, reviews, likes } = data;

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'moviedb',
  charset: 'utf8mb4',
  multipleStatements: true,
});

try {
  if (reset) {
    await conn.query(`
      SET FOREIGN_KEY_CHECKS = 0;
      DROP TABLE IF EXISTS likes, reviews, movie_genres, genres, movies, users;
      SET FOREIGN_KEY_CHECKS = 1;
    `);
    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('테이블 재생성 완료');
  }

  await conn.beginTransaction();

  // 1) users
  for (const u of users) {
    await conn.execute(
      'INSERT INTO users (id, login_id, password, nickname, authority) VALUES (?,?,?,?,?)',
      [u.id, u.loginId, u.password, u.nickname, u.authority ? 1 : 0],
    );
  }
  const nicknameById = new Map(users.map((u) => [u.id, u.nickname]));

  // 2) genres (고유값) + movies + movie_genres
  const genreIdByName = new Map();
  for (const name of [...new Set(movies.map((m) => m.genre))]) {
    const [r] = await conn.execute('INSERT INTO genres (name) VALUES (?)', [name]);
    genreIdByName.set(name, r.insertId);
  }

  for (const m of movies) {
    const movieId = toMovieId(m.id);
    // avg_rating, review_count는 reviews 적재 후 집계로 채움 (db.json의 rating은 무시)
    await conn.execute(
      `INSERT INTO movies
         (movie_id, title, original_title, release_date, runtime, director, \`cast\`,
          overview, poster_url, slogan, avg_rating, review_count)
       VALUES (?,?,?,?,?,?,?,?,?,?,NULL,0)`,
      [movieId, m.title, null, m.releaseDate, m.runningTime, m.director, m.actors,
       m.plot, m.poster, m.slogan],
    );
    await conn.execute('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?,?)',
      [movieId, genreIdByName.get(m.genre)]);
  }

  // 3) reviews (author = users.nickname 복사, is_critic = 0)
  for (const r of reviews) {
    const author = nicknameById.get(r.userId);
    if (author === undefined) throw new Error(`review ${r.id}: 존재하지 않는 userId ${r.userId}`);
    await conn.execute(
      `INSERT INTO reviews (id, movie_id, user_id, author, \`date\`, is_critic, rating, content)
       VALUES (?,?,?,?,?,0,?,?)`,
      [r.id, toMovieId(r.movieId), r.userId, author, toDateTime(r.createdAt), r.rating, r.content],
    );
  }

  // 4) likes
  for (const l of likes) {
    await conn.execute(
      'INSERT INTO likes (id, user_id, movie_id, type) VALUES (?,?,?,?)',
      [l.id, l.userId, toMovieId(l.movieId), l.type],
    );
  }

  // 5) 리뷰 집계 (리뷰 없는 영화는 avg_rating NULL, review_count 0)
  await conn.query(`
    UPDATE movies m SET
      m.review_count = (SELECT COUNT(*) FROM reviews r WHERE r.movie_id = m.movie_id),
      m.avg_rating   = (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.movie_id = m.movie_id)
  `);

  await conn.commit();

  // 검증 출력
  const [counts] = await conn.query(`
    SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM movies) movies,
           (SELECT COUNT(*) FROM genres) genres, (SELECT COUNT(*) FROM movie_genres) movie_genres,
           (SELECT COUNT(*) FROM reviews) reviews, (SELECT COUNT(*) FROM likes) likes`);
  console.log('적재 건수:', counts[0]);
  const [agg] = await conn.query(
    'SELECT movie_id, title, avg_rating, review_count FROM movies ORDER BY movie_id');
  console.table(agg);
  console.log('주의: movie_id 9999991~9999997 은 임시값입니다. 실제 TMDB id로 교체하세요.');
} catch (e) {
  await conn.rollback();
  console.error('마이그레이션 실패, 롤백됨:', e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
