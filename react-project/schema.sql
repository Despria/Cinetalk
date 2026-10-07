-- 영화 사이트 MySQL 스키마 (json-server db.json 대응)
-- 문자셋: 한글 및 이모지 저장을 위해 utf8mb4 사용

CREATE TABLE users (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  login_id  VARCHAR(50)  NOT NULL UNIQUE,
  password  VARCHAR(100) NOT NULL,              -- 실습용이므로 평문 유지
  nickname  VARCHAR(50)  NOT NULL,
  authority TINYINT(1)   NOT NULL DEFAULT 0     -- 1 = 사이트 관리자
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE movies (
  movie_id       BIGINT PRIMARY KEY,            -- TMDB id (임시값 9999991~ 은 교체 필요)
  title          VARCHAR(200) NOT NULL,
  original_title VARCHAR(200),
  release_date   DATE,
  runtime        INT,
  director       VARCHAR(200),
  `cast`         TEXT,                          -- 예약어 충돌 방지용 백틱
  overview       TEXT,
  poster_url     VARCHAR(500),                  -- 상대경로 유지
  slogan         VARCHAR(300),                  -- 추가 (db.json의 slogan)
  avg_rating     DECIMAL(3,2),                  -- 리뷰 집계값 (캐시)
  review_count   INT DEFAULT 0
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE genres (
  genre_id INT PRIMARY KEY AUTO_INCREMENT,
  name     VARCHAR(30) UNIQUE
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE movie_genres (
  movie_id BIGINT,
  genre_id INT,
  PRIMARY KEY (movie_id, genre_id),
  FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON UPDATE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(genre_id)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE reviews (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  movie_id  BIGINT NOT NULL,
  user_id   BIGINT NOT NULL,                    -- 추가 (db.json의 userId)
  author    VARCHAR(50) NOT NULL,               -- users.nickname의 복사본
  `date`    DATETIME NOT NULL,                  -- db.json의 createdAt (DATE -> DATETIME)
  is_critic TINYINT(1) NOT NULL DEFAULT 0,
  rating    DECIMAL(2,1) NOT NULL,
  content   TEXT NOT NULL,
  FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON UPDATE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  INDEX idx_movie_date (movie_id, `date`)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE likes (
  id       BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id  BIGINT NOT NULL,
  movie_id BIGINT NOT NULL,
  type     ENUM('like','favorite') NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON UPDATE CASCADE,
  UNIQUE KEY uq_user_movie_type (user_id, movie_id, type)
) DEFAULT CHARSET = utf8mb4;
