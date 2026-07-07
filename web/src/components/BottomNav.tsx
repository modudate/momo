"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, BadgeCheck, MessageSquare, User } from "lucide-react";
import { useUser } from "@/components/auth/useUser";

// 하단 탭바를 보여줄 고객 메인 화면들
function shouldShow(pathname: string) {
  return (
    pathname === "/home" ||
    pathname.startsWith("/region") ||
    pathname === "/verify" ||
    pathname === "/contact" ||
    pathname === "/mypage" ||
    pathname === "/login"
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const user = useUser();
  const visible = shouldShow(pathname);

  // 바가 보일 때만 본문 하단 여백 확보 (콘텐츠가 바에 가리지 않게)
  useEffect(() => {
    if (visible) {
      document.body.classList.add("with-bottom-nav");
      return () => document.body.classList.remove("with-bottom-nav");
    }
  }, [visible]);

  if (!visible) return null;

  const tabs = [
    {
      key: "home",
      href: "/home",
      label: "홈",
      icon: Home,
      active: pathname === "/home" || pathname.startsWith("/region"),
    },
    { key: "verify", href: "/verify", label: "인증", icon: BadgeCheck, active: pathname === "/verify" },
    { key: "contact", href: "/contact", label: "문의", icon: MessageSquare, active: pathname === "/contact" },
    {
      key: "my",
      href: user ? "/mypage" : "/login",
      label: user ? "마이" : "로그인",
      icon: User,
      active: pathname === "/mypage" || pathname === "/login",
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link key={t.key} href={t.href} className="bottom-nav-item" data-active={t.active}>
            <Icon size={21} strokeWidth={2.1} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
