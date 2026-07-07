// 임시 조회 스크립트: node scripts/query.mjs "select ..."
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const projectRoot = process.cwd();
function readEnvValue(key) {
  const content = fs.readFileSync(path.join(projectRoot, ".env.local"), "utf8");
  const m = content.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}
const connectionString = readEnvValue("SUPABASE_DB_URL");
const sql = process.argv[2];
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
const res = await client.query(sql);
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
