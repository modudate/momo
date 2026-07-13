// KCP 인증서/개인키(PEM)를 .env 에 넣을 수 있는 base64 한 줄로 변환합니다.
//
// 사용법:
//   node scripts/kcp-pem-to-env.mjs KCP_AUTH_XXXXX_CERT.pem KCP_AUTH_XXXXX_PRIKEY.pem
//
// 출력된 두 줄을 .env.local 의 KCP_CERT_B64 / KCP_PRIKEY_B64 에 붙여넣으세요.
// (PEM 은 여러 줄이라 .env 에 그대로 넣으면 깨집니다)
import fs from "node:fs";

const [certPath, keyPath] = process.argv.slice(2);
if (!certPath || !keyPath) {
  console.error("사용법: node scripts/kcp-pem-to-env.mjs <CERT.pem> <PRIKEY.pem>");
  process.exit(1);
}

function toB64(file, expect) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(expect)) {
    console.error(`⚠️  ${file} 안에 "${expect}" 가 없습니다. 파일이 맞는지 확인해 주세요.`);
    process.exit(1);
  }
  return Buffer.from(text, "utf8").toString("base64");
}

const cert = toB64(certPath, "BEGIN CERTIFICATE");
const key = toB64(keyPath, "PRIVATE KEY");

console.log("\n아래 두 줄을 .env.local 에 붙여넣으세요 (기존 빈 줄을 교체):\n");
console.log(`KCP_CERT_B64=${cert}`);
console.log(`KCP_PRIKEY_B64=${key}`);
console.log(
  "\n※ Vercel 에도 같은 값을 넣어야 실서비스에서 결제가 됩니다.\n" +
    "   Vercel > 프로젝트 > Settings > Environment Variables\n",
);
