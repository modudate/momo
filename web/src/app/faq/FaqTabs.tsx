"use client";

import { useState } from "react";
import type { FaqItem } from "@/data/faq";

type Group = { category: string; items: FaqItem[] };

// 카테고리 탭 + 해당 카테고리의 질문 목록
export default function FaqTabs({ groups }: { groups: Group[] }) {
  const [active, setActive] = useState(0);

  // 카테고리가 하나도 없으면(구버전 데이터) 탭 없이 전부 나열
  const hasCategories = groups.some((g) => g.category);
  const current = groups[active] ?? groups[0];

  if (!hasCategories) {
    return (
      <section className="page-content pt-5">
        <FaqList items={groups.flatMap((g) => g.items)} />
      </section>
    );
  }

  return (
    <>
      <div className="faq-tabs" role="tablist" aria-label="자주 묻는 질문 분류">
        {groups.map((g, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className="faq-tab"
            data-active={i === active}
            onClick={() => setActive(i)}
          >
            {g.category}
          </button>
        ))}
      </div>

      <section className="page-content pt-4">
        <FaqList key={active} items={current?.items ?? []} />
      </section>
    </>
  );
}

function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <details key={i} className="faq-item" open={i === 0}>
          <summary className="faq-q">
            <span className="faq-mark">Q</span>
            {item.q}
          </summary>
          <p className="faq-a">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
