import { NextResponse } from "next/server";

// 한국 공휴일 — Nager.Date 공개 API에서 로드, 실패 시 내장 테이블 폴백
//   GET /api/holidays?year=2026 → { holidays: { "2026-01-01": "신정", ... } }

// 내장 폴백 (2026) — API 장애 시에도 최소한 올해는 표기
const FALLBACK_2026: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

type NagerHoliday = { date: string; localName: string };

export async function GET(req: Request) {
  const yearRaw = new URL(req.url).searchParams.get("year") ?? "";
  const year = Number(yearRaw);
  if (!Number.isInteger(year) || year < 2020 || year > 2035) {
    return NextResponse.json({ error: "year_invalid" }, { status: 400 });
  }

  let holidays: Record<string, string> = {};
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, {
      // 공휴일은 거의 안 변함 — 하루 캐시
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const list = (await res.json()) as NagerHoliday[];
      list.forEach((h) => {
        if (h.date && h.localName) holidays[h.date] = h.localName;
      });
    }
  } catch {
    // 폴백으로 진행
  }

  if (Object.keys(holidays).length === 0 && year === 2026) {
    holidays = FALLBACK_2026;
  }

  return NextResponse.json(
    { year, holidays },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
