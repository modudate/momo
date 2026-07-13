import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { approveGroupOrder } from "@/lib/kcp/approve-order";
import { ordrNoToGroupId } from "@/lib/kcp/order-no";
import { payLog, maskFields } from "@/lib/kcp/log";

// 모바일 결제창 인증 결과 수신 (Ret_URL)
//  · KCP 가 이 주소로 폼(application/x-www-form-urlencoded) POST 를 보낸다.
//  · 브라우저가 KCP 결제창에서 이 주소로 이동하는 형태 → 응답은 리다이렉트여야 한다.
//  · 세션 쿠키가 없을 수 있으므로 사용자 검증 대신 KCP 가 서명한 enc_data 로만 승인한다.
//    (가짜 요청은 KCP 승인 단계에서 거부된다)

export const dynamic = "force-dynamic";

function redirect(origin: string, path: string) {
  // 303: POST → GET 으로 바꿔서 이동 (새로고침 시 재전송 방지)
  return NextResponse.redirect(`${origin}${path}`, 303);
}

// 결제창의 pay_method(CARD 등) → 승인 API 의 pay_type(PACA 등)
//  이미 P 로 시작하는 4자리면 승인용 코드이므로 그대로 쓴다.
function toPayType(payMethod: string): string {
  const m = payMethod.trim().toUpperCase();
  if (/^P[A-Z]{3}$/.test(m)) return m;
  const MAP: Record<string, string> = {
    CARD: "PACA", // 신용카드
    BANK: "PABK", // 계좌이체
    VCNT: "PAVC", // 가상계좌
    MOBX: "PAMC", // 휴대폰
  };
  return MAP[m] ?? "PACA";
}

export async function POST(req: Request) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin ?? "https://www.joinmomo.co.kr";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirect(origin, "/home?pay=error");
  }

  const get = (k: string) => String(form.get(k) ?? "");
  const ordrNo = get("ordr_idxx");
  const resCd = get("res_cd");
  const encData = get("enc_data");
  const encInfo = get("enc_info");

  // KCP 가 실제로 보낸 값 전부 기록 (실패 원인 진단용)
  const all: Record<string, unknown> = {};
  form.forEach((v, k) => {
    all[k] = typeof v === "string" ? v : "(file)";
  });
  await payLog("ret_url", ordrNo || null, maskFields(all));

  const groupId = ordrNoToGroupId(ordrNo);
  const admin = getAdminClient();

  // 어느 모임으로 돌려보낼지 찾아둔다
  let meetingId = "";
  if (admin && groupId) {
    const { data } = await admin
      .from("orders")
      .select("meeting_id")
      .eq("group_id", groupId)
      .limit(1)
      .maybeSingle<{ meeting_id: string }>();
    meetingId = data?.meeting_id ?? "";
  }
  const backTo = meetingId ? `/meeting/${meetingId}` : "/home";

  // 사용자가 취소했거나 인증 실패 → 잡아둔 자리 반납
  if (resCd !== "0000" || !encData || !encInfo) {
    if (admin && groupId) {
      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("group_id", groupId)
        .eq("status", "pending");
    }
    const reason = resCd && resCd !== "0000" ? "fail" : "cancel";
    return redirect(origin, `${backTo}?pay=${reason}`);
  }

  const outcome = await approveGroupOrder({
    ordrNo,
    encData,
    encInfo,
    payType: toPayType(get("pay_method")),
    // 거래코드는 결제창이 내려준 값을 그대로 (임의 지정 금지)
    tranCd: get("tran_cd") || undefined,
  });

  if (!outcome.ok) {
    const to = outcome.meetingId ? `/meeting/${outcome.meetingId}` : backTo;
    return redirect(origin, `${to}?pay=fail&code=${encodeURIComponent(outcome.error)}`);
  }

  return redirect(origin, `/meeting/${outcome.meetingId}?pay=done`);
}

// KCP 설정 오류로 GET 이 들어오는 경우 대비
export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  return redirect(origin, "/home");
}
