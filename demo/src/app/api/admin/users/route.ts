import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getBlacklistSet, normPhone } from "@/lib/blacklist";

type DbMember = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: string | null;
  created_at: string;
};

// 회원 목록 (관리자) — auth.users + profiles + 주문 통계 + 블랙 여부
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // 1) 회원 목록 (RPC: auth.users + profiles)
  const { data: members, error } = await admin.rpc("admin_member_list");
  if (error) {
    return NextResponse.json({ error: "list_failed", detail: error.message }, { status: 500 });
  }
  const users = (members ?? []) as DbMember[];
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return NextResponse.json({ users: [] });

  // 2) 주문 통계 (신청/참석/취소)
  const { data: orders } = await admin
    .from("orders")
    .select("user_id,status,attended")
    .in("user_id", ids)
    .returns<{ user_id: string | null; status: string; attended: boolean }[]>();
  const stat = new Map<string, { applied: number; attended: number; cancelled: number }>();
  (orders ?? []).forEach((o) => {
    if (!o.user_id) return;
    const s = stat.get(o.user_id) ?? { applied: 0, attended: 0, cancelled: 0 };
    if (o.status === "cancelled") s.cancelled += 1;
    else {
      s.applied += 1;
      if (o.attended) s.attended += 1;
    }
    stat.set(o.user_id, s);
  });

  // 4) 블랙리스트 대조
  const black = await getBlacklistSet();

  const rows = users.map((u) => {
    const phone = u.phone ?? null;
    const s = stat.get(u.id) ?? { applied: 0, attended: 0, cancelled: 0 };
    return {
      id: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      phone,
      birth_year: u.birth_year ?? null,
      gender: u.gender ?? null,
      created_at: u.created_at,
      applied: s.applied,
      attended: s.attended,
      cancelled: s.cancelled,
      blacklisted: phone ? black.has(normPhone(phone)) : false,
    };
  });

  return NextResponse.json({ users: rows });
}
