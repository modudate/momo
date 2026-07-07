// Supabase DB에 SQL 파일을 직접 실행하는 마이그레이션 러너.
// 사용: node scripts/run-sql.mjs supabase/some.sql
// .env.local 의 SUPABASE_DB_URL (Postgres 연결 문자열) 을 읽어 사용한다.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const projectRoot = process.cwd();

function readEnvValue(key) {
  const envPath = path.join(projectRoot, ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

const connectionString = readEnvValue("SUPABASE_DB_URL");
if (!connectionString) {
  console.error("SUPABASE_DB_URL not found in .env.local");
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(projectRoot, sqlFile), "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("OK:", sqlFile);
} catch (error) {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
