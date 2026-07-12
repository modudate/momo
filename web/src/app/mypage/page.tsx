"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Ticket, CalendarDays, Shield, ChevronRight, PenLine } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import { getBrowserClient } from "@/lib/supabase/browser";
import { formatKRW } from "@/data/moim-data";

type OrderRow = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "failed";
  created_at: string;
  meetings: { title: string; date: string; time: string } | null;
};

// 후기 작성 가능한 예약 (예약 1건당 1개, 이미 쓴 건 제외)
type WritableOrder = { id: string };

const statusLabel: Record<OrderRow["status"], string> = {
  paid: "결제완료",
  pending: "결제대기",
  cancelled: "취소됨",
  failed: "실패",
};

export default function MyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [writable, setWritable] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser) {
        router.replace("/login");
        return;
      }
      setEmail(authUser.email ?? null);
      setName((authUser.user_metadata?.name as string) ?? "");
      setReady(true);

      const { data: orderRows } = await supabase
        .from("orders")
        .select("id,amount,status,created_at,meetings(title,date,time)")
        .order("created_at", { ascending: false });
      setOrders((orderRows as OrderRow[] | null) ?? []);

      // 후기 작성 가능한 예약 (이미 쓴 건 제외)
      fetch("/api/reviews/writable")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { orders: WritableOrder[] } | null) => {
          setWritable(new Set((d?.orders ?? []).map((o) => o.id)));
        })
        .catch(() => {});

      // 관리자 여부 확인 (관리자면 관리자 페이지 링크 노출)
      const adminResponse = await fetch("/api/admin/session");
      const adminData = (await adminResponse.json().catch(() => ({ isAdmin: false }))) as {
        isAdmin: boolean;
      };
      setIsAdmin(adminData.isAdmin);
    })();
  }, [router]);

  const handleLogout = async () => {
    const supabase = getBrowserClient();
    await supabase?.auth.signOut();
    router.push("/home");
    router.refresh();
  };

  if (!ready) {
    return (
      <div className="app-main">
        <TopNav title="마이페이지" back />
        <div className="page-content py-20 text-center">
          <p className="tds-caption">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main pb-10">
      <TopNav title="마이페이지" back />

      {/* 프로필 */}
      <section className="page-content pt-5">
        <div className="tds-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center text-[22px] font-extrabold text-[var(--accent-primary)]">
            {(name || email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-[17px] font-bold">{name || "회원"}님</p>
            <p className="tds-caption mt-0.5">{email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-tertiary)]"
          >
            <LogOut size={15} /> 로그아웃
          </button>
        </div>
      </section>

      {/* 관리자 전용 링크 */}
      {isAdmin && (
        <section className="page-content pt-6">
          <Link
            href="/admin"
            className="tds-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary-light)] text-[var(--accent-primary)]">
              <Shield size={20} />
            </span>
            <span className="flex-1 text-[15px] font-bold">관리자 페이지</span>
            <ChevronRight size={20} className="text-[var(--text-muted)]" />
          </Link>
        </section>
      )}

      {/* 모임 알림 */}
      <section className="page-content pt-6">
        <div className="tds-card p-4">
          <p className="text-[15px] font-bold mb-1">모임 알림</p>
          <p className="tds-caption mb-3">
            마감 임박·신청 확정 소식을 푸시 알림으로 받아보세요.
          </p>
          <PushSubscribeButton />
        </div>
      </section>

      {/* 내 신청내역 */}
      <section className="page-content pt-6">
        <h3 className="tds-title-md mb-3 flex items-center gap-1.5">
          <Ticket size={18} /> 내 신청내역
        </h3>

        {orders === null ? (
          <p className="tds-caption py-6 text-center">불러오는 중…</p>
        ) : orders.length === 0 ? (
          <div className="tds-card p-8 text-center">
            <p className="tds-subtitle">아직 신청한 모임이 없어요.</p>
            <Link
              href="/home"
              className="inline-block mt-4 px-5 h-11 leading-[44px] rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[14px]"
            >
              모임 보러가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <div key={order.id} className="tds-card p-4">
                <div className="flex items-center justify-between">
                  <span className="tds-badge tds-badge-accent">
                    {statusLabel[order.status]}
                  </span>
                  <span className="text-[15px] font-extrabold">
                    {formatKRW(order.amount)}
                  </span>
                </div>
                <p className="text-[15px] font-bold mt-2">
                  {order.meetings?.title ?? "모임"}
                </p>
                {order.meetings && (
                  <p className="tds-caption mt-1 inline-flex items-center gap-1">
                    <CalendarDays size={13} />
                    {Number(order.meetings.date.slice(5, 7))}월{" "}
                    {Number(order.meetings.date.slice(8, 10))}일 {order.meetings.time}
                  </p>
                )}
                {/* 후기 작성 — 예약 1건당 1개, 이미 쓴 예약에는 안 보임 */}
                {writable.has(order.id) && (
                  <Link href={`/reviews/write?order=${order.id}`} className="mp-review-btn">
                    <PenLine size={14} /> 후기 작성
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
