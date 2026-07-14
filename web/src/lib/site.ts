// 우리 사이트의 정식 주소 (한 곳에서만 정한다)
//
// ⚠️ 요청 헤더(Origin / Host)로 이 값을 만들면 안 된다.
//    헤더는 공격자가 마음대로 바꿔 보낼 수 있고, 그 값이 KCP 의 Ret_URL(결제 인증 결과를
//    돌려받는 주소)로 쓰이면 결제 결과를 남의 서버로 보내게 된다.
//
// 도메인은 비밀이 아니므로 기본값을 코드에 둬도 된다.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinmomo.co.kr"
).replace(/\/+$/, "");
