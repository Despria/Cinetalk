// MySQL 연결 풀 (접속 정보는 환경변수, 없으면 기본값)
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "moviedb",
  charset: "utf8mb4",
  decimalNumbers: true, // DECIMAL(평점)을 문자열이 아닌 숫자로
  dateStrings: true, // DATE/DATETIME을 Date 객체가 아닌 문자열로
  connectionLimit: 10,
});

// 트랜잭션 헬퍼: fn(conn) 성공 시 commit, 예외 시 rollback
async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, withTx };
