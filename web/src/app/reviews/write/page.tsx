"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import TopNav from "@/components/TopNav";

type WritableOrder = { id: string; title: string; date: string; time: string };

const ERRORS: Record<string, string> = {
  login_required: "로그인이 필요해요.",
  order_not_found: "예약 정보를 찾을 수 없어요.",
  order_not_eligible: "취소된 예약은 후기를 쓸 수 없어요.",
  already_reviewed: "이 예약은 이미 후기를 작성했어요.",
  content_invalid: "후기는 5자 이상 입력해 주세요.",
};

function WriteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = params.get("order");

  const [orders, setOrders] = useState<WritableOrder[] | null>(null);
  const [orderId, setOrderId] = useState(preset ?? "");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/reviews/writable")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { orders: WritableOrder[] } | null) => {
        const list = d?.orders ?? [];
        setOrders(list);
        // 지정된 예약이 없으면 가장 최근 예약을 기본 선택
        setOrderId((cur) => (cur && list.some((o) => o.id === cur) ? cur : (list[0]?.id ?? "")));
      })
      .catch(() => setOrders([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!orderId) {
      setError("후기를 남길 예약을 선택해 주세요.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, content }),
    });
    setSaving(false);

    if (res.status === 401) {
      router.push("/login?next=/reviews/write");
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(ERRORS[data.error ?? ""] ?? "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    router.push("/reviews");
    router.refresh();
  };

  // 후기를 쓸 수 있는 예약이 없는 경우
  if (orders !== null && orders.length === 0) {
    return (
      <div className="page-content pt-6">
        <div className="tds-card p-8 text-center">
          <p className="tds-subtitle">후기를 남길 수 있는 예약이 없어요.</p>
          <p className="tds-caption mt-2">
            모임에 참여하신 분만 후기를 남길 수 있어요.
            <br />
            (예약 1건당 후기 1개)
          </p>
          <Link href="/home" className="rv-empty-btn">
            모임 보러가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="page-content pt-6 flex flex-col gap-4">
      <div className="fld">
        <label className="fld-label">어떤 모임의 후기인가요?</label>
        {orders === null ? (
          <p className="tds-caption">불러오는 중…</p>
        ) : (
          <div className="rv-picks">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`rv-pick ${orderId === o.id ? "is-sel" : ""}`}
                onClick={() => setOrderId(o.id)}
              >
                <span className="rv-pick-title">{o.title}</span>
                <span className="rv-pick-meta">
                  <CalendarDays size={12} />
                  {o.date ? `${Number(o.date.slice(5, 7))}월 ${Number(o.date.slice(8, 10))}일` : ""} {o.time}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fld">
        <label className="fld-label" htmlFor="rv-content">
          후기 내용
        </label>
        <textarea
          id="rv-content"
          className="rv-textarea"
          placeholder="모임은 어떠셨나요? 다른 분들께 도움이 되는 후기를 남겨주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={9}
        />
        <p className="tds-caption text-right mt-1">{content.length} / 2000</p>
      </div>

      {error && <p className="text-[13px] font-semibold text-[#FF4D4F]">{error}</p>}

      <button type="submit" className="tds-btn-primary" disabled={saving}>
        {saving ? "등록 중…" : "후기 등록"}
      </button>
      <p className="tds-caption text-center">
        예약 1건당 후기 1개를 남길 수 있어요.
      </p>
    </form>
  );
}

export default function ReviewWritePage() {
  return (
    <div className="app-main pb-10">
      <TopNav title="후기 작성" back />
      <Suspense fallback={<p className="tds-caption py-10 text-center">불러오는 중…</p>}>
        <WriteForm />
      </Suspense>
    </div>
  );
}
