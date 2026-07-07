"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function TopNav({
  title,
  back = false,
  right,
}: {
  title: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="top-nav">
      {back && (
        <div className="top-nav-side top-nav-left">
          <button
            type="button"
            className="top-nav-icon"
            aria-label="뒤로"
            onClick={() => router.back()}
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
