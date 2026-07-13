import ExcelJS from "exceljs";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getBlacklistSet, normPhone } from "@/lib/blacklist";
import { holdsSeat, SEAT_STATUSES } from "@/lib/orders";

// 참석 명단 엑셀 다운로드 (명단.xlsx 양식)
//   GET /api/admin/reservations/attendees/xlsx?meetingId=xxx
//
// 양식: 남/여 두 블록을 나란히 배치
//   왼쪽(남) A~H, 빈 열 I, 오른쪽(여) J~Q
//   1행: 제목 (병합) — "2026.7.19(일)_선릉와인남"
//   2행: NO. / 블락여부 / 참석여부 / 회원명 / 이름 / 전화번호 / 출생년도 / 비고
//   3행~: 데이터 (번호는 정원만큼 미리 채움)

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

type Row = {
  gender: string | null;
  attended: boolean;
  member_name: string | null;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  option_label: string | null;
  status: string;
  blacklisted: boolean;
};

const HEADERS = ["NO.", "블락여부", "참석여부", "회원명", "이름", "전화번호", "출생년도", "비고"];

export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return new Response(JSON.stringify({ error: "not_configured" }), { status: 503 });
  }

  const meetingId = new URL(req.url).searchParams.get("meetingId");
  if (!meetingId) {
    return new Response(JSON.stringify({ error: "meeting_required" }), { status: 400 });
  }

  const { data: meeting } = await admin
    .from("meetings")
    .select("id,region_slug,date,time,title,capacity,regions(name)")
    .eq("id", meetingId)
    .single<{
      id: string;
      region_slug: string;
      date: string;
      time: string;
      title: string;
      capacity: number;
      regions: { name: string } | null;
    }>();
  if (!meeting) {
    return new Response(JSON.stringify({ error: "meeting_not_found" }), { status: 404 });
  }

  // 자리를 잡고 있는 신청만 (만료된 미결제·실패 제외)
  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      "id,status,attended,gender,option_label,buyer_name,buyer_phone,birth_year,expires_at,user_id,created_at",
    )
    .eq("meeting_id", meetingId)
    .in("status", SEAT_STATUSES)
    .order("created_at", { ascending: true })
    .returns<
      {
        id: string;
        status: string;
        attended: boolean;
        gender: string | null;
        option_label: string | null;
        buyer_name: string | null;
        buyer_phone: string | null;
        birth_year: number | null;
        expires_at: string | null;
        user_id: string | null;
      }[]
    >();
  const orders = (ordersRaw ?? []).filter((o) => holdsSeat(o));

  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, { name: string | null; phone: string | null; birth_year: number | null; gender: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,name,phone,birth_year,gender")
      .in("id", userIds)
      .returns<{ id: string; name: string | null; phone: string | null; birth_year: number | null; gender: string | null }[]>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
  }

  const blacklist = await getBlacklistSet();

  const rows: Row[] = orders.map((o) => {
    const p = o.user_id ? profileMap.get(o.user_id) : undefined;
    const phone = p?.phone ?? o.buyer_phone ?? null;
    return {
      gender: o.gender ?? p?.gender ?? null,
      attended: o.attended,
      member_name: p?.name ?? null,
      name: o.buyer_name ?? p?.name ?? null,
      phone,
      birth_year: o.birth_year ?? p?.birth_year ?? null,
      option_label: o.option_label,
      status: o.status,
      blacklisted: phone ? blacklist.has(normPhone(phone)) : false,
    };
  });

  const males = rows.filter((r) => r.gender === "male");
  const females = rows.filter((r) => r.gender === "female");

  // 제목: 2026.7.19(일)_선릉와인남
  const [y, m, d] = meeting.date.split("-").map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  const regionName = meeting.regions?.name ?? meeting.region_slug;
  const base = `${y}.${m}.${d}(${dow})_${regionName}${meeting.title}`;

  // ---------- 엑셀 만들기 ----------
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("명단");

  // 열 너비 (남 A~H / 빈칸 I / 여 J~Q)
  const widths = [6, 10, 10, 12, 12, 16, 10, 16];
  [...widths, 3, ...widths].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const border = {
    top: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
    left: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
    right: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
  };

  // 1행 — 제목 (병합)
  ws.mergeCells(1, 1, 1, 8); // A1:H1
  ws.mergeCells(1, 10, 1, 17); // J1:Q1
  const titleMale = ws.getCell(1, 1);
  const titleFemale = ws.getCell(1, 10);
  titleMale.value = `${base}남`;
  titleFemale.value = `${base}여`;
  [
    [titleMale, "FF2F6FD0"],
    [titleFemale, "FFD03A47"],
  ].forEach(([cell, color]) => {
    const c = cell as ExcelJS.Cell;
    c.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color as string } };
  });
  ws.getRow(1).height = 24;

  // 2행 — 헤더
  HEADERS.forEach((h, i) => {
    for (const offset of [0, 9]) {
      const cell = ws.getCell(2, i + 1 + offset);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F3F5" } };
      cell.border = border;
    }
  });
  ws.getRow(2).height = 20;

  // 3행~ — 데이터 (정원만큼 번호를 미리 채움)
  const perGender = Math.max(males.length, females.length, Math.ceil(meeting.capacity / 2));
  for (let i = 0; i < perGender; i++) {
    const rowNo = 3 + i;

    ([
      [0, males[i]],
      [9, females[i]],
    ] as [number, Row | undefined][]).forEach(([offset, person]) => {
      const cells = [
        i + 1, // NO.
        person ? (person.blacklisted ? "블랙" : "") : "",
        person ? (person.attended ? "O" : "") : "",
        person?.member_name ?? "",
        person?.name ?? "",
        person?.phone ?? "",
        person?.birth_year ?? "",
        person
          ? [person.option_label, person.status === "paid" ? "결제완료" : "결제대기"]
              .filter(Boolean)
              .join(" / ")
          : "",
      ];

      cells.forEach((v, ci) => {
        const cell = ws.getCell(rowNo, ci + 1 + offset);
        cell.value = v === "" ? null : (v as string | number);
        cell.font = { size: 10 };
        cell.alignment = {
          horizontal: ci === 0 || ci === 1 || ci === 2 || ci === 6 ? "center" : "left",
          vertical: "middle",
        };
        cell.border = border;
        // 전화번호는 앞자리 0이 사라지지 않게 텍스트로
        if (ci === 5 && v) cell.numFmt = "@";
        if (person?.blacklisted && ci === 1) {
          cell.font = { size: 10, bold: true, color: { argb: "FFD03A47" } };
        }
      });
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${base}_명단.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // 한글 파일명 — RFC 5987
      "Content-Disposition": `attachment; filename="attendees.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
