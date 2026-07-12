import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/server";
import { getMeetingLite, getMeetingOptions } from "@/lib/data";
import { isBookingOpen, isMeetingVisible } from "@/lib/booking";
import { notifyAdmins } from "@/lib/notify";

type Ticket = {
  optionId?: string;
  name?: string;
  phone?: string;
  birthYear?: number;
  gender?: string; // 단일가(옵션 없음) 모임에서 참가자 성별
};

const MAX_TICKETS = 10;

// 주문 생성 — 서버가 금액을 직접 결정(위변조 방지)
//  · 다인 구매: tickets[] 티켓마다 참가자(이름·전화·출생년도) → 각 1건의 주문(같은 group_id)
//  · 구버전 호환: { meetingId, optionId } 단건도 동작 (티켓 1장)
export async function POST(req: Request) {
  let body: {
    meetingId?: string;
    optionId?: string;
    name?: string;
    phone?: string;
    tickets?: Ticket[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { meetingId } = body;
  if (!meetingId) {
    return NextResponse.json({ error: "meeting_required" }, { status: 400 });
  }

  // 티켓 목록 정규화 (구버전 단건 → 1장)
  const tickets: Ticket[] =
    Array.isArray(body.tickets) && body.tickets.length > 0
      ? body.tickets
      : [{ optionId: body.optionId, name: body.name, phone: body.phone }];
  if (tickets.length > MAX_TICKETS) {
    return NextResponse.json({ error: "too_many_tickets" }, { status: 400 });
  }

  const meeting = await getMeetingLite(meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "meeting_not_found" }, { status: 404 });
  }

  // 관리자가 손님 화면에서 내렸거나 종료 시간이 지난 모임은 신청 불가
  if (!isMeetingVisible({ date: meeting.date, time: meeting.time, endTime: meeting.end_time, hidden: meeting.hidden })) {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }

  // 신청 마감 검증
  if (!isBookingOpen(meeting.date, meeting.time)) {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }

  const admin = getAdminClient();

  // DB 미설정(데모)
  if (!admin) {
    return NextResponse.json({
      orderId: crypto.randomUUID(),
      amount: meeting.price * tickets.length,
      orderName: meeting.title,
      demo: true,
    });
  }

  const user = await getServerUser();
  const options = await getMeetingOptions(meetingId);
  const hasOptions = options.length > 0;

  // 참가자 정보 검증 (이름·전화·출생년도)
  for (const t of tickets) {
    if (!t.name?.trim() || !t.phone?.trim()) {
      return NextResponse.json({ error: "attendee_required" }, { status: 400 });
    }
    if (
      t.birthYear !== undefined &&
      (typeof t.birthYear !== "number" || t.birthYear < 1940 || t.birthYear > 2015)
    ) {
      return NextResponse.json({ error: "birth_invalid" }, { status: 400 });
    }
  }

  // 옵션 검증 + 가격 확정 (서버 기준)
  type Row = {
    amount: number;
    option_id: string | null;
    option_label: string | null;
    gender: string | null;
  };
  const rows: Row[] = [];
  const perOption = new Map<string, number>(); // 이번 요청의 옵션별 수량

  for (const t of tickets) {
    if (hasOptions) {
      if (!t.optionId) {
        return NextResponse.json({ error: "option_required" }, { status: 400 });
      }
      const option = options.find((item) => item.id === t.optionId);
      if (!option) {
        return NextResponse.json({ error: "invalid_option" }, { status: 400 });
      }
      // 성비 임시마감된 성별 차단
      if (
        (option.gender === "male" && meeting.closed_male) ||
        (option.gender === "female" && meeting.closed_female)
      ) {
        return NextResponse.json({ error: "gender_closed" }, { status: 409 });
      }
      perOption.set(option.id, (perOption.get(option.id) ?? 0) + 1);
      // 옵션 정원 1차 검증 — 0이면 옵션별 정원 없음(전체 정원만 적용). 최종 검증은 RPC 트랜잭션에서 원자적으로 재수행
      if (option.capacity > 0 && option.joined + (perOption.get(option.id) ?? 0) > option.capacity) {
        return NextResponse.json({ error: "sold_out" }, { status: 409 });
      }
      rows.push({
        amount: option.price,
        option_id: option.id,
        option_label: option.label,
        gender: option.gender,
      });
    } else {
      // 단일가: 참가자 성별(남/여) 직접 입력 → 인원 현황 남/여 카운트 반영
      const g = t.gender === "male" || t.gender === "female" ? t.gender : null;
      rows.push({ amount: meeting.price, option_id: null, option_label: null, gender: g });
    }
  }

  // 정원 검증 + 삽입 — RPC 트랜잭션(행 잠금)으로 원자 처리 → 동시 주문 오버셀 방지
  const ticketPayload = rows.map((row, i) => ({
    amount: row.amount, // 서버가 확정한 가격
    option_id: row.option_id,
    option_label: row.option_label,
    gender: row.gender,
    name: tickets[i].name!.trim(),
    phone: tickets[i].phone!.replace(/\D/g, ""), // 숫자만 저장
    birth_year: tickets[i].birthYear ?? null,
  }));

  const { data, error } = await admin.rpc("create_group_order", {
    p_meeting_id: meetingId,
    p_user_id: user?.id ?? null,
    p_tickets: ticketPayload,
  });
  if (error) {
    const code = error.message?.includes("sold_out")
      ? "sold_out"
      : error.message?.includes("invalid_option")
        ? "invalid_option"
        : "order_failed";
    return NextResponse.json({ error: code }, { status: code === "order_failed" ? 500 : 409 });
  }

  const created = (data ?? []) as { id: string; group_id: string | null }[];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  // 관리자 알림 (실패해도 주문에 영향 없음)
  const firstName = tickets[0]?.name ?? "신청자";
  void notifyAdmins(
    "🎉 새 신청 접수",
    `${meeting.title} · ${rows.length}매 · ${firstName}${rows.length > 1 ? ` 외 ${rows.length - 1}명` : ""} · ${total.toLocaleString("ko-KR")}원`,
  );

  return NextResponse.json({
    orderId: created[0]?.id,
    groupId: created[0]?.group_id,
    count: rows.length,
    amount: total, // 서버 확정 합계
    orderName: `${meeting.title}${rows.length > 1 ? ` 외 ${rows.length - 1}매` : ""}`,
  });
}
