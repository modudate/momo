import { getAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush, type PushSubscriptionRecord } from "@/lib/push";

// 관리자(ADMIN_EMAILS)에게 웹푸시 알림 — 신청/취소 발생 시 호출
// 실패해도 주문 흐름을 막지 않도록 호출측에서 catch 없이 fire-and-forget 사용 가능
export async function notifyAdmins(title: string, body: string, url = "/admin") {
  try {
    if (!isPushConfigured) return;
    const admin = getAdminClient();
    if (!admin) return;

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.length === 0) return;

    // 관리자 이메일 → user id (RPC: auth.users + profiles)
    const { data: members } = await admin.rpc("admin_member_list");
    const adminIds = ((members ?? []) as { id: string; email: string | null }[])
      .filter((m) => m.email && adminEmails.includes(m.email.toLowerCase()))
      .map((m) => m.id);
    if (adminIds.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .in("user_id", adminIds)
      .returns<(PushSubscriptionRecord & { id: string })[]>();
    if (!subs || subs.length === 0) return;

    const results = await Promise.allSettled(
      subs.map((s) => sendPush(s, { title, body, url })),
    );
    // 만료된 구독 정리
    const expiredIds = subs
      .filter((_, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value.expired;
      })
      .map((s) => s.id);
    if (expiredIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    }
  } catch {
    // 알림 실패는 무시 (주문 흐름에 영향 X)
  }
}
