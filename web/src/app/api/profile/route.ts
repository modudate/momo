import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// 내 개인정보 조회 / 수정
//  · 예약 흐름은 auth user_metadata 를, 관리자 화면은 profiles 테이블을 읽는다.
//    두 곳이 어긋나면 안 되므로 항상 함께 갱신한다.
//  · 클라이언트의 profiles 직접 쓰기는 막아뒀으므로(보안) 이 서버 API 로만 수정한다.

type Body = {
  name?: string;
  phone?: string;
  birth_year?: string | number;
  gender?: string;
};

const GENDERS = new Set(["male", "female"]);

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data } = await admin
    .from("profiles")
    .select("name,phone,birth_year,gender")
    .eq("id", user.id)
    .maybeSingle<{
      name: string | null;
      phone: string | null;
      birth_year: number | null;
      gender: string | null;
    }>();

  // profiles 행이 없으면 메타데이터로 대체 (구글 최초 로그인 직후 등)
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const profile = {
    email: user.email ?? "",
    name: data?.name ?? (meta.name as string) ?? "",
    phone: data?.phone ?? (meta.phone as string) ?? "",
    birth_year: data?.birth_year ?? (meta.birth_year ? Number(meta.birth_year) : null),
    gender: data?.gender ?? (meta.gender as string) ?? "",
  };
  const complete = Boolean(profile.name && profile.phone && profile.birth_year && profile.gender);
  return NextResponse.json({ profile, complete });
}

export async function PATCH(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").replace(/\D/g, "");
  const year = Number(body.birth_year);
  const gender = String(body.gender ?? "");

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (phone.length < 9 || phone.length > 11) {
    return NextResponse.json({ error: "phone_invalid" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1940 || year > 2015) {
    return NextResponse.json({ error: "birth_invalid" }, { status: 400 });
  }
  if (!GENDERS.has(gender)) {
    return NextResponse.json({ error: "gender_invalid" }, { status: 400 });
  }

  // 1) profiles 테이블 (관리자 화면·명단이 읽는 곳). 행이 없을 수도 있으니 upsert.
  const { error: upErr } = await admin
    .from("profiles")
    .upsert({ id: user.id, name, phone, birth_year: year, gender }, { onConflict: "id" });
  if (upErr) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  // 2) auth user_metadata (예약 흐름이 읽는 곳) — birth_year 는 기존 관례대로 문자열 저장
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      name,
      phone,
      birth_year: String(year),
      gender,
    },
  });

  return NextResponse.json({ ok: true });
}
