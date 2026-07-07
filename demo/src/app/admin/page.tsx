"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  CalendarRange,
  Ticket,
  Bell,
  Image as ImageIcon,
  Plus,
  Copy,
  Pencil,
  Trash2,
  CalendarClock,
  X,
  Users,
  ArrowUpRight,
  Send,
} from "lucide-react";
import { regions, formatKRW } from "@/data/moim-data";
import { CATEGORIES, categoryLabel, AGE_GROUP_PRESETS } from "@/data/taxonomy";
import { useBackdropClose } from "@/lib/useBackdropClose";
import ReservationsPanel from "./ReservationsPanel";
import SalesPanel from "./SalesPanel";
import UsersPanel from "./UsersPanel";
import HomeBannerPanel from "./HomeBannerPanel";

type AdminTab =
  | "dashboard"
  | "reservations"
  | "templates"
  | "sales"
  | "users"
  | "banner"
  | "push";

type Template = {
  id: string;
  category: string;
  region_slug: string;
  age_group: string;
  title: string;
  description: string | null;
  place: string | null;
  price: number;
  capacity: number;
  image: string | null;
  home_section: string | null;
  home_badge: string | null;
};

type Order = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "failed";
  buyer_name: string | null;
  buyer_phone: string | null;
  created_at: string;
  option_label: string | null;
  gender: string | null;
  meetings: { title: string; date: string } | null;
};

function genderLabel(gender: string | null) {
  return gender === "male" ? "남" : gender === "female" ? "여" : gender === "any" ? "공용" : "-";
}

type Stats = { templates: number; upcomingSessions: number; orders: number; subscribers: number };

const firstRegion = (regions[0]?.slug ?? "gangnam") as string;

const emptyTemplate = {
  category: "wine",
  regionSlug: firstRegion,
  ageGroup: "전연령",
  title: "",
  price: 30000,
  capacity: 16,
  place: "",
  description: "",
  image: "",
  homeSection: "",
  homeBadge: "",
};

const NAV: { key: AdminTab; label: string; icon: typeof Package }[] = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "reservations", label: "예약관리", icon: CalendarRange },
  { key: "templates", label: "예약 상품", icon: Package },
  { key: "sales", label: "판매", icon: Ticket },
  { key: "users", label: "유저 관리", icon: Users },
  { key: "banner", label: "홈 배너", icon: ImageIcon },
  { key: "push", label: "푸시 알림", icon: Bell },
];

const TAB_META: Record<AdminTab, { title: string; sub: string }> = {
  dashboard: { title: "대시보드", sub: "한눈에 보는 현황" },
  reservations: { title: "예약 일정 관리", sub: "지점별·모임별 예약 현황 한눈에 · 일정 클릭 시 성별 명단" },
  templates: { title: "예약 상품", sub: "예약 상품(모임 프로그램) 관리 · 복제 · 일정 생성" },
  sales: { title: "판매", sub: "매출 분석 + 주문 검색·필터·상세·CSV 내보내기" },
  users: { title: "유저 관리", sub: "회원 목록 + 블랙리스트 관리" },
  banner: { title: "홈 배너", sub: "메인 상단 슬라이드 이미지·문구 관리" },
  push: { title: "푸시 알림", sub: "전체 구독자에게 발송" },
};

const orderStatusLabel: Record<Order["status"], string> = {
  paid: "결제완료",
  pending: "결제대기",
  cancelled: "취소됨",
  failed: "실패",
};

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking");
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [toast, setToast] = useState("");

  const [stats, setStats] = useState<Stats>({ templates: 0, upcomingSessions: 0, orders: 0, subscribers: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [templateModal, setTemplateModal] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  });
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  }, []);
  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/admin/templates");
    if (res.ok) setTemplates((await res.json()).templates);
  }, []);
  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/admin/orders");
    if (res.ok) setOrders((await res.json()).orders);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/session");
      const data = (await res.json().catch(() => ({ isAdmin: false }))) as { isAdmin: boolean };
      if (!data.isAdmin) {
        setAuthState("denied");
        return;
      }
      setAuthState("ok");
      loadStats();
      loadTemplates();
      loadOrders();
    })();
  }, [loadStats, loadTemplates, loadOrders]);

  // ---- 상품(템플릿) ----
  const openTemplateCreate = () => {
    setTemplateForm({ ...emptyTemplate });
    setTemplateModal({ open: true, editId: null });
  };
  const openTemplateEdit = (t: Template) => {
    setTemplateForm({
      category: t.category,
      regionSlug: t.region_slug,
      ageGroup: t.age_group,
      title: t.title,
      price: t.price,
      capacity: t.capacity,
      place: t.place ?? "",
      description: t.description ?? "",
      image: t.image ?? "",
      homeSection: t.home_section ?? "",
      homeBadge: t.home_badge ?? "",
    });
    setTemplateModal({ open: true, editId: t.id });
  };
  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEdit = Boolean(templateModal.editId);
    const res = await fetch("/api/admin/templates", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { ...templateForm, id: templateModal.editId } : templateForm),
    });
    if (res.ok) {
      setTemplateModal({ open: false, editId: null });
      flash(isEdit ? "예약 상품을 수정했어요." : "예약 상품을 만들었어요.");
      loadTemplates();
      loadStats();
    } else {
      flash("저장에 실패했어요.");
    }
  };
  const duplicateTemplate = async (id: string) => {
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateFrom: id }),
    });
    if (res.ok) {
      flash("복제했어요. 지역·나이대를 바꿔 쓰세요.");
      loadTemplates();
      loadStats();
    }
  };
  const deleteTemplate = async (id: string) => {
    if (!window.confirm("이 예약 상품과 생성된 모든 일정이 삭제돼요. 진행할까요?")) return;
    const res = await fetch(`/api/admin/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      flash("삭제했어요.");
      loadTemplates();
      loadStats();
    }
  };

  // ---- 주문 ----
  const cancelOrder = async (id: string) => {
    if (!window.confirm("이 주문을 강제 취소할까요?")) return;
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      flash("취소했어요.");
      loadOrders();
    }
  };

  // ---- 푸시 ----
  const sendBroadcast = async () => {
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: pushTitle, body: pushBody }),
    });
    if (res.ok) {
      const data = (await res.json()) as { sent: number; total: number };
      flash(`발송 완료 · ${data.sent}/${data.total}명`);
      setPushTitle("");
      setPushBody("");
    } else {
      flash("발송에 실패했어요.");
    }
  };

  if (authState === "checking") {
    return <div className="admin-root"><div className="admin-empty" style={{ margin: "auto" }}>확인 중…</div></div>;
  }
  if (authState === "denied") {
    return (
      <div className="admin-root">
        <div className="admin-empty" style={{ margin: "auto" }}>
          <p>접근 권한이 없어요.</p>
          <button className="admin-btn admin-btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/home")}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const meta = TAB_META[tab];
  const primaryAction =
    tab === "templates" ? (
      <button className="admin-btn admin-btn-primary" onClick={openTemplateCreate}>
        <Plus size={17} /> 예약 상품 만들기
      </button>
    ) : null;

  const sortedOrders = [...orders].sort((a, b) =>
    (a.meetings?.date ?? "").localeCompare(b.meetings?.date ?? ""),
  );

  return (
    <div className="admin-root">
      {/* 사이드바 */}
      <aside className="admin-side">
        <div className="admin-side-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_white.png" alt="모두의 모임" className="admin-side-brand-logo" />
        </div>
        <nav className="admin-side-nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              data-active={tab === key}
              onClick={() => setTab(key)}
              className="admin-side-link"
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/home" className="admin-side-link">
            <ArrowUpRight size={18} /> 사이트로 이동
          </Link>
        </div>
      </aside>

      {/* 메인 */}
      <div className="admin-main">
        <header className="admin-top">
          <div>
            <h1 className="admin-top-title">{meta.title}</h1>
            <p className="admin-top-sub">{meta.sub}</p>
          </div>
          {primaryAction}
        </header>

        <div className="admin-wrap">
          {/* 대시보드 */}
          {tab === "dashboard" && (
            <>
              <div className="admin-stats">
                <StatCard icon={<Package size={19} />} num={stats.templates} label="예약 상품" />
                <StatCard icon={<CalendarClock size={19} />} num={stats.upcomingSessions} label="예정 일정" />
                <StatCard icon={<Ticket size={19} />} num={stats.orders} label="총 주문" />
                <StatCard icon={<Users size={19} />} num={stats.subscribers} label="알림 구독자" />
              </div>

              <div className="admin-card">
                <div className="admin-card-head">
                  <span className="admin-card-title">최근 주문</span>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setTab("sales")}>
                    전체 보기
                  </button>
                </div>
                <OrdersTable orders={sortedOrders.slice(0, 6)} onCancel={cancelOrder} compact />
              </div>
            </>
          )}

          {/* 예약관리 */}
          {tab === "reservations" && <ReservationsPanel flash={flash} />}

          {/* 상품 */}
          {tab === "templates" && (
            <>
              {templates.length === 0 ? (
                <div className="admin-card">
                  <div className="admin-empty">
                    아직 예약 상품이 없어요. 우측 상단 <b>예약 상품 만들기</b>로 시작하세요.
                  </div>
                </div>
              ) : (
                <div className="admin-cards">
                  {templates.map((t) => (
                    <article key={t.id} className="admin-item">
                      <div className="admin-item-cover">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.image && <img src={t.image} alt={t.title} />}
                      </div>
                      <div className="admin-item-body">
                        <span className={`admin-badge admin-badge-${t.category}`}>
                          {categoryLabel(t.category)}
                        </span>
                        <p className="text-[15px] font-bold mt-2">{t.title}</p>
                        <p className="tds-caption mt-1">
                          {t.region_slug} · {t.age_group} · {formatKRW(t.price)} · 정원 {t.capacity}
                        </p>
                      </div>
                      <div className="admin-item-foot">
                        <Link href={`/admin/template/${t.id}`} className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }}>
                          <CalendarClock size={15} /> 일정관리
                        </Link>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" title="수정" onClick={() => openTemplateEdit(t)}>
                          <Pencil size={15} />
                        </button>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" title="복제" onClick={() => duplicateTemplate(t.id)}>
                          <Copy size={15} />
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" title="삭제" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 판매 */}
          {tab === "sales" && <SalesPanel flash={flash} />}

          {/* 유저 관리 */}
          {tab === "users" && <UsersPanel flash={flash} />}

          {/* 홈 배너 */}
          {tab === "banner" && <HomeBannerPanel flash={flash} />}

          {/* 푸시 */}
          {tab === "push" && (
            <div className="admin-card" style={{ maxWidth: 560 }}>
              <div className="admin-card-pad flex flex-col gap-3">
                <div className="admin-field">
                  <label className="admin-label">알림 제목</label>
                  <input className="admin-input" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="예: 이번 주 금요일 모임 오픈!" />
                </div>
                <div className="admin-field">
                  <label className="admin-label">알림 내용</label>
                  <textarea className="admin-textarea" value={pushBody} onChange={(e) => setPushBody(e.target.value)} placeholder="구독자에게 보낼 메시지" />
                </div>
                <button className="admin-btn admin-btn-primary" disabled={!pushTitle.trim() || !pushBody.trim()} onClick={sendBroadcast}>
                  <Send size={16} /> 전체 발송 ({stats.subscribers}명)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상품 모달 */}
      {templateModal.open && (
        <TemplateModal
          editing={Boolean(templateModal.editId)}
          form={templateForm}
          setForm={setTemplateForm}
          onClose={() => setTemplateModal({ open: false, editId: null })}
          onSubmit={saveTemplate}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#16181d",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            zIndex: 90,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, num, label }: { icon: React.ReactNode; num: number; label: string }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-icon">{icon}</div>
      <div className="admin-stat-num">{num.toLocaleString()}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function OrdersTable({
  orders,
  onCancel,
  compact,
}: {
  orders: Order[];
  onCancel: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>상태</th>
            <th>모임</th>
            {!compact && <th>옵션</th>}
            <th>일시</th>
            <th>신청자</th>
            {!compact && <th>연락처</th>}
            <th>금액</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={compact ? 6 : 9}>
                <div className="admin-empty">주문이 없어요.</div>
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <span className={`admin-badge admin-badge-${o.status}`}>{orderStatusLabel[o.status]}</span>
              </td>
              <td className="font-semibold text-[var(--text-primary)]">{o.meetings?.title ?? "모임"}</td>
              {!compact && (
                <td>
                  {o.option_label ? `${o.option_label} (${genderLabel(o.gender)})` : "-"}
                </td>
              )}
              <td>{o.meetings?.date ?? "-"}</td>
              <td>{o.buyer_name ?? "-"}</td>
              {!compact && <td>{o.buyer_phone ?? "-"}</td>}
              <td className="font-semibold">{formatKRW(o.amount)}</td>
              <td>
                {o.status !== "cancelled" && (
                  <div className="flex justify-end">
                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onCancel(o.id)}>
                      강제취소
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TemplateFormState = typeof emptyTemplate;
function TemplateModal({
  editing,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  form: TemplateFormState;
  setForm: (f: TemplateFormState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const backdrop = useBackdropClose(onClose);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "templates");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        setForm({ ...form, image: data.url });
      } else {
        window.alert("이미지 업로드에 실패했어요.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-modal-back" {...backdrop}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="admin-modal-head">
          <span className="admin-modal-title">{editing ? "예약 상품 수정" : "예약 상품 만들기"}</span>
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">카테고리</label>
              <select className="admin-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">지역</label>
              <select className="admin-select" value={form.regionSlug} onChange={(e) => setForm({ ...form, regionSlug: e.target.value })}>
                {regions.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">나이대</label>
            <input className="admin-input" list="age-presets" value={form.ageGroup} onChange={(e) => setForm({ ...form, ageGroup: e.target.value })} placeholder="예: 2039" />
            <datalist id="age-presets">
              {AGE_GROUP_PRESETS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="admin-field">
            <label className="admin-label">예약 상품명</label>
            <input className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 강남 와인 모임" required />
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">가격(원)</label>
              <input className="admin-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
            </div>
            <div className="admin-field">
              <label className="admin-label">정원</label>
              <input className="admin-input" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">장소</label>
            <input className="admin-input" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="예: 강남역 OO카페" />
          </div>
          <div className="admin-field">
            <label className="admin-label">상세 소개</label>
            <textarea className="admin-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* 대표사진 업로드 */}
          <div className="admin-field">
            <label className="admin-label">대표사진</label>
            <div className="tpl-image-row">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="대표사진" className="tpl-image-preview" />
              ) : (
                <div className="tpl-image-empty">없음</div>
              )}
              <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer" }}>
                {uploading ? "업로드 중…" : "사진 업로드"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* 홈 노출 설정 */}
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">홈 노출</label>
              <select
                className="admin-select"
                value={form.homeSection}
                onChange={(e) => setForm({ ...form, homeSection: e.target.value })}
              >
                <option value="">노출 안함</option>
                <option value="signature">시그니처 모임</option>
                <option value="premium">인증 모임</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">홈 뱃지 문구</label>
              <input
                className="admin-input"
                value={form.homeBadge}
                onChange={(e) => setForm({ ...form, homeBadge: e.target.value })}
                placeholder="예: 자연스러운 대화의 장"
              />
            </div>
          </div>
        </div>
        <div className="admin-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 2 }}>{editing ? "수정 저장" : "만들기"}</button>
        </div>
      </form>
    </div>
  );
}
