import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";

// 현재 사용자가 관리자 페이지에 접근 가능한지 확인 (가드용)
export async function GET() {
  return NextResponse.json({ isAdmin: await isAdminAllowed() });
}
