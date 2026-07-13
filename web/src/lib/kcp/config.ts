// KCP 결제 설정 — 키가 채워지기 전에는 isKcpConfigured=false 로 동작(결제 미연동 상태 유지)
//  · 인증서/개인키는 .env 에 base64 한 줄로 넣는다 (PEM 은 여러 줄이라 그대로 못 넣음)
//  · 서버 전용. 절대 클라이언트로 내보내지 않는다.

const MODE = (process.env.KCP_MODE ?? "test").toLowerCase();

export const isLive = MODE === "live";

// KCP 게이트웨이 (문서 기준)
export const KCP_API = {
  // 결제 승인
  approve: isLive
    ? "https://spl.kcp.co.kr/gw/enc/v1/payment"
    : "https://stg-spl.kcp.co.kr/gw/enc/v1/payment",
  // 거래 취소 (전체 STSC / 부분 STPC)
  cancel: isLive
    ? "https://spl.kcp.co.kr/gw/mod/v1/cancel"
    : "https://stg-spl.kcp.co.kr/gw/mod/v1/cancel",
  // 거래등록 — 모바일 결제창은 이걸 먼저 호출해야 한다 (PC는 불필요)
  register: isLive
    ? "https://smpay.kcp.co.kr/trade/register.do"
    : "https://testsmpay.kcp.co.kr/trade/register.do",
  // 거래조회 — 승인 결과 재확인 (결제됐는데 저장 실패한 경우 복구용)
  inquiry: isLive
    ? "https://spl.kcp.co.kr/std/inquery"
    : "https://stg-spl.kcp.co.kr/std/inquery",
} as const;

function fromB64(value: string | undefined): string {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export const KCP = {
  mode: MODE,
  siteCd: process.env.KCP_SITE_CD ?? "",
  siteKey: process.env.KCP_SITE_KEY ?? "",
  /** 서비스 인증서 (PEM 원문) */
  cert: fromB64(process.env.KCP_CERT_B64),
  /** 개인키 (PEM 원문) */
  privateKey: fromB64(process.env.KCP_PRIKEY_B64),
  privateKeyPassword: process.env.KCP_PRIKEY_PASSWORD ?? "",
} as const;

// 결제를 실제로 붙일 수 있는 상태인지 (키가 다 들어왔는지)
export const isKcpConfigured = Boolean(
  KCP.siteCd &&
    KCP.siteKey &&
    KCP.cert.includes("BEGIN CERTIFICATE") &&
    KCP.privateKey.includes("PRIVATE KEY"),
);

// 어떤 값이 비었는지 (관리자 점검용 — 값 자체는 노출하지 않음)
export function kcpMissingKeys(): string[] {
  const missing: string[] = [];
  if (!KCP.siteCd) missing.push("KCP_SITE_CD");
  if (!KCP.siteKey) missing.push("KCP_SITE_KEY");
  if (!KCP.cert.includes("BEGIN CERTIFICATE")) missing.push("KCP_CERT_B64");
  if (!KCP.privateKey.includes("PRIVATE KEY")) missing.push("KCP_PRIKEY_B64");
  return missing;
}
