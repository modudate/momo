import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FAQ, type FaqItem } from "@/data/faq";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "모두의 모임 이용에 대해 자주 묻는 질문을 모았습니다.",
};

// 관리자가 저장한 게 없으면 기본 질문을 보여준다
async function loadFaq(): Promise<FaqItem[]> {
  const admin = getAdminClient();
  if (!admin) return DEFAULT_FAQ;

  const { data } = await admin
    .from("site_content")
    .select("value")
    .eq("key", "faq")
    .maybeSingle<{ value: { items?: FaqItem[] } }>();

  const items = data?.value?.items;
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_FAQ;
  return items.filter((it) => it?.q?.trim());
}

// 카테고리 단위로 묶는다. 저장된 순서를 그대로 유지한다 (관리자가 정한 순서가 곧 노출 순서).
function groupByCategory(items: FaqItem[]): { category: string; items: FaqItem[] }[] {
  const groups: { category: string; items: FaqItem[] }[] = [];
  for (const item of items) {
    const category = item.c?.trim() ?? "";
    const last = groups[groups.length - 1];
    if (last && last.category === category) last.items.push(item);
    else groups.push({ category, items: [item] });
  }
  return groups;
}

export const revalidate = 60; // 관리자 수정은 최대 1분 내 반영

export default async function FaqPage() {
  const faqs = await loadFaq();

  return (
    <div className="app-main pb-10">
      <TopNav title="자주 묻는 질문" back />

      <div className="page-content pt-5">
        <h2 className="tds-title-lg">
          모두의 모임
          <br />
          자주 묻는 질문
        </h2>
        <p className="tds-caption mt-2">궁금한 점이 있으면 문의하기로 연락 주세요.</p>
      </div>

      {groupByCategory(faqs).map((group, gi) => (
        <section className="page-content pt-5" key={gi}>
          {group.category && <h3 className="faq-cat">{group.category}</h3>}
          <div className="faq-list">
            {group.items.map((item, i) => (
              <details key={i} className="faq-item" open={gi === 0 && i === 0}>
                <summary className="faq-q">
                  <span className="faq-mark">Q</span>
                  {item.q}
                </summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <SiteFooter />
    </div>
  );
}
