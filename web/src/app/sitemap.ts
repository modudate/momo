import type { MetadataRoute } from "next";
import { getAdminClient } from "@/lib/supabase/admin";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr";

// KST 오늘 (YYYY-MM-DD)
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/home`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/region/gangnam`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/region/hongdae`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/region/suwon`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/reviews`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/verify`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 다가오는 모임 상세 페이지 (지난 모임은 제외)
  let meetingPages: MetadataRoute.Sitemap = [];
  const admin = getAdminClient();
  if (admin) {
    const { data } = await admin
      .from("meetings")
      .select("id,date")
      .gte("date", todayKST())
      .order("date", { ascending: true })
      .limit(500)
      .returns<{ id: string; date: string }[]>();
    meetingPages = (data ?? []).map((m) => ({
      url: `${BASE}/meeting/${m.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  }

  return [...staticPages, ...meetingPages];
}
