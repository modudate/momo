import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { KCP, KCP_API, isKcpConfigured, isLive, kcpMissingKeys } from "@/lib/kcp/config";

// KCP 키가 제대로 들어왔는지 점검 (관리자 전용)
//  · 키 값 자체는 절대 응답에 담지 않는다. 들어왔는지 여부만.
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    configured: isKcpConfigured,
    mode: isLive ? "운영(실결제)" : "테스트",
    siteCd: KCP.siteCd || null, // 사이트코드는 결제창에도 노출되는 값이라 표시해도 무방
    endpoint: KCP_API.approve,
    missing: kcpMissingKeys(), // 아직 안 채운 항목
  });
}
