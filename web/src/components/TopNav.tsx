"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function TopNav({
  title,
  back = false,
  backTo = "/home",
  right,
}: {
  title: React.ReactNode;
  back?: boolean;
  /** 뒤로 갈 히스토리가 없을 때 대신 갈 곳 */
  backTo?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  // router.back() 은 히스토리가 없으면 아무 일도 하지 않는다.
  // (탭의 첫 페이지로 바로 들어온 경우 — 모바일에서 링크/앱으로 진입하면 흔하다)
  // → 뒤로 가지지 않으면 대체 경로로 보낸다. 버튼이 먹통이 되는 일은 없어야 한다.
  const goBack = () => {
    let moved = false;
    const onPop = () => {
      moved = true;
    };
    window.addEventListener("popstate", onPop, { once: true });

    router.back();

    window.setTimeout(() => {
      window.removeEventListener("popstate", onPop);
      if (!moved) router.replace(backTo);
    }, 400);
  };

  return (
    <header className="top-nav">
      {back && (
        <div className="top-nav-side top-nav-left">
          <button
            type="button"
            className="top-nav-icon"
            aria-label="뒤로"
            data-backto={backTo}
            onClick={goBack}
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
        </div>
      )}
      <h1 className="top-nav-title">{title}</h1>
      {right && <div className="top-nav-side top-nav-right">{right}</div>}
    </header>
  );
}
