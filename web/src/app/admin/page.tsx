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
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  LayoutList,
} from "lucide-react";
import { regions, formatKRW } from "@/data/moim-data";
import { CATEGORIES, categoryLabel, AGE_GROUP_PRESETS } from "@/data/taxonomy";
import { useBackdropClose } from "@/lib/useBackdropClose";
import ReservationsPanel from "./ReservationsPanel";
import SalesPanel from "./SalesPanel";
import UsersPanel from "./UsersPanel";
import HomeBannerPanel from "./HomeBannerPanel";
import SectionsPanel, { type HomeSection } from "./SectionsPanel";
import ReviewsPanel from "./ReviewsPanel";
import { uploadImage } from "@/lib/uploadImage";

type AdminTab =
  | "dashboard"
  | "reservations"
  | "templates"
  | "sales"
  | "users"
  | "reviews"
  | "banner"
  | "sections"
  | "push";

type Template = {
  id: string;
  category: string;
  region_slug: string;
  age_group: string;
  title: string;
  description: string | null;
  card_note: string | null;
  place: string | null;
  price: number;
  capacity: number;
  image: string | null;
  home_section: string | null;
  home_badge: string | null;
  home_label: string | null;
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
  cardNote: "",
  image: "",
  homeSection: "",
  homeBadge: "",
  homeLabel: "",
};

const NAV: { key: AdminTab; label: string; icon: typeof Package }[] = [
  { key: "dashboard", label: "판매내역", icon: LayoutDashboard },
  { key: "reservations", label: "예약관리", icon: CalendarRange },
  { key: "templates", label: "예약 상품", icon: Package },
  { key: "sales", label: "매출분석", icon: Ticket },
  { key: "users", label: "유저 관리", icon: Users },
  { key: "reviews", label: "후기 관리", icon: MessageSquare },
  { key: "banner", label: "홈 배너", icon: ImageIcon },
  { key: "sections", label: "홈 카테고리", icon: LayoutList },
  { key: "push", label: "푸시 알림", icon: Bell },
];

const TAB_META: Record<AdminTab, { title: string; sub: string }> = {
  dashboard: { title: "판매 내역", sub: "주문 검색·필터·상세·CSV 내보내기" },
  reservations: { title: "예약 일정 관리", sub: "지점별·모임별 예약 현황 한눈에 · 일정 클릭 시 성별 명단" },
  templates: { title: "예약 상품", sub: "예약 상품(모임 프로그램) 관리 · 복제 · 일정 생성" },
  sales: { title: "매출 분석", sub: "일·주·월 매출 비교 대시보드" },
  users: { title: "유저 관리", sub: "회원 목록 + 블랙리스트 관리" },
  reviews: { title: "후기 관리", sub: "회원이 남긴 후기 확인 · 부적절한 글 삭제" },
  banner: { title: "홈 배너", sub: "메인 상단 슬라이드 이미지·문구 관리" },
  sections: { title: "홈 카테고리", sub: "홈에 노출되는 모임 섹션 추가·이름수정·순서" },
  push: { title: "푸시 알림", sub: "전체 구독자에게 발송" },
};

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking");
  const [tab, setTabState] = useState<AdminTab>("dashboard");

  // 탭을 URL(?tab=)에 동기화 — 상세 페이지 갔다가 뒤로가기 해도 보던 탭으로 복원
  useEffect(() => {
    const readTab = () => {
      const t = new URLSearchParams(window.location.search).get("tab");
      setTabState(t && TAB_META[t as AdminTab] ? (t as AdminTab) : "dashboard");
    };
    readTab();
    window.addEventListener("popstate", readTab);
    return () => window.removeEventListener("popstate", readTab);
  }, []);

  const setTab = (t: AdminTab) => {
    setTabState(t);
    window.history.replaceState(window.history.state, "", t === "dashboard" ? "/admin" : `/admin?tab=${t}`);
  };
  const [toast, setToast] = useState("");
  const [sideCollapsed, setSideCollapsed] = useState(false); // 사이드바 접기

  const [stats, setStats] = useState<Stats>({ templates: 0, upcomingSessions: 0, orders: 0, subscribers: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<HomeSection[]>([]); // 홈 카테고리 (상품 폼 선택지)

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
  const loadSections = useCallback(async () => {
    const res = await fetch("/api/admin/sections");
    if (res.ok) setSections((await res.json()).sections);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/session");
      const data = (await res.json().catch(() => ({ isAdmin: false }))) as { isAdmin: boolean };
      if (!data.isAdmin) {
        router.replace("/admin/login");
        return;
      }
      setAuthState("ok");
      loadStats();
      loadTemplates();
      loadSections();
    })();
  }, [loadStats, loadTemplates, loadSections]);

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
      cardNote: t.card_note ?? "",
      image: t.image ?? "",
      homeSection: t.home_section ?? "",
      homeBadge: t.home_badge ?? "",
      homeLabel: t.home_label ?? "",
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
    // 미로그인은 /admin/login 으로 보내므로 여기 올 일은 거의 없음 (전환 중 폴백)
    return <div className="admin-root"><div className="admin-empty" style={{ margin: "auto" }}>확인 중…</div></div>;
  }

  const meta = TAB_META[tab];
  const primaryAction =
    tab === "templates" ? (
      <button className="admin-btn admin-btn-primary" onClick={openTemplateCreate}>
        <Plus size={17} /> 예약 상품 만들기
      </button>
    ) : null;

  return (
    <div className="admin-root">
      {/* 사이드바 */}
      <aside className={`admin-side ${sideCollapsed ? "is-collapsed" : ""}`}>
        <div className="admin-side-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {!sideCollapsed && (
            <img src="/logo_white.png" alt="모두의 모임" className="admin-side-brand-logo" />
          )}
          <button
            type="button"
            className="admin-side-toggle"
            title={sideCollapsed ? "사이드바 펼치기" : "사이드바 숨기기"}
            onClick={() => setSideCollapsed((v) => !v)}
          >
            {sideCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
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
              <Icon size={18} /> {!sideCollapsed && label}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/home" className="admin-side-link">
            <ArrowUpRight size={18} /> {!sideCollapsed && "사이트로 이동"}
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
          {/* 대시보드 = 판매 내역 */}
          {tab === "dashboard" && <SalesPanel flash={flash} mode="list" />}

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
                        {/* 1줄: 주요 동작 */}
                        <div className="admin-item-actions">
                          <Link href={`/admin/template/${t.id}`} className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }}>
                            <CalendarClock size={15} /> 일정관리
                          </Link>
                          {t.home_section && (
                            <Link href={`/admin/template/${t.id}/detail`} className="admin-btn admin-btn-ghost admin-btn-sm" style={{ flex: 1 }} title="홈 상세페이지 편집">
                              <Pencil size={15} /> 홈 상세
                            </Link>
                          )}
                        </div>
                        {/* 2줄: 관리 도구 */}
                        <div className="admin-item-tools">
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openTemplateEdit(t)}>
                            <Pencil size={14} /> 수정
                          </button>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => duplicateTemplate(t.id)}>
                            <Copy size={14} /> 복제
                          </button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteTemplate(t.id)}>
                            <Trash2 size={14} /> 삭제
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 판매 */}
          {tab === "sales" && <SalesPanel flash={flash} mode="analytics" />}

          {/* 유저 관리 */}
          {tab === "users" && <UsersPanel flash={flash} />}

          {/* 후기 관리 */}
          {tab === "reviews" && <ReviewsPanel flash={flash} />}

          {/* 홈 배너 */}
          {tab === "banner" && <HomeBannerPanel flash={flash} />}

          {/* 홈 카테고리 */}
          {tab === "sections" && <SectionsPanel flash={flash} />}

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
          sections={sections}
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

type TemplateFormState = typeof emptyTemplate;
function TemplateModal({
  editing,
  form,
  setForm,
  onClose,
  onSubmit,
  sections,
}: {
  editing: boolean;
  form: TemplateFormState;
  setForm: (f: TemplateFormState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  sections: HomeSection[];
}) {
  const backdrop = useBackdropClose(onClose);
  const [uploading, setUploading] = useState(false);

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, "templates");
      setForm({ ...form, image: url });
    } catch {
      window.alert("이미지 업로드에 실패했어요.");
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
            <label className="admin-label">카드 문구 (일정 목록의 회색 한 줄)</label>
            <input
              className="admin-input"
              value={form.cardNote}
              onChange={(e) => setForm({ ...form, cardNote: e.target.value })}
              placeholder="예: 연령대를 선택해 신청하세요"
            />
            <p className="admin-hint">
              지점 일정 목록에서 모임 이름 아래에 회색으로 한 줄 나와요.
            </p>
          </div>
          <div className="admin-field">
            <label className="admin-label">상세 소개</label>
            <textarea
              className="admin-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="신청 페이지의 '모임 소개'에 그대로 나와요. 여기서 고치면 이 상품의 모든 일정에 바로 반영됩니다."
            />
            <p className="admin-hint">신청 페이지의 &apos;모임 소개&apos; 본문에 쓰여요.</p>
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
                    if (f) pickImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* 홈 노출 설정 */}
          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-label">홈 카테고리</label>
              <select
                className="admin-select"
                value={form.homeSection}
                onChange={(e) => setForm({ ...form, homeSection: e.target.value })}
              >
                <option value="">노출 안함</option>
                {sections.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
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
          <div className="admin-field">
            <label className="admin-label">홈 카드 라벨 (주황 글씨)</label>
            <input
              className="admin-input"
              value={form.homeLabel}
              onChange={(e) => setForm({ ...form, homeLabel: e.target.value })}
              placeholder="비우면 카테고리 기본 라벨 사용 (예: 인기남녀)"
            />
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
